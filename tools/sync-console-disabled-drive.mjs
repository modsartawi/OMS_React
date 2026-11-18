// Sync console disabled-store drive (ticket 900, BackOffice spec 3913) — drives the REAL Fleet page, store page
// and audit page in Chromium against STUBBED `ActionSync/*` envelopes. The shapes are BackOffice 3913/3914's
// as the amended 2523 contract names them (BackOffice pricing2, merge d5e48c4a2): the toggle's count is the Summary's
// top-level `disabled` (`counts.disabled` counts the view, 0 by default); the preview answers `{ items, unknown }`.
// 🚩 NOTHING here is driven against a live SIS.Api. The staging walk is owed.
//
// It verifies:
//   1. the default Fleet view: the disabled store is not listed, there is no Disabled tile, the GET names no
//      `disabled`, and the toggle reads "Show disabled (1)" off the Summary's count;
//   2. the active view's bulk bar: Move, Hand back, Pause, Resume, Re-push, Disable — never Enable;
//   3. the toggle: the selection is emptied, the GET asks `disabled=only`, only the disabled store is listed, the
//      tiles and the last-hour panel are gone, and the bar offers only Enable; going back restores the tiles;
//   4. a bulk Disable: the reason dialog with its note, one POST, the store leaves the list, the count reads 2;
//   5. a bulk Enable from the disabled view: the store leaves that view and is back in the active one, paused;
//   6. a per-row DISABLED refusal is listed with its words;
//   7. a disabled store's page: only Enable, and "Disabled by … on … — reason"; Enable returns it to paused,
//      after which Resume, Disable and the commands are offered again;
//   8. the audit feed labels Disable and Enable;
//   9. under `oms.locale = ar` (RTL) the toggle's count and the disabled line keep their order. The chrome stays
//      English there (`lng` is pinned to `en` app-wide), so the ar bundle's key coverage is proven in
//      control-helpers.test.ts, on the lf-returns precedent.
//  10. ticket 901, "Disable warns, then allows": the Disable dialog reads `POST ActionSync/Stores/Disable/Preview`
//      (BackOffice 3917) for exactly its stores, shows one row per store with the
//      seven facts, highlights the stores holding work under a one-line count, and never gates Confirm: not on
//      the warnings, not on a failed preview (10b). One store from its page too, and the table under RTL (10c).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-disabled-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-disabled-shots'
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

