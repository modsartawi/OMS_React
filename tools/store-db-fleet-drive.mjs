// Store database fleet drive (oms 915, BackOffice spec 4016 D10, door 4030/4031) — drives the REAL Store database tab
// in Chromium against STUBBED `StoreDatabase/*` envelopes (`tools/store-db-stubs.mjs`, fixture
// `src/features/admin/sync-console/store-db/__fixtures__/fleet.json`), shaped to the GUESSED contract.
// 🚩 NOTHING here is driven against a live SIS.Api.
//
// It verifies:
//   1. with StoreDatabase:03 the console's nav carries Store database, and it opens /admin/sync/database;
//   2. the fleet is listed worst state first, then fewest days to cap, no forecast last;
//   3. each row's state chip names the door's state (Not checked never green); an unknown state reads raw;
//   4. the used / cap bar fills to the share of the store's own cap, and reads "used / cap" as one value;
//      a store with no cap or no reading draws no bar;
//   5. the state, engine and edition filters narrow the list, together;
//   6. Needs 2019 lists only the 4 GB-cap stores, nearest the cap first, with its note;
//   7. a store's code opens its database page (916's shell) and its back link returns;
//   8. without StoreDatabase:03 the tab is not in the nav, and the hand-typed URL shows the denial;
//   9. a failed Fleet read shows the error, not an empty list;
//  10. under Arabic (RTL) the bar mirrors: it grows from the inline start. (Arabic words: store-db/locales.test.ts.)
//
//   1. run the app:  npx vite --port 5199      (or any port: DRIVE_PORT=5215)
//   2. node tools/store-db-fleet-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { refusal, storeDbRoute } from './store-db-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.store-db-fleet-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const VIEW = ['ActionSyncConsole:03', 'StoreDatabase:03']
const browser = await chromium.launch()

async function open(path, { screens = VIEW, overrides = {}, locale = 'en' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((lng) => {
    localStorage.setItem('oms.locale', lng)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', storeDbRoute({ screens, overrides }))
  await page.goto(`${BASE}${path}`)
  return { context, page, errors }
}

const GRID = '[data-tab-grid="store-db-fleet"]'
const rowIds = (page) =>
  page.locator(`${GRID} .ag-row[row-id]`).evaluateAll((rows) => {
    // One id per row index: a row renders once per column container.
    const byIndex = new Map(rows.map((r) => [Number(r.getAttribute('row-index')), r.getAttribute('row-id')]))
    return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, id]) => id)
  })
const cell = (page, code, col) => page.locator(`${GRID} .ag-row[row-id="${code}"] [col-id="${col}"]`).first()
const plain = (s) => s.replace(/[\u2066-\u2069\u200e\u200f]/g, '').trim()
const settle = (page) => page.waitForTimeout(250)

