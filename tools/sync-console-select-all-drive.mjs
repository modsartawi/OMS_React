// Sync console "Select all matching" drive (ticket 902, BackOffice spec 3913) — drives the REAL Fleet page and
// audit page in Chromium against STUBBED `ActionSync/*` envelopes. The shapes are BackOffice 3913/3916/3917's (the
// door contract asset of 2523 is not amended yet): `Fleet/Codes` answering a bare `string[]`, the bulk door
// answering `{ batchId, results }`, `counts.closedNotDisabled` on the Summary — all guesses.
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3916/3917 are unbuilt. The staging walk is owed.
//
// It verifies:
//   1. the "Closed, not disabled" tile, its count, and that it filters the table on `state=closedNotDisabled`;
//   2. one-by-one ticking keeps the 50 cap (a 51st tick is refused and un-ticked);
//   3. "Select all matching" reads `Fleet/Codes` with the table's filter and selects all 70 matching stores, past
//      the cap; the bar then offers only Pause, Resume, Disable, and says the batch goes 50 at a time;
//   4. Disable on the 70 goes through ONE `Stores/Control/Bulk` POST (never `Stores/Control`), the toast names the
//      batch, the per-store DISABLED refusal is listed, and the disabled stores leave the list;
//   5. a selection of 50 or fewer keeps the 50-store door;
//   6. the audit feed draws the batch's two chunk rows as one event, with "2 chunks" and all 70 stores;
//   7. the disabled view: Select all matching asks `disabled=only`, the bar offers only Enable, and Enable on
//      the whole view goes through the bulk door;
//   8. under `oms.locale = ar` (RTL) the counts stay isolated. The chrome stays English there (`lng` is pinned to
//      `en` app-wide); the ar bundle's key coverage is proven in control-helpers.test.ts.
//
//   1. run the app:  npx vite --port 5287
//   2. DRIVE_PORT=5287 node tools/sync-console-select-all-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-select-all-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

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