const loop = () => ({ lastPassAt: '2026-11-15T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null })
const noWho = { isDisabled: false, disabledBy: null, disabledAt: null, disableReason: null, pausedBy: null, pausedAt: null, pauseReason: null }

const workerStore = (code, over = {}) => ({
  code,
  description: `Store ${code}`,
  host: 'Worker',
  isPaused: false,
  ...noWho,
  controlPending: false,
  states: ['onWorker'],
  lastConnectOkAt: '2026-11-15T12:03:10',
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: loop(),
  pull: loop(),
  pendingActions: 4,
  oldestPendingActionAt: '2026-11-15T11:50:00',
  lastTrxPulledAt: '2026-11-15T12:02:00',
  healthUpdatedAt: '2026-11-15T12:03:30',
  controlVersion: 4,
  appliedVersion: 4,
  appliedAt: '2026-11-15T09:00:00',
  ...over,
})

// The state list the door would send, kept in step with the flags.
const restate = (s) => {
  s.states = s.isDisabled ? ['onWorker', 'paused', 'disabled'] : s.isPaused ? ['onWorker', 'paused'] : ['onWorker']
}

// 12 worker stores; P003 is disabled (paused underneath, as 3913 rules).
const makeStores = () =>
  Array.from({ length: 12 }, (_, i) => {
    const code = `P${String(i + 1).padStart(3, '0')}`
    const s = workerStore(code)
    if (code === 'P003')
      Object.assign(s, {
        isPaused: true,
        isDisabled: true,
        disabledBy: 'n.alharbi',
        disabledAt: '2026-11-14T10:15:00',
        disableReason: 'Store closed for good',
        pausedBy: 'n.alharbi',
        pausedAt: '2026-11-14T10:15:00',
        pauseReason: 'Store closed for good',
      })
    restate(s)
    return s
  })

const HOUR = (hour) => ({ hour, pushPasses: 1, pullPasses: 1, connectFailures: 0, chunksPushed: 1, actionsPushed: 1, trxPulled: 1, errors: 0 })
const WORKERS = { items: [{ instance: 'SISAPI-SYNC-01', version: '1.4.2', gateOn: true, pushWidth: 64, pullWidth: 64, pushInFlight: 1, pullInFlight: 1, lastFlushAt: '2026-11-15T12:04:20', isStale: false, settings: {} }] }

const AUDIT = [
  { id: 'A-2', at: '2026-11-14T10:15:00', who: 'n.alharbi', action: 'Disable', codes: ['P003'], batchId: null, before: 'Worker', after: 'Worker, paused, disabled', reason: 'Store closed for good' },
  { id: 'A-1', at: '2026-11-13T09:00:00', who: 'm.qahtani', action: 'Enable', codes: ['P009'], batchId: null, before: 'Worker, paused, disabled', after: 'Worker, paused', reason: 'Reopened' },
]

const browser = await chromium.launch()

// What HQ may not have yet, per store (ticket 901). P001 holds its pending actions, P002 a till backlog, P005 dead
// letters, P006 a waiting script; P007 never connected (null backlog) and P008's pull last failed — neither is work held.
const previewOf = (s) => ({
  code: s.code,
  description: s.description,
  lastConnectOkAt: s.code === 'P007' ? null : s.lastConnectOkAt,
  push: s.push,
  pull: s.code === 'P008' ? { ...s.pull, lastPassOutcome: 'Failed' } : s.pull,
  lastTrxPulledAt: s.lastTrxPulledAt,
  pendingActions: s.code === 'P001' ? s.pendingActions : 0,
  tillBacklogCount: s.code === 'P002' ? 12 : s.code === 'P007' ? null : 0,
  openDeadLetters: s.code === 'P005' ? 2 : 0,
  scriptsWaiting: s.code === 'P006' ? 1 : 0,
})

/** Codes the preview stub also names under `unknown`, beside any sent code the fleet lacks. */
let extraUnknown = []

async function open({ locale = 'en', previewFails = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1300 } })
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-11-15T12:04:00') })
  const errors = []
  const calls = []
  const posts = []
  const previews = []
  const stores = makeStores()
  const audit = AUDIT.map((a) => ({ ...a }))
  const byCode = (c) => stores.find((s) => s.code === c)
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((loc) => {
    localStorage.setItem('oms.locale', loc)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const q = url.searchParams
    calls.push(p + url.search)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['ActionSyncConsole:03', 'ActionSyncConsole:06']))
    if (p === 'ActionSync/Workers') return route.fulfill(envelope(WORKERS))
    if (p === 'ActionSync/Fleet/Summary') {
      const active = stores.filter((s) => !s.isDisabled)
      const n = (st) => active.filter((s) => s.states.includes(st)).length
      return route.fulfill(
        envelope({
          asOf: '2026-11-15T12:04:31',
          total: active.length,
          counts: { all: active.length, onWorker: n('onWorker'), onWpf: 0, paused: n('paused'), offline: 0, behind: 0, erroring: 0, controlPending: n('controlPending'), mirrorOffline: 0, mirrorBehind: 0, deadLetters: 0, deferredTooLong: 0, railsDisagree: 0, disabled: 0 },
          disabled: stores.length - active.length,
        }),
      )
    }
    if (p === 'ActionSync/Fleet/LastHour') return route.fulfill(envelope({ current: HOUR('2026-11-15T12:00:00'), previous: HOUR('2026-11-15T11:00:00') }))
    if (p === 'ActionSync/Fleet') {
      const only = q.get('disabled') === 'only'
      const items = stores.filter((s) => !!s.isDisabled === only)
      return route.fulfill(envelope({ items, total: items.length, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) }))
    }
    if (p === 'ActionSync/Store') {
      const s = byCode(q.get('code'))
      return route.fulfill(s ? envelope(s) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Store/Hours' || p === 'ActionSync/Store/Counters') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Audit') {
      const code = q.get('code')
      const items = audit.filter((a) => !code || a.codes.includes(code))
      return route.fulfill(envelope({ items, total: items.length, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) }))
    }
    if (p === 'ActionSync/Stores/Disable/Preview') {
      const body = route.request().postDataJSON()
      previews.push(body)
      if (previewFails) return route.fulfill(envelope(null, { status: 500, success: false, message: 'The preview read timed out.' }))
      const unknown = [...body.codes.filter((c) => !byCode(c)), ...extraUnknown]
      return route.fulfill(envelope({ items: body.codes.map(byCode).filter(Boolean).map(previewOf), unknown }))
    }
    if (p === 'ActionSync/Stores/Control') {
      const body = route.request().postDataJSON()
      posts.push(body)
      const res = body.codes.map((code) => {
        const s = byCode(code)
        if (!s) return { code, ok: false, error: 'NO_STORE', controlVersion: 0 }
        // P010 was disabled by someone else after the page read it.
        if (code === 'P010' && body.action !== 'Enable') return { code, ok: false, error: 'DISABLED', controlVersion: s.controlVersion }
        if (s.isDisabled && body.action !== 'Enable') return { code, ok: false, error: 'DISABLED', controlVersion: s.controlVersion }
        if (!s.isDisabled && body.action === 'Enable') return { code, ok: false, error: 'NOT_DISABLED', controlVersion: s.controlVersion }
        if (body.action === 'Disable') Object.assign(s, { isDisabled: true, isPaused: true, disabledBy: 'msartawi', disabledAt: '2026-11-15T12:05:00', disableReason: body.reason })
        if (body.action === 'Enable') Object.assign(s, { isDisabled: false, disabledBy: null, disabledAt: null, disableReason: null })
        if (body.action === 'Pause') s.isPaused = true
        if (body.action === 'Resume') s.isPaused = false
        s.controlVersion += 1
        restate(s)
        return { code, ok: true, error: null, controlVersion: s.controlVersion }
      })
      audit.unshift({ id: `A-${audit.length + 1}`, at: '2026-11-15T12:05:00', who: 'msartawi', action: body.action, codes: body.codes, batchId: null, before: null, after: null, reason: body.reason })
      return route.fulfill(envelope({ auditId: `A-${audit.length}`, results: res }))
    }
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, posts, previews, byCode }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitFor = async (page, fn, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const tick = (page, code) => page.locator(`.ag-row[row-id="${code}"] .ag-selection-checkbox input`).click()
// A row is drawn once per grid section (the pinned checkbox column too), so its id is read once.
const rowIds = (page) => page.locator('[data-fleet-table] .ag-row[row-id]').evaluateAll((rs) => [...new Set(rs.map((r) => r.getAttribute('row-id')))].sort())
const bulkButtons = (page) => page.locator('[data-bulk-bar] [data-bulk]').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-bulk')).join(' '))
const toggle = (page) => page.locator('[data-show-disabled]')
const sendWithReason = async (page, reason) => {
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  const text = await dialog.innerText()
  await dialog.locator('[data-reason-input]').fill(reason)
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => (await page.locator('dialog[open]').count()) === 0)
  return text
}

