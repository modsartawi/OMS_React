// Sync console controls drive (ticket 447, spec 444) — drives the REAL store page, fleet page and audit
// page in Chromium against STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2539/2540 are unbuilt, and ticket 450 is
// the live walk.
//
// It verifies:
//   1. a single Pause with a reason: the worker store offers Pause + Hand back, the reason dialog keeps
//      Confirm disabled until a non-blank reason, the POST carries the trimmed reason, one toast sentence,
//      the pending badge appears off the refetched controlPending and clears when the door clears it,
//      and the store's Audit tab lists the new entry;
//   2. a paused worker store offers Resume + Hand back; a WPF store offers only Move to worker;
//   3. a whole refusal (REASON_REQUIRED) shows in the dialog through apiErrorMessage + its code;
//   4. without canOperate: no control, no checkbox, no bulk bar — absent, not disabled;
//   5. a bulk Move of 3 from the fleet: one POST, one toast sentence, the refused row listed with its code,
//      the pending badge on the refetched rows; a bulk Pause with a WPF row lists NOT_ON_WORKER;
//   6. the 50-store cap: a page-wide select takes 50, the 51st on page 2 is refused with a message;
//   7. the fleet-wide Audit page: its entries (who, when, action, stores/batch, before → after, reason)
//      and the from / to / who / code filters, with a bad range refused before any call.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-controls-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-controls-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads (the contract abbreviates its error entries).
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

