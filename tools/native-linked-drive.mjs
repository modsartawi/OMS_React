// PROTOTYPE drive — ticket 747, linked board. Default view + click a store row → cross-filter all.
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
const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForSelector('.recharts-surface', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(2500) }

async function shot(name, scenario) {
  await page.goto(`${BASE}/prototype/analytics?variant=linked&scenario=${scenario}`)
  await settle()
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}
await shot('linked-en', 'en')

// click a store row (not the selected) → cross-filter
await page.locator('tbody tr').nth(2).click().catch((e) => console.log('row', e.message))
await settle()
await page.screenshot({ path: `${OUT}/linked-focus.png` })
console.log('shot linked-focus')

await shot('linked-ar', 'ar')
console.log('errors', errors.slice(0, 10))
await browser.close()
