// PROTOTYPE drive — ticket 747, NATIVE variant. Screenshots the native builder (our own controls +
// recharts over Metabase OSS /api/dataset) inside the real shell. oms-react's /api is stubbed;
// Metabase on :3000 is REAL. Run: `npx vite --port 5199` then this.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199'
const OUT = 'C:/Playground/oms-react-proto747/.issues/assets/747-shots'
mkdirSync(OUT, { recursive: true })
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: null, data }) })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
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

const waitChart = async () => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForSelector('.recharts-surface, table', { timeout: 30000 }).catch((e) => console.log('no chart', e.message))
  await page.waitForTimeout(2500)
}
async function shot(name) {
  await waitChart()
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

// 1. default: Till sales value by city, last 30 days → row/bar chart
await page.goto(BASE + '/prototype/analytics?variant=native&scenario=en')
await shot('native-en')

// 2. a clean monthly trend → single line: drop City, group by month, 12 months
const selWith = (optText) => page.locator('select', { has: page.locator('option', { hasText: optText }) })
await page.getByRole('button', { name: 'City', exact: true }).click().catch(() => {}) // deselect City dim
await selWith('By month').selectOption('month').catch((e) => console.log('grain', e.message))
await selWith('Last 12 months').selectOption('12m').catch((e) => console.log('period', e.message))
await shot('native-trend')

// 3. Orders by channel → pie
await page.getByRole('tab', { name: 'Orders' }).click().catch(() => {})
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Channel' }).click().catch(() => {})
await shot('native-orders-channel')

// 4. Arabic scenario (shell RTL; native UI is our own i18n/RTL, not Metabase's)
await page.goto(BASE + '/prototype/analytics?variant=native&scenario=ar')
await shot('native-ar')

console.log('errors', errors.slice(0, 12))
await browser.close()
