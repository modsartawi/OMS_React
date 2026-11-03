// PROTOTYPE drive — ticket 747, native drill-through. Click a bar → break down by store.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const BASE = 'http://localhost:5199'
const OUT = 'C:/Playground/oms-react-proto747/.issues/assets/747-shots'
mkdirSync(OUT, { recursive: true })
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: null, data }) })
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
await page.route(`${BASE}/api/**`, (route) => {
  const p = new URL(route.request().url()).pathname.split('/api/')[1]
  if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'm', currentStoreCode: 'P001' }))
  if (/Access$/.test(p)) return route.fulfill(envelope({ allowed: true, canOpen: true, screenAllowed: true }))
  return route.fulfill(envelope([]))
})
const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForSelector('.recharts-surface', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1800) }

await page.goto(BASE + '/prototype/analytics?variant=native&scenario=en')
await settle()
// click the top bar (Riyadh)
await page.locator('.recharts-bar-rectangle').first().click({ force: true })
await page.waitForTimeout(800)
await page.screenshot({ path: `${OUT}/native-drill-pick.png` })
console.log('shot native-drill-pick')
// break down by store
await page.getByRole('button', { name: /Break down by store/ }).click().catch((e) => console.log('break', e.message))
await settle()
await page.screenshot({ path: `${OUT}/native-drill-stores.png` })
console.log('shot native-drill-stores')
console.log('errors', errors.slice(0, 10))
await browser.close()
