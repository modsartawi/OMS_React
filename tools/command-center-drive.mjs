// oms 946 (BackOffice spec 4165) — drive of the Retail Command Center home against stubs (BO 4176 is unbuilt).
// Manual tool, not a CI gate: `npx vite --port 5199` in one shell, `node tools/command-center-drive.mjs` in another.
//
// Contract the stubs follow (`src/core/models/command-center.ts`, ⚠ proposed):
//   GET Auth/Permissions        → screens + extras.commandCenterOn (the `CommandCenter:Home` switch, decisions §2)
//   GET CommandCenter/Home?lang → `tools/command-center-stubs.mjs` home(lang)
//
// Scenarios:
//   1. Analytics:03 + switch on: the leaf shows; the brief opens in English; open/folded sections; the status line's
//      red dot; links; no raw keys.
//   2. The language switch: Arabic asked of the server, the page right to left, the shell left to right.
//   3. Switch off: no leaf, no home call, the not-switched-on sentence.
//   4. (947) The map half: the region table, the filter changing it, the not-on-map count; a pharmacy code in the brief
//      opens the scorecard panel with six measures and the store profile link; closing it. The stub sends no `maps`
//      key, so the map says it cannot be drawn (the live Google walk is owed: BO 4176 unbuilt).
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
import { home, mapPart, scorecard } from './command-center-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/analytics/command-center'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')
const rawKey = (text) => text.match(/\b(?:command-center:)?(?:brief|status|access|offer|lang|menu|map|regions|scorecard)\.[a-zA-Z.-]+\b/)

const browser = await chromium.launch()

async function open(keys, extras) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.split('/api/')[1]
    calls.push({ path, params: Object.fromEntries(url.searchParams) })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'drive', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys, extras))
    if (path === 'CommandCenter/Home') return route.fulfill(envelope(home(url.searchParams.get('lang'), mapPart(url.searchParams.get('lang')))))
    if (path === 'CommandCenter/Scorecard') return route.fulfill(envelope(scorecard(url.searchParams.get('storeCode'), url.searchParams.get('lang'))))
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

try {
  {
    const { page, context, errors, calls } = await open(['Analytics:03'], { commandCenterOn: true })
    await page.goto(ROOT)
    await page.waitForSelector('[data-cc-brief]')
    const body = strip(await page.locator('body').innerText())
    check('1. the menu offers the command center', (await page.locator('a[href="/analytics/command-center"]').count()) > 0)
    check('1. the home is asked in English', calls.some((c) => c.path === 'CommandCenter/Home' && c.params.lang === 'en'))
    check('1. the page is left to right', (await page.locator('[data-cc-page]').getAttribute('dir')) === 'ltr')
    const folded = await page.locator('[data-cc-folded="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-cc-section')))
    check('1. four sections folded', JSON.stringify(folded) === JSON.stringify(['slipped', 'products', 'categories', 'omni']), JSON.stringify(folded))
    check('1. each folded section shows its summary', body.includes('3 pharmacies slipped, 2 improved.') && body.includes('Not available this morning'))
    check('1. the four headline figures', ['SAR 12.4 m', '182,340', 'SAR 68.10', '9,812'].every((f) => body.includes(f)))
    const dot = await page.locator('[data-cc-run="product-health"] [data-dot]').getAttribute('data-dot')
    check('1. the failed run shows a red dot', dot === 'red')
    check('1. a pharmacy code is a link to its scorecard', (await page.locator('a[href="/analytics/command-center?store=P166&lang=en"]').count()) === 1)
    check('1. no raw keys', !rawKey(body), String(rawKey(body)))
    await page.click('[data-cc-section="products"] summary')
    check('1. the folded not-available section opens on its last good date', strip(await page.locator('[data-cc-section="products"]').innerText()).includes('2026-11-19'))
    await page.screenshot({ path: process.env.DRIVE_SHOTS ? `${process.env.DRIVE_SHOTS}/cc-en.png` : 'cc-en.png', fullPage: true }).catch(() => {})

    await page.click('[data-cc-lang="ar"]')
    await page.waitForFunction(() => document.querySelector('[data-cc-page]')?.getAttribute('dir') === 'rtl')
    await page.waitForSelector('text=المزيد في موجز اليوم')
    const ar = strip(await page.locator('[data-cc-page]').innerText())
    check('2. the switch asks the server for Arabic', calls.some((c) => c.path === 'CommandCenter/Home' && c.params.lang === 'ar'))
    check('2. the URL keeps the language', new URL(page.url()).searchParams.get('lang') === 'ar', page.url())
    check('2. the brief reads as the server wrote it in Arabic', ar.includes('أُشّرت حديثًا'))
    check('2. the shell stays left to right', (await page.evaluate(() => document.documentElement.dir || 'ltr')) === 'ltr')
    check('2. no raw keys in Arabic', !rawKey(ar), String(rawKey(ar)))
    await page.screenshot({ path: process.env.DRIVE_SHOTS ? `${process.env.DRIVE_SHOTS}/cc-ar.png` : 'cc-ar.png', fullPage: true }).catch(() => {})
    check('1-2. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { page, context, calls } = await open(['Analytics:03'], { commandCenterOn: false })
    await page.goto(ROOT)
    await page.waitForSelector('text=The command center is not switched on')
    check('3. switch off: the page says so', true)
    check('3. switch off: the home is never asked', !calls.some((c) => c.path === 'CommandCenter/Home'))
    check('3. switch off: no menu leaf', (await page.locator('a[href="/analytics/command-center"]').count()) === 0)
    await context.close()
  }
  {
    const { page, context, errors, calls } = await open(['Analytics:03'], { commandCenterOn: true })
    await page.goto(ROOT)
    await page.waitForSelector('[data-cc-regions]')
    const centre = () => page.locator('[data-cc-region="Center"]').innerText().then(strip)
    check('4. the region table: all issues', (await centre()).includes('260') && (await centre()).includes('38%'))
    check('4. the map cannot be drawn without a key, and says so', (await page.locator('[data-cc-map-cannot-draw]').count()) === 1)
    check('4. a pharmacy without coordinates is counted under the map', strip(await page.locator('[data-cc-not-on-map]').innerText()).includes('1'))
    await page.click('[data-cc-filter="stock"]')
    await page.waitForFunction(() => new URL(location.href).searchParams.get('filter') === 'stock')
    check('4. the stock filter changes the table', (await centre()).includes('258') && (await centre()).includes('9%'))
    await page.click('[data-cc-section="changed"] a[href*="store=P166"]')
    await page.waitForSelector('[data-cc-scorecard="P166"] [data-cc-measures]')
    check('4. a pharmacy code in the brief opens its scorecard', calls.some((c) => c.path === 'CommandCenter/Scorecard' && c.params.storeCode === 'P166'))
    check('4. six measures', (await page.locator('[data-cc-scorecard="P166"] [data-cc-measure]').count()) === 6)
    check('4. the store profile link', (await page.locator('[data-cc-open-profile]').getAttribute('href')) === '/analytics/command-center/store/P166?lang=en')
    const panelText = strip(await page.locator('[data-cc-scorecard="P166"]').innerText())
    check('4. no raw keys in the panel', !rawKey(panelText), String(rawKey(panelText)))
    await page.screenshot({ path: process.env.DRIVE_SHOTS ? `${process.env.DRIVE_SHOTS}/cc-scorecard.png` : 'cc-scorecard.png', fullPage: true }).catch(() => {})
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !new URL(location.href).searchParams.has('store'))
    check('4. closing the panel takes the pharmacy out of the URL', (await page.locator('[data-cc-scorecard]').count()) === 0)
    check('4. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
