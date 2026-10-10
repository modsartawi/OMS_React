// Sync console commands drive (ticket 448, spec 444) — drives the REAL store page, fleet page and
// commands page in Chromium against STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2539/2540 are unbuilt, and ticket 450 is
// the live walk.
//
// It verifies:
//   1. a worker store offers Retry now, Re-push and Test connection beside its controls; a WPF store
//      only Move to worker and Test connection;
//   2. a connection test goes from "Testing…" to OK (polled every 2 s on Commands?batch=), and to the
//      flattened error on another store; a command that never ends reads "still running" after 60 s;
//   3. a duplicate refused: DUPLICATE_PENDING is listed with its code, and nothing is polled;
//   4. a re-push from the store page: the date opens on the 41-day window's start, Confirm waits for a
//      preview, the preview's sentence shows the counts and the ECHOED date, a changed input invalidates
//      it, and Confirm posts the SAME inputs with preview: false;
//   5. a re-push of a fleet selection: per-store counts and total, a refused store listed;
//   6. the Commands page and tab: filters, a cancel with a reason, a NOT_PENDING refusal, view only.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-commands-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-commands-shots'
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

const loop = () => ({ lastPassAt: '2026-10-09T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null })
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

// 12 stores; P002 is on WPF.
const makeStores = () =>
  Array.from({ length: 12 }, (_, i) => {
    const code = `P${String(i + 1).padStart(3, '0')}`
    return code === 'P002' ? wpfStore(code) : workerStore(code)
  })

const COUNTERS = {
  items: [
    { objectId: 'Item', bound: 'Out', lineNumber: 1, counter: 88120000, logHead: 88120400, lag: 400, oldestPendingAt: '2026-10-09T11:00:00' },
    { objectId: 'ItemPrice', bound: 'Out', lineNumber: 3, counter: 88303000, logHead: 88303000, lag: 0, oldestPendingAt: null },
    { objectId: 'RetailTrx', bound: 'In', lineNumber: 15, counter: 4412019, logHead: null, lag: null, oldestPendingAt: null },
  ],
}

// The feed the Commands page opens on: newest first.
const seedCommands = () => [
  { id: 'C-3', batchId: 'B-0412', code: 'P006', kind: 'RePush', objectId: 'ItemPrice', fromDate: '2026-10-01', status: 'Pending', result: 'store offline, waiting', requestedBy: 'n.alharbi', requestedAt: '2026-10-09T12:02:00', finishedAt: null },
  { id: 'C-2', batchId: 'B-0412', code: 'P005', kind: 'RePush', objectId: null, fromDate: '2026-10-01T00:00:00', status: 'Pending', result: null, requestedBy: 'n.alharbi', requestedAt: '2026-10-09T12:02:00', finishedAt: null },
  { id: 'C-1', batchId: 'B-0398', code: 'P011', kind: 'RetryNow', objectId: null, fromDate: null, status: 'Failed', result: 'connect timeout (5 s)', requestedBy: 'm.qahtani', requestedAt: '2026-10-09T11:40:00', finishedAt: '2026-10-09T11:40:07' },
]

// How each store's queued command moves, one step per batch read. The last step repeats.
const SCRIPTS = {
  P001: [
    ['Pending', null],
    ['Running', null],
    ['Done', 'OK, 188 ms'],
  ],
  P003: [
    ['Running', null],
    ['Failed', 'connect timeout (5 s): 10.20.3.14,1433'],
  ],
  P004: [['Running', null]],
}

const SUMMARY = { asOf: '2026-10-09T12:04:31', total: 12, counts: { all: 12, onWorker: 11, onWpf: 1, paused: 0, offline: 0, behind: 0, erroring: 0, controlPending: 0 } }
const HOUR = (hour) => ({ hour, pushPasses: 1, pullPasses: 1, connectFailures: 0, chunksPushed: 1, actionsPushed: 1, trxPulled: 1, errors: 0 })
const WORKERS = { items: [{ instance: 'SISAPI-SYNC-01', version: '1.4.2', gateOn: true, pushWidth: 64, pullWidth: 64, pushInFlight: 1, pullInFlight: 1, lastFlushAt: '2026-10-09T12:04:20', isStale: false, settings: {} }] }

// Per-store replay counts the preview answers with, by scope.
const replayCount = (code, objectIds) => (objectIds ? 210 : 1204) + (code === 'P003' ? 1000 : 0)

const browser = await chromium.launch()

async function open({ canOperate = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-10-09T12:04:00') })
  const errors = []
  const calls = []
  const posts = []
  const stores = makeStores()
  const commands = seedCommands()
  const steps = {}
  let batchNo = 500
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
      const s = stores.find((x) => x.code === q.get('code'))
      return route.fulfill(s ? envelope(s) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Store/Hours') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Store/Counters') return route.fulfill(envelope(COUNTERS))
    if (p === 'ActionSync/Audit') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    if (p === 'ActionSync/Commands' && route.request().method() === 'GET') {
      const batch = q.get('batch')
      if (batch) {
        // A poll: each read moves every command of the batch one step along its script.
        for (const c of commands.filter((x) => x.batchId === batch && SCRIPTS[x.code])) {
          const script = SCRIPTS[c.code]
          const i = Math.min(steps[c.id] ?? 0, script.length - 1)
          steps[c.id] = i + 1
          ;[c.status, c.result] = script[i]
          if (['Done', 'Failed'].includes(c.status)) c.finishedAt = '2026-10-09T12:05:08'
        }
      }
      const items = commands.filter(
        (c) =>
          (!batch || c.batchId === batch) &&
          (!q.get('code') || c.code === q.get('code')) &&
          (!q.get('status') || c.status === q.get('status')) &&
          (!q.get('kind') || c.kind === q.get('kind')),
      )
      return route.fulfill(envelope({ items, total: items.length, page: Number(q.get('page')), pageSize: Number(q.get('pageSize')) }))
    }
    if (p === 'ActionSync/Commands') {
      const body = route.request().postDataJSON()
      posts.push({ door: p, body })
      const batchId = `B-${++batchNo}`
      const res = body.codes.map((code) => {
        const s = stores.find((x) => x.code === code)
        if (code === 'P008') return { code, ok: false, commandId: null, error: 'DUPLICATE_PENDING' }
        if (s.host === 'Wpf' && body.kind === 'RetryNow') return { code, ok: false, commandId: null, error: 'NOT_ON_WORKER' }
        const id = `C-${batchId}-${code}`
        commands.unshift({ id, batchId, code, kind: body.kind, objectId: null, fromDate: null, status: 'Pending', result: null, requestedBy: 'msartawi', requestedAt: '2026-10-09T12:05:00', finishedAt: null })
        return { code, ok: true, commandId: id, error: null }
      })
      return route.fulfill(envelope({ batchId, auditId: `A-${batchNo}`, results: res }))
    }
    if (p === 'ActionSync/Commands/RePush') {
      const body = route.request().postDataJSON()
      posts.push({ door: p, body })
      const batchId = body.preview ? null : `B-${++batchNo}`
      const perStore = body.codes.map((code) => {
        const s = stores.find((x) => x.code === code)
        if (s.host === 'Wpf') return { code, actions: 0, ok: false, error: 'NOT_ON_WORKER', commandId: null }
        const commandId = body.preview ? null : `C-${batchId}-${code}`
        if (!body.preview) commands.unshift({ id: commandId, batchId, code, kind: 'RePush', objectId: body.objectIds ? body.objectIds[0] : null, fromDate: body.fromDate, status: 'Pending', result: null, requestedBy: 'msartawi', requestedAt: '2026-10-09T12:05:00', finishedAt: null })
        return { code, actions: replayCount(code, body.objectIds), ok: true, error: null, commandId }
      })
      return route.fulfill(
        envelope({
          preview: body.preview,
          // The door echoes the date it clamped to — with a time part, as a DateTime would serialize.
          effectiveFromDate: `${body.fromDate}T00:00:00`,
          totalActions: perStore.reduce((n, s) => n + s.actions, 0),
          perStore,
          batchId,
          auditId: body.preview ? null : `A-${batchNo}`,
        }),
      )
    }
    if (p === 'ActionSync/Commands/Cancel') {
      const body = route.request().postDataJSON()
      posts.push({ door: p, body })
      const res = body.commandIds.map((id) => {
        const c = commands.find((x) => x.id === id)
        // C-3 started meanwhile: the door refuses it.
        if (!c || c.status !== 'Pending' || id === 'C-3') return { commandId: id, ok: false, error: 'NOT_PENDING' }
        c.status = 'Cancelled'
        c.result = 'cancelled by msartawi'
        return { commandId: id, ok: true, error: null }
      })
      return route.fulfill(envelope({ results: res }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, posts }
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
const verdict = (page) => page.locator('[data-command-run]').getAttribute('data-run-verdict').catch(() => null)
const runText = async (page) => strip(await page.locator('[data-command-run]').innerText())
const polls = (calls, batch) => calls.filter((c) => c === `ActionSync/Commands?batch=${batch}&page=1&pageSize=50`).length

async function sendCommand(page, kind, reason) {
  await page.locator(`[data-control="${kind}"]`).click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.locator('[data-reason-input]').fill(reason)
  await dialog.locator('[data-reason-confirm]').click()
}

// ── 1 + 2 + 3: the store page's commands ────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  check('1. a worker store offers Retry now, Re-push and Test connection, in the prototype order', (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'RetryNow Pause RePush ConnectionTest HandBack')

  // 2: a connection test that ends OK.
  await page.locator('[data-control="ConnectionTest"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('2. Test connection asks for a reason first', strip(await dialog.locator('#modal-title').innerText()) === 'Test connection: store P001' && (await dialog.locator('[data-reason-confirm]').isDisabled()))
  await dialog.locator('[data-reason-input]').fill('  Store called: router replaced  ')
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => posts.length === 1)
  check('2. one POST ActionSync/Commands with the kind, the store and the trimmed reason', JSON.stringify(posts[0]) === JSON.stringify({ door: 'ActionSync/Commands', body: { kind: 'ConnectionTest', codes: ['P001'], reason: 'Store called: router replaced' } }), JSON.stringify(posts[0]))
  await page.locator('[data-command-run]').waitFor({ timeout: 5000 })
  check('2. the page shows "Testing…" at once', (await verdict(page)) === 'running' && /^Testing…$/.test(await runText(page)), await runText(page))
  check('2. …and asks nothing before 2 s', polls(calls, 'B-501') === 0)
  await page.screenshot({ path: `${SHOTS}/testing.png`, fullPage: true })
  await page.clock.runFor(2_000)
  await waitFor(page, async () => polls(calls, 'B-501') === 1)
  check('2. the first poll reads the batch, 2 s later; still testing (Pending)', polls(calls, 'B-501') === 1 && (await verdict(page)) === 'running')
  await page.clock.runFor(2_000)
  await waitFor(page, async () => polls(calls, 'B-501') === 2)
  check('2. …Running is still testing', (await verdict(page)) === 'running')
  await page.clock.runFor(2_000)
  check('2. Done reads OK, with the worker\'s result', await waitFor(page, async () => (await verdict(page)) === 'ok') && (await runText(page)) === 'Connection OK OK, 188 ms', await runText(page))
  await page.clock.runFor(10_000)
  await page.waitForTimeout(200)
  check('2. the poll stops at the terminal status', polls(calls, 'B-501') === 3, String(polls(calls, 'B-501')))
  await page.screenshot({ path: `${SHOTS}/test-ok.png`, fullPage: true })

  // 3: a duplicate refused.
  await page.goto(`${BASE}/admin/sync/store/P008`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  await sendCommand(page, 'RetryNow', 'Back online')
  const dup = await toastText(page, /Retry now/)
  check('3. a duplicate is refused in one toast sentence', dup === 'Retry now was refused for the store.', dup)
  await page.locator('[data-failure="P008"]').waitFor({ timeout: 5000 }).catch(() => {})
  const dupRow = strip(await page.locator('[data-failure="P008"]').innerText().catch(() => ''))
  check('3. …listed with its words and its code DUPLICATE_PENDING', dupRow === 'P008 The same command is already pending DUPLICATE_PENDING', dupRow)
  check('3. …and nothing is polled', (await page.locator('[data-command-run]').count()) === 0 && !calls.some((c) => /batch=B-502/.test(c)))
  await page.screenshot({ path: `${SHOTS}/duplicate.png`, fullPage: true })

  // 2: a connection test that ends in an error.
  await page.goto(`${BASE}/admin/sync/store/P003`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  await sendCommand(page, 'ConnectionTest', 'Check after the move')
  await page.locator('[data-command-run]').waitFor({ timeout: 5000 })
  check('2. a second store starts testing', (await verdict(page)) === 'running')
  await page.clock.runFor(4_000)
  check('2. Failed reads as the flattened error', await waitFor(page, async () => (await verdict(page)) === 'failed') && (await runText(page)) === 'Connection test failed connect timeout (5 s): 10.20.3.14,1433', await runText(page))
  await page.screenshot({ path: `${SHOTS}/test-error.png`, fullPage: true })

  // 2: a command that never ends.
  await page.goto(`${BASE}/admin/sync/store/P004`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  await sendCommand(page, 'RetryNow', 'Store just came back')
  await page.locator('[data-command-run]').waitFor({ timeout: 5000 })
  check('2. Retry now shows "Retrying…"', /^Retrying…$/.test(await runText(page)))
  // The clock stops here, so only the drive's 2 s ticks move it (the drive's own waiting must not
  // count as the command's time), and each tick waits for its read to land before the next.
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 50))
  const batchP004 = 'B-504'
  for (let i = 1; i <= 30; i++) {
    await page.clock.runFor(2_000)
    await waitFor(page, async () => polls(calls, batchP004) >= i)
    if (i === 29) check('2. still "Retrying…" at 58 s', (await verdict(page)) === 'running')
  }
  check('2. after 60 s it reads still running, never failed', await waitFor(page, async () => (await verdict(page)) === 'stillRunning') && /still running/.test(await runText(page)), await runText(page))
  await page.clock.runFor(10_000)
  await page.waitForTimeout(200)
  check('2. …after 30 reads, one every 2 s, and no more', polls(calls, batchP004) === 30, `${polls(calls, batchP004)} reads`)
  await page.screenshot({ path: `${SHOTS}/still-running.png`, fullPage: true })
  await page.clock.resume()

  // 1: a WPF store.
  await page.goto(`${BASE}/admin/sync/store/P002`)
  await page.locator('[data-wpf-note]').waitFor({ timeout: 20000 })
  check('1. a WPF store offers only Move to worker and Test connection', (await page.locator('[data-store-controls]').getAttribute('data-store-controls')) === 'Move ConnectionTest')
  check('no page errors (commands)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: a re-push from the store page ────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  await page.locator('[data-control="RePush"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('4. Re-push opens its dialog', strip(await dialog.locator('#modal-title').innerText()) === 'Re-push to store P001')
  const from = dialog.locator('[data-repush-from]')
  check('4. the date opens on the window\'s start, 41 days from today\'s local date', (await from.inputValue()) === '2026-08-30' && (await from.getAttribute('min')) === '2026-08-30' && (await from.getAttribute('max')) === '2026-10-09', `${await from.inputValue()} ${await from.getAttribute('min')}`)
  check('4. …and the note names the window\'s start', /start of the 41-day action log \(\u2068?2026-08-30/.test(await dialog.locator('[data-repush-window]').innerText()))
  const confirm = dialog.locator('[data-reason-confirm]')
  const previewBtn = dialog.locator('[data-repush-preview-button]')
  check('4. Confirm and Preview wait for a reason', (await confirm.isDisabled()) && (await previewBtn.isDisabled()))
  await dialog.locator('[data-reason-input]').fill('Price file for Oct 1 loaded twice')
  check('4. with a reason, Preview is offered, Confirm still waits for a preview', (await previewBtn.isEnabled()) && (await confirm.isDisabled()))
  await previewBtn.click()
  await waitFor(page, async () => posts.length === 1)
  check('4. the preview posts preview: true, all objects, the window\'s start', JSON.stringify(posts[0].body) === JSON.stringify({ codes: ['P001'], objectIds: null, fromDate: '2026-08-30', reason: 'Price file for Oct 1 loaded twice', preview: true }), JSON.stringify(posts[0].body))
  await dialog.locator('[data-repush-sentence]').waitFor({ timeout: 5000 })
  const sentence = strip(await dialog.locator('[data-repush-sentence]').innerText())
  check('4. the preview reads as one sentence with the count and the ECHOED date', sentence === 'Replays 1,204 actions to store P001, from 2026-08-30.', sentence)
  check('4. Confirm is offered after the preview', await confirm.isEnabled())

  // A changed input invalidates the preview.
  await from.fill('2026-09-15')
  check('4. a changed date invalidates the preview', (await dialog.locator('[data-repush-preview]').getAttribute('data-repush-preview')) === 'stale' && (await confirm.isDisabled()) && /Preview again/.test(await dialog.locator('[data-repush-preview]').innerText()))
  await from.fill('2026-08-01')
  await from.blur()
  check('4. a date before the window is pulled back to its start', (await from.inputValue()) === '2026-08-30', await from.inputValue())
  await dialog.locator('[data-repush-scope-option="chosen"]').check()
  await dialog.locator('[data-repush-object="ItemPrice"]').waitFor({ timeout: 5000 })
  check('4. chosen objects lists the store\'s push objects only', (await dialog.locator('[data-repush-object]').count()) === 2 && (await dialog.locator('[data-repush-object="RetailTrx"]').count()) === 0)
  check('4. …and Preview waits for one to be chosen', await previewBtn.isDisabled())
  // A re-push names at most one object: two is a 400 BAD_REQUEST on the built door (450).
  await dialog.locator('[data-repush-object="Item"]').check()
  await dialog.locator('[data-repush-object="ItemPrice"]').check()
  check('4. …one object only: choosing a second drops the first', !(await dialog.locator('[data-repush-object="Item"]').isChecked()))
  await page.screenshot({ path: `${SHOTS}/repush-inputs.png` })
  await previewBtn.click()
  await waitFor(page, async () => posts.length === 2)
  check('4. the second preview carries the chosen object', JSON.stringify(posts[1].body.objectIds) === '["ItemPrice"]' && posts[1].body.preview === true)
  await waitFor(page, async () => (await dialog.locator('[data-repush-preview]').getAttribute('data-repush-preview')) === 'fresh')
  check('4. …and counts it', strip(await dialog.locator('[data-repush-sentence]').innerText()) === 'Replays 210 actions to store P001, from 2026-08-30.')
  await page.screenshot({ path: `${SHOTS}/repush-preview.png` })
  await confirm.click()
  await waitFor(page, async () => posts.length === 3)
  const sent = posts[2]?.body
  check('4. Confirm posts the SAME inputs with preview: false', JSON.stringify(sent) === JSON.stringify({ ...posts[1].body, preview: false }), JSON.stringify(sent))
  const queued = await toastText(page, /Re-push queued/)
  check('4. one toast sentence, with the batch', /^Re-push queued for 1 store\. Queued as batch B-501\.$/.test(queued), queued)
  check('4. the dialog closes', await waitFor(page, async () => (await page.locator('dialog[open]').count()) === 0))
  await page.locator('[data-tab="commands"]').click()
  await page.locator('[data-tab-grid="commands"] .ag-row').first().waitFor({ timeout: 10000 })
  check('4. the Commands tab reads this store\'s commands', calls.includes('ActionSync/Commands?code=P001&page=1&pageSize=50'), calls.filter((c) => c.includes('Commands?')).join(','))
  const row = strip(await page.locator('[data-tab-grid="commands"] .ag-row').first().innerText())
  check('4. …and lists the queued re-push', /Re-push/.test(row) && /ItemPrice/.test(row) && /2026-08-30/.test(row) && /B-501/.test(row) && /Pending/.test(row), row)
  check('no page errors (store re-push)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: a re-push of a fleet selection ───────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  check('5. the bulk bar offers Re-push, disabled with no selection', await page.locator('[data-bulk="RePush"]').isDisabled())
  for (const c of ['P001', 'P002', 'P003']) await page.locator(`.ag-row[row-id="${c}"] .ag-selection-checkbox input`).click()
  await waitFor(page, async () => (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '3')
  await page.locator('[data-bulk="RePush"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('5. the dialog names the count and lists the stores', strip(await dialog.locator('#modal-title').innerText()) === 'Re-push to 3 stores' && strip(await dialog.locator('[data-reason-codes]').innerText()) === 'P001, P002, P003')
  await dialog.locator('[data-reason-input]').fill('Price fix, set 2')
  await dialog.locator('[data-repush-preview-button]').click()
  await dialog.locator('[data-repush-sentence]').waitFor({ timeout: 5000 })
  const sentence = strip(await dialog.locator('[data-repush-sentence]').innerText())
  check('5. the preview counts per store and in total', sentence === 'Replays 3,408 actions in total to 2 stores, from 2026-08-30: P001 · 1,204, P003 · 2,204.', sentence)
  const refused = strip(await dialog.locator('[data-repush-refused] [data-failure="P002"]').innerText().catch(() => ''))
  check('5. …and lists the store that would be refused, with its code', refused === 'P002 Not on the worker NOT_ON_WORKER', refused)
  await page.screenshot({ path: `${SHOTS}/repush-fleet.png` })
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => posts.length === 2)
  check('5. Confirm posts the three again with preview: false', JSON.stringify(posts[1].body) === JSON.stringify({ ...posts[0].body, preview: false }), JSON.stringify(posts[1].body))
  const said = await toastText(page, /Re-push queued/)
  check('5. one toast sentence counts the queued and the refused', /^Re-push queued for 2 of 3 stores; 1 refused\./.test(said), said)
  check('5. the refused store stays listed under the bulk bar', await waitFor(page, async () => (await page.locator('[data-bulk-bar] [data-failure="P002"]').count()) === 1))
  check('5. the answered selection is cleared', (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '0')
  check('no page errors (fleet re-push)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: the Commands page, a cancel, a refusal, view only ─────────────────────────────────────
{
  const { context, page, errors, calls, posts } = await open()
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-console-page="commands"]').click()
  await page.locator('[data-tab-grid="commands"] .ag-row').first().waitFor({ timeout: 20000 })
  check('6. the console nav opens /admin/sync/commands', new URL(page.url()).pathname === '/admin/sync/commands', page.url())
  check('6. it reads the whole feed, 50 a page', calls.includes('ActionSync/Commands?page=1&pageSize=50'), calls.filter((c) => c.includes('Commands')).join(','))
  check('6. every command is drawn', (await page.locator('[data-tab-grid="commands"] .ag-row').count()) === 3)
  const failed = strip(await page.locator('.ag-row[row-id="C-1"]').innerText())
  check('6. a row shows when, who, store, kind, batch, status and result', /2026-10-09 11:40/.test(failed) && /m\.qahtani/.test(failed) && /P011/.test(failed) && /Retry now/.test(failed) && /B-0398/.test(failed) && /Failed/.test(failed) && /connect timeout/.test(failed), failed)
  const allObjects = strip(await page.locator('.ag-row[row-id="C-2"] [col-id="objectId"]').innerText())
  check('6. a re-push without an object reads all push objects; its date as echoed', allObjects === 'All push objects' && strip(await page.locator('.ag-row[row-id="C-2"] [col-id="fromDate"]').innerText()) === '2026-10-01')
  check('6. Cancel is offered on the pending commands only', (await page.locator('[data-command-cancel]').count()) === 2 && (await page.locator('[data-command-cancel="C-1"]').count()) === 0)

  await page.locator('[data-commands-status]').selectOption('Pending')
  await page.locator('[data-commands-kind]').selectOption('RePush')
  await page.locator('[data-commands-batch]').fill(' B-0412 ')
  await page.locator('[data-commands-code]').fill('P005')
  await page.locator('[data-commands-apply]').click()
  check('6. Search asks with status, batch, code and kind', await waitFor(page, async () => calls.includes('ActionSync/Commands?status=Pending&batch=B-0412&code=P005&kind=RePush&page=1&pageSize=50')), calls.filter((c) => c.includes('Commands')).join(','))
  check('6. …and draws the match', await waitFor(page, async () => (await page.locator('[data-tab-grid="commands"] .ag-row').count()) === 1))
  await page.locator('[data-commands-clear]').click()
  await waitFor(page, async () => (await page.locator('[data-tab-grid="commands"] .ag-row').count()) === 3)

  await page.locator('[data-command-cancel="C-2"]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('6. Cancel asks for a reason', strip(await dialog.locator('#modal-title').innerText()) === 'Cancel Re-push: store P005' && (await dialog.locator('[data-reason-confirm]').isDisabled()))
  await dialog.locator('[data-reason-input]').fill('Wrong date picked')
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => posts.length === 1)
  check('6. one POST Cancel with the command id and the reason', JSON.stringify(posts[0]) === JSON.stringify({ door: 'ActionSync/Commands/Cancel', body: { commandIds: ['C-2'], reason: 'Wrong date picked' } }), JSON.stringify(posts[0]))
  const cancelled = await toastText(page, /cancelled/)
  check('6. one toast sentence', cancelled === '1 command cancelled.', cancelled)
  check('6. the feed is read again and shows it Cancelled', await waitFor(page, async () => (await page.locator('.ag-row[row-id="C-2"] [data-command-status]').getAttribute('data-command-status')) === 'Cancelled'))
  await page.locator('[data-command-cancel="C-3"]').click()
  await page.locator('dialog[open] [data-reason-input]').fill('Not needed')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.locator('[data-failure="C-3"]').waitFor({ timeout: 5000 }).catch(() => {})
  const notPending = strip(await page.locator('[data-failure="C-3"]').innerText().catch(() => ''))
  check('6. a command that started meanwhile is refused NOT_PENDING, listed with its code', notPending === 'C-3 No longer pending NOT_PENDING', notPending)
  check('6. …under the commands title', /refused for these commands/.test(await page.locator('[data-control-failures]').innerText()))
  await page.screenshot({ path: `${SHOTS}/commands-page.png`, fullPage: true })
  check('no page errors (commands page)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open({ canOperate: false })
  await page.goto(`${BASE}/admin/sync/commands`)
  await page.locator('[data-tab-grid="commands"] .ag-row').first().waitFor({ timeout: 20000 })
  check('6. view only: the feed is readable, with no Cancel', (await page.locator('[data-command-cancel], [col-id="cancel"]').count()) === 0)
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-health]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('6. view only: no Retry, Re-push or Test connection on the store page', (await page.getByRole('button', { name: /^(Retry now|Re-push…|Test connection)$/ }).count()) === 0)
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  check('6. view only: no bulk Re-push', (await page.locator('[data-bulk="RePush"]').count()) === 0)
  check('no page errors (view only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