const loop = (over = {}) => ({ lastPassAt: '2026-10-09T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null, ...over })
const noLoop = () => ({ lastPassAt: null, lastPassOutcome: 'None', lastErrorAt: null, lastError: null })

const workerStore = (code, over = {}) => ({
  code,
  description: `Store ${code}`,
  host: 'Worker',
  isPaused: false,
  controlPending: false,
  states: ['onWorker'],
  lastConnectOkAt: '2026-10-09T12:03:10',
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: loop(),
  pull: loop(),
  pendingActions: 12,
  oldestPendingActionAt: '2026-10-09T11:50:00',
  lastTrxPulledAt: '2026-10-09T12:02:00',
  healthUpdatedAt: '2026-10-09T12:03:30',
  controlVersion: 4,
  appliedVersion: 4,
  appliedAt: '2026-10-09T09:00:00',
  ...over,
})
const wpfStore = (code) => ({
  ...workerStore(code),
  host: 'Wpf',
  states: ['onWpf'],
  lastConnectOkAt: null,
  push: noLoop(),
  pull: noLoop(),
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: null,
  healthUpdatedAt: null,
  controlVersion: 0,
  appliedVersion: 0,
  appliedAt: null,
})

// 60 stores: two pages at 50. P002, P004 and P005 are on WPF; P003 is paused.
const makeStores = () =>
  Array.from({ length: 60 }, (_, i) => {
    const code = `P${String(i + 1).padStart(3, '0')}`
    if (['P002', 'P004', 'P005'].includes(code)) return wpfStore(code)
    if (code === 'P003') return workerStore(code, { isPaused: true, states: ['onWorker', 'paused'] })
    return workerStore(code)
  })

const AUDIT = [
  { id: 'A-3', at: '2026-10-09T10:15:00', who: 'n.alharbi', action: 'Pause', codes: ['P003'], batchId: null, before: 'paused: no', after: 'paused: yes', reason: 'Store closed for renovation until Oct 20' },
  { id: 'A-2', at: '2026-10-09T09:05:00', who: 'm.qahtani', action: 'Move', codes: ['P401', 'P402'], batchId: 'B-0412', before: 'WPF', after: 'Worker', reason: 'Rollout set 4' },
  { id: 'A-1', at: '2026-10-08T16:20:00', who: 'n.alharbi', action: 'Explode', codes: ['P058'], batchId: null, before: null, after: null, reason: 'An action newer than this bundle' },
]

const SUMMARY = { asOf: '2026-10-09T12:04:31', total: 60, counts: { all: 60, onWorker: 57, onWpf: 3, paused: 1, offline: 0, behind: 0, erroring: 0, controlPending: 0 } }
const HOUR = (hour) => ({ hour, pushPasses: 1, pullPasses: 1, connectFailures: 0, chunksPushed: 1, actionsPushed: 1, trxPulled: 1, errors: 0 })
const WORKERS = { items: [{ instance: 'SISAPI-SYNC-01', version: '1.4.2', gateOn: true, pushWidth: 64, pullWidth: 64, pushInFlight: 1, pullInFlight: 1, lastFlushAt: '2026-10-09T12:04:20', isStale: false, settings: {} }] }

const browser = await chromium.launch()

async function open({ canOperate = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-10-09T12:04:00') })
  const errors = []
  const calls = []
  const posts = []
  const stores = makeStores()
  const audit = AUDIT.map((a) => ({ ...a }))
  const byCode = (c) => stores.find((s) => s.code === c)
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const q = url.searchParams
    calls.push(p + url.search)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate, canOnboard: false }))
    if (p === 'ActionSync/Workers') return route.fulfill(envelope(WORKERS))
    if (p === 'ActionSync/Fleet/Summary') return route.fulfill(envelope(SUMMARY))
    if (p === 'ActionSync/Fleet/LastHour') return route.fulfill(envelope({ current: HOUR('2026-10-09T12:00:00'), previous: HOUR('2026-10-09T11:00:00') }))
    if (p === 'ActionSync/Fleet') {
      const pg = Number(q.get('page'))
      const size = Number(q.get('pageSize'))
      return route.fulfill(envelope({ items: stores.slice((pg - 1) * size, pg * size), total: stores.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/Store') {
      const s = byCode(q.get('code'))
      return route.fulfill(s ? envelope(s) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Store/Hours') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Store/Counters') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Audit') {
      const code = q.get('code')
      const who = q.get('who')
      const items = audit.filter((a) => (!code || a.codes.includes(code)) && (!who || a.who === who))
      return route.fulfill(envelope({ items, total: items.length, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) }))
    }
    if (p === 'ActionSync/Stores/Control') {
      const body = route.request().postDataJSON()
      posts.push(body)
      if (body.reason === 'trip the door')
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'A reason is required for every control.', errorCode: 'REASON_REQUIRED' }))
      const res = body.codes.map((code) => {
        const s = byCode(code)
        if (!s || code === 'P005') return { code, ok: false, error: 'NO_STORE', controlVersion: 0 }
        if (s.host === 'Wpf' && body.action !== 'Move') return { code, ok: false, error: 'NOT_ON_WORKER', controlVersion: s.controlVersion }
        s.controlVersion += 1
        s.controlPending = true
        s.states = [...s.states.filter((x) => x !== 'controlPending'), 'controlPending']
        return { code, ok: true, error: null, controlVersion: s.controlVersion }
      })
      audit.unshift({ id: `A-${audit.length + 1}`, at: '2026-10-09T12:05:00', who: 'msartawi', action: body.action, codes: body.codes, batchId: null, before: 'paused: no', after: 'paused: yes', reason: body.reason })
      return route.fulfill(envelope({ auditId: `A-${audit.length}`, results: res }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  // The worker applies every pending control.
  const settle = () => stores.forEach((s) => ((s.controlPending = false), (s.appliedVersion = s.controlVersion), (s.states = s.states.filter((x) => x !== 'controlPending'))))
  return { context, page, errors, calls, posts, settle }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitFor = async (page, fn, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const toastText = async (page, re) => {
  const t = page.locator('[data-sonner-toast]').filter({ hasText: re })
  await t.first().waitFor({ timeout: 5000 }).catch(() => {})
  return (await t.count()) > 0 ? strip(await t.first().innerText()) : ''
}
const tick = (page, code) => page.locator(`.ag-row[row-id="${code}"] .ag-selection-checkbox input`).click()
const ticked = (page, code) => page.locator(`.ag-row[row-id="${code}"] .ag-selection-checkbox input`).isChecked()

// ── 1: a single Pause with a reason ───────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts, settle } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  check('1. a worker store offers Pause and Hand back', (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'Pause HandBack')
  check('1. …and no Move to worker', (await page.locator('[data-control="Move"]').count()) === 0)
  check('1. no pending badge before the control', (await page.locator('[data-control-pending]').count()) === 0)

  await page.locator('[data-control="Pause"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('1. Pause opens the in-page reason dialog', strip(await dialog.locator('#modal-title').innerText()) === 'Pause: store P001', strip(await dialog.locator('#modal-title').innerText()))
  check('1. …naming the store and what Pause does', strip(await dialog.locator('[data-reason-codes]').innerText()) === 'P001' && /chunk boundary/.test(await dialog.innerText()))
  const confirm = dialog.locator('[data-reason-confirm]')
  check('1. Confirm is disabled with no reason', await confirm.isDisabled())
  await dialog.locator('[data-reason-input]').fill('   \n  ')
  check('1. …and with a blank one', await confirm.isDisabled())
  await dialog.locator('[data-reason-input]').fill('  Store closed for renovation  ')
  check('1. …and enabled once a reason is typed', await confirm.isEnabled())
  await page.screenshot({ path: `${SHOTS}/reason-dialog.png` })
  await confirm.click()
  await waitFor(page, async () => posts.length === 1)
  check('1. one POST with the action, the store and the trimmed reason', JSON.stringify(posts[0]) === JSON.stringify({ action: 'Pause', codes: ['P001'], reason: 'Store closed for renovation' }), JSON.stringify(posts[0]))
  const sentence = await toastText(page, /Pause sent/)
  check('1. one toast sentence', /^Pause sent for 1 store\. It shows as pending until the worker applies it\.$/.test(sentence), sentence)
  check('1. the dialog closes', await waitFor(page, async () => (await page.locator('dialog[open]').count()) === 0))
  check('1. the store is read again', await waitFor(page, async () => calls.filter((c) => c === 'ActionSync/Store?code=P001').length >= 2))
  check('1. the pending badge appears off the refetched controlPending', await waitFor(page, async () => (await page.locator('[data-control-pending]').count()) === 1))
  check('1. no refused list for an all-done answer', (await page.locator('[data-control-failures]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/pending.png`, fullPage: true })
  settle()
  await page.clock.runFor(31_000)
  check('1. the badge clears when the door clears controlPending', await waitFor(page, async () => (await page.locator('[data-control-pending]').count()) === 0))

  await page.locator('[data-tab="audit"]').click()
  await page.locator('[data-tab-grid="audit"] .ag-row').first().waitFor({ timeout: 10000 })
  check('1. the Audit tab reads this store\'s feed', calls.includes('ActionSync/Audit?code=P001&page=1&pageSize=50'), calls.filter((c) => c.includes('Audit')).join(','))
  const row = strip(await page.locator('[data-tab-grid="audit"] .ag-row').first().innerText())
  check('1. …listing the new entry: when, who, action, store, before → after, reason', /2026-10-09 12:05/.test(row) && /msartawi/.test(row) && /Pause/.test(row) && /P001/.test(row) && /paused: no/.test(row) && /paused: yes/.test(row) && /Store closed for renovation/.test(row), row)
  await page.screenshot({ path: `${SHOTS}/store-audit.png`, fullPage: true })
  check('no page errors (single pause)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2 + 3: the other hosts, and a whole refusal ───────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  await page.goto(`${BASE}/admin/sync/store/P003`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  check('2. a paused worker store offers Resume and Hand back', (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'Resume HandBack')
  await page.goto(`${BASE}/admin/sync/store/P002`)
  await page.locator('[data-wpf-note]').waitFor({ timeout: 20000 })
  await page.locator('[data-store-controls]').waitFor()
  check('2. a WPF store offers only Move to worker', (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'Move')
  check('2. …and no Pause, Resume or Hand back', (await page.locator('[data-control="Pause"], [data-control="Resume"], [data-control="HandBack"]').count()) === 0)

  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-control="HandBack"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-reason-input]').fill('trip the door')
  await dialog.locator('[data-reason-confirm]').click()
  await dialog.locator('[data-reason-error]').waitFor({ timeout: 5000 }).catch(() => {})
  check('3. a whole refusal keeps the dialog open', (await page.locator('dialog[open]').count()) === 1)
  const said = strip(await dialog.locator('[role="alert"]').innerText())
  check('3. …showing the server\'s message and its code', /A reason is required for every control\./.test(said) && (await dialog.locator('[data-reason-error="REASON_REQUIRED"]').count()) === 1, said)
  check('3. …and the reason is kept', (await dialog.locator('[data-reason-input]').inputValue()) === 'trip the door')
  await page.screenshot({ path: `${SHOTS}/refusal.png` })
  await dialog.locator('[data-reason-cancel]').click()
  check('3. Cancel closes it', (await page.locator('dialog[open]').count()) === 0)
  await page.locator('[data-control="HandBack"]').click()
  check('3. a reopened dialog starts clean', (await page.locator('dialog[open] [data-reason-input]').inputValue()) === '' && (await page.locator('dialog[open] [data-reason-error]').count()) === 0)
  await page.keyboard.press('Escape')
  check('3. only the refused POST was sent', posts.length === 1)
  check('no page errors (hosts + refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: view only ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ canOperate: false })
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-health]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('4. view only: no control on the store page', (await page.locator('[data-store-controls], [data-control]').count()) === 0)
  check('4. …not even a disabled one', (await page.getByRole('button', { name: /^(Pause|Resume|Hand back to WPF|Move to worker)$/ }).count()) === 0)
  await page.locator('[data-tab="audit"]').click()
  // Nothing is recorded for P001 in a fresh stub: the tab says so, in this store's words.
  await page.locator('[data-tab-empty="audit"]').waitFor({ timeout: 10000 })
  check('4. …the Audit tab is still readable', calls.includes('ActionSync/Audit?code=P001&page=1&pageSize=50') && /Nothing is recorded for this store/.test(await page.locator('[data-tab-empty="audit"]').innerText()))
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  check('4. view only: no checkbox and no bulk bar on the fleet', (await page.locator('.ag-selection-checkbox, .ag-header-select-all, [data-bulk-bar], [data-bulk]').count()) === 0)
  check('no page errors (view only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5 + 6: the fleet's bulk controls and the cap ──────────────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open()
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  check('5. the bulk bar starts empty, its buttons disabled', /Select stores in the table/.test(await page.locator('[data-bulk-bar]').innerText()) && (await page.locator('[data-bulk="Move"]').isDisabled()))
  for (const c of ['P002', 'P004', 'P005']) await tick(page, c)
  const countText = async () => strip(await page.locator('[data-selection-count]').innerText())
  check('5. three ticks select three stores', await waitFor(page, async () => (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '3' && /^3 stores selected$/.test(await countText())), await countText())
  const fleetBefore = calls.filter((c) => c.startsWith('ActionSync/Fleet?')).length
  await page.locator('[data-bulk="Move"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('5. the bulk dialog names the action and the count', strip(await dialog.locator('#modal-title').innerText()) === 'Move to worker: 3 stores', strip(await dialog.locator('#modal-title').innerText()))
  check('5. …and lists the three stores', strip(await dialog.locator('[data-reason-codes]').innerText()) === 'P002, P004, P005')
  await dialog.locator('[data-reason-input]').fill('Rollout set 5')
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => posts.length === 1)
  check('5. ONE call moves the three', posts.length === 1 && JSON.stringify(posts[0]) === JSON.stringify({ action: 'Move', codes: ['P002', 'P004', 'P005'], reason: 'Rollout set 5' }), JSON.stringify(posts[0]))
  const sentence = await toastText(page, /Move to worker sent/)
  check('5. one toast sentence counts the done and the refused', sentence === 'Move to worker sent for 2 of 3 stores; 1 refused.', sentence)
  await page.locator('[data-control-failures]').waitFor({ timeout: 5000 })
  const fail = strip(await page.locator('[data-failure="P005"]').innerText())
  check('5. the refused row is listed with its words and its code', fail === 'P005 No such store NO_STORE', fail)
  check('5. …and only it', (await page.locator('[data-failure]').count()) === 1)
  check('5. the answered selection is cleared', (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '0' && !(await ticked(page, 'P002')))
  check('5. the fleet is read again', await waitFor(page, async () => calls.filter((c) => c.startsWith('ActionSync/Fleet?')).length > fleetBefore))
  const pending = async (code) => strip(await page.locator(`.ag-row[row-id="${code}"] [col-id="controlPending"]`).innerText())
  check('5. the moved stores show Pending off the refetched rows', await waitFor(page, async () => (await pending('P002')) === 'Pending' && (await pending('P004')) === 'Pending'))
  check('5. …the refused one does not', (await pending('P005')) === '')
  await page.screenshot({ path: `${SHOTS}/bulk-move.png`, fullPage: true })

  await tick(page, 'P001')
  await tick(page, 'P002')
  await page.locator('[data-bulk="Pause"]').click()
  await page.locator('dialog[open] [data-reason-input]').fill('Night maintenance')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await waitFor(page, async () => posts.length === 2)
  await waitFor(page, async () => (await page.locator('[data-failure="P002"]').count()) === 1)
  const wpfFail = strip(await page.locator('[data-failure="P002"]').innerText())
  check('5. a bulk Pause lists the WPF row as NOT_ON_WORKER', wpfFail === 'P002 Not on the worker NOT_ON_WORKER', wpfFail)
  check('5. …the new answer replaces the last list', (await page.locator('[data-failure="P005"]').count()) === 0 && (await page.locator('[data-control-failures]').getAttribute('data-control-failures')) === 'Pause')
  await page.locator('[data-control-failures-dismiss]').click()
  check('5. the list can be dismissed', (await page.locator('[data-control-failures]').count()) === 0)

  // 6: the cap.
  await page.locator('.ag-header-select-all input').click()
  check('6. a page-wide select takes the 50 on the page', await waitFor(page, async () => (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '50'))
  await page.getByRole('button', { name: 'Next' }).click()
  await page.locator('.ag-row[row-id="P051"]').waitFor({ timeout: 10000 })
  await tick(page, 'P051')
  const capped = await toastText(page, /At most/)
  check('6. the 51st is refused with a message', capped === 'At most 50 stores can be selected at once. Act on these first, then select the next ones.', capped)
  check('6. …its tick is taken back', await waitFor(page, async () => !(await ticked(page, 'P051'))))
  check('6. …and the selection stays at 50', (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '50')
  await page.getByRole('button', { name: 'Previous' }).click()
  await page.locator('.ag-row[row-id="P001"]').waitFor()
  check('6. the selection is kept across pages', await waitFor(page, async () => (await ticked(page, 'P001')) && (await ticked(page, 'P012'))))
  await page.screenshot({ path: `${SHOTS}/cap.png`, fullPage: true })
  await page.locator('[data-selection-clear]').click()
  check('6. Clear selection empties it', (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '0' && !(await ticked(page, 'P001')))
  check('no page errors (bulk + cap)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: the fleet-wide Audit page ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ canOperate: false })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-console-page="audit"]').click()
  await page.locator('[data-tab-grid="audit"] .ag-row').first().waitFor({ timeout: 20000 })
  check('7. the console nav opens /admin/sync/audit', new URL(page.url()).pathname === '/admin/sync/audit', page.url())
  check('7. it reads the whole feed, 50 a page', calls.includes('ActionSync/Audit?page=1&pageSize=50'), calls.filter((c) => c.includes('Audit')).join(','))
  check('7. every entry is drawn', (await page.locator('[data-tab-grid="audit"] .ag-row').count()) === 3)
  const move = strip(await page.locator('.ag-row[row-id="A-2"]').innerText())
  check('7. an entry shows when, who, action, stores and batch, before → after, reason', /2026-10-09 09:05/.test(move) && /m\.qahtani/.test(move) && /Move to worker/.test(move) && /P401, P402/.test(move) && /Batch B-0412/.test(move) && /WPF/.test(move) && /Worker/.test(move) && /Rollout set 4/.test(move), move)
  const unknown = strip(await page.locator('.ag-row[row-id="A-1"] [col-id="action"]').innerText())
  check('7. an action this bundle does not know shows its raw code', unknown === 'Explode', unknown)

  const auditCalls = () => calls.filter((c) => c.startsWith('ActionSync/Audit')).length
  const before = auditCalls()
  await page.locator('[data-audit-from]').fill('2026-10-09')
  await page.locator('[data-audit-to]').fill('2026-10-01')
  check('7. an end date before the start is refused', (await page.locator('[data-audit-bad-range]').count()) === 1 && (await page.locator('[data-audit-apply]').isDisabled()))
  await page.locator('[data-audit-from]').fill('2026-10-01')
  await page.locator('[data-audit-to]').fill('2026-10-09')
  await page.locator('[data-audit-who]').fill(' n.alharbi ')
  await page.locator('[data-audit-code]').fill('P003')
  check('7. nothing is asked while the filters are typed', auditCalls() === before)
  await page.locator('[data-audit-apply]').click()
  check('7. Search asks with from, to, who and code', await waitFor(page, async () => calls.includes('ActionSync/Audit?from=2026-10-01&to=2026-10-09&who=n.alharbi&code=P003&page=1&pageSize=50')), calls.filter((c) => c.includes('Audit')).join(','))
  check('7. …and draws the matching entry only', await waitFor(page, async () => (await page.locator('[data-tab-grid="audit"] .ag-row').count()) === 1 && (await page.locator('.ag-row[row-id="A-3"]').count()) === 1))
  await page.screenshot({ path: `${SHOTS}/audit-page.png`, fullPage: true })
  await page.locator('[data-audit-code]').fill('P999')
  await page.locator('[data-audit-apply]').click()
  await page.locator('[data-tab-empty="audit"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('7. no match reads as empty', /Nothing is recorded for these filters/.test(await page.locator('[data-tab-empty="audit"]').innerText().catch(() => '')))
  await page.locator('[data-audit-clear]').click()
  check('7. Clear brings the whole feed back', await waitFor(page, async () => (await page.locator('[data-tab-grid="audit"] .ag-row').count()) === 3) && (await page.locator('[data-audit-who]').inputValue()) === '')
  check('no page errors (audit page)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
