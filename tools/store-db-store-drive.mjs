// Store database store-page drive (oms 916, BackOffice spec 4016, door 4031) — drives the REAL store page in Chromium
// against STUBBED `StoreDatabase/*` envelopes (`tools/store-db-stubs.mjs`, fixtures
// `src/features/admin/sync-console/store-db/__fixtures__/store.json` + `store-not-checked.json`), shaped to the GUESSED
// contract. 🚩 NOTHING here is driven against a live SIS.Api.
//
// It verifies:
//   1. the page asks `GET StoreDatabase/Store?code=` for its store, and its header names code, name, state, read time;
//   2. the panel strip shows the mounted panels (Readings today), and an unknown `?panel=` falls back to the first;
//   3. the latest reading reads in plain words: engine, cap, used of cap, allocated, free inside the file, log,
//      recovery model, drive free, machine, uptime, last backup;
//   4. days to cap reads with the growth rate and window behind it;
//   5. the daily history draws two charts: files (used, allocated, log + the cap) and drive free;
//   6. the 10 largest tables are listed in the server's order, sizes in their unit;
//   7. the side copies are not on Readings (918 moved them to Space);
//   8. a store read on its last attempt shows no Not checked banner;
//   9. a Not checked store shows the banner with the last error, and its chip says so;
//  10. an unknown store (NO_STORE) shows the not-found card; another failure shows its error;
//  11. without StoreDatabase:03 the page shows the denial and asks no door;
//  12. Refresh asks the Store door again;
//  13. under Arabic (RTL) the page lays out right to left and the chart box stays left to right.
//
//   1. run the app:  npx vite --port 5199      (or any port: DRIVE_PORT=5216)
//   2. node tools/store-db-store-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { envelope, fixture, refusal, storeDbRoute } from './store-db-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.store-db-store-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const VIEW = ['ActionSyncConsole:03', 'StoreDatabase:03']
const browser = await chromium.launch()

