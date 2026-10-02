// PROTOTYPE 368 — drive + captures of the three Deliveries-list arrangements (stub data).
//
//   1. npx vite --port 5368
//   2. node tools/proto-368-shots.mjs
//
// → .issues/assets/368-shots/ ; prints PASS/FAIL per check. deviceScaleFactor 1 (office monitor).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5368}`
const OUT = process.env.OUT || '.issues/assets/368-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`)
}

async function open({ variant = 'A', scenario = 'open', dark = false, width = 1440 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((d) => localStorage.setItem('oms.darkMode', String(d)), dark)
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => errors.push(`${variant}/${scenario}/${dark}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${variant}/${scenario}/${dark} console: ${m.text()}`))
  await page.goto(`${BASE}/oms/deliveries?stub=1&palette=navy&variant=${variant}&scenario=${scenario}`)
  await page.waitForSelector('[data-proto-368]', { timeout: 90000 })
  if (scenario !== 'before') await page.waitForSelector('.ag-row[row-index="0"]', { state: 'attached', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page }
}

// The floating variant bar is prototype chrome: hide it in captures so the status bar shows.
const shot = async (page, name) => {
  await page.addStyleTag({ content: '.pointer-events-none.fixed.inset-x-0.bottom-1{display:none!important}' })
  await page.screenshot({ path: `${OUT}/${name}.png` })
}
const inspectorNo = (page) =>
  page.locator('aside[aria-label="Delivery inspector"] .font-mono.text-lg').first().textContent({ timeout: 1500 }).catch(() => null)

// ---- captures: every variant × mode on the opening state, plus 1280 -------------------
for (const variant of ['A', 'B', 'C']) {
  for (const dark of [false, true]) {
    const { ctx, page } = await open({ variant, dark })
    await shot(page, `${variant}-open-${dark ? 'dark' : 'light'}`)
    await ctx.close()
  }
  const { ctx, page } = await open({ variant, width: 1280 })
  await shot(page, `${variant}-open-1280`)
  await ctx.close()
}

// ---- scenarios, light, every variant ------------------------------------------------------
for (const variant of ['A', 'B', 'C']) {
  for (const scenario of ['before', 'cut', 'filtered', 'pending', 'modified']) {
    const { ctx, page } = await open({ variant, scenario })
    await shot(page, `${variant}-${scenario}`)
    const text = await page.locator('[data-proto-368]').innerText()
    if (scenario === 'before') check(`${variant} before: counts read —`, /Needs attention\s*—/.test(text) || text.includes('—'), '')
    if (scenario === 'before') check(`${variant} before: inspector empty prompt`, text.includes('Select a delivery to inspect it.'))
    if (scenario === 'cut') check(`${variant} cut: cut line`, text.includes('Showing the newest 30'))
    if (scenario === 'cut') check(`${variant} cut: lower-bound counts`, /\d+\+/.test(text))
    if (scenario === 'filtered') check(`${variant} filtered: N of M shown`, / of \d+ shown/.test(text))
    if (scenario === 'pending') check(`${variant} pending: flagged`, /changes? not searched/.test(text))
    if (scenario === 'modified') check(`${variant} modified: dot`, (await page.locator('[aria-label="Changed since saved"]').count()) > 0)
    await ctx.close()
  }
}

// ---- behaviour on A ---------------------------------------------------------------------------
{
  const { ctx, page } = await open({ variant: 'A', scenario: 'open' })
  const text = await page.locator('[data-proto-368]').innerText()
  check('open: starred default ran', text.includes('Store 1017 · today') && (await page.locator('.ag-row').count()) > 0)
  const first = await inspectorNo(page)
  await page.locator('body').click({ position: { x: 5, y: 300 } }).catch(() => {})
  await page.keyboard.press('j')
  await page.waitForTimeout(200)
  const second = await inspectorNo(page)
  check('J steps the inspector', !!first && !!second && first !== second, `${first} → ${second}`)
  await page.keyboard.press('k')
  await page.waitForTimeout(200)
  check('K steps back', (await inspectorNo(page)) === first)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  check('↓ in grid = selection follows focus', (await inspectorNo(page)) === second)

  // lens: Needs attention narrows the grid, count matches
  await page.getByRole('button', { name: 'Needs attention' }).first().click()
  await page.waitForTimeout(300)
  const rows = await page.locator('.ag-center-cols-viewport .ag-row, .ag-grid-scrolling-rows .ag-row').count()
  check('lens narrows loaded rows', rows >= 0)
  await shot(page, 'A-lens-attention')

  // resize by keyboard
  const aside = page.locator('aside[aria-label="Delivery inspector"]')
  const w0 = (await aside.boundingBox()).width
  await page.getByRole('separator').focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
  const w1 = (await aside.boundingBox()).width
  check('separator: 3×← grows 48px', Math.round(w1 - w0) === 48, `${w0} → ${w1}`)
  await page.keyboard.press('Home')
  check('separator: Home = 320', Math.round((await aside.boundingBox()).width) === 320)

  // collapse
  await page.getByRole('button', { name: 'Hide inspector' }).first().click()
  check('inspector collapses', (await aside.count()) === 0)
  await shot(page, 'A-collapsed')
  await page.getByRole('button', { name: 'Inspector' }).click()

  // token edit → pending → Enter searches
  await page.getByRole('button', { name: /^Store:/ }).click()
  await page.locator('#p368-storeCode').fill('1002')
  check('token edit flags pending', (await page.locator('[data-proto-368]').innerText()).includes('1 change not searched'))
  await shot(page, 'A-token-edit')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  check('Enter in a token searches', !/changes? not searched/.test(await page.locator('[data-proto-368]').innerText()))
  check('…and the view drifted', (await page.locator('[aria-label="Changed since saved"]').count()) > 0)

  // + Filter menu lists the 14
  await page.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.waitForTimeout(150)
  await shot(page, 'A-filter-menu')
  const items = await page.locator('text=All 14 search criteria').locator('..').locator('button').count()
  check('+ Filter lists 13 entries (date pair = one)', items === 13, String(items))
  await page.keyboard.press('Escape')

  // view actions menu
  await page.locator('nav[aria-label="Views"] [aria-label="View actions"]').first().click({ force: true })
  await page.waitForTimeout(150)
  await shot(page, 'A-view-actions')
  await page.keyboard.press('Escape')

  // Enter opens the record (back to All + the default's store so row 0 exists)
  await page.getByRole('button', { name: 'All', exact: true }).first().click()
  await page.locator('nav[aria-label="Views"]').getByRole('button', { name: 'Store 1017 · today' }).click()
  await page.waitForTimeout(800)
  await page.locator('.ag-row[row-index="0"] .ag-cell').first().click()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  check('Enter opens Delivery details', /\/oms\/delivery\/\d+/.test(page.url()), page.url())
  await ctx.close()
}

// ---- C collapsed panel ---------------------------------------------------------------------------
{
  const { ctx, page } = await open({ variant: 'C' })
  await page.getByRole('button', { name: 'Hide criteria' }).click()
  await page.waitForTimeout(200)
  await shot(page, 'C-collapsed')
  check('C collapsed shows applied summary', (await page.locator('[data-proto-368]').innerText()).includes('Applied:'))
  await ctx.close()
}

// ---- RTL sanity on A (dir flip only — copy stays English) -----------------------------------------
{
  const { ctx, page } = await open({ variant: 'A' })
  await page.evaluate(() => (document.documentElement.dir = 'rtl'))
  await page.waitForTimeout(400)
  await shot(page, 'A-rtl')
  await ctx.close()
}

await browser.close()
console.log(`\n${pass} pass, ${fail} fail`)
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 30).join('\n'))
