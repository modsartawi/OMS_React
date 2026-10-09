// Focus-on-arrival drive — the screens that start with typing put the caret in their box on
// landing, whether opened by URL or through the Ctrl+K palette (owner request 2026-10-09; GS1
// check had it since 454, the rest added alongside this drive). Manual run, like every drive:
//
//   npx vite --port 5244 --strictPort          (SIS_API unset = the local SIS.Api on :5111)
//   DRIVE_PORT=5244 SIS_USER=<id> SIS_PASS=<pw> node tools/focus-on-arrival-drive.mjs
//
// Needs a session that can open every screen listed (ADMIN). A palette run waits for the
// palette's rows: a gated leaf (GS1 check) appears only once its access probe has answered.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const BASE = `http://localhost:${process.env.DRIVE_PORT || 5244}`
const SCREENS = [
  ['/materials/gs1', '[data-gs1-scan]'],
  ['/materials', '[data-material-q]'],
  ['/materials/stock', '[data-stock-materials]'],
  ['/loy/members', 'input[placeholder]'],
  ['/pricing/coupon-support', 'input[type=text]'],
  ['/pricing/bonus-buy-download', '#bby-numbers'],
  ['/oms/central-invoice', '#central-invoice-list'],
  ['/collection/settlement', '[data-testid=settlement-search]'],
  ['/collection/settlement/ledger', '[data-testid=ledger-entry]'],
  ['/pricing/bonus-buy-inquiry', 'input[inputmode=numeric]'],
]
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 950 } })
await context.request.post(`${BASE}/api/Auth/Login`, { headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' }, data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' } })
const page = await context.newPage()
await page.addInitScript(() => { localStorage.setItem('oms.locale', 'en'); localStorage.setItem('oms.railExpanded', 'true') })
let fails = 0
const focused = async (sel) => {
  await page.locator(sel).first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(300)
  return page.evaluate((s) => { const el = document.querySelector(s); return !!el && document.activeElement === el }, sel)
}
const report = (how, route, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${how.padEnd(7)} ${route} ${extra}`) }
for (const [route, sel] of SCREENS) {
  await page.goto(`${BASE}${route}`)
  report('direct', route, await focused(sel))
  // label for the palette, from the rail link (may be inside a collapsed group)
  const label = (await page.locator(`a[href="${route}"]`).first().innerText().catch(() => '')).trim()
  // menu: from home, click the rail link (expanding its group if needed)
  await page.goto(`${BASE}/`); await page.locator('nav').first().waitFor()
  const link = page.locator(`a[href="${route}"]`).first()
  if (await link.isVisible().catch(() => false)) { await link.click(); report('menu', route, await focused(sel)) }
  else console.log(`SKIP  menu    ${route} (link not visible from home)`)
  // palette: from home, Ctrl+K + label + Enter
  if (label) {
    await page.goto(`${BASE}/`); await page.locator('nav').first().waitFor(); await page.waitForTimeout(3000)
    await page.keyboard.press('Control+k'); await page.waitForTimeout(300)
    await page.keyboard.type(label); await page.waitForTimeout(1200); await page.keyboard.press('Enter')
    await page.waitForURL((u) => u.pathname === route, { timeout: 10000 }).catch(() => {})
    const at = new URL(page.url()).pathname
    report('palette', route, at === route && await focused(sel), at === route ? `("${label}")` : `landed ${at} ("${label}")`)
  } else console.log(`SKIP  palette ${route} (no menu label)`)
}
console.log(fails ? `${fails} FAIL` : 'all green')
await browser.close(); process.exit(fails ? 1 : 0)
