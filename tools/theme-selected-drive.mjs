// Targeted review of the owner-selected combination. Run npm run prototype:theme first.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const { chromium } = createRequire('C:/Playground/frontend/package.json')('playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
const errors = [], checks = []
page.on('pageerror', e => errors.push(String(e)))
const check = (name, pass) => { checks.push({name,pass}); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`) }
const url = 'http://127.0.0.1:5198/oms/deliveries?variant=selected'
const dir = '.issues/assets/355-theme-review'
for (const mode of ['light', 'dark']) {
  await page.goto(`${url}&mode=${mode}`)
  await page.waitForSelector('.ag-row')
  check(`${mode}: selected label`, await page.getByRole('button',{name:'Selected',exact:true}).count() === 1)
  check(`${mode}: steel palette`, await page.evaluate(expected => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() === expected, mode === 'light' ? '#2f63a6' : '#6ba0e8'))
  check(`${mode}: compact composition`, await page.locator('.prototype-C.prototype-selected .prototype-command-strip').count() === 1)
  check(`${mode}: five common fields`, await page.locator('.prototype-common-filters input').count() === 5)
  const cell = page.getByRole('gridcell').filter({hasText:/^8000048$/})
  await cell.dblclick({position:{x:25,y:14}})
  await page.keyboard.press('Control+c')
  check(`${mode}: native text copy`, await page.evaluate(() => navigator.clipboard.readText()) === '8000048')
  check(`${mode}: compact rows`, await page.locator('.ag-row').first().evaluate(e => e.getBoundingClientRect().height === 28))
  await page.screenshot({path:`${dir}/selected-${mode}.png`,fullPage:true})
  await page.getByRole('button',{name:'All filters',exact:true}).click()
  check(`${mode}: all fourteen fields`, await page.locator('form input:visible, form select:visible').count() === 14)
  await page.getByLabel('Document No',{exact:true}).fill('2000080421')
  await page.getByRole('button',{name:'Search sample',exact:true}).click()
  check(`${mode}: search leaves panel open`, await page.getByRole('button',{name:/^Fewer filters/}).getAttribute('aria-expanded') === 'true')
  await page.getByRole('button',{name:'Clear all',exact:true}).click()
  await page.screenshot({path:`${dir}/selected-${mode}-all-filters.png`,fullPage:true})
}
await page.getByRole('button',{name:'RTL',exact:true}).click()
await page.waitForSelector('.ag-rtl')
check('RTL pinned identity', await page.getByRole('gridcell').filter({hasText:/^8000048$/}).evaluate(e => Math.abs(e.getBoundingClientRect().right - document.querySelector('.ag-root-wrapper').getBoundingClientRect().right) < 3))
await page.screenshot({path:`${dir}/selected-dark-rtl.png`,fullPage:true})
await page.setViewportSize({width:390,height:844})
await page.goto(url)
await page.waitForSelector('.ag-row')
check('Mobile switcher fits viewport', await page.locator('.prototype-switcher').evaluate(e => e.scrollWidth <= e.clientWidth))
check('Mobile page fits viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
await page.getByRole('button',{name:'All filters',exact:true}).click()
await page.screenshot({path:`${dir}/selected-mobile-all-filters.png`,fullPage:true})
check('Mobile expanded filters fit viewport', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
check('No browser errors', errors.length === 0)
writeFileSync(`${dir}/selected-verification.json`,JSON.stringify({checks,errors},null,2)+'\n')
await browser.close()
if(checks.some(c => !c.pass)) process.exitCode=1
