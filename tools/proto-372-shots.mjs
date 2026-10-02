// PROTOTYPE 372 — the Simulation price waterfall on the live app (stubbed Pricing/Simulate).
//
//   1. npx vite --port 5372
//   2. OUT=../oms-react/.issues/assets/372-shots node tools/proto-372-shots.mjs
//
// deviceScaleFactor 1, like 362: the 12px rows are judged in real pixels.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5372}`
const OUT = process.env.OUT || '.issues/assets/372-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []

async function shot(name, { wf, cap, scale = 'line', dark = false, rtl = false, open = [], width = 1440 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((d) => localStorage.setItem('oms.darkMode', String(d)), dark)
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`))
  await page.goto(`${BASE}/pricing/simulation?stub=1&palette=navy&wf=${wf}&scale=${scale}&cap=${cap}`)
  const material = page.locator('table input').first()
  await material.waitFor({ timeout: 90000 })
  await material.fill('200706')
  await page.keyboard.press('Control+Enter')
  await page.waitForSelector('tr[data-result-line]')
  await page.evaluate(() => document.querySelector('[data-proto-bar]')?.remove())
  if (rtl) await page.evaluate(() => (document.documentElement.dir = 'rtl'))
  for (const n of open) await page.locator(`tr[data-result-line="${n}"]`).click()
  await page.mouse.move(5, 5)
  await page.waitForTimeout(300)
  await page.evaluate(() => document.querySelector('[data-proto-bar]')?.remove())
  const area = page.locator('[data-sim-work-area]')
  await area.screenshot({ path: `${OUT}/${name}.png` })
  await ctx.close()
  console.log('✓', name)
}

const S = [
  ['A-ledger-06-light', { wf: 'ledger', cap: '06', open: [10, 20] }],
  ['A-ledger-06-dark', { wf: 'ledger', cap: '06', open: [10, 20], dark: true }],
  ['A-ledger-06-rtl', { wf: 'ledger', cap: '06', open: [10, 20], rtl: true }],
  ['A-ledger-05-light', { wf: 'ledger', cap: '05', open: [10, 20] }],
  ['A-ledger-buyget-light', { wf: 'ledger', cap: 'buyget', open: [10, 20, 30] }],
  ['A-ledger-buyget-dark', { wf: 'ledger', cap: 'buyget', open: [10, 20, 30], dark: true }],
  ['A-ledger-many-line', { wf: 'ledger', cap: 'many', open: [10, 40, 50, 80] }],
  ['A-ledger-many-basket', { wf: 'ledger', cap: 'many', scale: 'basket', open: [10, 40, 50, 80] }],
  ['A-ledger-04b-light', { wf: 'ledger', cap: '04b', open: [10, 20] }],
  ['A-ledger-06-960', { wf: 'ledger', cap: '06', open: [10, 20], width: 1180 }],
  ['B-beside-06-light', { wf: 'beside', cap: '06', open: [10, 20] }],
  ['C-pane-06-light', { wf: 'pane', cap: '06', open: [] }],
  ['C-pane-many-light', { wf: 'pane', cap: 'many', open: [60] }],
  ['today-06-light', { wf: 'off', cap: '06', open: [10, 20] }],
]
const only = process.env.ONLY
for (const [name, opts] of S) if (!only || name.includes(only)) await shot(name, opts)

await browser.close()
if (errors.length) {
  console.log('page errors:\n' + errors.join('\n'))
  process.exit(1)
}
