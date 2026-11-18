// Store database Live activity / Health check / Check now drive (oms 917, BackOffice spec 4016, door 4032) — drives the
// REAL store page in Chromium against STUBBED `StoreDatabase/*` envelopes (`tools/store-db-stubs.mjs`, fixtures
// `src/features/admin/sync-console/store-db/__fixtures__/live-activity.json`, `health-check.json`, `check-now.json`),
// shaped to the GUESSED contract. 🚩 NOTHING here is driven against a live SIS.Api.
//
// It verifies:
//   1. the strip shows Readings, Live activity and Health check;
//   2. Live activity asks `GET StoreDatabase/LiveActivity?code=` and draws its four tables with their rows, and the
//      time of the look;
//   3. Look again takes another look (the door is asked again) — and nothing polls meanwhile;
//   4. a result set with no rows says so;
//   5. Health check asks `GET StoreDatabase/HealthCheck?code=` and lists the findings most urgent first, with the
//      check's words, the server's detail and the fix; an unknown check shows the server's own word;
//   6. a check that faulted says so;
//   7. the Health panel carries 919's sp_Blitz section;
//   8. a failed look / health check shows the server's message;
//   9. Check now is hidden without StoreDatabase:06;
//  10. Check now opens the reason dialog: Confirm stays off without a reason (and for white space);
//  11. with a reason it posts `{ code, reason }` (trimmed), closes, toasts, and the fresh reading replaces the page's
//      (read time, state chip), and the health check is re-run;
//  12. a refusal stays in the dialog with its code;
//  13. a fresh reading that FAILED shows the Not checked banner at once;
//  14. under Arabic (RTL) the Live panel and Health panel lay out right to left with no error.
//
//   1. run the app:  npx vite --port 5199      (or any port: DRIVE_PORT=5217)
//   2. node tools/store-db-live-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { envelope, fixture, refusal, storeDbRoute } from './store-db-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.store-db-live-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const VIEW = ['ActionSyncConsole:03', 'StoreDatabase:03']
const ACT = [...VIEW, 'StoreDatabase:06']
const browser = await chromium.launch()