const loop = () => ({ lastPassAt: '2026-11-16T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null })

const workerStore = (code, closed) => ({
  code,
  description: `Store ${code}`,
  host: 'Worker',
  isPaused: false,
  isDisabled: false,
  disabledBy: null,
  disabledAt: null,
  disableReason: null,
  pausedBy: null,
  pausedAt: null,
  pauseReason: null,
  closed, // the stub's own memory of the store master's Closed flag
  controlPending: false,
  states: [],
  lastConnectOkAt: '2026-11-16T12:03:10',
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: loop(),
  pull: loop(),
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: '2026-11-16T12:02:00',
  healthUpdatedAt: '2026-11-16T12:03:30',
  controlVersion: 4,
  appliedVersion: 4,
  appliedAt: '2026-11-16T09:00:00',
})

// The state list the door would send, kept in step with the flags.
const restate = (s) => {
  s.states = s.isDisabled
    ? ['onWorker', 'paused', 'disabled']
    : [...(s.isPaused ? ['onWorker', 'paused'] : ['onWorker']), ...(s.closed ? ['closedNotDisabled'] : [])]
}

// 70 closed stores (C001–C070) and 60 working ones (W001–W060). C042 is disabled by someone else after the
// page read it, so the bulk Disable refuses it DISABLED while the other 69 go through.
const makeStores = () => {
  const out = []
  for (let i = 1; i <= 70; i++) out.push(workerStore(`C${String(i).padStart(3, '0')}`, true))
  for (let i = 1; i <= 60; i++) out.push(workerStore(`W${String(i).padStart(3, '0')}`, false))
  out.forEach(restate)
  return out
}

const HOUR = (hour) => ({ hour, pushPasses: 1, pullPasses: 1, connectFailures: 0, chunksPushed: 1, actionsPushed: 1, trxPulled: 1, errors: 0 })
const WORKERS = { items: [{ instance: 'SISAPI-SYNC-01', version: '1.4.2', gateOn: true, pushWidth: 64, pullWidth: 64, pushInFlight: 1, pullInFlight: 1, lastFlushAt: '2026-11-16T12:04:20', isStale: false, settings: {} }] }

const browser = await chromium.launch()

async function open({ locale = 'en' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1300 } })
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-11-16T12:04:00') })
  const errors = []
  const calls = []
  const posts = []
  const stores = makeStores()
  const audit = []
  const byCode = (c) => stores.find((s) => s.code === c)
  let batches = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((loc) => {
    localStorage.setItem('oms.locale', loc)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)

  const matching = (q) => {
    const only = q.get('disabled') === 'only'
    const states = q.getAll('state')
    const text = (q.get('q') || '').toUpperCase()
    return stores.filter((s) => !!s.isDisabled === only && states.every((st) => s.states.includes(st)) && (!text || s.code.includes(text)))
  }
  const apply = (action, code, reason) => {
    const s = byCode(code)
    if (!s) return { code, ok: false, error: 'NO_STORE', controlVersion: 0 }
    if (code === 'C042' && action === 'Disable') {
      Object.assign(s, { isDisabled: true, isPaused: true })
      restate(s)
      return { code, ok: false, error: 'DISABLED', controlVersion: s.controlVersion }
    }
    if (s.isDisabled && action !== 'Enable') return { code, ok: false, error: 'DISABLED', controlVersion: s.controlVersion }
    if (!s.isDisabled && action === 'Enable') return { code, ok: false, error: 'NOT_DISABLED', controlVersion: s.controlVersion }
    if (action === 'Disable') Object.assign(s, { isDisabled: true, isPaused: true, disableReason: reason })
    if (action === 'Enable') Object.assign(s, { isDisabled: false })
    if (action === 'Pause') s.isPaused = true
    if (action === 'Resume') s.isPaused = false
    s.controlVersion += 1
    restate(s)
    return { code, ok: true, error: null, controlVersion: s.controlVersion }
  }
  const auditRow = (body, codes, batchId, i) =>
    audit.unshift({ id: `A-${audit.length + 1}`, at: `2026-11-16T12:05:0${i}`, who: 'msartawi', action: body.action, codes, batchId, before: null, after: null, reason: body.reason })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const q = url.searchParams
    calls.push(p + url.search)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate: true, canOnboard: false }))
    if (p === 'ActionSync/Workers') return route.fulfill(envelope(WORKERS))
    if (p === 'ActionSync/Fleet/Summary') {
      const active = stores.filter((s) => !s.isDisabled)
      const n = (st) => active.filter((s) => s.states.includes(st)).length
      return route.fulfill(
        envelope({
          asOf: '2026-11-16T12:04:31',
          total: active.length,
          counts: { all: active.length, onWorker: n('onWorker'), onWpf: 0, paused: n('paused'), offline: 0, behind: 0, erroring: 0, controlPending: 0, mirrorOffline: 0, mirrorBehind: 0, deadLetters: 0, deferredTooLong: 0, railsDisagree: 0, disabled: stores.length - active.length, closedNotDisabled: n('closedNotDisabled') },
        }),
      )
    }
    if (p === 'ActionSync/Fleet/LastHour') return route.fulfill(envelope({ current: HOUR('2026-11-16T12:00:00'), previous: HOUR('2026-11-16T11:00:00') }))
    if (p === 'ActionSync/Fleet/Codes') return route.fulfill(envelope(matching(q).map((s) => s.code)))
    if (p === 'ActionSync/Fleet') {
      const all = matching(q)
      const pg = Number(q.get('page'))
      const size = Number(q.get('pageSize'))
      return route.fulfill(envelope({ items: all.slice((pg - 1) * size, pg * size), total: all.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/Audit') {
      return route.fulfill(envelope({ items: audit, total: audit.length, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) }))
    }
    if (p === 'ActionSync/Stores/Control') {
      const body = route.request().postDataJSON()
      posts.push({ door: 'control', ...body })
      if (body.codes.length > 50) return route.fulfill(envelope(null, { status: 400, success: false, message: 'Too many stores.', errorCode: 'TOO_MANY_STORES' }))
      const res = body.codes.map((c) => apply(body.action, c, body.reason))
      auditRow(body, body.codes, null, 0)
      return route.fulfill(envelope({ auditId: `A-${audit.length}`, results: res }))
    }
    if (p === 'ActionSync/Stores/Control/Bulk') {
      const body = route.request().postDataJSON()
      posts.push({ door: 'bulk', ...body })
      const batchId = `01JBATCH${++batches}`
      const res = []
      for (let i = 0; i * 50 < body.codes.length; i++) {
        const chunk = body.codes.slice(i * 50, i * 50 + 50)
        res.push(...chunk.map((c) => apply(body.action, c, body.reason)))
        auditRow(body, chunk, batchId, i)
      }
      return route.fulfill(envelope({ batchId, results: res }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, posts, byCode }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitFor = async (page, fn, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const rowIds = (page) => page.locator('[data-fleet-table] .ag-row[row-id]').evaluateAll((rs) => [...new Set(rs.map((r) => r.getAttribute('row-id')))].sort())
const checkedIds = (page) =>
  page.locator('[data-fleet-table] .ag-row.ag-row-selected[row-id]').evaluateAll((rs) => [...new Set(rs.map((r) => r.getAttribute('row-id')))])
const bulkButtons = (page) => page.locator('[data-bulk-bar] [data-bulk]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-bulk')).join(' '))
const count = async (page) => page.locator('[data-selection-count]').getAttribute('data-selection-count')
const sendWithReason = async (page, reason) => {
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  const text = await dialog.innerText()
  await dialog.locator('[data-reason-input]').fill(reason)
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => (await page.locator('dialog[open]').count()) === 0)
  return text
}
const toastText = async (page) => strip((await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | '))

// ── 1–5: the Fleet page ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts, byCode } = await open()
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="C001"]').waitFor({ timeout: 20000 })
  const tile = page.locator('[data-tile="closedNotDisabled"]')
  await waitFor(page, async () => /70/.test(await tile.innerText()))
  check('1. the "Closed, not disabled" tile is drawn, last', (await page.locator('[data-tile]').last().getAttribute('data-tile')) === 'closedNotDisabled')
  check('1. …with its words and count', strip(await tile.innerText()) === '70 Closed, not disabled', strip(await tile.innerText()))
  await tile.click()
  await waitFor(page, async () => calls.some((c) => /^ActionSync\/Fleet\?state=closedNotDisabled/.test(c)))
  await waitFor(page, async () => (await rowIds(page)).every((c) => c.startsWith('C')))
  check('1. the tile filters the table on state=closedNotDisabled', calls.some((c) => /^ActionSync\/Fleet\?state=closedNotDisabled&/.test(c)) && (await rowIds(page)).every((c) => c.startsWith('C')), calls.filter((c) => c.startsWith('ActionSync/Fleet?')).pop())
  await waitFor(page, async () => strip(await page.locator('[data-fleet-count]').innerText()) === '70 stores')
  check('1. …70 stores, 50 to a page', strip(await page.locator('[data-fleet-count]').innerText()) === '70 stores' && /pageSize=50$/.test(calls.filter((c) => c.startsWith('ActionSync/Fleet?')).pop()), strip(await page.locator('[data-fleet-count]').innerText()))

  // 2: the header checkbox takes page 1's 50; a tick on page 2 is refused.
  await page.locator('[data-fleet-table] .ag-header-select-all input').click()
  await waitFor(page, async () => (await count(page)) === '50')
  check('2. the header checkbox takes the page: 50', (await count(page)) === '50')
  await page.locator('[data-fleet-table] nav button').last().click()
  await page.locator('.ag-row[row-id="C051"]').waitFor({ timeout: 5000 })
  await page.locator('.ag-row[row-id="C051"] .ag-selection-checkbox input').click()
  await page.waitForTimeout(300)
  check('2. a 51st tick is refused: still 50', (await count(page)) === '50', await count(page))
  check('2. …and un-ticked', !(await checkedIds(page)).includes('C051'))
  check('2. …with the cap message', /At most 50 stores/.test(await toastText(page)), await toastText(page))
  check('2. 50 keep the full bar', (await bulkButtons(page)) === 'Move HandBack Pause Resume RePush Disable', await bulkButtons(page))
  await page.locator('[data-selection-clear]').click()

  // 3: Select all matching.
  await page.locator('[data-select-all]').click()
  await waitFor(page, async () => (await count(page)) === '70')
  const codesCall = calls.filter((c) => c.startsWith('ActionSync/Fleet/Codes')).pop()
  check('3. Select all matching reads Fleet/Codes with the table filter, no page or sort', codesCall === 'ActionSync/Fleet/Codes?state=closedNotDisabled', codesCall)
  check('3. …and selects all 70, past the cap', (await count(page)) === '70', await count(page))
  check('3. …the page in view shows them ticked', (await checkedIds(page)).length === 20, String((await checkedIds(page)).length))
  check('3. over 50 the bar offers only Pause, Resume, Disable', (await bulkButtons(page)) === 'Pause Resume Disable', await bulkButtons(page))
  check('3. …and says it goes as one batch, 50 at a time', /Over 50 stores: sent as one batch, 50 stores at a time/.test(strip(await page.locator('[data-selection-bulk]').innerText())))
  await page.screenshot({ path: `${SHOTS}/select-all.png`, fullPage: true })

  // 4: Disable the 70 through the bulk door.
  await page.locator('[data-bulk="Disable"]').click()
  const dialogText = await sendWithReason(page, ' Closed stores, retired ')
  check('4. the dialog names 70 stores', /Disable: 70 stores/.test(strip(dialogText)), dialogText.slice(0, 80))
  const sent = posts.at(-1)
  check('4. ONE POST, to Stores/Control/Bulk', posts.length === 1 && sent.door === 'bulk', JSON.stringify(posts.map((x) => x.door)))
  check('4. …with the same body as Stores/Control: action, all 70 codes, the trimmed reason', sent.action === 'Disable' && sent.codes.length === 70 && new Set(sent.codes).size === 70 && sent.reason === 'Closed stores, retired')
  await page.locator('[data-failure="C042"]').waitFor({ timeout: 5000 })
  check('4. the DISABLED refusal is listed with its words', (await page.locator('[data-failure="C042"]').getAttribute('data-failure-code')) === 'DISABLED' && /only Enable is allowed/.test(strip(await page.locator('[data-failure="C042"]').innerText())))
  check('4. …and only it', (await page.locator('[data-failure]').count()) === 1)
  const toast = await toastText(page)
  check('4. the toast counts 69 of 70 and names the batch', /69 of 70/.test(toast) && /Batch 01JBATCH1/.test(toast), toast)
  check('4. the selection is spent', (await count(page)) === '0')
  check('4. the disabled stores leave the list', await waitFor(page, async () => (await page.locator('[data-fleet-empty]').count()) === 1 || (await rowIds(page)).length === 0))
  check('4. the tile counts 0', await waitFor(page, async () => strip(await tile.innerText()) === '0 Closed, not disabled'), strip(await tile.innerText()))
  check('4. every closed store is disabled', byCode('C001').isDisabled && byCode('C070').isDisabled && !byCode('W001').isDisabled)
  await page.screenshot({ path: `${SHOTS}/after-disable.png`, fullPage: true })

  // 5: 50 or fewer keep the 50-store door.
  await tile.click()
  await page.locator('.ag-row[row-id="W001"]').waitFor({ timeout: 5000 })
  await page.locator('.ag-row[row-id="W001"] .ag-selection-checkbox input').click()
  await page.locator('.ag-row[row-id="W002"] .ag-selection-checkbox input').click()
  await page.locator('[data-bulk="Pause"]').click()
  await sendWithReason(page, 'Maintenance')
  check('5. two stores go through Stores/Control', posts.at(-1).door === 'control' && posts.at(-1).codes.join(',') === 'W001,W002', JSON.stringify(posts.at(-1)))
  const pauseToast = page.locator('[data-sonner-toast]', { hasText: /Pause sent for \W*2\W* stores/ })
  await pauseToast.waitFor({ timeout: 5000 })
  check('5. …and its toast names no batch', !/Batch/.test(strip(await pauseToast.innerText())), strip(await pauseToast.innerText()))
  check('no page errors (fleet)', errors.length === 0, errors.join(' | '))

  // 6: the audit feed groups the batch.
  await page.goto(`${BASE}/admin/sync/audit`)
  await page.locator('[data-audit-chunks]').waitFor({ timeout: 20000 })
  const auditRows = await page.locator('[data-audit-codes]').count()
  check('6. the batch is one event beside the single Pause: 2 rows, not 3', auditRows === 2, String(auditRows))
  const chunks = strip(await page.locator('[data-audit-chunks]').innerText())
  check('6. …with its chunk count', chunks === '2 chunks' && (await page.locator('[data-audit-chunks]').getAttribute('data-audit-chunks')) === '2', chunks)
  const listed = (await page.locator('[data-audit-batch="01JBATCH1"]').locator('xpath=..').getAttribute('data-audit-codes')).split(' ')
  check('6. …and all 70 stores, in the order they were sent', listed.length === 70 && listed[0] === sent.codes[0] && listed[69] === sent.codes[69], String(listed.length))
  await page.screenshot({ path: `${SHOTS}/audit.png`, fullPage: true })
  check('no page errors (audit)', errors.length === 0, errors.join(' | '))

  // 7: the disabled view — Select all matching, then Enable through the bulk door.
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-show-disabled="70"]').waitFor({ timeout: 20000 })
  await page.locator('[data-show-disabled]').click()
  await page.locator('.ag-row[row-id="C001"]').waitFor({ timeout: 5000 })
  await page.locator('[data-select-all]').click()
  await waitFor(page, async () => (await count(page)) === '70')
  check('7. the disabled view selects all 70 through Fleet/Codes?disabled=only', calls.filter((c) => c.startsWith('ActionSync/Fleet/Codes')).pop() === 'ActionSync/Fleet/Codes?disabled=only' && (await count(page)) === '70')
  check('7. …and offers only Enable', (await bulkButtons(page)) === 'Enable', await bulkButtons(page))
  await page.locator('[data-bulk="Enable"]').click()
  await sendWithReason(page, 'Reopened')
  check('7. Enable goes through the bulk door', posts.at(-1).door === 'bulk' && posts.at(-1).action === 'Enable' && posts.at(-1).codes.length === 70)
  check('7. the view empties', await waitFor(page, async () => (await page.locator('[data-fleet-empty]').count()) === 1))
  check('no page errors (disabled view)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: Arabic ───────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ locale: 'ar' })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="C001"]').waitFor({ timeout: 20000 })
  check('8. the page is RTL', (await page.locator('html').getAttribute('dir')) === 'rtl')
  await page.locator('[data-tile="closedNotDisabled"]').click()
  await waitFor(page, async () => (await rowIds(page)).every((c) => c.startsWith('C')))
  await page.locator('[data-select-all]').click()
  await waitFor(page, async () => (await count(page)) === '70')
  const sel = strip(await page.locator('[data-selection-count]').innerText())
  check('8. the selection count reads in order, isolated', sel === '70 stores selected' && (await page.locator('[data-selection-count] bdi[dir="ltr"]').count()) === 1, sel)
  await page.screenshot({ path: `${SHOTS}/select-all-ar.png`, fullPage: true })
  check('no page errors (ar)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
