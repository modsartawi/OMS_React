// PROTOTYPE 363 — captures of the rail-shell variants on the real app (stubbed data).
//
//   1. npx vite --port 5199
//   2. node tools/proto-363-shots.mjs
//
// → .issues/assets/363-shots/ (copied by hand into the main checkout's assets).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OUT = process.env.OUT || '.issues/assets/363-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
const shots = []
const facts = []

async function open(shell, { dark = false, rtl = false, cmd = false, width = 1440, height = 900, clear = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await ctx.addInitScript(
    ([d, c]) => {
      localStorage.setItem('oms.darkMode', String(d))
      if (c) {
        localStorage.removeItem('proto363.c.panel')
        localStorage.removeItem('proto363.d.expanded')
      }
    },
    [dark, clear],
  )
  const page = await ctx.newPage()
  page.setDefaultTimeout(5000)
  page.setDefaultNavigationTimeout(90000)
  page.on('pageerror', (e) => errors.push(`${shell}: ${e}`))
  const q = `?stub=1&palette=navy&shell=${shell}&rtl=${rtl ? 1 : 0}&cmd=${cmd ? 1 : 0}`
  return { ctx, page, q }
}

async function deliveries(page, q) {
  await page.goto(BASE + '/oms/deliveries' + q)
  const load = page.getByRole('button', { name: /load/i }).first()
  await load.waitFor({ timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await load.click().catch(() => {})
  await page.waitForSelector('.ag-row[row-index="5"]', { state: 'attached', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function snap(page, name) {
  await page.addStyleTag({ content: '[data-proto-bar]{display:none!important}' }).catch(() => {})
  await page.screenshot({ path: `${OUT}/${name}` })
  shots.push(name)
}

for (const shell of ['today', 'A', 'B', 'C', 'D']) {
  for (const dark of [false, true]) {
    const { ctx, page, q } = await open(shell, { dark, cmd: shell !== 'today' })
    await deliveries(page, q)
    await snap(page, `${shell}-deliveries-${dark ? 'dark' : 'light'}.png`)
    if (shell !== 'today' && !dark) {
      // flyout / panel switch: open the Collections group from the rail
      const btn = page.locator('[data-rail] button[aria-haspopup]').nth(5)
      await btn.click().catch(() => {})
      await page.waitForTimeout(300)
      await snap(page, `${shell}-group-open-light.png`)
      // where the rail's active marker actually sits (logical check)
      const m = await page.evaluate(() => {
        const a = document.querySelector('[data-rail] [data-active]')
        const r = document.querySelector('[data-rail]')?.getBoundingClientRect()
        if (!a || !r) return null
        const before = getComputedStyle(a, '::before')
        const b = a.getBoundingClientRect()
        return { railX: r.x, btnX: b.x, before: before.insetInlineStart, bg: before.backgroundColor }
      })
      facts.push({ shell, marker: m })
    }
    await ctx.close()
  }
  if (shell !== 'today') {
    const { ctx, page, q } = await open(shell, { rtl: true, cmd: true })
    await deliveries(page, q)
    await snap(page, `${shell}-deliveries-rtl.png`)
    await ctx.close()
    // a deep page under a sub-group: the crumb + marker
    const s2 = await open(shell, { cmd: false })
    await s2.page.goto(BASE + '/oms/document/1000000393' + s2.q)
    await s2.page.waitForTimeout(2500)
    await snap(s2.page, `${shell}-document-light.png`)
    await s2.ctx.close()
    // narrow office width
    const s3 = await open(shell, { width: 1100, cmd: true })
    await deliveries(s3.page, s3.q)
    await snap(s3.page, `${shell}-1100-light.png`)
    await s3.ctx.close()
  }
}

// phone: one capture of the shared drawer
{
  const { ctx, page, q } = await open('A', { width: 390, height: 800 })
  await page.goto(BASE + '/oms/deliveries' + q)
  await page.waitForTimeout(2500)
  await snap(page, `phone-390.png`)
  await page.getByRole('button', { name: /toggle menu/i }).click().catch(() => {})
  await page.waitForTimeout(300)
  await snap(page, `phone-390-drawer.png`)
  await ctx.close()
}

// D expanded at 1100 (overlay peek) — expand from the rail
{
  const { ctx, page, q } = await open('D', { width: 1100 })
  await deliveries(page, q)
  await page.getByRole('button', { name: 'Expand menu' }).click().catch(() => {})
  await page.waitForTimeout(300)
  await snap(page, `D-1100-peek-light.png`)
  await ctx.close()
}

// user menu from the rail (A) and from the top bar (C)
for (const shell of ['A', 'C']) {
  const { ctx, page, q } = await open(shell)
  await page.goto(BASE + '/oms/deliveries' + q)
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: /account menu/i }).click().catch(() => {})
  await page.waitForTimeout(250)
  await snap(page, `${shell}-user-menu.png`)
  await ctx.close()
}

await browser.close()
console.log(`${shots.length} shots → ${OUT}`)
console.log('facts', JSON.stringify(facts, null, 1))
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 15).join('\n  '))