async function open(path, { screens = VIEW, overrides = {}, locale = 'en' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const posts = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((lng) => {
    localStorage.setItem('oms.locale', lng)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', storeDbRoute({ screens, overrides, calls, posts }))
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, calls, posts }
}

const plain = (s) => s.replace(/[\u2066-\u2069\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim()
const text = async (loc) => plain(await loc.innerText())
const asked = (calls, door) => calls.filter((c) => c.startsWith(`StoreDatabase/${door}`))

// ── 1–4: Live activity ───────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('/admin/sync/database/P104?panel=live')
  await page.locator('[data-live-section="running"] [data-tab-grid]').waitFor({ timeout: 15000 })
  check('1. the strip shows Readings, Live activity and Health check',
    (await page.locator('[data-store-db-panels]').getAttribute('data-store-db-panels'))?.startsWith('readings live health') === true)
  check('2. Live activity asks its door for the store', asked(calls, 'LiveActivity')[0] === 'StoreDatabase/LiveActivity?code=P104', asked(calls, 'LiveActivity').join(','))
  const rows = {}
  for (const key of ['running', 'headBlockers', 'workerSessions', 'longTransactions'])
    rows[key] = new Set(await page.locator(`[data-live-section="${key}"] .ag-row`).evaluateAll((els) => els.map((e) => e.getAttribute('row-index')))).size
  check('2. …four tables with their rows', JSON.stringify(rows) === JSON.stringify({ running: 2, headBlockers: 1, workerSessions: 2, longTransactions: 1 }), JSON.stringify(rows))
  const titles = await page.locator('[data-live-section] h3').allTextContents()
  check('2. …titled in order', plain(titles.join('|')) === 'Running requests2|Head blockers1|Sync worker sessions2|Transactions open over 30 seconds1', plain(titles.join('|')))
  const blocked = await text(page.locator('[data-live-section="running"] .ag-row[row-index="0"] [col-id="blockedBy"]').first())
  const wait = await text(page.locator('[data-live-section="running"] .ag-row[row-index="0"] [col-id="waitType"]').first())
  check('2. …a blocked request names its blocker and wait', blocked === '61' && wait === 'LCK_M_U', `${blocked} ${wait}`)
  const notBlocked = await text(page.locator('[data-live-section="running"] .ag-row[row-index="1"] [col-id="blockedBy"]').first())
  check('2. …an unblocked one shows no blocker', notBlocked === '', notBlocked)
  const at = await text(page.locator('[data-live-looked-at]'))
  check('2. …and the time of the look', at === 'Looked at 2026-11-18 10:41', at)
  await page.screenshot({ path: `${SHOTS}/live.png`, fullPage: true })

  const before = asked(calls, 'LiveActivity').length
  await page.waitForTimeout(1500)
  check('3. nothing polls the look', asked(calls, 'LiveActivity').length === before, `${before} → ${asked(calls, 'LiveActivity').length}`)
  await page.locator('[data-live-refresh]').click()
  await page.waitForTimeout(600)
  check('3. Look again takes another look', asked(calls, 'LiveActivity').length === before + 1, `${before} → ${asked(calls, 'LiveActivity').length}`)
  check('9. Check now is hidden without StoreDatabase:06', (await page.locator('[data-check-now]').count()) === 0)
  check('no page errors (live)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const live = fixture('live-activity')
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=live', {
    overrides: { LiveActivity: () => envelope({ ...live, headBlockers: [], longTransactions: [] }) },
  })
  await page.locator('[data-live-section="running"] [data-tab-grid]').waitFor({ timeout: 15000 })
  const empty = await text(page.locator('[data-tab-empty="live-headBlockers"]'))
  check('4. a result set with no rows says so', empty === 'No session is blocking another.', empty)
  check('no page errors (live, empty set)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=live', {
    overrides: { LiveActivity: refusal('STORE_UNREACHABLE', 'Store P104 did not answer within 15 seconds.', 502) },
  })
  await page.getByText('Store P104 did not answer within 15 seconds.').waitFor({ timeout: 15000 })
  check('8. a failed look shows the server\'s message, no tables', (await page.locator('[data-live-section]').count()) === 0)
  check('no page errors (live failed)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5–7: Health check ────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('/admin/sync/database/P104?panel=health')
  await page.locator('[data-health-finding]').first().waitFor({ timeout: 15000 })
  check('5. Health check asks its door for the store', asked(calls, 'HealthCheck')[0] === 'StoreDatabase/HealthCheck?code=P104', asked(calls, 'HealthCheck').join(','))
  const order = await page.locator('[data-health-finding]').evaluateAll((els) => els.map((e) => e.getAttribute('data-health-finding')))
  check('5. …findings most urgent first, server order within a priority',
    order.join(',') === 'NearSizeCap,LogLargerThanData,NoRecentBackup,LastGoodCheckDb,AutoShrinkOn,ReplicaLagUnusual', order.join(','))
  const first = await text(page.locator('[data-health-finding="NearSizeCap"]'))
  check('5. …with priority, the check\'s words, the detail and the fix',
    /^Priority 1 Near the size cap Data used is 3\.1 GB of the 4 GB cap \(78%\)\. Fix: ?Shrink the log/.test(first), first)
  const unknown = await text(page.locator('[data-health-finding="ReplicaLagUnusual"] [data-health-check]'))
  check('5. …an unknown check shows the server\'s own word', unknown === 'ReplicaLagUnusual', unknown)
  const at = await text(page.locator('[data-health-taken-at]'))
  check('5. …and when it was checked', at === 'Checked at 2026-11-18 10:42', at)
  const faulted = page.locator('[data-health-finding="LastGoodCheckDb"]')
  check('6. a check that faulted says so', (await faulted.getAttribute('data-health-faulted')) === 'true' &&
    /This check could not run/.test(await text(faulted)) && (await faulted.locator('[data-health-fix]').count()) === 0)
  check('7. the Health panel carries sp_Blitz below the findings (919)', (await page.locator('[data-health-panel] [data-blitz]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/health.png`, fullPage: true })
  check('no page errors (health)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open('/admin/sync/database/P104?panel=health', {
    overrides: { HealthCheck: refusal('STORE_UNREACHABLE', 'Store P104 did not answer the health check.', 502) },
  })
  await page.getByText('Store P104 did not answer the health check.').waitFor({ timeout: 15000 })
  check('8. a failed health check shows the server\'s message', (await page.locator('[data-health-finding]').count()) === 0)
  check('no page errors (health failed)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10–11: Check now ─────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open('/admin/sync/database/P104?panel=health', { screens: ACT })
  await page.locator('[data-health-finding]').first().waitFor({ timeout: 15000 })
  const button = page.locator('[data-check-now]')
  check('10. Check now shows to a holder of StoreDatabase:06', (await button.count()) === 1)
  await button.click()
  const dialog = page.locator('[data-reason-dialog]')
  await dialog.waitFor({ timeout: 5000 })
  const confirm = page.locator('[data-reason-confirm]')
  check('10. …the reason dialog names the store', (await text(page.locator('[data-reason-codes]'))) === 'P104')
  check('10. …Confirm is off without a reason', await confirm.isDisabled())
  await page.locator('[data-reason-input]').fill('   ')
  check('10. …and off for white space', await confirm.isDisabled())
  await page.locator('[data-reason-input]').fill('  helpdesk 5512: till slow  ')
  check('10. …and on with a reason', await confirm.isEnabled())
  const healthBefore = asked(calls, 'HealthCheck').length
  await confirm.click()
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  check('11. it posts the store and the trimmed reason',
    JSON.stringify(posts.CheckNow) === JSON.stringify([{ code: 'P104', reason: 'helpdesk 5512: till slow' }]), JSON.stringify(posts.CheckNow))
  const toast = await text(page.locator('[data-sonner-toast]').first())
  check('11. …toasts', /Store P104 was read just now\./.test(toast), toast)
  const read = await page.locator('[data-store-db-taken-at]').getAttribute('data-store-db-taken-at')
  check('11. …the fresh reading replaces the page\'s', read === '2026-11-18T10:43:12', read ?? '')
  check('11. …the state chip follows it', (await text(page.locator('[data-store-db-state]'))) === 'OK', await text(page.locator('[data-store-db-state]')))
  await page.waitForTimeout(500)
  check('11. …and the health check is re-run', asked(calls, 'HealthCheck').length === healthBefore + 1, `${healthBefore} → ${asked(calls, 'HealthCheck').length}`)
  await page.screenshot({ path: `${SHOTS}/check-now.png`, fullPage: true })
  check('no page errors (check now)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 12: a refusal ────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104', {
    screens: ACT,
    overrides: { CheckNow: refusal('REASON_REQUIRED', 'A reason is required.', 400) },
  })
  await page.locator('[data-check-now]').click()
  await page.locator('[data-reason-input]').fill('testing')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error="REASON_REQUIRED"]').waitFor({ timeout: 10000 })
  check('12. a refusal stays in the dialog with its message and code',
    (await page.locator('[data-reason-dialog]').count()) === 1 && /A reason is required\./.test(await text(page.locator('[data-reason-dialog]'))))
  check('no page errors (refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: a fresh reading that failed ──────────────────────────────────────────────
{
  const { context, page, errors } = await open('/admin/sync/database/P104', {
    screens: ACT,
    overrides: { CheckNow: () => envelope(fixture('store-not-checked')) },
  })
  await page.locator('[data-check-now]').click()
  await page.locator('[data-reason-input]').fill('till cannot sync')
  check('13. (no banner before)', (await page.locator('[data-not-checked]').count()) === 0)
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-not-checked]').waitFor({ timeout: 10000 })
  const error = await text(page.locator('[data-not-checked-error]'))
  check('13. a failed fresh reading shows the Not checked banner with its error at once', /The wait operation timed out\./.test(error), error)
  const toast = await text(page.locator('[data-sonner-toast]').first())
  check('13. …and the toast says it could not be read', /Store P104 could not be read/.test(toast), toast)
  check('no page errors (failed read)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 14: Arabic ───────────────────────────────────────────────────────────────────
for (const panel of ['live', 'health']) {
  const { context, page, errors } = await open(`/admin/sync/database/P104?panel=${panel}`, { locale: 'ar', screens: ACT })
  await page.locator(panel === 'live' ? '[data-live-section="running"] [data-tab-grid]' : '[data-health-finding]').first().waitFor({ timeout: 15000 })
  // The app is still `lng: 'en'`: the Arabic words are pinned by `store-db/locales.test.ts`; this checks the layout.
  check(`14. under Arabic the ${panel} panel lays out right to left`, (await page.locator('html').getAttribute('dir')) === 'rtl')
  await page.screenshot({ path: `${SHOTS}/${panel}-ar.png`, fullPage: true })
  check(`no page errors (Arabic ${panel})`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
