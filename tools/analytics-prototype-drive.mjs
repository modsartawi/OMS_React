// PROTOTYPE drive — ticket 747. Screenshots the embedded-Metabase prototype inside the real shell.
// oms-react's own /api is stubbed (no SIS.Api here); Metabase on :3000 is REAL (local OSS,
// localhost evaluation mode, synthetic data). Run: `npx vite --port 5199` then this.
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

async function shot(name, url, wait) {
  await page.goto(BASE + url)
  await wait()
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(12000)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

const settle = (sel) => () => page.waitForSelector(sel, { timeout: 60000 }).catch((e) => console.log('wait miss', sel, e.message))
await shot('board-en', '/prototype/analytics?variant=board&scenario=en', settle('text=Value through our tills by city'))
await shot('explore-en', '/prototype/analytics?variant=explore&scenario=en', settle('text=HQ analytics — saved views'))
await page.goto(BASE + '/prototype/analytics?variant=ask&scenario=en')
await page.getByRole('button', { name: 'HungerStation orders in Riyadh by day, last 30 days' }).click({ timeout: 60000 })
await page.waitForSelector('text=I understood:', { timeout: 60000 })
await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(12000)
await page.screenshot({ path: `${OUT}/ask-en.png` })
console.log('shot ask-en')
await shot('board-ar', '/prototype/analytics?variant=board&scenario=ar', settle('text=HQ board'))
console.log('errors', errors.slice(0, 12))
await browser.close()
