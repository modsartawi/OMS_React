// Sync console Scripts drive (tickets 663 + 664, BackOffice spec 3202 D11/D14, doors 3205-3207) — drives the REAL Scripts page
// and the store page's Scripts tab in Chromium against STUBBED `ActionSync/*` envelopes, shaped from the spec's D11
// door shapes (the door contract does not list the script doors yet; BackOffice 3205-3207 are not built).
// 🚩 NOTHING here is driven against a live SIS.Api: the live walk waits on BackOffice 3205/3206/3207.
//
// It verifies:
//   1. the nav carries Scripts after Objects; the list reads page 1 of 50, newest first in the door's order;
//   2. a row shows its title, sender, target and the five state counts; a legacy one reads "untitled (legacy)";
//   3. opening a script reads its detail: the header, and each store's row, the exhausted stores first;
//   4. the SQL is drawn read only when the door sends it, and NOT AT ALL when the door sends `null`;
//   5. a legacy script's detail says it has no sender and cannot be withdrawn or retried;
//   6. the store page's Scripts tab shows the title, sent at, attempts and state (blank time + legacy title for a
//      legacy one), still with no SQL and no control; an older door (no state) still reads Executed / Failed.
//   7. (664) without canRunScripts there is no Send, no Withdraw, no Retry all and no Retry column;
//   8. Send: Confirm waits for a preview (preview: true, target all, no codes); the preview lists the exact stores and
//      the re-run warning shows; an edit sets the preview aside; Send posts preview: false with the reason, toasts, and
//      the list is re-read;
//   9. a chosen target picks from the eligible stores (paused ones marked) and posts their codes;
//  10. a refusal (SCRIPT_HAS_GO on the preview, NOT_ELIGIBLE naming codes on the send) keeps the dialog open;
//  11. Withdraw previews, then posts preview: false with the reason; Retry all posts no codes; a row's Retry posts its
//      code; a withdrawn or legacy script offers none of them.
//  12. (review) the detail's controls wait for the detail itself: none while it reads or after it fails; the per-store
//      grid is capped and virtualised (normal layout); a fresh preview clears a confirm's refusal (Send and Withdraw);
//      an older door's store tab draws a blank title, not "untitled (legacy)".
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-scripts-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-scripts-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads.
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const SQL = 'UPDATE dbo.Item SET IsActive = 0\nWHERE ItemCode = N\'100234\';'

// GET ActionSync/Scripts, newest first: a sent-to-all, a chosen one already withdrawn, and a hand-made legacy one.
const SCRIPTS = [
  {
    scriptId: '01JBX7Q2Z9M4K8R3T6V1W5Y0AB', title: 'Deactivate item 100234', sentBy: 'msartawi', sentAt: '2026-10-29T10:00:00',
    targetMode: 'all', storeCount: 412, executed: 400, pending: 6, retrying: 3, exhausted: 2, withdrawn: 1, withdrawnAt: null, isLegacy: false,
  },
  {
    scriptId: '01JBW0000000000000000000CC', title: 'Fix P014 price row', sentBy: 'aali', sentAt: '2026-10-28T09:30:00',
    targetMode: 'chosen', storeCount: 2, executed: 1, pending: 0, retrying: 0, exhausted: 0, withdrawn: 1, withdrawnAt: '2026-10-28T11:00:00', isLegacy: false,
  },
  {
    scriptId: 'SCR-2026-0412', title: 'untitled (legacy)', sentBy: null, sentAt: null,
    targetMode: null, storeCount: 3, executed: 3, pending: 0, retrying: 0, exhausted: 0, withdrawn: 0, withdrawnAt: null, isLegacy: true,
  },
]

const STORE_ROWS = [
  { code: 'P001', description: 'Olaya Main', state: 'executed', attempts: 1, lastAttempt: '2026-10-29T10:05:00', errorMessage: null },
  { code: 'P002', description: 'Tahlia', state: 'pending', attempts: 0, lastAttempt: null, errorMessage: null },
  { code: 'P003', description: 'Malaz', state: 'exhausted', attempts: 5, lastAttempt: '2026-10-29T14:05:00', errorMessage: "Invalid object name 'dbo.Item'." },
  { code: 'P004', description: 'Nakheel', state: 'retrying', attempts: 2, lastAttempt: '2026-10-29T11:05:00', errorMessage: 'Lock request time out period exceeded.' },
  { code: 'P005', description: 'Sulaimaniah', state: 'withdrawn', attempts: 0, lastAttempt: null, errorMessage: null },
  { code: 'P006', description: 'Rawdah', state: 'exhausted', attempts: 5, lastAttempt: '2026-10-29T14:06:00', errorMessage: "Invalid object name 'dbo.Item'." },
]

