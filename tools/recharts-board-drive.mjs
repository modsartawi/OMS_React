// PROTOTYPE drive — map 741, Recharts board variant. oms-react /api stubbed; Metabase :3000 REAL.
// Run: `npx vite --port 5199` then `node tools/recharts-board-drive.mjs`.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const BASE = 'http://localhost:5199'
const OUT = 'C:/Playground/oms-react-proto747/.issues/assets/747-shots'
mkdirSync(OUT, { recursive: true })
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: null, data }) })
const browser = await chromium.launch()
const errors = []
async function run(name, scenario, theme, full = true) {
  const context = await browser.newContext({ viewport: { width: 1600, height: full ? 2300 : 1000 }, colorScheme: theme })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(name + ': ' + String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(name + ': ' + m.text().slice(0, 300)))
  await page.route(`${BASE}/api/**`, (route) => {
    const p = new URL(route.request().url()).pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })
  if (theme) await page.addInitScript((t) => { try { localStorage.setItem('oms.darkMode', String(t === 'dark')) } catch {} }, theme)
  await page.goto(`${BASE}/prototype/analytics?variant=recharts&scenario=${scenario}`)
  await page.waitForSelector('.recharts-surface', { timeout: 60000 })
  await page.waitForFunction(() => !document.body.innerText.includes('refreshing…'), null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  const main = page.locator('main')
  // full board: expand main so the whole scroll area is captured
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) { m.style.overflow = 'visible'; m.style.flex = 'none' } document.querySelectorAll('*').forEach((e) => { const s = getComputedStyle(e); if (s.overflowY === 'auto' && e.tagName !== 'MAIN') {} }) })
  await page.screenshot({ path: `${OUT}/recharts-${name}.png`, fullPage: false })
  // hover tooltip on the stacked bar
  const bars = page.locator('.recharts-bar-rectangle').nth(30)
  if (await bars.count()) { await bars.hover().catch(() => {}); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/recharts-${name}-tooltip.png` }) }
  console.log('shot', name, 'dark=', await page.evaluate(() => document.documentElement.classList.contains('dark')))
  await context.close()
}
await run('en', 'en', 'light')
await run('ar', 'ar', 'light')
await run('en-dark', 'en', 'dark')
console.log('errors', errors.slice(0, 15))
await browser.close()