async function open(path, { screens = VIEW, overrides = {}, locale = 'en' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((lng) => {
    localStorage.setItem('oms.locale', lng)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', storeDbRoute({ screens, overrides, calls }))
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, calls }
}

const plain = (s) => s.replace(/[\u2066-\u2069\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim()
const text = async (loc) => plain(await loc.innerText())
const line = (page, key) => page.locator(`[data-reading-line="${key}"] dd`)
const storeCalls = (calls) => calls.filter((c) => c.startsWith('StoreDatabase/Store'))

// ── 1–8, 12: a read store ────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('/admin/sync/database/P104?panel=nope')
  await page.locator('[data-readings-panel]').waitFor({ timeout: 15000 })
  check('1. the page asks the Store door for its store', storeCalls(calls)[0] === 'StoreDatabase/Store?code=P104', storeCalls(calls).join(','))
  const header = await text(page.locator('[data-store-db-header]'))
  check('1. …the header names code, name, state and read time', /P104/.test(header) && /Riyadh Olaya 3/.test(header) && /Watch/.test(header) &&
    /Read at 2026-11-18 04:10/.test(header), header)

  check('2. the strip shows the mounted panels, Readings first', (await page.locator('[data-store-db-panels]').getAttribute('data-store-db-panels')).split(' ')[0] === 'readings')
  check('2. …an unknown ?panel= opens the first', (await page.locator('[data-panel-open]').getAttribute('data-panel-open')) === 'readings')

  check('3. the reading has its 11 lines', (await page.locator('[data-reading-line]').count()) === 11)
  const engine = await text(line(page, 'engine'))
  check('3. …engine with version, edition and bitness', engine === '2008 R2 · 10.50.6000.34 SP3 · Express Edition · 64-bit', engine)
  const used = await text(line(page, 'used'))
  check('3. …used against the cap', used === '3.0 GB, 75% of the cap', used)
  const cap = await text(line(page, 'cap'))
  const allocated = await text(line(page, 'allocated'))
  const free = await text(line(page, 'freeInFile'))
  check('3. …cap, allocated and free inside the file', cap === '4.0 GB' && allocated === '3.3 GB' && free === '256 MB', `${cap} | ${allocated} | ${free}`)
  const log = await text(line(page, 'log'))
  check('3. …log used of its size', log === '60 MB used of 512 MB', log)
  const drive = await text(line(page, 'driveFree'))
  check('3. …drive free on its drive', drive === '18.0 GB on D:', drive)
  const rm = await text(line(page, 'recoveryModel'))
  const machine = await text(line(page, 'machine'))
  check('3. …recovery model and machine', rm === 'SIMPLE' && machine === 'P104-POS01', `${rm} | ${machine}`)
  const uptime = await text(line(page, 'uptime'))
  check('3. …uptime from the SQL start to the reading', uptime === '15 days, 21 hours', uptime)
  const backup = await text(line(page, 'lastBackup'))
  check('3. …last backup with its size', backup === '2026-11-17 02:15, 2.8 GB', backup)

  const days = await text(page.locator('[data-days-to-cap]'))
  const rate = await text(page.locator('[data-growth-rate]'))
  check('4. days to cap with the growth behind it', days === '41 days to the cap' && rate === 'Growing 12 MB a day over the last 14 days', `${days} | ${rate}`)

  await page.locator('[data-history-chart="files"] .recharts-line').first().waitFor({ timeout: 10000 })
  const fileLines = await page.locator('[data-history-chart="files"] .recharts-line').count()
  const driveLines = await page.locator('[data-history-chart="drive"] .recharts-line').count()
  check('5. the files chart draws used, allocated, log and the cap', fileLines === 4, String(fileLines))
  const legend = await text(page.locator('[data-history-chart="files"] .recharts-legend-wrapper'))
  check('5. …named in its legend', /Used/.test(legend) && /Allocated/.test(legend) && /Log/.test(legend) && /Cap/.test(legend), legend)
  check('5. …and drive free draws on its own chart', driveLines === 1, String(driveLines))
  check('5. …over the 7 kept days', (await page.locator('[data-store-db-history]').getAttribute('data-store-db-history')) === '7')

  const TABLES = '[data-tab-grid="store-db-tables"]'
  const firstRow = page.locator(`${TABLES} .ag-row[row-index="0"]`)
  const tableName = await text(firstRow.locator('[col-id="tableName"]').first())
  const reserved = await text(firstRow.locator('[col-id="reservedKb"]').first())
  const rows = await text(firstRow.locator('[col-id="rows"]').first())
  check('6. the 10 largest tables, largest first', (await page.locator('[data-store-db-tables]').getAttribute('data-store-db-tables')) === '10' &&
    tableName === 'dbo.SalesLine' && reserved === '1.1 GB' && rows === '8,412,093', `${tableName} ${reserved} ${rows}`)

  // The side copies moved to the Space panel (oms 918; `tools/store-db-space-drive.mjs` check 4).
  check('7. the side copies are not on Readings (they are on Space)', (await page.locator('[data-store-db-side-copies]').count()) === 0)
  check('8. a store read on its last attempt shows no Not checked banner', (await page.locator('[data-not-checked]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/store.png`, fullPage: true })

  const before = storeCalls(calls).length
  await page.locator('[data-store-db-refresh]').click()
  await page.waitForTimeout(500)
  check('12. Refresh asks the Store door again', storeCalls(calls).length === before + 1, `${before} → ${storeCalls(calls).length}`)
  check('no page errors (store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: a store not checked ───────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104', {
    overrides: { Store: () => envelope(fixture('store-not-checked')) },
  })
  await page.locator('[data-not-checked]').waitFor({ timeout: 15000 })
  const banner = await text(page.locator('[data-not-checked]'))
  check('9. Not checked shows the banner with the attempt time', /Not checked/.test(banner) && /2026-11-18 04:10/.test(banner), banner)
  const error = await text(page.locator('[data-not-checked-error]'))
  check('9. …and the last error', /The wait operation timed out\./.test(error) && /Last error/.test(error), error)
  check('9. …and the chip reads Not checked', (await text(page.locator('[data-store-db-state]'))) === 'Not checked')
  check('9. …the last good reading still shows below', (await page.locator('[data-reading-line]').count()) === 11)
  await page.screenshot({ path: `${SHOTS}/not-checked.png`, fullPage: true })
  check('no page errors (not checked)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: no such store, and a failed read ─────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/ZZZ9', {
    overrides: { Store: refusal('NO_STORE', 'No store ZZZ9.', 404) },
  })
  await page.locator('[data-no-store]').waitFor({ timeout: 15000 })
  check('10. an unknown store shows the not-found card, no panels', (await page.locator('[data-store-db-panels]').count()) === 0)
  check('no page errors (no store)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open('/admin/sync/database/P104', {
    overrides: { Store: refusal('SERVER', 'The HQ reading table is unreachable.', 500) },
  })
  await page.getByText('The HQ reading table is unreachable.').waitFor({ timeout: 15000 })
  check('10. …another failure shows its error, no header', (await page.locator('[data-store-db-header]').count()) === 0)
  check('no page errors (failed read)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11: no View grant ────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('/admin/sync/database/P104', { screens: ['ActionSyncConsole:03'] })
  await page.getByText('No access to the store databases').waitFor({ timeout: 15000 })
  check('11. without StoreDatabase:03 the page shows the denial and asks no door', storeCalls(calls).length === 0)
  check('no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: Arabic ───────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104', { locale: 'ar' })
  await page.locator('[data-history-chart="files"] .recharts-line').first().waitFor({ timeout: 15000 })
  // The app is still `lng: 'en'`: the Arabic words are pinned by `store-db/locales.test.ts`; this checks the layout.
  check('13. under Arabic the page lays out right to left', (await page.locator('html').getAttribute('dir')) === 'rtl')
  const boxDir = await page.locator('[data-history-chart="files"] [dir="ltr"]').count()
  check('13. …and the chart box stays left to right (it mirrors by props)', boxDir > 0)
  await page.screenshot({ path: `${SHOTS}/store-ar.png`, fullPage: true })
  check('no page errors (Arabic)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