const detailOf = (id, withSql) => {
  const s = SCRIPTS.find((x) => x.scriptId === id)
  if (!s) return null
  return {
    ...s,
    stores: s.isLegacy ? STORE_ROWS.slice(0, 1).map((r) => ({ ...r, attempts: 0 })) : STORE_ROWS,
    sql: withSql ? SQL : null,
  }
}

// GET ActionSync/Store/Scripts — a 3207 door: one sent script, one legacy (no title, no time).
const STORE_SCRIPTS_3207 = {
  items: [
    { scriptId: '01JBX7Q2Z9M4K8R3T6V1W5Y0AB', createdAt: '2026-10-29T10:00:00', title: 'Deactivate item 100234', attempts: 5, state: 'exhausted', isExecuted: false, lastAttempt: '2026-10-29T14:05:00', errorMessage: "Invalid object name 'dbo.Item'." },
    { scriptId: 'SCR-2026-0412', createdAt: null, title: null, attempts: 1, state: 'executed', isExecuted: true, lastAttempt: '2026-10-01T09:05:00', errorMessage: null },
  ],
}
// The same door before 3207: no title, attempts or state.
const STORE_SCRIPTS_OLD = {
  items: [
    { scriptId: 'SCR-2026-0412', createdAt: null, isExecuted: true, lastAttempt: '2026-10-01T09:05:00', errorMessage: null },
    { scriptId: 'SCR-2026-0419', createdAt: null, isExecuted: false, lastAttempt: '2026-10-09T11:00:00', errorMessage: "Invalid column name 'Foo'" },
  ],
}

