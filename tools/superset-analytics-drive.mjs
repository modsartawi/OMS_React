// PROTOTYPE drive — ticket 754, SUPERSET variant. Embedded Apache Superset inside the real shell.
// oms-react's /api is stubbed; Superset (Docker, 10.211.55.2:8088) is REAL.
// Run: `npx vite --port 5199` then `node tools/superset-analytics-drive.mjs`.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199'
const OUT = 'C:/Playground/oms-react-proto747/.issues/assets/754-shots'
mkdirSync(OUT, { recursive: true })
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: null, data }) })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)))
await page.route(`${BASE}/api/**`, (route) => {
  const p = new URL(route.request().url()).pathname.split('/api/')[1]
  if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
  if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
  return route.fulfill(envelope([]))
})

const frame = async () => {
  await page.waitForSelector('.ss-embed iframe', { timeout: 30000 })
  const f = page.frameLocator('.ss-embed iframe')
  await f.locator('.chart-container, .dashboard-component-chart-holder').first().waitFor({ timeout: 60000 }).catch((e) => console.log('no chart', e.message))
  await page.waitForTimeout(9000) // let every chart query land
  return f
}
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name) }

const t0 = Date.now()
await page.goto(BASE + '/prototype/analytics?variant=superset&scenario=en')
let f = await frame()
console.log('first paint ms', Date.now() - t0)
await shot('superset-en')

// cross-filter: click the first bar of "Sales by region" — the host's observeDataMask strip should update
const bar = f.locator('.dashboard-component-chart-holder', { hasText: 'Sales by region' }).locator('canvas, svg').first()
const box = await bar.boundingBox().catch(() => null)
if (box) { await page.mouse.click(box.x + box.width * 0.12, box.y + box.height * 0.75); await page.waitForTimeout(6000) }
console.log('mask strip:', await page.locator('[data-testid=ss-mask]').innerText())
await shot('superset-crossfilter')

// theme off, for contrast with the DMSCO-themed embed
await page.goto(BASE + '/prototype/analytics?variant=superset&scenario=en')
f = await frame()
await page.getByRole('button', { name: /DMSCO theme/ }).click()
await page.waitForTimeout(2500)
await shot('superset-en-stock-theme')

// Arabic: our shell is RTL; the Superset dashboard has Arabic names + Arabic store names
await page.goto(BASE + '/prototype/analytics?variant=superset&scenario=ar')
f = await frame()
await shot('superset-ar')

// filter bar opened (native filters) — how its own chrome renders
await f.locator('[data-test="filter-bar__expand-button"], [data-test="filter-bar__collapsable"]').first().click({ timeout: 5000 }).catch((e) => console.log('filter bar', e.message.slice(0, 120)))
await page.waitForTimeout(2500)
await shot('superset-ar-filters')

console.log('errors', errors.slice(0, 12))
await browser.close()