// ── 1–7: a holder of the View grant ──────────────────────────────────────────────
{
  // From another console page (the Scripts list answers the stubs' generic empty page; the Fleet page needs its own doors).
  const { context, page, errors } = await open('/admin/sync/scripts')
  const link = page.locator('[data-console-page="database"]')
  await link.waitFor({ timeout: 15000 })
  check('1. the console nav carries Store database', (await link.innerText()).trim() === 'Store database')
  await link.click()
  await page.locator(`${GRID} .ag-row`).first().waitFor({ timeout: 15000 })
  check('1. …and it opens /admin/sync/database', new URL(page.url()).pathname === '/admin/sync/database', page.url())

  const order = await rowIds(page)
  check('2. worst state first, then fewest days to cap, no forecast last',
    JSON.stringify(order) === JSON.stringify(['P014', 'P221', 'C011', 'P300', 'P102', 'P050', 'P007', 'P900']), order.join(','))

  const chip = async (code) => plain(await cell(page, code, 'state').innerText())
  check('3. state chips name the door\'s state',
    (await chip('P014')) === 'Critical' && (await chip('C011')) === 'Disk low' && (await chip('P102')) === 'Watch' && (await chip('P050')) === 'OK',
    [await chip('P014'), await chip('C011'), await chip('P102'), await chip('P050')].join(','))
  const notChecked = cell(page, 'P300', 'state').locator('span span').first()
  const ncClass = (await notChecked.getAttribute('class')) ?? ''
  check('3. …Not checked reads so and is never drawn green', (await chip('P300')) === 'Not checked' && !/success/.test(ncClass), ncClass)
  check('3. …an unknown state reads raw', (await chip('P900')) === 'Overheated')

  const bar = (code) => cell(page, code, 'used').locator('[data-used-bar]').getAttribute('data-used-bar')
  check('4. the bar fills to the share of the store\'s own cap', (await bar('P014')) === '95' && (await bar('P102')) === '72.5' && (await bar('P050')) === '40',
    [await bar('P014'), await bar('P102'), await bar('P050')].join(','))
  check('4. …no bar without a cap or a reading', (await bar('C011')) === '' && (await bar('P300')) === '')
  const used = plain(await cell(page, 'P014', 'used').innerText())
  check('4. …"used / cap" reads as one value', used === '3.8 GB / 4.0 GB', used)
  const noCap = plain(await cell(page, 'C011', 'used').innerText())
  check('4. …a store with no cap says so', noCap === '20.0 GB · No cap', noCap)
  const share = plain(await cell(page, 'P102', 'usedShare').innerText())
  const drive = plain(await cell(page, 'P014', 'driveFreeKb').innerText())
  check('4. …share, drive free, bitness and taken at are drawn', share === '72.5%' && drive === '30.0 GB' &&
    plain(await cell(page, 'P221', 'is64Bit').innerText()) === '32-bit' && /2026/.test(await cell(page, 'P014', 'takenAt').innerText()), `${share} ${drive}`)
  check('4. …and the shown line counts the fleet', plain(await page.locator('[data-store-db-shown]').innerText()) === 'Showing 8 of 8 stores')
  await page.screenshot({ path: `${SHOTS}/fleet.png`, fullPage: true })

  await page.locator('[data-filter-state]').selectOption('Critical')
  await settle(page)
  check('5. the state filter narrows the list', JSON.stringify(await rowIds(page)) === '["P014","P221"]', (await rowIds(page)).join(','))
  await page.locator('[data-filter-state]').selectOption('')
  await page.locator('[data-filter-engine]').selectOption('2008')
  await page.locator('[data-filter-edition]').selectOption('Express Edition')
  await settle(page)
  check('5. …engine and edition filter together', JSON.stringify(await rowIds(page)) === '["P221","P007"]', (await rowIds(page)).join(','))
  check('5. …and the shown line follows', plain(await page.locator('[data-store-db-shown]').innerText()) === 'Showing 2 of 8 stores')
  await page.locator('[data-filter-state]').selectOption('DiskLow')
  await settle(page)
  check('5. …a filter matching nothing says so', plain(await page.locator('[data-tab-empty="store-db-fleet"]').innerText()) === 'No store matches these filters.')
  await page.locator('[data-filter-state]').selectOption('')
  await page.locator('[data-filter-engine]').selectOption('')
  await page.locator('[data-filter-edition]').selectOption('')

  await page.locator('[data-needs-2019]').click()
  await settle(page)
  check('6. Needs 2019: only the 4 GB-cap stores, nearest the cap first',
    JSON.stringify(await rowIds(page)) === '["P014","P221","P102","P300","P007"]', (await rowIds(page)).join(','))
  check('6. …with its note, and the chip pressed', (await page.locator('[data-needs-2019-note]').count()) === 1 &&
    (await page.locator('[data-needs-2019]').getAttribute('aria-pressed')) === 'true')
  await page.screenshot({ path: `${SHOTS}/needs-2019.png`, fullPage: true })
  await page.locator('[data-needs-2019]').click()

  await page.locator('[data-store-db-link="P014"]').click()
  await page.locator('[data-store-db-page="P014"]').waitFor({ timeout: 10000 })
  check('7. a store\'s code opens its database page', new URL(page.url()).pathname === '/admin/sync/database/P014')
  await page.locator('[data-store-db-back]').click()
  await page.locator(`${GRID} .ag-row`).first().waitFor({ timeout: 10000 })
  check('7. …and its back link returns to the fleet', new URL(page.url()).pathname === '/admin/sync/database')
  check('no page errors (fleet)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: no View grant ─────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/scripts', { screens: ['ActionSyncConsole:03', 'ActionSyncConsole:06', 'StoreDatabase:06'] })
  await page.locator('[data-console-page="scripts"]').waitFor({ timeout: 15000 })
  check('8. without StoreDatabase:03 the tab is not in the nav', (await page.locator('[data-console-page="database"]').count()) === 0)
  await page.goto(`${BASE}/admin/sync/database`)
  await page.getByText('No access to the store databases').waitFor({ timeout: 15000 })
  check('8. …and the hand-typed URL shows the denial, no grid', (await page.locator(GRID).count()) === 0)
  await page.screenshot({ path: `${SHOTS}/denied.png`, fullPage: true })
  check('no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: the Fleet read fails ──────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database', {
    overrides: { Fleet: refusal('SERVER', 'The HQ reading table is unreachable.', 500) },
  })
  await page.getByText('The HQ reading table is unreachable.').waitFor({ timeout: 15000 })
  check('9. a failed Fleet read shows the error, not an empty list', (await page.locator('[data-tab-empty="store-db-fleet"]').count()) === 0)
  check('no page errors (failed read)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: Arabic ───────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database', { locale: 'ar' })
  await page.locator(`${GRID} .ag-row`).first().waitFor({ timeout: 15000 })
  // The app is still `lng: 'en'` (core/i18n.ts): the Arabic bundle is shipped and pinned by `store-db/locales.test.ts`,
  // but only the direction follows `oms.locale` until Arabic is switched on. So this checks the RTL layout.
  check('10. under Arabic the page lays out right to left', (await page.locator('html').getAttribute('dir')) === 'rtl')
  const box = await cell(page, 'P014', 'used').locator('[data-used-bar] > span').first().boundingBox()
  const cellBox = await cell(page, 'P014', 'used').boundingBox()
  check('10. …and the bar grows from the inline start (the right)', !!box && !!cellBox && Math.abs(box.x + box.width - (cellBox.x + cellBox.width)) < 20,
    box && cellBox ? `bar end ${Math.round(box.x + box.width)} cell end ${Math.round(cellBox.x + cellBox.width)}` : 'no box')
  await page.screenshot({ path: `${SHOTS}/fleet-ar.png`, fullPage: true })
  check('no page errors (Arabic)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