const loop = { lastPassAt: '2026-10-29T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null }
const STORE = {
  code: 'P003', description: 'Malaz', host: 'Worker', isPaused: false, controlPending: false, states: ['onWorker'],
  lastConnectOkAt: '2026-10-29T12:03:10', lastConnectFailAt: null, lastConnectError: null, backoffUntil: null,
  push: loop, pull: loop, pendingActions: 0, oldestPendingActionAt: null, lastTrxPulledAt: '2026-10-29T12:02:00',
  healthUpdatedAt: '2026-10-29T12:03:30', controlVersion: 7, appliedVersion: 7, appliedAt: '2026-10-29T11:00:00',
}

const browser = await chromium.launch()

// GET ActionSync/Scripts/Eligible: worker stores, one paused.
const ELIGIBLE = {
  items: [
    { code: 'P001', description: 'Olaya Main', isPaused: false },
    { code: 'P002', description: 'Tahlia', isPaused: true },
    { code: 'P003', description: 'Malaz', isPaused: false },
  ],
}

async function open(path, { canRunScripts = false, storeScripts = STORE_SCRIPTS_3207, refuse = {}, detail = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  /** Every POST body, by door. */
  const posts = { Send: [], Withdraw: [], Retry: [] }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    calls.push(`${p}${url.search}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access')
      return route.fulfill(envelope({ screenAllowed: true, canOperate: false, canOnboard: false, canEnrol: false, canReplay: false, canRunScripts }))
    if (p === 'ActionSync/Scripts') {
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      return route.fulfill(envelope({ items: SCRIPTS.slice((pg - 1) * size, pg * size), total: SCRIPTS.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/Scripts/Detail') {
      // `hang` never answers (a detail still reading); `fail` answers a 500.
      if (detail === 'hang') return new Promise(() => {})
      if (detail === 'fail') return route.fulfill(envelope(null, { status: 500, success: false, message: 'Boom.' }))
      // The door sends the SQL only to a holder of ActionSync.RunStoreScript.
      const d = detailOf(url.searchParams.get('scriptId'), canRunScripts)
      return route.fulfill(d ? envelope(d) : envelope(null, { status: 404, success: false, message: 'No such script.', errorCode: 'UNKNOWN_SCRIPT' }))
    }
    const write = /^ActionSync\/Scripts\/(Send|Withdraw|Retry)$/.exec(p)
    if (write && route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      posts[write[1]].push(body)
      // A refusal, keyed `<Door>:<preview|confirm>`, answers a 400 envelope that may carry the codes it names.
      const r = refuse[`${write[1]}:${body.preview ? 'preview' : 'confirm'}`]
      if (r) return route.fulfill(envelope(r.data ?? null, { status: 400, success: false, message: r.message, errorCode: r.code }))
      if (write[1] === 'Send') {
        const stores = body.target === 'all' ? ELIGIBLE.items.map((s) => s.code) : body.codes
        return route.fulfill(envelope({ scriptId: body.preview ? null : '01JBZNEW0000000000000000ZZ', stores, auditId: body.preview ? null : 'A-1' }))
      }
      if (write[1] === 'Withdraw') return route.fulfill(envelope({ storesWithdrawn: 11, auditId: body.preview ? null : 'A-2' }))
      return route.fulfill(envelope({ storesRetried: body.codes ? body.codes.length : 2, auditId: body.preview ? null : 'A-3' }))
    }
    if (p === 'ActionSync/Scripts/Eligible') return route.fulfill(envelope(ELIGIBLE))
    if (p === 'ActionSync/Store') return route.fulfill(envelope(STORE))
    if (p === 'ActionSync/Store/Hours') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Store/Counters') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Store/Scripts') return route.fulfill(envelope(storeScripts))
    if (p === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
  })
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, calls, posts }
}

// One id per row, by row index (a row can render once per column container).
const rowIds = (page, grid) =>
  page.locator(`[data-tab-grid="${grid}"] .ag-row[row-id]`).evaluateAll((rows) => {
    const byIndex = new Map(rows.map((r) => [Number(r.getAttribute('row-index')), r.getAttribute('row-id')]))
    return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, id]) => id)
  })

// The text a reader sees, without the bidi isolates (FSI/PDI) `fsi()` wraps values in.
const plain = (s) => s.replace(/[⁦-⁩]/g, '')
const cell = (page, grid, rowId, col) => page.locator(`[data-tab-grid="${grid}"] .ag-row[row-id="${rowId}"] [col-id="${col}"]`).first().innerText().then(plain)

{
  // 1–4 as a Health.View holder: no SQL.
  const { context, page, errors, calls } = await open('/admin/sync/scripts')
  await page.locator('[data-tab-grid="scripts-list"] .ag-row').first().waitFor({ timeout: 20000 })

  // 1.
  const nav = await page.locator('[data-console-page]').evaluateAll((els) => els.map((e) => e.getAttribute('data-console-page')))
  check('1. the console nav carries Scripts right after Objects', nav.indexOf('scripts') === nav.indexOf('objects') + 1, nav.join(','))
  check('1. the list reads page 1 of 50', calls.includes('ActionSync/Scripts?page=1&pageSize=50'), calls.filter((c) => c.startsWith('ActionSync/Scripts')).join(','))
  const ids = await rowIds(page, 'scripts-list')
  check('1. the rows keep the door order (newest first)', JSON.stringify(ids) === JSON.stringify(SCRIPTS.map((s) => s.scriptId)), ids.join(','))
  check('1. the count says 3 store scripts', /3 store scripts/.test(plain(await page.locator('[data-scripts-count]').innerText())))

  // 2.
  const first = SCRIPTS[0].scriptId
  check('2. the title', (await cell(page, 'scripts-list', first, 'title')) === 'Deactivate item 100234')
  check('2. the sender', (await cell(page, 'scripts-list', first, 'sentBy')) === 'msartawi')
  check('2. the target is worded', (await cell(page, 'scripts-list', first, 'targetMode')) === 'All worker stores')
  check('2. a chosen target is worded', (await cell(page, 'scripts-list', SCRIPTS[1].scriptId, 'targetMode')) === 'Chosen stores')
  const counts = []
  for (const c of ['storeCount', 'executed', 'pending', 'retrying', 'exhausted', 'withdrawn']) counts.push(await cell(page, 'scripts-list', first, c))
  check('2. store count and the five state counts', JSON.stringify(counts) === JSON.stringify(['412', '400', '6', '3', '2', '1']), counts.join(','))
  const headers = await page.locator('[data-tab-grid="scripts-list"] .ag-header-cell-text').allInnerTexts()
  check('2. the count headers use the glossary words', ['Executed', 'Pending', 'Retrying', 'Exhausted', 'Withdrawn'].every((h) => headers.includes(h)), headers.join(','))
  const legacy = await cell(page, 'scripts-list', 'SCR-2026-0412', 'title')
  check('2. a legacy script reads "untitled (legacy)", with no sender or time', legacy === 'untitled (legacy)' && (await cell(page, 'scripts-list', 'SCR-2026-0412', 'sentBy')) === '' && (await cell(page, 'scripts-list', 'SCR-2026-0412', 'sentAt')) === '', legacy)
  check('2. no control on the list without canRunScripts (664 adds them)', (await page.locator('[data-scripts-list] button:not([data-script-open]):not([data-pager] button)').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/list.png`, fullPage: true })

  // 3.
  await page.locator(`[data-script-open="${first}"]`).click()
  await page.locator(`[data-script-detail="${first}"] [data-tab-grid="script-stores"] .ag-row`).first().waitFor({ timeout: 10000 })
  check('3. opening reads the detail by scriptId', calls.includes(`ActionSync/Scripts/Detail?scriptId=${first}`))
  const header = plain(await page.locator('[data-script-header]').innerText())
  check('3. the header names the sender, target and stores', /msartawi/.test(header) && /All worker stores/.test(header) && /412/.test(header), header.replace(/\n/g, ' | '))
  check('12. the per-store grid is capped and virtualised (normal layout, not autoHeight)',
    (await page.locator('[data-tab-grid="script-stores"] .ag-layout-normal').count()) > 0 && (await page.locator('[data-tab-grid="script-stores"] .ag-layout-auto-height').count()) === 0)
  const order = await rowIds(page, 'script-stores')
  check('3. the exhausted stores come first, then retrying, pending, withdrawn, executed', JSON.stringify(order) === JSON.stringify(['P003', 'P006', 'P004', 'P002', 'P005', 'P001']), order.join(','))
  check('3. a store row: code, description, state, attempts, last attempt, last error',
    (await cell(page, 'script-stores', 'P003', 'description')) === 'Malaz' &&
    (await cell(page, 'script-stores', 'P003', 'state')) === 'Exhausted' &&
    (await cell(page, 'script-stores', 'P003', 'attempts')) === '5' &&
    (await cell(page, 'script-stores', 'P003', 'lastAttempt')) !== '' &&
    /Invalid object name/.test(await cell(page, 'script-stores', 'P003', 'errorMessage')))

  // 4. (null)
  check('4. no SQL drawn when the door sends null', (await page.locator('[data-script-sql]').count()) === 0)
  const body = await page.locator(`[data-script-detail="${first}"]`).innerText()
  check('4. …nor any of its text', !/UPDATE dbo\.Item|ItemCode/.test(body))
  check('4. …and the detail says who may read it', (await page.locator('[data-script-sql-hidden]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/detail-no-sql.png`, fullPage: true })
  await page.locator('[data-script-detail-close]').click()

  // 5.
  await page.locator('[data-script-open="SCR-2026-0412"]').click()
  await page.locator('[data-script-detail="SCR-2026-0412"] [data-script-header]').waitFor({ timeout: 10000 })
  check('5. a legacy detail says it cannot be withdrawn or retried', (await page.locator('[data-script-legacy-note]').count()) === 1)
  check('5. …and shows no sender or time', !/Sent by|Sent at/.test(await page.locator('[data-script-header]').innerText()))
  await page.locator('[data-script-detail-close]').click()

  check('no page errors (list + detail)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 4. (sent) as a RunStoreScript holder.
  const { context, page, errors } = await open('/admin/sync/scripts', { canRunScripts: true })
  const first = SCRIPTS[0].scriptId
  await page.locator(`[data-script-open="${first}"]`).click()
  await page.locator('[data-script-sql]').waitFor({ timeout: 10000 })
  check('4. the SQL is drawn as sent when the door sends it', (await page.locator('[data-script-sql]').innerText()) === SQL)
  check('4. …read only: no field to edit it', (await page.locator(`[data-script-detail="${first}"] textarea, [data-script-detail="${first}"] input:not(.ag-input-field-input)`).count()) === 0)
  check('4. …and the hidden note is gone', (await page.locator('[data-script-sql-hidden]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/detail-sql.png`, fullPage: true })
  check('no page errors (SQL)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 6. the store page's Scripts tab, on a 3207 door.
  const { context, page, errors } = await open('/admin/sync/store/P003?tab=scripts')
  await page.locator('[data-tab-grid="scripts"] .ag-row').first().waitFor({ timeout: 20000 })
  const sent = '01JBX7Q2Z9M4K8R3T6V1W5Y0AB'
  check('6. the tab shows the title', (await cell(page, 'scripts', sent, 'title')) === 'Deactivate item 100234')
  check('6. …the sent at', (await cell(page, 'scripts', sent, 'createdAt')) !== '')
  check('6. …the attempts', (await cell(page, 'scripts', sent, 'attempts')) === '5')
  check('6. …and the state, exhausted', (await cell(page, 'scripts', sent, 'state')) === 'Exhausted')
  check('6. a legacy row: untitled (legacy), blank sent at', (await cell(page, 'scripts', 'SCR-2026-0412', 'title')) === 'untitled (legacy)' && (await cell(page, 'scripts', 'SCR-2026-0412', 'createdAt')) === '')
  const panel = await page.locator('[data-tab-panel="scripts"]').innerText()
  check('6. still no SQL and no control on the tab', !/\bUPDATE\b|\bSELECT\b/.test(panel) && (await page.locator('[data-tab-panel="scripts"] button, [data-tab-panel="scripts"] textarea').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/store-tab.png`, fullPage: true })
  check('no page errors (store tab)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 6. the same tab on a door older than 3207: no title, attempts or state.
  const { context, page, errors } = await open('/admin/sync/store/P003?tab=scripts', { storeScripts: STORE_SCRIPTS_OLD })
  await page.locator('[data-tab-grid="scripts"] .ag-row').first().waitFor({ timeout: 20000 })
  check('6. an older door still reads Executed / Failed', (await cell(page, 'scripts', 'SCR-2026-0412', 'state')) === 'Executed' && (await cell(page, 'scripts', 'SCR-2026-0419', 'state')) === 'Failed')
  check('6. …with blank attempts', (await cell(page, 'scripts', 'SCR-2026-0419', 'attempts')) === '')
  const oldTitles = [await cell(page, 'scripts', 'SCR-2026-0412', 'title'), await cell(page, 'scripts', 'SCR-2026-0419', 'title')]
  check('12. an older door (no title member) draws a blank title, not "untitled (legacy)"', oldTitles.every((x) => x === '') && (await page.locator('[data-tab-grid="scripts"] [data-script-legacy]').count()) === 0, oldTitles.join(','))
  check('no page errors (older door)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 7. without canRunScripts: no control anywhere.
  const { context, page, errors } = await open('/admin/sync/scripts')
  const first = SCRIPTS[0].scriptId
  await page.locator('[data-tab-grid="scripts-list"] .ag-row').first().waitFor({ timeout: 20000 })
  check('7. no Send without canRunScripts', (await page.locator('[data-script-send-open]').count()) === 0)
  await page.locator(`[data-script-open="${first}"]`).click()
  await page.locator(`[data-script-detail="${first}"] [data-tab-grid="script-stores"] .ag-row`).first().waitFor({ timeout: 10000 })
  check('7. no Withdraw or Retry all on the detail', (await page.locator('[data-script-withdraw], [data-script-retry-all]').count()) === 0)
  check('7. no Retry column on the store rows', (await page.locator('[data-tab-grid="script-stores"] [col-id="retry"]').count()) === 0 && (await page.locator('[data-script-retry-store]').count()) === 0)
  check('no page errors (no grant)', errors.length === 0, errors.join(' | '))
  await context.close()
}

const fillSend = async (page, { title = 'Deactivate item 100235', sql = SQL, reason = 'Item recalled by the supplier' } = {}) => {
  await page.locator('[data-script-send-title]').fill(title)
  await page.locator('[data-script-send-sql]').fill(sql)
  await page.locator('[data-reason-input]').fill(reason)
}

{
  // 8. Send to all eligible stores.
  const { context, page, errors, calls, posts } = await open('/admin/sync/scripts', { canRunScripts: true })
  await page.locator('[data-tab-grid="scripts-list"] .ag-row').first().waitFor({ timeout: 20000 })
  await page.locator('[data-script-send-open]').click()
  await page.locator('[data-script-send-sql]').waitFor({ timeout: 10000 })
  check('8. the target defaults to all eligible stores', (await page.locator('[data-script-send-target="all"]').getAttribute('aria-pressed')) === 'true')
  check('8. the dialog warns the script may run more than once and must be safe to re-run', /more than once.*safe to re-run/.test(await page.locator('[data-script-send-rerun]').innerText()))
  await fillSend(page)
  const count = plain(await page.locator('[data-script-send-count]').innerText())
  check('8. the SQL is counted against 8,000', count === `${SQL.length} / 8,000`, count)
  check('8. Send waits for a preview', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-script-send-preview]').click()
  await page.locator('[data-script-send-preview-box="fresh"]').waitFor({ timeout: 10000 })
  const pv = posts.Send[0]
  check('8. the preview posts preview: true, target all and no codes',
    pv && pv.preview === true && pv.target === 'all' && !('codes' in pv) && pv.title === 'Deactivate item 100235' && pv.sql === SQL && pv.reason === 'Item recalled by the supplier',
    JSON.stringify(pv))
  const listed = plain(await page.locator('[data-script-send-stores]').innerText())
  check('8. the preview lists the exact stores', /sent to 3 stores/.test(plain(await page.locator('[data-script-send-sentence]').innerText())) && listed === 'P001, P002, P003', listed)
  check('8. Send is enabled once the preview answers', !(await page.locator('[data-reason-confirm]').isDisabled()))
  await page.locator('[data-script-send-sql]').fill(SQL + '\n-- edited')
  check('8. an edit sets the preview aside and Send waits again', (await page.locator('[data-script-send-preview-box="none"]').count()) === 1 && (await page.locator('[data-reason-confirm]').isDisabled()))
  await page.locator('[data-script-send-sql]').fill(SQL)
  await page.locator('[data-script-send-preview]').click()
  await page.locator('[data-script-send-preview-box="fresh"]').waitFor({ timeout: 10000 })
  await page.screenshot({ path: `${SHOTS}/send-preview.png`, fullPage: true })
  const listReads = calls.filter((c) => c.startsWith('ActionSync/Scripts?page=1')).length
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-script-send-sql]').waitFor({ state: 'detached', timeout: 10000 })
  const sent = posts.Send.at(-1)
  check('8. Send posts preview: false with the reason and the same body',
    sent.preview === false && sent.target === 'all' && !('codes' in sent) && sent.reason === 'Item recalled by the supplier' && sent.sql === SQL, JSON.stringify(sent))
  const toast = plain(await page.getByText(/sent to .*3.* stores\./).first().innerText())
  check('8. the toast names the script and its stores', toast === 'Deactivate item 100235 sent to 3 stores.', toast)
  await page.waitForTimeout(500)
  check('8. the list is re-read', calls.filter((c) => c.startsWith('ActionSync/Scripts?page=1')).length > listReads)
  check('no page errors (send all)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 9. Send to chosen stores.
  const { context, page, errors, calls, posts } = await open('/admin/sync/scripts', { canRunScripts: true })
  await page.locator('[data-script-send-open]').click()
  await fillSend(page)
  await page.locator('[data-script-send-target="chosen"]').click()
  await page.locator('[data-testid="script-send-stores"] [data-multi-select-trigger]').click()
  await page.locator('[data-testid="script-send-stores"] [data-option="P003"]').waitFor({ timeout: 10000 })
  check('9. the picker reads the eligible stores', calls.includes('ActionSync/Scripts/Eligible'))
  const paused = await page.locator('[data-testid="script-send-stores"] [data-option="P002"]').innerText()
  check('9. a paused store is marked', /Paused/.test(paused), paused)
  await page.locator('[data-testid="script-send-stores"] [data-option="P003"] input').check()
  await page.locator('[data-testid="script-send-stores"] [data-option="P002"] input').check()
  await page.keyboard.press('Escape')
  await page.locator('[data-script-send-preview]').click()
  await page.locator('[data-script-send-preview-box="fresh"]').waitFor({ timeout: 10000 })
  const pv = posts.Send[0]
  check('9. the preview posts target chosen with the codes picked', pv.target === 'chosen' && JSON.stringify(pv.codes) === '["P003","P002"]', JSON.stringify(pv))
  check('9. …and lists exactly those stores', plain(await page.locator('[data-script-send-stores]').innerText()) === 'P003, P002')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-script-send-sql]').waitFor({ state: 'detached', timeout: 10000 })
  check('9. Send posts the same codes with preview: false', posts.Send.at(-1).preview === false && JSON.stringify(posts.Send.at(-1).codes) === '["P003","P002"]')
  check('no page errors (send chosen)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 10. refusals keep the dialog open.
  const { context, page, errors, posts } = await open('/admin/sync/scripts', {
    canRunScripts: true,
    refuse: {
      'Send:preview': { code: 'SCRIPT_HAS_GO', message: 'Line 2 is a GO line.' },
      'Send:confirm': { code: 'NOT_ELIGIBLE', message: 'P009, BackOffice are not eligible.', data: { codes: ['P009', 'BackOffice'] } },
    },
  })
  await page.locator('[data-script-send-open]').click()
  await fillSend(page, { sql: 'SELECT 1\nGO\nSELECT 2' })
  await page.locator('[data-script-send-preview]').click()
  await page.locator('[data-script-preview-error="SCRIPT_HAS_GO"]').waitFor({ timeout: 10000 })
  const refusal = plain(await page.locator('[data-script-preview-error]').innerText())
  check('10. a preview refusal shows its code and words', /SCRIPT_HAS_GO/.test(refusal) && /GO line/.test(refusal), refusal.replace(/\n/g, ' | '))
  check('10. …the dialog stays open, its draft kept, Send still waiting',
    (await page.locator('[data-script-send-sql]').inputValue()) === 'SELECT 1\nGO\nSELECT 2' && (await page.locator('[data-reason-confirm]').isDisabled()))
  await page.screenshot({ path: `${SHOTS}/send-refused.png`, fullPage: true })
  // From here the preview answers, and the confirm is refused naming two codes.
  await page.route('**/api/ActionSync/Scripts/Send', (route) => {
    const body = route.request().postDataJSON()
    posts.Send.push(body)
    return body.preview
      ? route.fulfill(envelope({ scriptId: null, stores: ['P001'], auditId: null }))
      : route.fulfill(envelope({ codes: ['P009', 'BackOffice'] }, { status: 400, success: false, message: 'P009, BackOffice are not eligible.', errorCode: 'NOT_ELIGIBLE' }))
  })
  const before = posts.Send.length
  await page.locator('[data-script-send-sql]').fill(SQL)
  await page.locator('[data-script-send-preview]').click()
  await page.locator('[data-script-send-preview-box="fresh"]').waitFor({ timeout: 10000 })
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error="NOT_ELIGIBLE"]').waitFor({ timeout: 10000 })
  check('10. a send refusal shows its code under the reason', posts.Send.length === before + 2 && posts.Send.at(-1).preview === false)
  const named = plain(await page.locator('[data-script-refused-stores]').innerText())
  check('10. …names the stores it refused', named.endsWith('P009, BackOffice'), named)
  check('10. …and the dialog stays open', (await page.locator('[data-script-send-sql]').count()) === 1)
  await page.locator('[data-script-send-preview]').click()
  await page.locator('[data-script-send-preview-box="fresh"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check('12. a fresh preview clears the send refusal', (await page.locator('[data-reason-error]').count()) === 0 && (await page.locator('[data-script-refused-stores]').count()) === 0)
  check('no page errors (refusals)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 11. Withdraw and Retry on a live script's detail.
  const { context, page, errors, calls, posts } = await open('/admin/sync/scripts', { canRunScripts: true })
  const first = SCRIPTS[0].scriptId
  await page.locator(`[data-script-open="${first}"]`).click()
  await page.locator(`[data-script-detail="${first}"] [data-tab-grid="script-stores"] .ag-row`).first().waitFor({ timeout: 10000 })
  check('11. the detail offers Withdraw and Retry all exhausted', (await page.locator('[data-script-withdraw]').count()) === 1 && (await page.locator('[data-script-retry-all]').count()) === 1)
  const retryRows = await page.locator('[data-script-retry-store]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-script-retry-store')))])
  check('11. Retry is on the exhausted rows only', JSON.stringify(retryRows.sort()) === '["P003","P006"]', retryRows.join(','))

  // Withdraw.
  await page.locator('[data-script-withdraw]').click()
  await page.locator('[data-script-action="withdraw"]').waitFor({ timeout: 10000 })
  const note = await page.locator('[data-reason-dialog]').innerText()
  check('11. the withdraw dialog says executed stores stay executed and a withdrawn script cannot be sent again', /stay executed/.test(note) && /cannot be sent again/.test(note))
  await page.locator('[data-reason-input]').fill('Wrong item code')
  check('11. Withdraw waits for a preview', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-script-action-preview]').click()
  await page.locator('[data-script-action-preview-box="fresh"]').waitFor({ timeout: 10000 })
  check('11. the withdraw preview posts preview: true', JSON.stringify(posts.Withdraw[0]) === JSON.stringify({ scriptId: first, reason: 'Wrong item code', preview: true }), JSON.stringify(posts.Withdraw[0]))
  check('11. …and says how many stores have not run it', /11 stores have not run this script/.test(plain(await page.locator('[data-script-action-sentence]').innerText())))
  await page.screenshot({ path: `${SHOTS}/withdraw-preview.png`, fullPage: true })
  const detailReads = calls.filter((c) => c.startsWith('ActionSync/Scripts/Detail')).length
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-script-action]').waitFor({ state: 'detached', timeout: 10000 })
  check('11. Withdraw posts preview: false with the reason', JSON.stringify(posts.Withdraw[1]) === JSON.stringify({ scriptId: first, reason: 'Wrong item code', preview: false }), JSON.stringify(posts.Withdraw[1]))
  await page.waitForTimeout(500)
  check('11. the detail is re-read after the write', calls.filter((c) => c.startsWith('ActionSync/Scripts/Detail')).length > detailReads)

  // Retry all exhausted.
  await page.locator('[data-script-retry-all]').click()
  await page.locator('[data-script-action="retry"]').waitFor({ timeout: 10000 })
  await page.locator('[data-reason-input]').fill('Item table restored')
  await page.locator('[data-script-action-preview]').click()
  await page.locator('[data-script-action-preview-box="fresh"]').waitFor({ timeout: 10000 })
  check('11. Retry all previews with no codes', JSON.stringify(posts.Retry[0]) === JSON.stringify({ scriptId: first, reason: 'Item table restored', preview: true }), JSON.stringify(posts.Retry[0]))
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-script-action]').waitFor({ state: 'detached', timeout: 10000 })
  check('11. Retry all posts preview: false, still no codes', JSON.stringify(posts.Retry[1]) === JSON.stringify({ scriptId: first, reason: 'Item table restored', preview: false }), JSON.stringify(posts.Retry[1]))

  // A row's Retry.
  await page.locator('[data-script-retry-store="P006"]').first().click()
  await page.locator('[data-script-action="retry"]').waitFor({ timeout: 10000 })
  check('11. a row Retry names its store', plain(await page.locator('[data-reason-codes]').innerText()) === 'P006')
  await page.locator('[data-reason-input]').fill('One store restored')
  await page.locator('[data-script-action-preview]').click()
  await page.locator('[data-script-action-preview-box="fresh"]').waitFor({ timeout: 10000 })
  check('11. …and previews with its code', JSON.stringify(posts.Retry[2]) === JSON.stringify({ scriptId: first, codes: ['P006'], reason: 'One store restored', preview: true }), JSON.stringify(posts.Retry[2]))
  check('11. …saying one store gets five fresh attempts', /1 exhausted store would get five fresh attempts/.test(plain(await page.locator('[data-script-action-sentence]').innerText())))
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-script-action]').waitFor({ state: 'detached', timeout: 10000 })
  check('11. a row Retry posts its code with preview: false', JSON.stringify(posts.Retry[3]) === JSON.stringify({ scriptId: first, codes: ['P006'], reason: 'One store restored', preview: false }), JSON.stringify(posts.Retry[3]))
  await page.locator('[data-script-detail-close]').click()

  // A withdrawn script and a legacy one offer nothing.
  for (const id of [SCRIPTS[1].scriptId, 'SCR-2026-0412']) {
    await page.locator(`[data-script-open="${id}"]`).click()
    await page.locator(`[data-script-detail="${id}"] [data-tab-grid="script-stores"] .ag-row`).first().waitFor({ timeout: 10000 })
    check(`11. ${id === 'SCR-2026-0412' ? 'a legacy' : 'a withdrawn'} script offers no Withdraw or Retry`,
      (await page.locator('[data-script-withdraw], [data-script-retry-all], [data-script-retry-store]').count()) === 0)
    await page.locator('[data-script-detail-close]').click()
  }
  check('no page errors (withdraw + retry)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  // 12. the detail's controls wait for the detail: none while it reads, none after it fails.
  for (const mode of ['hang', 'fail']) {
    const { context, page } = await open('/admin/sync/scripts', { canRunScripts: true, detail: mode })
    const first = SCRIPTS[0].scriptId
    await page.locator(`[data-script-open="${first}"]`).click()
    await page.locator(`[data-script-detail="${first}"]`).waitFor({ timeout: 10000 })
    if (mode === 'fail') await page.locator(`[data-script-detail="${first}"] [role="alert"], [data-script-detail="${first}"] .text-danger`).first().waitFor({ timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(800)
    check(`12. no Withdraw or Retry all while the detail ${mode === 'hang' ? 'reads' : 'has failed'} (the list row would offer both)`,
      (await page.locator('[data-script-withdraw], [data-script-retry-all], [data-script-retry-store]').count()) === 0)
    await context.close()
  }
}

{
  // 12. a fresh withdraw preview clears the confirm's refusal.
  const { context, page, errors } = await open('/admin/sync/scripts', {
    canRunScripts: true,
    refuse: { 'Withdraw:confirm': { code: 'WITHDRAWN', message: 'Already withdrawn.' } },
  })
  const first = SCRIPTS[0].scriptId
  await page.locator(`[data-script-open="${first}"]`).click()
  await page.locator('[data-script-withdraw]').click()
  await page.locator('[data-reason-input]').fill('Wrong item code')
  await page.locator('[data-script-action-preview]').click()
  await page.locator('[data-script-action-preview-box="fresh"]').waitFor({ timeout: 10000 })
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error="WITHDRAWN"]').waitFor({ timeout: 10000 })
  check('12. a withdraw refusal shows and keeps the dialog open', (await page.locator('[data-script-action="withdraw"]').count()) === 1)
  await page.locator('[data-script-action-preview]').click()
  await page.locator('[data-script-action-preview-box="fresh"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check('12. …and a fresh preview clears it', (await page.locator('[data-reason-error]').count()) === 0)
  check('no page errors (withdraw refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