// ── 1–6: the Fleet page ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts, byCode } = await open()
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  await waitFor(page, async () => (await toggle(page).getAttribute('data-show-disabled')) === '1')

  const ids = await rowIds(page)
  check('1. the default view leaves the disabled store out', !ids.includes('P003') && ids.includes('P001'), ids.join(','))
  check('1. …and draws no Disabled tile', (await page.locator('[data-tile="disabled"]').count()) === 0 && (await page.locator('[data-tile="paused"]').count()) === 1)
  check('1. …and its GET names no disabled', calls.filter((c) => c.startsWith('ActionSync/Fleet?')).every((c) => !/disabled=/.test(c)))
  check('1. the toggle reads "Show disabled (1)"', strip(await toggle(page).innerText()) === 'Show disabled (1)', strip(await toggle(page).innerText()))
  check('1. …and is not pressed', (await toggle(page).getAttribute('aria-pressed')) === 'false')

  check('2. the active bulk bar: Move, Hand back, Pause, Resume, Re-push, Disable', (await bulkButtons(page)) === 'Move HandBack Pause Resume RePush Disable', await bulkButtons(page))

  await tick(page, 'P001')
  await waitFor(page, async () => (await page.locator('[data-selection-count="1"]').count()) === 1)
  await toggle(page).click()
  await waitFor(page, async () => (await rowIds(page)).join(',') === 'P003')
  check('3. the toggle empties the selection', (await page.locator('[data-selection-count="0"]').count()) === 1)
  check('3. …asks the door for disabled=only', calls.some((c) => /^ActionSync\/Fleet\?.*disabled=only/.test(c)), calls.filter((c) => c.startsWith('ActionSync/Fleet?')).pop())
  check('3. …and lists only the disabled store', (await rowIds(page)).join(',') === 'P003')
  check('3. the tiles and the last-hour panel are gone', (await page.locator('[data-tiles]').count()) === 0 && (await page.locator('[data-tile]').count()) === 0)
  check('3. the view says what it is', (await page.locator('[data-disabled-note]').count()) === 1 && (await toggle(page).getAttribute('aria-pressed')) === 'true')
  check('3. the bulk bar offers only Enable', (await bulkButtons(page)) === 'Enable', await bulkButtons(page))
  const stateCell = strip(await page.locator('.ag-row[row-id="P003"]').innerText())
  check('3. the row reads Disabled', /Disabled/.test(stateCell), stateCell)
  await page.screenshot({ path: `${SHOTS}/disabled-view.png`, fullPage: true })
  await toggle(page).click()
  await page.locator('[data-tile="paused"]').waitFor({ timeout: 5000 })
  check('3. going back restores the tiles and the active list', (await rowIds(page)).includes('P001') && !(await rowIds(page)).includes('P003'))

  // 4: a bulk Disable of P001 and P002.
  await tick(page, 'P001')
  await tick(page, 'P002')
  await page.locator('[data-bulk="Disable"]').click()
  const dialogText = await sendWithReason(page, '  Closed stores, batch 1 ')
  check('4. the Disable dialog says only Enable lifts it', /only Enable does/.test(dialogText), dialogText.slice(0, 200))
  check('4. one POST: Disable, the two stores, the trimmed reason', JSON.stringify(posts.at(-1)) === JSON.stringify({ action: 'Disable', codes: ['P001', 'P002'], reason: 'Closed stores, batch 1' }), JSON.stringify(posts.at(-1)))
  check('4. the disabled stores leave the list', await waitFor(page, async () => { const r = await rowIds(page); return !r.includes('P001') && !r.includes('P002') }))
  check('4. the toggle counts 3', await waitFor(page, async () => strip(await toggle(page).innerText()) === 'Show disabled (3)'), strip(await toggle(page).innerText()))

  // 6: a per-row DISABLED refusal, listed with its words.
  await tick(page, 'P010')
  await tick(page, 'P011')
  await page.locator('[data-bulk="Pause"]').click()
  await sendWithReason(page, 'Maintenance window')
  await page.locator('[data-failure="P010"]').waitFor({ timeout: 5000 })
  const fail = strip(await page.locator('[data-failure="P010"]').innerText())
  check('6. a DISABLED refusal is listed with its words', (await page.locator('[data-failure="P010"]').getAttribute('data-failure-code')) === 'DISABLED' && /only Enable is allowed/.test(fail), fail)
  check('6. …and the store that could take it is not', (await page.locator('[data-failure="P011"]').count()) === 0)

  // 5: Enable P001 from the disabled view.
  await toggle(page).click()
  await waitFor(page, async () => (await rowIds(page)).join(',') === 'P001,P002,P003')
  check('5. the disabled view lists the three', (await rowIds(page)).join(',') === 'P001,P002,P003', (await rowIds(page)).join(','))
  await tick(page, 'P001')
  await page.locator('[data-bulk="Enable"]').click()
  const enableText = await sendWithReason(page, 'Reopened after renovation')
  check('5. the Enable dialog says the store comes back paused', /comes back paused/.test(enableText))
  check('5. one POST: Enable P001', JSON.stringify(posts.at(-1)) === JSON.stringify({ action: 'Enable', codes: ['P001'], reason: 'Reopened after renovation' }), JSON.stringify(posts.at(-1)))
  check('5. P001 leaves the disabled view', await waitFor(page, async () => (await rowIds(page)).join(',') === 'P002,P003'))
  await toggle(page).click()
  await waitFor(page, async () => (await rowIds(page)).includes('P001'))
  check('5. …and is back in the active list, paused', (await rowIds(page)).includes('P001') && byCode('P001').isPaused === true && /Paused/.test(strip(await page.locator('.ag-row[row-id="P001"]').innerText())))
  await page.screenshot({ path: `${SHOTS}/active-view.png`, fullPage: true })
  check('no page errors (fleet)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: a disabled store's page ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  await page.goto(`${BASE}/admin/sync/store/P003`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  check('7. a disabled store offers only Enable', (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'Enable')
  const line = strip(await page.locator('[data-store-disabled]').innerText())
  check('7. it says who disabled it, when and why', /^Disabled by n\.alharbi on .*2026.* — Store closed for good$/.test(line), line)
  await page.screenshot({ path: `${SHOTS}/store-disabled.png`, fullPage: true })
  await page.locator('[data-control="Enable"]').click()
  await sendWithReason(page, 'Reopened')
  check('7. Enable sends one POST', JSON.stringify(posts.at(-1)) === JSON.stringify({ action: 'Enable', codes: ['P003'], reason: 'Reopened' }))
  check(
    '7. the store comes back paused: Resume, Disable and the commands are offered again',
    await waitFor(page, async () => (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'RetryNow Resume RePush ConnectionTest Disable HandBack'),
    await page.locator('[data-store-controls]').getAttribute('data-store-controls'),
  )
  check('7. the disabled line is gone', (await page.locator('[data-store-disabled]').count()) === 0)
  check('no page errors (store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: the audit feed ───────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/admin/sync/audit`)
  await page.locator('.ag-row[row-id="A-2"]').waitFor({ timeout: 20000 })
  const action = async (id) => strip(await page.locator(`.ag-row[row-id="${id}"] [col-id="action"]`).innerText())
  check('8. Disable reads "Disabled a store"', (await action('A-2')) === 'Disabled a store', await action('A-2'))
  check('8. Enable reads "Enabled a store"', (await action('A-1')) === 'Enabled a store', await action('A-1'))
  check('no page errors (audit)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: Arabic ───────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ locale: 'ar' })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  await waitFor(page, async () => (await toggle(page).getAttribute('data-show-disabled')) === '1')
  check('9. the page is RTL', (await page.locator('html').getAttribute('dir')) === 'rtl')
  const label = strip(await toggle(page).innerText())
  check('9. the toggle keeps its count isolated', label === 'Show disabled (1)' && (await toggle(page).locator('bdi[dir="ltr"]').count()) === 1, label)
  await page.goto(`${BASE}/admin/sync/store/P003`)
  await page.locator('[data-store-disabled]').waitFor({ timeout: 20000 })
  const line = strip(await page.locator('[data-store-disabled]').innerText())
  check('9. the disabled line reads in order under RTL', /^Disabled by n\.alharbi on 2026-11-14 10:15 — Store closed for good$/.test(line), line)
  check('9. …each value isolated (who, when, reason)', (await page.locator('[data-store-disabled] bdi').count()) === 3)
  await page.screenshot({ path: `${SHOTS}/store-disabled-ar.png`, fullPage: true })
  check('no page errors (ar)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: the Disable dialog warns, then allows (ticket 901) ─────────────────────────────────────
{
  const { context, page, errors, posts, previews } = await open()
  const picked = ['P001', 'P002', 'P004', 'P005', 'P006', 'P007', 'P008']
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  for (const c of picked) await tick(page, c)
  await page.locator('[data-bulk="Disable"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-disable-warnings="read"]').waitFor({ timeout: 5000 })
  check('10. one preview POST, for exactly the selection', JSON.stringify(previews) === JSON.stringify([{ codes: picked }]), JSON.stringify(previews))
  const rows = await dialog.locator('[data-disable-row]').evaluateAll((rs) => rs.map((r) => `${r.getAttribute('data-disable-row')}:${r.getAttribute('data-outstanding')}`).join(' '))
  // 3913 review: the stores still holding work are drawn first, each kind in the door's order.
  check('10. one row per store, held work first; P001, P002, P005, P006 highlighted', rows === 'P001:true P002:true P005:true P006:true P004:false P007:false P008:false', rows)
  const summary = strip(await dialog.locator('[data-disable-summary]').innerText())
  check('10. the one-line count reads "4 of 7"', summary === 'Stores still holding work HQ has not received: 4 of 7.', summary)
  const heads = strip(await dialog.locator('[data-disable-table] thead').innerText())
  check(
    '10. the seven facts are columns',
    ['Last good connect', 'Last push', 'Last pull', 'Last transaction pulled', 'Pending actions', 'Till backlog', 'Dead letters', 'Scripts waiting'].every((h) => heads.includes(h)),
    heads,
  )
  const cell = (code, col) => dialog.locator(`[data-disable-row="${code}"] [data-disable-count="${col}"]`)
  check(
    '10. the held count is marked, the others not',
    (await cell('P002', 'tillBacklog').getAttribute('data-held')) === 'true' &&
      strip(await cell('P002', 'tillBacklog').innerText()) === '12' &&
      (await cell('P002', 'pendingActions').getAttribute('data-held')) === 'false',
  )
  check(
    '10. a backlog never measured reads "Not measured"; a store never connected reads "Never"',
    strip(await cell('P007', 'tillBacklog').innerText()) === 'Not measured' && /Never/.test(strip(await dialog.locator('[data-disable-row="P007"]').innerText())),
  )
  check('10. a failed last pull is shown, not flagged', /Failed/.test(strip(await dialog.locator('[data-disable-row="P008"] [data-disable-loop="pull"]').innerText())))
  const storeCell = dialog.locator('[data-disable-row="P002"] td').first()
  check('10. the store cell is "code · name", isolated once', strip(await storeCell.innerText()) === 'P002 · Store P002' && (await storeCell.locator('bdi').count()) === 1, strip(await storeCell.innerText()))
  check('10. the dialog says nothing stops it', (await dialog.locator('[data-disable-allowed]').count()) === 1)
  check('10. Confirm waits only for the reason', (await dialog.locator('[data-reason-confirm]').isDisabled()) === true)
  await dialog.locator('[data-reason-input]').fill('Closed for good')
  check('10. …and is offered with stores still holding work', (await dialog.locator('[data-reason-confirm]').isDisabled()) === false)
  await page.screenshot({ path: `${SHOTS}/disable-warnings.png`, fullPage: true })
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => (await page.locator('dialog[open]').count()) === 0)
  check('10. …and, every code known, no "not in the fleet" line', (await page.locator('[data-disable-unknown]').count()) === 0)
  check('10. Disable is sent for all seven, held work or not', JSON.stringify(posts.at(-1)) === JSON.stringify({ action: 'Disable', codes: picked, reason: 'Closed for good' }), JSON.stringify(posts.at(-1)))

  // One store from its page, nothing held; the door also answers one code the fleet does not have (`unknown`).
  extraUnknown = ['ZZ99']
  await page.goto(`${BASE}/admin/sync/store/P009`)
  await page.locator('[data-control="Disable"]').waitFor({ timeout: 20000 })
  await page.locator('[data-control="Disable"]').click()
  await page.locator('dialog[open] [data-disable-warnings="read"]').waitFor({ timeout: 5000 })
  const one = strip(await page.locator('dialog[open] [data-disable-summary]').innerText())
  check('10. one store, nothing held: "No store holds work … (1 checked)"', one === 'No store holds work HQ has not received (1 checked).' && JSON.stringify(previews.at(-1)) === JSON.stringify({ codes: ['P009'] }), one)
  check('10. …and its row is not highlighted', (await page.locator('dialog[open] [data-disable-row="P009"]').getAttribute('data-outstanding')) === 'false')
  const unknownLine = strip(await page.locator('dialog[open] [data-disable-unknown]').innerText().catch(() => ''))
  check('10. the codes the fleet does not have are named on one line, isolated once', unknownLine === 'Not in the fleet, so not disabled: ZZ99' && (await page.locator('dialog[open] [data-disable-unknown] bdi[dir="ltr"]').count()) === 1, unknownLine)
  extraUnknown = []
  await page.locator('dialog[open] [data-reason-cancel]').click()

  // Every other control reads no preview.
  const before = previews.length
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P010"]').waitFor({ timeout: 20000 })
  await tick(page, 'P010')
  await page.locator('[data-bulk="Pause"]').click()
  await page.locator('dialog[open]').waitFor()
  await page.waitForTimeout(300)
  check('10. Pause reads no preview and draws no table', previews.length === before && (await page.locator('dialog[open] [data-disable-warnings]').count()) === 0)
  await page.locator('dialog[open] [data-reason-cancel]').click()
  check('no page errors (warnings)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10b: a failed preview never blocks the Disable ─────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open({ previewFails: true })
  await page.goto(`${BASE}/admin/sync/store/P002`)
  await page.locator('[data-control="Disable"]').waitFor({ timeout: 20000 })
  await page.locator('[data-control="Disable"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-disable-warnings="failed"]').waitFor({ timeout: 5000 })
  const said = strip(await dialog.locator('[data-disable-warnings="failed"]').innerText())
  check('10b. a failed preview says so, and that Disable is still allowed', /^What HQ may not have yet could not be read\. You can still disable\. \S/.test(said), said)
  await dialog.locator('[data-reason-input]').fill('Unreachable, closed')
  check('10b. …and Confirm is offered', (await dialog.locator('[data-reason-confirm]').isDisabled()) === false)
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => (await page.locator('dialog[open]').count()) === 0)
  check('10b. Disable is sent', JSON.stringify(posts.at(-1)) === JSON.stringify({ action: 'Disable', codes: ['P002'], reason: 'Unreachable, closed' }), JSON.stringify(posts.at(-1)))
  check('no page errors (failed preview)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10c: the table under RTL ─────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ locale: 'ar' })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  for (const c of ['P001', 'P002', 'P004']) await tick(page, c)
  await page.locator('[data-bulk="Disable"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-disable-warnings="read"]').waitFor({ timeout: 5000 })
  const summary = strip(await dialog.locator('[data-disable-summary]').innerText())
  check('10c. under RTL the count keeps its order, each figure isolated', /2 of 3/.test(summary) && (await dialog.locator('[data-disable-summary] bdi[dir="ltr"]').count()) === 2, summary)
  check('10c. the pair stays "code · name"', strip(await dialog.locator('[data-disable-row="P002"] td').first().innerText()) === 'P002 · Store P002')
  await page.screenshot({ path: `${SHOTS}/disable-warnings-ar.png`, fullPage: true })
  check('no page errors (warnings ar)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
