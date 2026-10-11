// Sync console Store page drive (ticket 446, spec 444) — drives the REAL store page in Chromium
// against STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2539 is unbuilt, and ticket 450 is the
// live walk.
//
// It verifies:
//   1. a worker store's header (code, description, host, door states, the pending badge read off
//      controlPending) and its health summary (reachable, backoff, push lag + oldest pending, last trx
//      pulled, each loop's last pass and last error);
//   2. the 24 h strip: one cell per hour from Store/Hours, coloured by the door's cell (an unknown cell
//      as noData), and the five-entry legend;
//   3. the six tabs in order; Counters opens first, a pull counter's log head and lag are blank;
//   4. Passes opens on 7 days ago, its picker is bounded to 30 days (an older date is pulled back to the
//      bound before any call), it pages at 50, the strip's Refresh re-reads the open tab alone at its
//      date and page, and a pass opens its detail from Store/PassDetail;
//   5. Scripts shows the script id and its state, never SQL; Location shows no credentials;
//   6. Commands (448's) and Audit (447's) read here only as empty feeds; ?tab= opens a tab
//      and survives a reload;
//   7. a WPF store shows only Counters and Passes, with the WPF note, no health and no strip;
//   8. a 404 NO_STORE shows "No such store", asked once, not a crash.
//
// Ticket 457 (spec 2563, BackOffice 2564/2565/2567/2568 — unbuilt, so every mirror shape is a stub in the
// contract's section "Mirror lane and rail agreement"). The stores above stay in the shape the doors had
// BEFORE 2563, so the console's boundary fill runs on every old check. It adds:
//   9. a store on mirror: the mirror block (reachability, last pull / last good pull, till backlog with its
//      "till clock" oldest, inbox pending / deferred, open dead letters, the mirror state badges); a never
//      measured till backlog reads differently from 0;
//  10. the strip's Mirror line from each hour's mirror.cell, on the same legend, its hover giving the counts;
//  11. the Mirror tab: the inbox by entity type, dead letters paged at 50, the stage and reason filters,
//      include-acknowledged (muted rows with who / when / why), the error truncated and expandable, no
//      payload anywhere, and the tab's Refresh;
//  12. a store not on mirror (an old door's): the block, the strip line and the tab read "not on mirror",
//      and Store/Mirror is never asked (a request counter); a WPF store on mirror draws its strip with the
//      Mirror line alone.
// 🚩 Changed on purpose by 457, and only these two: the worker store's tab list (six → seven, Mirror last)
// and the WPF store's (Counters, Passes → Counters, Passes, Mirror). Every other assertion is unchanged.
//
// Ticket 459 (spec 2563, BackOffice 2571/2572 — unbuilt, stubbed in the same section's "Rail agreement"):
//  13. the Agreement tab, read only: the store's agreement, the judged days in the door's order (newest
//      first, a day with no NewPos receipt absent) with each side's counts, totals to 3 decimals and the gap
//      counts; the gaps paged at 50 (receipt, kind, both totals, a missing side blank); picking a day asks
//      the door with day= and narrows the gaps, and a way back to every day; no Recheck without canOperate;
//  14. with canOperate: Recheck a day through the reason dialog (Confirm waits for a reason; the POST carries
//      code, day and the trimmed reason); a healed day's row is replaced and its gap clears, a day with no
//      NewPos receipt is removed; the gaps and the store header are read again; a refusal shows its code
//      with its words;
//  15. a store on mirror with no judged day says so; a store not on mirror shows the note and asks nothing.
// 🚩 Changed on purpose by 459, and only the same four tab-list assertions (sections 3, 7, 11, 12b): Agreement
// is appended after Mirror, on worker and WPF stores alike.
//
// Ticket 467 (spec 444 amended by BackOffice spec 2586, doors 2587/2588 — unbuilt, so Store/Transactions is a stub
// in the contract's section "Today's transactions"):
//  16. the Transactions tab, read only: not read before it is opened; the day picker offers today and the 7 days
//      before it (today first, as the default); the door's summary of the day it served (sales, returns, the signed
//      total, last completed, not yet on the counter rail, and mismatches only when > 0, in the danger token); the
//      list paged at 50 with each receipt's counter badge (arrived / not yet / totals differ, an unknown flag raw)
//      and the counter total in its tooltip; each filter (status, kind, counter flag) and the exact receipt search
//      asked from page 1, the search on submit only; a past day; a day with no receipt is an empty list; Refresh;
//  17. polling (Playwright's clock, the real 60 s interval): today re-reads after 60 s, a past day never does, and
//      a closed tab never reads;
//  18. a store whose mirror the door cannot read (available: false) says so with no list; a WPF store reads
//      "No NewPos receipts" and Store/Transactions is never asked.
// 🚩 Changed on purpose by 467, and only the same four tab-list assertions (sections 3, 7, 11, 12b): Transactions is
// appended after Agreement, on worker and WPF stores alike (spec 2586 decision 5).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-store-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-store-shots'
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

const WORKER_STORE = {
  code: 'P001',
  description: 'Olaya Main',
  host: 'Worker',
  isPaused: false,
  controlPending: true,
  states: ['onWorker', 'erroring', 'controlPending'],
  lastConnectOkAt: '2026-10-09T12:03:10',
  lastConnectFailAt: '2026-10-09T09:15:00',
  lastConnectError: 'A network-related error occurred (timeout 5 s)',
  backoffUntil: '2026-10-09T12:05:00',
  push: loop({ lastPassOutcome: 'Failed', lastErrorAt: '2026-10-09T11:31:02', lastError: 'Violation of PRIMARY KEY constraint' }),
  pull: loop(),
  pendingActions: 1240,
  oldestPendingActionAt: '2026-10-09T10:50:00',
  lastTrxPulledAt: '2026-10-09T12:02:00',
  healthUpdatedAt: '2026-10-09T12:03:30',
  controlVersion: 7,
  appliedVersion: 6,
  appliedAt: '2026-10-09T11:00:00',
}
const WPF_STORE = {
  code: 'P002',
  description: 'Tahlia',
  host: 'Wpf',
  isPaused: false,
  controlPending: false,
  states: ['onWpf'],
  lastConnectOkAt: null,
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: noLoop(),
  pull: noLoop(),
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: null,
  healthUpdatedAt: null,
  controlVersion: 0,
  appliedVersion: 0,
  appliedAt: null,
}
// ── Ticket 457: stores on the mirror rail, in the contract's 2563 shape ──
const MIRROR_LANE = {
  onMirror: true,
  lastPullAt: '2026-10-09T12:03:30',
  lastPullOkAt: '2026-10-09T11:58:00',
  lastConnectOkAt: '2026-10-09T11:58:00',
  lastConnectFailAt: '2026-10-09T12:03:30',
  lastConnectError: 'Login failed for user (mirror connect)',
  tillBacklogCount: 4210,
  tillBacklogOldestAt: '2026-10-09T10:41:00',
  inboxPending: 1830,
  inboxDeferred: 12,
  oldestDeferredAt: '2026-10-09T09:20:00',
  openDeadLetters: 65,
}
const MIRROR_STORE = {
  ...WORKER_STORE,
  code: 'P003',
  description: 'Malaz',
  controlPending: false,
  states: ['onWorker', 'mirrorOffline', 'mirrorBehind', 'deadLetters'],
  mirror: MIRROR_LANE,
  agreement: 'notJudged',
}
// On mirror, never measured (no good connect yet), and no mirror state.
const UNMEASURED_STORE = {
  ...WORKER_STORE,
  code: 'P004',
  description: 'Sulay',
  controlPending: false,
  states: ['onWorker'],
  mirror: {
    ...MIRROR_LANE,
    lastConnectFailAt: null,
    lastConnectError: null,
    tillBacklogCount: null,
    tillBacklogOldestAt: null,
    inboxPending: 0,
    inboxDeferred: 0,
    oldestDeferredAt: null,
    openDeadLetters: 0,
  },
  agreement: 'notJudged',
}
// A WPF store on mirror: its lane is its own (ADR 0073).
const WPF_MIRROR_STORE = { ...WPF_STORE, code: 'P005', description: 'Rawdah', mirror: MIRROR_LANE, agreement: 'notJudged' }
// ── Ticket 459: a store whose rails disagree ──
const DISAGREE_STORE = {
  ...WORKER_STORE,
  code: 'P006',
  description: 'Hamra',
  controlPending: false,
  states: ['onWorker', 'railsDisagree'],
  mirror: { ...MIRROR_LANE, lastConnectFailAt: null, lastConnectError: null, openDeadLetters: 0 },
  agreement: 'disagree',
}
// ── Ticket 467: a NewPos store selling today, and one whose mirror the door cannot read ──
const NEWPOS_STORE = { ...DISAGREE_STORE, code: 'P007', description: 'Nakheel', states: ['onWorker'], agreement: 'agree' }
const UNREADABLE_STORE = { ...WORKER_STORE, code: 'P008', description: 'Suwaidi', controlPending: false, states: ['onWorker'] }
const STORES = {
  P001: WORKER_STORE,
  P002: WPF_STORE,
  P003: MIRROR_STORE,
  P004: UNMEASURED_STORE,
  P005: WPF_MIRROR_STORE,
  P006: DISAGREE_STORE,
  P007: NEWPOS_STORE,
  P008: UNREADABLE_STORE,
}

// Store/Agreement: D-1..D-7 newest first; 2026-10-05 had no NewPos receipt, so it is absent.
const AGREEMENT_DAYS = [
  { businessDay: '2026-10-08', judgedAt: '2026-10-09T03:00:12', agrees: false, mirrorCount: 412, counterCount: 357, mirrorTotal: 48210.125, counterTotal: 43002.5, missingAtCounter: 55, missingAtMirror: 0, totalMismatches: 1 },
  { businessDay: '2026-10-07', judgedAt: '2026-10-09T03:00:10', agrees: true, mirrorCount: 398, counterCount: 398, mirrorTotal: 45120.75, counterTotal: 45120.75, missingAtCounter: 0, missingAtMirror: 0, totalMismatches: 0 },
  { businessDay: '2026-10-06', judgedAt: '2026-10-09T03:00:08', agrees: false, mirrorCount: 401, counterCount: 402, mirrorTotal: 46000, counterTotal: 46012.345, missingAtCounter: 0, missingAtMirror: 1, totalMismatches: 0 },
  { businessDay: '2026-10-04', judgedAt: '2026-10-09T03:00:05', agrees: true, mirrorCount: 120, counterCount: 120, mirrorTotal: 9000.5, counterTotal: 9000.5, missingAtCounter: 0, missingAtMirror: 0, totalMismatches: 0 },
]
// 57 gaps: two pages at 50 — 55 receipts missing at the counter and one total mismatch on 10-08, one missing at
// the mirror on 10-06.
const AGREEMENT_GAPS = [
  ...Array.from({ length: 55 }, (_, i) => ({
    businessDay: '2026-10-08',
    receiptNumber: `0042-0008-${String(118800 + i)}`,
    kind: 'missingAtCounter',
    mirrorTotal: 93.5 + i,
    counterTotal: null,
  })),
  { businessDay: '2026-10-08', receiptNumber: '0042-0008-118900', kind: 'totalMismatch', mirrorTotal: 120.5, counterTotal: 120.125 },
  { businessDay: '2026-10-06', receiptNumber: '0042-0006-117001', kind: 'missingAtMirror', mirrorTotal: null, counterTotal: 12.345 },
]
// What a recheck finds: 10-06 healed (the late receipt arrived), 10-04 had no NewPos receipt after all.
const HEALED_1006 = { ...AGREEMENT_DAYS[2], judgedAt: '2026-10-09T12:04:00', agrees: true, mirrorCount: 402, mirrorTotal: 46012.345, missingAtMirror: 0 }

// Store/Transactions (467): P007's NewPos receipts. Today (the clock's 2026-10-09) has 63: 60 COMPLETED (two pages at
// 50) and 3 VOIDED, sales and returns (a return's total already negative, as the door signs it), every counter flag
// and one a door newer than this bundle might send. 2026-10-08 has three, all arrived; every other day has none.
const pad2 = (n) => String(n).padStart(2, '0')
const localStamp = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
const TODAY_TX = Array.from({ length: 63 }, (_, i) => {
  const isReturn = i % 9 === 4
  const total = isReturn ? -(10 + i * 0.125) : 25.5 + i
  const counter = i === 1 ? 'melted' : i % 10 === 3 ? 'notYet' : i % 17 === 5 ? 'mismatch' : 'arrived'
  return {
    transactionId: `TX-${9000 + i}`,
    receiptNumber: `0042-0009-${119000 - i}`,
    registerId: `R0${1 + (i % 2)}`,
    operatorId: `OP-${100 + (i % 3)}`,
    status: i % 20 === 7 ? 'VOIDED' : 'COMPLETED',
    isReturn,
    total,
    openedAt: localStamp(new Date(2026, 9, 9, 11, 57 - i)),
    completedAt: localStamp(new Date(2026, 9, 9, 11, 59 - i)),
    counter,
    counterTotal: counter === 'notYet' ? null : counter === 'mismatch' ? total + 0.5 : total,
  }
})
const YESTERDAY_TX = Array.from({ length: 3 }, (_, i) => ({
  transactionId: `TX-${8000 + i}`,
  receiptNumber: `0042-0008-${118000 - i}`,
  registerId: 'R01',
  operatorId: 'OP-100',
  status: 'COMPLETED',
  isReturn: false,
  total: 40 + i,
  openedAt: `2026-10-08T20:0${i}:00`,
  completedAt: `2026-10-08T20:1${i}:00`,
  counter: 'arrived',
  counterTotal: 40 + i,
}))
const TX_BY_DAY = { '2026-10-09': TODAY_TX, '2026-10-08': YESTERDAY_TX }
// The door's summary: the whole day under the status and kind filters — never paged, never the counter filter.
const txSummary = (rows) => ({
  sales: rows.filter((r) => !r.isReturn).length,
  returns: rows.filter((r) => r.isReturn).length,
  total: Math.round(rows.reduce((a, r) => a + r.total, 0) * 1000) / 1000,
  lastCompletedAt: rows.length ? rows.map((r) => r.completedAt).sort().at(-1) : null,
  notYet: rows.filter((r) => r.counter === 'notYet').length,
  mismatches: rows.filter((r) => r.counter === 'mismatch').length,
})
const txOfDay = (day, status = 'COMPLETED', kind = 'all') =>
  (TX_BY_DAY[day] ?? []).filter((r) => (status === 'all' || r.status === status) && (kind === 'all' || r.isReturn === (kind === 'return')))

// 24 hours, oldest first: 08:00 yesterday … 07:00 … the cells cycle the five, with one cell a door newer
// than this bundle might send.
const CYCLE = ['work', 'idle', 'passErrors', 'connectFailOnly', 'noData', 'work']
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2026, 9, 8, 13 + i)
  const pad = (n) => String(n).padStart(2, '0')
  const hour = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`
  const cell = i === 23 ? 'melting' : CYCLE[i % CYCLE.length]
  return { hour, cell, pushPasses: 60, pullPasses: 120, connectFailures: 0, actionsPushed: 400, trxPulled: 90, errors: 0 }
})

// The same hours with the 2563 mirror member; one mirror cell a door newer than this bundle might send.
const MIRROR_CYCLE = ['idle', 'work', 'connectFailOnly', 'passErrors', 'noData', 'idle']
const MIRROR_HOURS = HOURS.map((h, i) => ({
  ...h,
  mirror: {
    cell: i === 22 ? 'thawing' : MIRROR_CYCLE[i % MIRROR_CYCLE.length],
    sweeps: 120,
    connectFailures: i === 2 ? 3 : 0,
    rowsPulled: 1200 + i,
    applied: 1180,
    deferred: 4,
    errored: i === 3 ? 2 : 0,
    deadLettered: i === 3 ? 1 : 0,
  },
}))

// Store/Mirror: 60 open dead letters of both stages (two pages at 50) and 5 acknowledged ones.
const LONG_ERROR =
  'Violation of FOREIGN KEY constraint "FK_PosTransactionLine_Header". The conflict occurred in database "POS", ' +
  'table "dbo.PosTransactionHeader", column Id. The statement has been terminated while applying the snapshot ' +
  'of transaction 0042-0007-118812 on till 3.'
const APPLY_REASONS = ['errorCap', 'orphaned', 'unmapped']
const DEAD_LETTERS = [
  ...Array.from({ length: 60 }, (_, i) => {
    const pull = i % 4 === 3
    return {
      id: String(88000 - i),
      stage: pull ? 'pull' : 'apply',
      // One reason a door newer than this bundle might send.
      reason: i === 1 ? 'melted' : pull ? 'poison' : APPLY_REASONS[i % 3],
      entityType: pull ? 'TRX/COMPLETED' : 'SHIFT/CLOSED',
      entityId: `E-${1000 + i}`,
      action: pull ? null : 'Upsert',
      attempts: pull ? 3 : 10,
      firstSeenAt: '2026-10-08T22:10:00',
      lastSeenAt: `2026-10-09T${String(11 - Math.floor(i / 10)).padStart(2, '0')}:${String(59 - (i % 10)).padStart(2, '0')}:00`,
      error: i === 0 ? LONG_ERROR : `Apply failed (${i})`,
      canRetry: !pull,
      acknowledgedAt: null,
      acknowledgedBy: null,
      acknowledgeReason: null,
    }
  }),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: String(77000 - i),
    stage: 'apply',
    reason: 'errorCap',
    entityType: 'DRAWER/MOVED',
    entityId: `D-${200 + i}`,
    action: 'Upsert',
    attempts: 10,
    firstSeenAt: '2026-10-01T09:00:00',
    lastSeenAt: '2026-10-01T10:00:00',
    error: 'Cannot insert duplicate key',
    canRetry: false,
    acknowledgedAt: '2026-10-02T08:15:00',
    acknowledgedBy: 'msartawi',
    acknowledgeReason: 'Superseded by the shift re-send',
  })),
]
const BY_ENTITY_TYPE = [
  { entityType: 'SHIFT/CLOSED', pending: 1200, deferred: 12, deadLetters: 45 },
  { entityType: 'TRX/COMPLETED', pending: 630, deferred: 0, deadLetters: 15 },
]

const COUNTERS = {
  items: [
    { objectId: 'ItemMaster', bound: 'Out', lineNumber: 1, counter: 88120000, logHead: 88121240, lag: 1240, oldestPendingAt: '2026-10-09T10:50:00' },
    { objectId: 'ItemPrice', bound: 'Out', lineNumber: 2, counter: 88211731, logHead: 88211731, lag: 0, oldestPendingAt: null },
    { objectId: 'RetailTrx', bound: 'In', lineNumber: 15, counter: 4412019, logHead: null, lag: null, oldestPendingAt: null },
  ],
}

// 75 passes: two pages at 50.
const PASSES = Array.from({ length: 75 }, (_, i) => ({
  processId: `PR-${String(1000 - i)}`,
  loop: i % 2 ? 'pull' : 'push',
  startOn: `2026-10-0${9 - Math.floor(i / 20)}T${String(12 - (i % 12)).padStart(2, '0')}:03:58`,
  finishOn: `2026-10-0${9 - Math.floor(i / 20)}T${String(12 - (i % 12)).padStart(2, '0')}:04:00`,
  status: i === 3 ? 'Failed' : i === 5 ? 'Partial' : 'Ok',
  actionsCount: 412 + i,
  errorMessage: i === 3 ? 'Violation of PRIMARY KEY constraint' : null,
}))
const PASS_DETAIL = {
  items: [
    { lineNumber: 1, objectId: 'ItemMaster', identifiers: '100045', actionType: 'Upsert', counter: 88120001, lineStatus: 'Ok', startOn: '2026-10-09T11:31:02', finishOn: '2026-10-09T11:31:04', errorMessage: null },
    // One line, two chunks: a pass writes a row per object AND chunk, so line 2 repeats.
    { lineNumber: 2, objectId: 'ItemPrice', identifiers: '100040', actionType: 'Upsert', counter: 88120000, lineStatus: 'Ok', startOn: '2026-10-09T11:31:03', finishOn: '2026-10-09T11:31:04', errorMessage: null },
    { lineNumber: 2, objectId: 'ItemPrice', identifiers: '100046', actionType: 'Upsert', counter: 88120002, lineStatus: 'Error', startOn: '2026-10-09T11:31:04', finishOn: '2026-10-09T11:31:05', errorMessage: 'Violation of PRIMARY KEY constraint' },
  ],
}
const SCRIPTS = {
  items: [
    { scriptId: 'SCR-2026-0412', createdAt: '2026-10-01T09:00:00', isExecuted: true, lastAttempt: '2026-10-01T09:05:00', errorMessage: null },
    { scriptId: 'SCR-2026-0419', createdAt: '2026-10-08T09:00:00', isExecuted: false, lastAttempt: '2026-10-09T11:00:00', errorMessage: "Invalid column name 'Foo'" },
  ],
}
const LOCATION = { code: 'P001', description: 'Olaya Main', ip: '10.20.1.11', instance: 'SQLEXPRESS', dbName: 'POS', groupId: 'G01', father: 'BackOffice', isPosSyncEnabled: true }

const browser = await chromium.launch()

async function open({ failStoreAfter = Infinity, failHoursAfter = Infinity, canOperate = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  // A fixed local "today", so the 30-day bound is checkable: 2026-10-09.
  await page.clock.install({ time: new Date('2026-10-09T12:04:00') })
  const errors = []
  const calls = []
  // 459: this context's own agreement, so a recheck changes what the next read returns.
  const agreement = { days: structuredClone(AGREEMENT_DAYS), gaps: structuredClone(AGREEMENT_GAPS), rechecks: [] }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    calls.push(p + url.search)
    const code = url.searchParams.get('code')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate, canOnboard: false }))
    if (p === 'ActionSync/Store') {
      if (calls.filter((c) => c.startsWith('ActionSync/Store?')).length > failStoreAfter)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The store read failed.', errorCode: 'BOOM' }))
      const s = STORES[code]
      return route.fulfill(s ? envelope(s) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Store/Hours') {
      if (calls.filter((c) => c.startsWith('ActionSync/Store/Hours?')).length > failHoursAfter)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The hours read failed.', errorCode: 'BOOM' }))
      // A store on mirror gets the 2563 hours; the others keep the old door's shape.
      return route.fulfill(envelope({ items: STORES[code]?.mirror ? MIRROR_HOURS : HOURS }))
    }
    if (p === 'ActionSync/Store/Mirror') {
      if (!STORES[code]?.mirror)
        return route.fulfill(envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
      const stage = url.searchParams.get('stage')
      const reason = url.searchParams.get('reason')
      const withAck = url.searchParams.get('includeAcknowledged') === 'true'
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      const rows = DEAD_LETTERS.filter((d) => (!stage || d.stage === stage) && (!reason || d.reason === reason) && (withAck || !d.acknowledgedAt))
      return route.fulfill(
        envelope({
          lane: STORES[code].mirror,
          byEntityType: BY_ENTITY_TYPE,
          deadLetters: { items: rows.slice((pg - 1) * size, pg * size), total: rows.length, page: pg, pageSize: size },
        }),
      )
    }
    if (p === 'ActionSync/Store/Agreement') {
      if (!STORES[code]?.mirror)
        return route.fulfill(envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
      // Only P006 has judged days; every other store on mirror had no NewPos receipt in the window.
      const days = code === 'P006' ? agreement.days : []
      const gaps = code === 'P006' ? agreement.gaps : []
      const day = url.searchParams.get('day')
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      const rows = gaps.filter((g) => !day || g.businessDay === day)
      return route.fulfill(envelope({ days, gaps: { items: rows.slice((pg - 1) * size, pg * size), total: rows.length, page: pg, pageSize: size } }))
    }
    if (p === 'ActionSync/Agreement/Recheck') {
      const body = route.request().postDataJSON()
      agreement.rechecks.push(body)
      if (body.reason === 'refuse me')
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'The day is outside the window.', errorCode: 'BAD_DATE' }))
      if (body.day === '2026-10-06') {
        agreement.days = agreement.days.map((d) => (d.businessDay === '2026-10-06' ? HEALED_1006 : d))
        agreement.gaps = agreement.gaps.filter((g) => g.businessDay !== '2026-10-06')
        return route.fulfill(envelope({ auditId: 'AU-459-1', day: HEALED_1006 }))
      }
      if (body.day === '2026-10-04') {
        agreement.days = agreement.days.filter((d) => d.businessDay !== '2026-10-04')
        return route.fulfill(envelope({ auditId: 'AU-459-2', day: null }))
      }
      return route.fulfill(envelope({ auditId: 'AU-459-3', day: agreement.days.find((d) => d.businessDay === body.day) ?? null }))
    }
    if (p === 'ActionSync/Store/Transactions') {
      if (!STORES[code]) return route.fulfill(envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
      const day = url.searchParams.get('day') ?? '2026-10-09'
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      if (code === 'P008') {
        const none = { sales: 0, returns: 0, total: 0, lastCompletedAt: null, notYet: 0, mismatches: 0 }
        return route.fulfill(envelope({ available: false, day, summary: none, items: { items: [], total: 0, page: pg, pageSize: size } }))
      }
      const counter = url.searchParams.get('counter')
      const receipt = url.searchParams.get('receipt')
      const whole = code === 'P007' ? txOfDay(day, url.searchParams.get('status') ?? 'COMPLETED', url.searchParams.get('kind') ?? 'all') : []
      const rows = whole.filter((r) => (!counter || r.counter === counter) && (!receipt || r.receiptNumber === receipt))
      return route.fulfill(
        envelope({ available: true, day, summary: txSummary(whole), items: { items: rows.slice((pg - 1) * size, pg * size), total: rows.length, page: pg, pageSize: size } }),
      )
    }
    if (p === 'ActionSync/Store/Counters') return route.fulfill(envelope(COUNTERS))
    if (p === 'ActionSync/Store/Passes') {
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      return route.fulfill(envelope({ items: PASSES.slice((pg - 1) * size, pg * size), total: PASSES.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/Store/PassDetail') return route.fulfill(envelope(PASS_DETAIL))
    if (p === 'ActionSync/Store/Scripts') return route.fulfill(envelope(SCRIPTS))
    if (p === 'ActionSync/Store/Location') return route.fulfill(envelope(LOCATION))
    // The store's audit feed is 447's; here it is only an empty page of the contract's shape.
    if (p === 'ActionSync/Audit') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    if (p === 'ActionSync/Commands') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, agreement }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitForCall = async (page, calls, want) => {
  for (let i = 0; i < 40; i++) {
    if (calls.some((c) => c === want)) return true
    await page.waitForTimeout(100)
  }
  return false
}
// An autoHeight grid draws its rows over a frame or two: wait for the count to settle.
const rowCount = async (page, sel, want) => {
  let n = 0
  for (let i = 0; i < 30; i++) {
    n = await page.locator(sel).count()
    if (n === want) return n
    await page.waitForTimeout(100)
  }
  return n
}
const tabList = (page) => page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))

// ── 1–6: a worker store ────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-header]').waitFor({ timeout: 20000 })

  const header = strip(await page.locator('[data-store-header]').innerText())
  check('1. the header shows the code and the description', /^P001 Olaya Main/.test(header), header)
  check('1. …the host', (await page.locator('[data-store-host="Worker"]').count()) === 1 && /Host Worker/.test(header), header)
  check('1. …the door states without the pending one', (await page.locator('[data-store-header] [data-states]').first().getAttribute('data-states')) === 'onWorker erroring')
  check('1. …and the pending badge read off controlPending', (await page.locator('[data-control-pending]').count()) === 1 && /Control pending/.test(header), header)
  const health = strip(await page.locator('[data-store-health]').innerText())
  check('1. health: as-of stamp, unshifted', /Health as of 2026-10-09 12:03/.test(health), health)
  check('1. health: reachable, last failure, backoff and the connect error', /Last connect 2026-10-09 12:03/.test(health) && /Last connect failure 2026-10-09 09:15/.test(health) && /Next try after \(backoff\) 2026-10-09 12:05/.test(health) && /timeout 5 s/.test(health), health)
  check('1. health: push lag with the oldest pending action', /1,240 actions pending/.test(health) && /Oldest pending action 2026-10-09 10:50/.test(health), health)
  check('1. health: last transaction pulled', /Last transaction pulled 2026-10-09 12:02/.test(health), health)
  const pushErr = strip(await page.locator('[data-loop="push"]').innerText())
  const pullErr = strip(await page.locator('[data-loop="pull"]').innerText())
  check('1. health: push loop failed, with its error and time', /Failed/.test(pushErr) && /2026-10-09 11:31 Violation of PRIMARY KEY constraint/.test(pushErr), pushErr)
  check('1. health: pull loop ok, no error', /Done/.test(pullErr) && /No error/.test(pullErr), pullErr)

  // 2: the strip.
  check('2. the strip asks Store/Hours for 24 hours', calls.includes('ActionSync/Store/Hours?code=P001&hours=24'), calls.filter((c) => c.includes('Hours')).join(','))
  await page.locator('[data-hour-cell]').first().waitFor()
  const cells = await page.locator('[data-hour-cell]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hour-cell')))
  check('2. one cell per hour', cells.length === 24, String(cells.length))
  check('2. each cell is the door cell', cells.slice(0, 6).join(',') === 'work,idle,passErrors,connectFailOnly,noData,work', cells.join(','))
  check('2. an unknown cell is drawn as noData', cells[23] === 'noData')
  const swatches = await page.locator('[data-hour-cell]').evaluateAll((els) => els.slice(0, 5).map((e) => getComputedStyle(e).backgroundColor))
  check('2. the five cells draw in five colours', new Set(swatches).size === 5, swatches.join(' | '))
  const cellTitle = strip((await page.locator('[data-hour-cell]').nth(2).getAttribute('title')) || '')
  check('2. a cell names its hour and its reading, as one pair', cellTitle === '2026-10-08 15:00 · Pass errors', cellTitle)
  const legend = await page.locator('[data-legend]').evaluateAll((els) => els.map((e) => e.innerText.trim()))
  check('2. the legend lists the five cells', JSON.stringify(legend) === '["Passes ran, work moved","Checked, idle","Pass errors","Connect failures only","No data"]', JSON.stringify(legend))

  // 3: the tabs, Counters first.
  // 🚩 Changed on purpose by ticket 457: Mirror is appended at the end (six tabs → seven), and by 459:
  // Agreement after it (seven → eight), and by 467: Transactions after Agreement (eight → nine).
  check('3. nine tabs in the prototype order, Mirror, Agreement then Transactions last', JSON.stringify(await tabList(page)) === '["counters","passes","commands","scripts","audit","location","mirror","agreement","transactions"]', JSON.stringify(await tabList(page)))
  await page.locator('[data-tab-grid="counters"] .ag-row').first().waitFor()
  check('3. Counters opens first', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'counters')
  check('3. …reading Store/Counters', calls.includes('ActionSync/Store/Counters?code=P001'))
  const c1 = strip(await page.locator('[data-tab-grid="counters"] .ag-row[row-id="1-ItemMaster-Out"]').innerText())
  check('3. a push counter shows counter, head, lag and oldest pending', /ItemMaster/.test(c1) && /Push/.test(c1) && /88,120,000/.test(c1) && /88,121,240/.test(c1) && /1,240/.test(c1) && /2026-10-09 10:50/.test(c1), c1)
  const pullHead = strip(await page.locator('.ag-row[row-id="15-RetailTrx-In"] [col-id="logHead"]').innerText())
  const pullLag = strip(await page.locator('.ag-row[row-id="15-RetailTrx-In"] [col-id="lag"]').innerText())
  check('3. a pull counter has a blank head and lag, not 0', pullHead === '' && pullLag === '', JSON.stringify([pullHead, pullLag]))
  check('3. no later tab has been read yet', !calls.some((c) => /Store\/(Passes|Scripts|Location)/.test(c)))
  await page.screenshot({ path: `${SHOTS}/store.png`, fullPage: true })

  // 4: passes.
  await page.locator('[data-tab="passes"]').click()
  check('4. Passes opens on 7 days ago, page 1 of 50', await waitForCall(page, calls, 'ActionSync/Store/Passes?code=P001&from=2026-10-02&page=1&pageSize=50'), calls.filter((c) => c.includes('Passes')).join(','))
  const picker = page.locator('[data-passes-from]')
  check('4. the picker is bounded to the last 30 days', (await picker.getAttribute('min')) === '2026-09-09' && (await picker.getAttribute('max')) === '2026-10-09')
  await page.locator('[data-tab-grid="passes"] .ag-row').first().waitFor()
  check('4. a page draws 50 passes', (await rowCount(page, '[data-tab-grid="passes"] .ag-row', 50)) === 50)
  const failedRow = strip(await page.locator('.ag-row[row-id="PR-997"]').innerText())
  check('4. a pass shows loop, outcome, actions and its error', /Pull/.test(failedRow) && /Failed/.test(failedRow) && /415/.test(failedRow) && /Violation of PRIMARY KEY/.test(failedRow), failedRow)
  await picker.fill('2026-08-01')
  check('4. an out-of-window date is held while the box is being typed in', !calls.some((c) => c.includes('from=2026-08-01')))
  await picker.blur()
  check('4. an older date is pulled back to the 30-day bound before the call', await waitForCall(page, calls, 'ActionSync/Store/Passes?code=P001&from=2026-09-09&page=1&pageSize=50'), calls.filter((c) => c.includes('Passes')).join(','))
  check('4. …and never sent past it', !calls.some((c) => c.includes('from=2026-08-01')))
  check('4. the picker shows the bound', (await picker.inputValue()) === '2026-09-09', await picker.inputValue())
  await page.getByRole('button', { name: 'Next' }).click()
  check('4. Next asks for page 2', await waitForCall(page, calls, 'ActionSync/Store/Passes?code=P001&from=2026-09-09&page=2&pageSize=50'))
  await page.locator('.ag-row[row-id="PR-950"]').waitFor()
  check('4. page 2 draws the last 25', (await rowCount(page, '[data-tab-grid="passes"] .ag-row', 25)) === 25)
  const page2 = 'ActionSync/Store/Passes?code=P001&from=2026-09-09&page=2&pageSize=50'
  const asked = (want) => calls.filter((c) => c === want).length
  const [p2Before, countersBefore, headerBefore] = [asked(page2), asked('ActionSync/Store/Counters?code=P001'), asked('ActionSync/Store?code=P001')]
  await page.locator('[data-tab-refresh="passes"]').click()
  const deadline = Date.now() + 5000
  while (asked(page2) === p2Before && Date.now() < deadline) await page.waitForTimeout(100)
  check('4. Refresh re-reads the open tab at its date and page', asked(page2) === p2Before + 1, String(asked(page2) - p2Before))
  check('4. …and only that tab', asked('ActionSync/Store/Counters?code=P001') === countersBefore && asked('ActionSync/Store?code=P001') === headerBefore)
  check('4. …keeping page 2 drawn', (await rowCount(page, '[data-tab-grid="passes"] .ag-row', 25)) === 25)
  await page.getByRole('button', { name: 'Previous' }).click()
  await page.locator('[data-pass="PR-997"]').click()
  await page.locator('[data-pass-detail="PR-997"] .ag-row').first().waitFor({ timeout: 10000 })
  check('4. a pass opens its detail from Store/PassDetail', calls.includes('ActionSync/Store/PassDetail?processId=PR-997'))
  const dialogTitle = strip(await page.locator('dialog #modal-title').innerText())
  check('4. …titled with the pass id', dialogTitle === 'Pass PR-997', dialogTitle)
  const detail = strip(await page.locator('[data-pass-detail="PR-997"]').innerText())
  check('4. …listing its rows with status and error', /ItemPrice/.test(detail) && /Error/.test(detail) && /88,120,002/.test(detail) && /Violation of PRIMARY KEY/.test(detail), detail)
  check('4. …every row, even where a line number repeats', (await rowCount(page, '[data-pass-detail="PR-997"] .ag-row', 3)) === 3)
  await page.screenshot({ path: `${SHOTS}/pass-detail.png`, fullPage: true })
  await page.locator('[data-pass-detail-close]').click()
  check('4. Close shuts the detail', (await page.locator('dialog[open]').count()) === 0)

  // 5: scripts and location.
  await page.locator('[data-tab="scripts"]').click()
  await page.locator('[data-tab-grid="scripts"] .ag-row').first().waitFor()
  const scripts = strip(await page.locator('[data-tab-panel="scripts"]').innerText())
  check('5. Scripts shows each script id and state', /SCR-2026-0412/.test(scripts) && /Executed/.test(scripts) && /SCR-2026-0419/.test(scripts) && /Failed/.test(scripts) && /Invalid column name/.test(scripts), scripts)
  check('5. …read only: no SQL column, no control', !/\bSQL text\b|\bSELECT\b|\bINSERT\b/.test(scripts) && (await page.locator('[data-tab-panel="scripts"] button, [data-tab-panel="scripts"] textarea').count()) === 0, scripts)
  await page.locator('[data-tab="location"]').click()
  await page.locator('[data-location]').waitFor()
  const loc = strip(await page.locator('[data-location]').innerText())
  check('5. Location shows the location fields', /IP address 10\.20\.1\.11/.test(loc) && /Instance SQLEXPRESS/.test(loc) && /Database POS/.test(loc) && /Group G01/.test(loc) && /Father BackOffice/.test(loc) && /POS sync sweep Enabled/.test(loc), loc)
  check('5. …and no credentials, only a note that they stay on the server', (await page.locator('[data-location] input').count()) === 0 && /Credentials Never shown in the browser/.test(loc) && !/User ?ID|Password/i.test(loc), loc)

  // 6: the tabs 447 and 448 filled, ?tab= and reload.
  await page.locator('[data-tab="commands"]').click()
  // 448 filled the Commands tab: it reads the store's commands (its own drive is sync-console-commands-drive).
  await page.locator('[data-tab-empty="commands"]').waitFor({ timeout: 5000 }).catch(() => {})
  check("6. Commands reads the store's commands", calls.includes('ActionSync/Commands?code=P001&page=1&pageSize=50') && (await page.locator('[data-tab-empty="commands"]').count()) === 1)
  await page.locator('[data-tab="audit"]').click()
  // 447 filled the Audit tab: it reads the store's feed (its own drive is sync-console-controls-drive).
  await page.locator('[data-tab-empty="audit"]').waitFor({ timeout: 5000 }).catch(() => {})
  check("6. Audit reads the store's feed", calls.includes('ActionSync/Audit?code=P001&page=1&pageSize=50') && (await page.locator('[data-tab-empty="audit"]').count()) === 1)
  await page.locator('[data-tab="scripts"]').click()
  check('6. the open tab is ?tab=', new URL(page.url()).searchParams.get('tab') === 'scripts', page.url())
  await page.reload()
  await page.locator('[data-tab-grid="scripts"]').waitFor({ timeout: 20000 })
  check('6. a reload reopens the same tab', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'scripts')
  check('no page errors (worker store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6b: a failed header refresh keeps the tabs ─────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ failStoreAfter: 1, failHoursAfter: 1 })
  await page.goto(`${BASE}/admin/sync/store/P001?tab=passes`)
  await page.locator('[data-tab-grid="passes"] .ag-row').first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.locator('.ag-row[row-id="PR-950"]').waitFor()
  // The 30 s refresh fails, and so does its one retry.
  await page.clock.runFor(31_000)
  await page.clock.runFor(3_000)
  await page.getByText('The store read failed.').waitFor({ timeout: 10000 })
  check('6b. a failed refresh drops the stale health', (await page.locator('[data-store-health]').count()) === 0)
  await page.getByText('The hours read failed.').waitFor({ timeout: 10000 })
  check('6b. …keeps the last good strip under its error', (await page.locator('[data-hour-cell]').count()) === 24)
  check('6b. …but keeps the tab the reader is on, at its page', (await page.locator('.ag-row[row-id="PR-950"]').count()) === 1 && (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'passes')
  check('no page errors (failed refresh)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: a WPF store ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P002?tab=location`)
  await page.locator('[data-store-header]').waitFor({ timeout: 20000 })
  check('7. the WPF note is shown', /still synced by WPF/.test(strip(await page.locator('[data-wpf-note]').innerText())))
  check('7. no health summary and no strip', (await page.locator('[data-store-health]').count()) === 0 && (await page.locator('[data-hour-strip]').count()) === 0)
  check('7. …and no hours read', !calls.some((c) => c.includes('Store/Hours')))
  // 🚩 Changed on purpose by ticket 457: a WPF store keeps its mirror lane (ADR 0073), so Mirror is appended,
  // and by 459: its rail agreement too, so Agreement after it, and by 467: Transactions after that (decision 5).
  check('7. only Counters, Passes, Mirror, Agreement and Transactions', JSON.stringify(await tabList(page)) === '["counters","passes","mirror","agreement","transactions"]', JSON.stringify(await tabList(page)))
  check('7. a withheld ?tab= falls back to Counters', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'counters')
  check('7. …and Location is never read', !calls.some((c) => c.includes('Store/Location')))
  check('7. the host reads WPF', /Host WPF/.test(strip(await page.locator('[data-store-header]').innerText())))
  await page.locator('[data-tab="passes"]').click()
  await page.locator('[data-tab-grid="passes"] .ag-row').first().waitFor()
  check('7. a WPF store\'s passes are listed', calls.some((c) => c.startsWith('ActionSync/Store/Passes?code=P002')))
  await page.screenshot({ path: `${SHOTS}/wpf.png`, fullPage: true })
  // 457: an old door's WPF store is not on mirror — its block and its Mirror tab say so, and nothing is asked.
  check('7. a WPF store not on mirror shows its mirror block as not on mirror', (await page.locator('[data-mirror-health="notOnMirror"]').count()) === 1)
  await page.locator('[data-tab="mirror"]').click()
  await page.locator('[data-mirror-tab="notOnMirror"]').waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)
  const wpfMirrorCalls = calls.filter((c) => c.startsWith('ActionSync/Store/Mirror')).length
  check('7. …its Mirror tab reads not on mirror and asks nothing', /not on the mirror rail/.test(await page.locator('[data-mirror-tab]').innerText()) && wpfMirrorCalls === 0, String(wpfMirrorCalls))
  check('no page errors (WPF store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: NO_STORE ────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P999`)
  await page.locator('[data-no-store]').waitFor({ timeout: 20000 })
  const text = strip(await page.locator('[data-no-store]').innerText())
  check('8. NO_STORE shows "No such store"', /No such store/.test(text), text)
  check('8. …with the way back to the fleet', (await page.locator('a[href="/admin/sync"]').filter({ hasText: 'Back to the fleet' }).count()) === 1)
  await page.waitForTimeout(1500)
  // Past the 30 s refresh: a NO_STORE is the answer, so it is not polled either.
  await page.clock.runFor(65_000)
  await page.waitForTimeout(500)
  check('8. …asked once, not retried or polled', calls.filter((c) => c.startsWith('ActionSync/Store?')).length === 1, String(calls.filter((c) => c.startsWith('ActionSync/Store?')).length))
  check('8. …and nothing else of the store is read', !calls.some((c) => /Store\/(Hours|Counters)/.test(c)))
  await page.screenshot({ path: `${SHOTS}/no-store.png`, fullPage: true })
  check('no page errors (NO_STORE)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9–11: a store on the mirror rail (ticket 457) ─────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P003`)
  await page.locator('[data-mirror-health]').waitFor({ timeout: 20000 })

  // 9: the mirror block.
  check('9. a store on mirror shows its mirror block', (await page.locator('[data-mirror-health="onMirror"]').count()) === 1)
  check("9. …with the door's mirror state badges, and no other state", (await page.locator('[data-mirror-health] [data-states]').getAttribute('data-states')) === 'mirrorOffline mirrorBehind deadLetters')
  const mh = strip(await page.locator('[data-mirror-health]').innerText())
  check('9. …the mirror states named', /Mirror offline/.test(mh) && /Mirror behind/.test(mh) && /Dead letters/.test(mh), mh)
  const reach = strip(await page.locator('[data-health-block="mirror-reachable"]').innerText())
  check('9. reachability: last connect, last failure and the error', /Last connect 2026-10-09 11:58/.test(reach) && /Last connect failure 2026-10-09 12:03/.test(reach) && /Login failed for user \(mirror connect\)/.test(reach), reach)
  check('9. …the error isolated as free text', (await page.locator('bdi[data-mirror-connect-error]').count()) === 1)
  const pulls = strip(await page.locator('[data-health-block="mirror-pull"]').innerText())
  check('9. last pull and last good pull', /Last pull 2026-10-09 12:03/.test(pulls) && /Last good pull 2026-10-09 11:58/.test(pulls), pulls)
  const till = strip(await page.locator('[data-health-block="mirror-till-backlog"]').innerText())
  check('9. till backlog: the count and its oldest, on the till clock', /4,210 events waiting on the till/.test(till) && /Oldest 2026-10-09 10:41 till clock/.test(till), till)
  const inbox = strip(await page.locator('[data-health-block="mirror-inbox"]').innerText())
  check('9. inbox pending and deferred, the oldest deferred on the till clock', /Pending 1,830/.test(inbox) && /Deferred 12/.test(inbox) && /Oldest deferred 2026-10-09 09:20 till clock/.test(inbox), inbox)
  check('9. …both till times carry the hint', (await page.locator('[data-mirror-health] [data-till-clock]').count()) === 2)
  const dl = strip(await page.locator('[data-health-block="mirror-dead-letters"]').innerText())
  check('9. open dead letters', /Open 65/.test(dl), dl)

  // 10: the strip's Mirror line.
  await page.locator('[data-mirror-hour-cell]').first().waitFor()
  check('10. both lines come from the one Store/Hours read', calls.filter((c) => c.includes('Store/Hours')).every((c) => c === 'ActionSync/Store/Hours?code=P003&hours=24'))
  const mcells = await page.locator('[data-mirror-hour-cell]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mirror-hour-cell')))
  check('10. a Mirror line of one cell per hour', mcells.length === 24, String(mcells.length))
  check("10. …beside the store worker's line, unchanged", (await page.locator('[data-hour-cell]').count()) === 24)
  check("10. each mirror cell is the door's mirror.cell", mcells.slice(0, 6).join(',') === 'idle,work,connectFailOnly,passErrors,noData,idle', mcells.join(','))
  check('10. an unknown mirror cell is drawn as noData', mcells[22] === 'noData')
  const mSwatch = await page.locator('[data-mirror-hour-cell]').nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)
  const wSwatch = await page.locator('[data-hour-cell]').nth(0).evaluate((e) => getComputedStyle(e).backgroundColor)
  check('10. …on the same legend as the store line (work is work)', mSwatch === wSwatch, `${mSwatch} vs ${wSwatch}`)
  const rawTitle = (await page.locator('[data-mirror-hour-cell]').nth(3).getAttribute('title')) || ''
  const mTitle = strip(rawTitle)
  check('10. hovering a mirror cell names its hour and reading, then the mirror counts', mTitle === '2026-10-08 16:00 · Pass errors: rows pulled 1,203, applied 1,180, deferred 4, errored 2, dead-lettered 1; sweeps 120; connect failures 0', mTitle)
  check('10. …the hour pair isolated once', rawTitle.startsWith('⁨' + '2026-10-08 16:00 · Pass errors' + '⁩'), JSON.stringify(rawTitle.slice(0, 40)))
  const lines = await page.locator('[data-hour-strip]').innerText()
  check('10. the two lines are named', /Master and counter/.test(lines) && /Mirror/.test(lines), lines.slice(0, 80))
  check('10. the legend still lists the five cells, once', (await page.locator('[data-legend]').count()) === 5)
  await page.screenshot({ path: `${SHOTS}/mirror-store.png`, fullPage: true })

  // 11: the Mirror tab.
  // 🚩 Changed on purpose by 459: Agreement follows Mirror, and by 467: Transactions follows Agreement.
  check('11. the tab list ends with Mirror, then Agreement, then Transactions', JSON.stringify(await tabList(page)) === '["counters","passes","commands","scripts","audit","location","mirror","agreement","transactions"]')
  check('11. Store/Mirror is not read before the tab is opened', !calls.some((c) => c.startsWith('ActionSync/Store/Mirror')))
  await page.locator('[data-tab="mirror"]').click()
  const first = 'ActionSync/Store/Mirror?code=P003&includeAcknowledged=false&page=1&pageSize=50'
  check('11. the tab reads Store/Mirror: open dead letters, page 1 of 50', await waitForCall(page, calls, first), calls.filter((c) => c.includes('Mirror')).join(','))
  await page.locator('[data-tab-grid="mirror-dead-letters"] .ag-row').first().waitFor()
  const ent = strip(await page.locator('[data-tab-grid="mirror-entities"]').innerText())
  check('11. the inbox by entity type: pending, deferred, dead letters', /SHIFT\/CLOSED/.test(ent) && /1,200/.test(ent) && /45/.test(ent) && /TRX\/COMPLETED/.test(ent) && /630/.test(ent), ent)
  check('11. a page draws 50 dead letters', (await rowCount(page, '[data-tab-grid="mirror-dead-letters"] .ag-row', 50)) === 50)
  const headers = strip(await page.locator('[data-tab-grid="mirror-dead-letters"] .ag-header').innerText())
  check('11. columns: stage, reason, entity type and id, action, attempts, first and last seen, error', ['Stage', 'Reason', 'Entity type', 'Entity id', 'Action', 'Attempts', 'First seen', 'Last seen', 'Error'].every((h) => headers.includes(h)), headers)
  check('11. …and no payload column, nor any payload asked for', !/payload/i.test(headers) && !calls.some((c) => /payload/i.test(c)), headers)
  const applyRow = strip(await page.locator('.ag-row[row-id="apply-88000"]').first().innerText())
  check('11. an apply dead letter: stage, reason, entity, action, attempts, times', /Apply/.test(applyRow) && /Error cap/.test(applyRow) && /SHIFT\/CLOSED/.test(applyRow) && /E-1000/.test(applyRow) && /Upsert/.test(applyRow) && /\b10\b/.test(applyRow) && /2026-10-08 22:10/.test(applyRow) && /2026-10-09 11:59/.test(applyRow), applyRow)
  const pullRow = strip(await page.locator('.ag-row[row-id="pull-87997"]').first().innerText())
  check('11. a pull dead letter: poison, no action', /Pull/.test(pullRow) && /Poison/.test(pullRow) && /TRX\/COMPLETED/.test(pullRow) && !/Upsert/.test(pullRow), pullRow)
  const unknownReason = strip(await page.locator('.ag-row[row-id="apply-87999"] [col-id="reason"]').first().innerText())
  check('11. an unknown reason shows its raw code', unknownReason === 'melted', unknownReason)
  // The error: truncated in its row, whole behind its button, free text.
  const errCell = page.locator('.ag-row[row-id="apply-88000"] [data-dead-letter-error]').first()
  const truncated = await errCell.evaluate((e) => e.scrollWidth > e.clientWidth && getComputedStyle(e).textOverflow === 'ellipsis')
  check('11. a long error is truncated in its row', truncated)
  check('11. …isolated as free text', (await errCell.evaluate((e) => e.tagName)) === 'BDI')
  await page.locator('[data-dead-letter-expand="apply-88000"]').first().click()
  await page.locator('[data-dead-letter-error-full="apply-88000"]').waitFor({ timeout: 5000 })
  const full = await page.locator('[data-dead-letter-error-full="apply-88000"]').innerText()
  check('11. …and expands to the whole error', full.includes('applying the snapshot of transaction 0042-0007-118812 on till 3.'), full.slice(-60))
  check('11. …titled with the dead letter id', strip(await page.locator('dialog #modal-title').innerText()) === 'Dead letter 88000')
  await page.screenshot({ path: `${SHOTS}/mirror-error.png`, fullPage: true })
  await page.locator('[data-dead-letter-error-close]').click()
  check('11. Close shuts it', (await page.locator('dialog[open]').count()) === 0)

  // Paging.
  await page.getByRole('button', { name: 'Next' }).click()
  const p2 = 'ActionSync/Store/Mirror?code=P003&includeAcknowledged=false&page=2&pageSize=50'
  check('11. Next asks for page 2', await waitForCall(page, calls, p2))
  await page.locator('.ag-row[row-id="apply-87950"]').first().waitFor()
  check('11. page 2 draws the last 10', (await rowCount(page, '[data-tab-grid="mirror-dead-letters"] .ag-row', 10)) === 10)
  // The tab's Refresh re-reads it, at its page.
  const before = calls.filter((c) => c === p2).length
  await page.locator('[data-tab-refresh="mirror"]').click()
  const deadline = Date.now() + 5000
  while (calls.filter((c) => c === p2).length === before && Date.now() < deadline) await page.waitForTimeout(100)
  check('11. Refresh re-reads the Mirror tab at its page', calls.filter((c) => c === p2).length === before + 1)

  // Filters: each asks the door, from page 1.
  await page.locator('[data-mirror-stage]').selectOption('apply')
  check('11. the stage filter asks the door, from page 1', await waitForCall(page, calls, 'ActionSync/Store/Mirror?code=P003&stage=apply&includeAcknowledged=false&page=1&pageSize=50'), calls.filter((c) => c.includes('Mirror')).slice(-2).join(','))
  await page.waitForTimeout(300)
  const stages = await page.locator('[data-tab-grid="mirror-dead-letters"] .ag-cell[col-id="stage"]').evaluateAll((els) => [...new Set(els.map((e) => e.innerText.trim()))])
  check('11. …and draws apply rows only', JSON.stringify(stages) === '["Apply"]', JSON.stringify(stages))
  const reasons = await page.locator('[data-mirror-reason] option').evaluateAll((els) => els.map((e) => e.textContent))
  check('11. the reason filter offers every reason', JSON.stringify(reasons) === '["All reasons","Error cap","Orphaned (deferred past the cutoff)","Unmapped","Poison"]', JSON.stringify(reasons))
  await page.locator('[data-mirror-reason]').selectOption('orphaned')
  check('11. the reason filter asks the door', await waitForCall(page, calls, 'ActionSync/Store/Mirror?code=P003&stage=apply&reason=orphaned&includeAcknowledged=false&page=1&pageSize=50'))
  const orphanCount = DEAD_LETTERS.filter((d) => d.stage === 'apply' && d.reason === 'orphaned' && !d.acknowledgedAt).length
  check('11. …and draws its rows', (await rowCount(page, '[data-tab-grid="mirror-dead-letters"] .ag-row', orphanCount)) === orphanCount, String(orphanCount))
  await page.locator('[data-mirror-reason]').selectOption('errorCap')
  await page.locator('.ag-row[row-id="apply-88000"]').first().waitFor({ timeout: 5000 })
  check('11. no acknowledged row is drawn by default', (await page.locator('.ag-row[row-id="apply-77000"]').count()) === 0)

  // Include acknowledged: muted rows with who / when / why.
  await page.locator('[data-mirror-include-acknowledged]').check()
  check('11. include-acknowledged asks the door', await waitForCall(page, calls, 'ActionSync/Store/Mirror?code=P003&stage=apply&reason=errorCap&includeAcknowledged=true&page=1&pageSize=50'))
  await page.locator('.ag-row[row-id="apply-77000"]').first().waitFor({ timeout: 5000 })
  // Muted as the settlement grids mute a closed row: the row drawn at reduced opacity.
  const rowOpacity = (id) => page.locator(`.ag-row[row-id="${id}"]`).first().evaluate((e) => getComputedStyle(e).opacity)
  const [mutedOpacity, openOpacity] = [await rowOpacity('apply-77000'), await rowOpacity('apply-88000')]
  check('11. an acknowledged row is drawn muted', Number(mutedOpacity) < 1, mutedOpacity)
  check('11. …an open one is not', openOpacity === '1', openOpacity)
  const ackText = strip(
    (
      await page
        .locator('.ag-row[row-id="apply-77000"] [col-id="acknowledgedAt"], .ag-row[row-id="apply-77000"] [col-id="acknowledgedBy"], .ag-row[row-id="apply-77000"] [col-id="acknowledgeReason"]')
        .evaluateAll((els) => els.map((e) => e.innerText))
    ).join(' '),
  )
  check('11. …showing who, when and why', /2026-10-02 08:15/.test(ackText) && /msartawi/.test(ackText) && /Superseded by the shift re-send/.test(ackText), ackText)
  await page.screenshot({ path: `${SHOTS}/mirror-tab.png`, fullPage: true })
  check('11. the tab says no payload is ever shown', /payload is never shown/.test(await page.locator('[data-mirror-tab]').innerText()))
  check('no page errors (store on mirror)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9b: on mirror, never measured, no mirror state ────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/admin/sync/store/P004`)
  await page.locator('[data-mirror-health]').waitFor({ timeout: 20000 })
  const till = strip(await page.locator('[data-health-block="mirror-till-backlog"]').innerText())
  check('9b. a never-measured till backlog says so, not 0', /Never measured/.test(till) && !/\b0\b/.test(till) && (await page.locator('[data-till-not-measured]').count()) === 1, till)
  check('9b. …and draws no oldest, so no till-clock hint', (await page.locator('[data-mirror-health] [data-till-clock]').count()) === 0)
  check('9b. on mirror with no mirror state reads so, with no badge', (await page.locator('[data-mirror-no-state]').count()) === 1 && (await page.locator('[data-mirror-health] [data-states]').count()) === 0)
  check('9b. a zero inbox is 0', /Pending 0/.test(strip(await page.locator('[data-health-block="mirror-inbox"]').innerText())))
  check('no page errors (never measured)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 12b: a WPF store on mirror ─────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P005?tab=mirror`)
  await page.locator('[data-mirror-health]').waitFor({ timeout: 20000 })
  check('12b. a WPF store on mirror keeps the WPF note, no worker health, and its mirror block', (await page.locator('[data-wpf-note]').count()) === 1 && (await page.locator('[data-store-health]').count()) === 0 && (await page.locator('[data-mirror-health="onMirror"]').count()) === 1)
  await page.locator('[data-mirror-hour-cell]').first().waitFor({ timeout: 10000 })
  check('12b. …its strip draws the Mirror line alone', (await page.locator('[data-mirror-hour-cell]').count()) === 24 && (await page.locator('[data-hour-cell]').count()) === 0 && !/Master and counter/.test(await page.locator('[data-hour-strip]').innerText()))
  // 🚩 Changed on purpose by 459: Agreement follows Mirror on a WPF store too, and by 467: Transactions after it.
  check('12b. its tabs are Counters, Passes, Mirror, Agreement and Transactions, and ?tab=mirror opens Mirror', JSON.stringify(await tabList(page)) === '["counters","passes","mirror","agreement","transactions"]' && (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'mirror')
  check('12b. …which reads Store/Mirror', await waitForCall(page, calls, 'ActionSync/Store/Mirror?code=P005&includeAcknowledged=false&page=1&pageSize=50'))
  await page.screenshot({ path: `${SHOTS}/wpf-mirror.png`, fullPage: true })
  check('no page errors (WPF store on mirror)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 12: a store not on mirror (the old door's shape) ──────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-mirror-health]').waitFor({ timeout: 20000 })
  check("12. an old door's store reads not on mirror in its block", (await page.locator('[data-mirror-health="notOnMirror"]').count()) === 1 && /not on the mirror rail/.test(await page.locator('[data-mirror-health]').innerText()))
  check('12. …with no mirror state and no figure', (await page.locator('[data-mirror-health] [data-states]').count()) === 0 && (await page.locator('[data-health-block^="mirror-"]').count()) === 0)
  await page.locator('[data-hour-cell]').first().waitFor()
  check("12. the strip's Mirror line reads not on mirror, with no cells", (await page.locator('[data-mirror-line="notOnMirror"]').count()) === 1 && (await page.locator('[data-mirror-hour-cell]').count()) === 0)
  await page.locator('[data-tab="mirror"]').click()
  await page.locator('[data-mirror-tab="notOnMirror"]').waitFor({ timeout: 5000 })
  await page.locator('[data-tab-refresh="mirror"]').click()
  await page.waitForTimeout(800)
  check('12. the Mirror tab stays visible and reads not on mirror', /not on the mirror rail/.test(await page.locator('[data-mirror-tab]').innerText()))
  const asked = calls.filter((c) => c.startsWith('ActionSync/Store/Mirror')).length
  check('12. …and Store/Mirror is never asked, Refresh included', asked === 0, String(asked))
  // 459: the Agreement tab, the same way.
  await page.locator('[data-tab="agreement"]').click()
  await page.locator('[data-agreement-tab="notOnMirror"]').waitFor({ timeout: 5000 })
  await page.locator('[data-tab-refresh="agreement"]').click()
  await page.waitForTimeout(800)
  check('15. the Agreement tab stays visible on a store not on mirror and says so', /not on the mirror rail/.test(await page.locator('[data-agreement-tab]').innerText()))
  const askedAgreement = calls.filter((c) => c.startsWith('ActionSync/Store/Agreement')).length
  check('15. …and Store/Agreement is never asked, Refresh included', askedAgreement === 0, String(askedAgreement))
  await page.screenshot({ path: `${SHOTS}/not-on-mirror.png`, fullPage: true })
  check('no page errors (not on mirror)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: the Agreement tab, read only (ticket 459) ──────────────────────────────────────────────
const toastText = async (page, re) => {
  const t = page.locator('[data-sonner-toast]').filter({ hasText: re })
  await t.first().waitFor({ timeout: 5000 }).catch(() => {})
  return (await t.count()) > 0 ? strip(await t.first().innerText()) : ''
}
const dayOrder = (page) => page.locator('[data-agreement-day]').evaluateAll((els) => els.map((e) => e.getAttribute('data-agreement-day')))
const allGaps = 'ActionSync/Store/Agreement?code=P006&page=1&pageSize=50'
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P006`)
  await page.locator('[data-store-header]').waitFor({ timeout: 20000 })
  check('13. the header names the rails disagreeing', /Rails disagree/.test(strip(await page.locator('[data-store-header]').innerText())))
  check('13. Store/Agreement is not read before the tab is opened', !calls.some((c) => c.startsWith('ActionSync/Store/Agreement')))
  await page.locator('[data-tab="agreement"]').click()
  check('13. the tab reads Store/Agreement: every gap, page 1 of 50', await waitForCall(page, calls, allGaps), calls.filter((c) => c.includes('Agreement')).join(','))
  await page.locator('[data-agreement-days]').waitFor({ timeout: 5000 })
  check("13. the store's agreement is shown", (await page.locator('[data-agreement-overall="disagree"]').count()) === 1 && /Rails disagree/.test(await page.locator('[data-agreement-overall]').innerText()))
  check("13. the judged days in the door's order, newest first, the day with no NewPos receipt absent", JSON.stringify(await dayOrder(page)) === '["2026-10-08","2026-10-07","2026-10-06","2026-10-04"]', JSON.stringify(await dayOrder(page)))
  const d08 = strip(await page.locator('[data-agreement-day="2026-10-08"]').innerText())
  check('13. a day: its verdict, both counts, both totals to 3 decimals, the gap counts and when it was judged', d08 === '2026-10-08 Rails disagree 412 357 48210.125 43002.500 55 0 1 2026-10-09 03:00', d08)
  check('13. …a day that agrees says so', /Rails agree/.test(await page.locator('[data-agreement-day="2026-10-07"]').innerText()))
  const isolated = await page.locator('[data-agreement-day="2026-10-08"] bdi[dir="ltr"]').count()
  check('13. …each figure, total, day and time isolated once', isolated === 9, String(isolated))
  const gapHead = strip(await page.locator('[data-agreement-days] thead').innerText())
  check('13. read only: no Recheck column', !/Recheck/.test(gapHead) && (await page.locator('[data-agreement-recheck]').count()) === 0, gapHead)
  // The gaps.
  check('13. the gaps title reads every judged day', /Gaps on every judged day/i.test(await page.locator('[data-agreement-gaps]').innerText()))
  check('13. a page draws 50 gaps', (await rowCount(page, '[data-tab-grid="agreement-gaps"] .ag-row', 50)) === 50)
  const gHeaders = strip(await page.locator('[data-tab-grid="agreement-gaps"] .ag-header').innerText())
  check('13. columns: business day, receipt, gap, both totals', ['Business day', 'Receipt', 'Gap', 'Mirror total', 'Counter total'].every((h) => gHeaders.includes(h)), gHeaders)
  const g1 = strip(await page.locator('.ag-row[row-id="2026-10-08-0042-0008-118800-missingAtCounter"]').first().innerText())
  check('13. a receipt missing at the counter: its mirror total to 3 decimals, the counter total blank', g1 === '2026-10-08 0042-0008-118800 Missing at the counter rail 93.500', g1)
  const kindClass = await page.locator('.ag-row[row-id="2026-10-08-0042-0008-118800-missingAtCounter"] [data-gap-kind] > span').first().getAttribute('class')
  check('13. …the kind in its token', /bg-danger-050/.test(kindClass ?? ''), kindClass)
  await page.getByRole('button', { name: 'Next' }).click()
  check('13. Next asks for page 2', await waitForCall(page, calls, 'ActionSync/Store/Agreement?code=P006&page=2&pageSize=50'))
  await page.locator('.ag-row[row-id="2026-10-08-0042-0008-118900-totalMismatch"]').first().waitFor({ timeout: 5000 })
  check('13. page 2 draws the last 7', (await rowCount(page, '[data-tab-grid="agreement-gaps"] .ag-row', 7)) === 7)
  const mm = strip(await page.locator('.ag-row[row-id="2026-10-08-0042-0008-118900-totalMismatch"]').first().innerText())
  check('13. a total mismatch: both totals to 3 decimals', mm === '2026-10-08 0042-0008-118900 Totals differ 120.500 120.125', mm)
  // A day narrows the gaps.
  await page.locator('[data-agreement-pick="2026-10-06"]').click()
  const day06 = 'ActionSync/Store/Agreement?code=P006&day=2026-10-06&page=1&pageSize=50'
  check('13. picking a day asks the door with day=, from page 1', await waitForCall(page, calls, day06), calls.filter((c) => c.includes('Agreement')).slice(-2).join(','))
  await page.locator('[data-agreement-gaps="2026-10-06"]').waitFor({ timeout: 5000 })
  check('13. …and narrows the gaps to it', (await rowCount(page, '[data-tab-grid="agreement-gaps"] .ag-row', 1)) === 1)
  const g06 = strip(await page.locator('.ag-row[row-id="2026-10-06-0042-0006-117001-missingAtMirror"]').first().innerText())
  check('13. …a receipt missing at the mirror: the mirror total blank', g06 === '2026-10-06 0042-0006-117001 Missing at the mirror rail 12.345', g06)
  check('13. …titled with the day, isolated once', strip(await page.locator('[data-agreement-gaps] h3').innerText()).toLowerCase() === 'gaps on 2026-10-06' && (await page.locator('[data-agreement-gaps] h3 bdi').count()) === 1)
  check('13. …the picked day reads as pressed', (await page.locator('[data-agreement-pick="2026-10-06"]').getAttribute('aria-pressed')) === 'true')
  check('13. …and the days are still all listed', (await page.locator('[data-agreement-day]').count()) === 4)
  // Refresh re-reads the tab at its day.
  const before = calls.filter((c) => c === day06).length
  await page.locator('[data-tab-refresh="agreement"]').click()
  const deadline = Date.now() + 5000
  while (calls.filter((c) => c === day06).length === before && Date.now() < deadline) await page.waitForTimeout(100)
  check('13. Refresh re-reads the Agreement tab at its day', calls.filter((c) => c === day06).length === before + 1)
  await page.screenshot({ path: `${SHOTS}/agreement-day.png`, fullPage: true })
  // The way back.
  const allBefore = calls.filter((c) => c === allGaps).length
  await page.locator('[data-agreement-all-days]').click()
  await page.locator('[data-agreement-gaps=""]').waitFor({ timeout: 5000 })
  check("13. \"Show every day's gaps\" goes back to every gap", (await rowCount(page, '[data-tab-grid="agreement-gaps"] .ag-row', 50)) === 50 && /Gaps on every judged day/i.test(await page.locator('[data-agreement-gaps]').innerText()))
  check('13. …and nothing is ever asked with an agreement filter the door does not have', !calls.some((c) => /agreement=/i.test(c)) && calls.filter((c) => c === allGaps).length >= allBefore)
  check('no page errors (agreement, read only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 14: Recheck (ticket 459) ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, agreement } = await open({ canOperate: true })
  await page.goto(`${BASE}/admin/sync/store/P006?tab=agreement`)
  await page.locator('[data-agreement-days]').waitFor({ timeout: 20000 })
  check('14. with canOperate every listed day offers Recheck, and no other day does', JSON.stringify(await page.locator('[data-agreement-recheck]').evaluateAll((els) => els.map((e) => e.getAttribute('data-agreement-recheck')))) === JSON.stringify(await dayOrder(page)))
  await page.locator('[data-agreement-pick="2026-10-06"]').click()
  await page.locator('.ag-row[row-id="2026-10-06-0042-0006-117001-missingAtMirror"]').first().waitFor({ timeout: 5000 })

  // A refusal: its code with its words, and the dialog stays open.
  await page.locator('[data-agreement-recheck="2026-10-06"]').click()
  await page.locator('[data-reason-dialog]').waitFor({ timeout: 5000 })
  check('14. the reason dialog names the day and the store', strip(await page.locator('dialog #modal-title').innerText()) === 'Recheck rail agreement for 2026-10-06 of store P006')
  check('14. Confirm waits for a reason', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-reason-input]').fill('refuse me')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error="BAD_DATE"]').waitFor({ timeout: 5000 })
  check('14. a refusal shows its code with its words, and the dialog stays open', /outside the last seven finished business days/.test(await page.locator('[data-reason-error-label]').innerText()) && (await page.locator('dialog[open]').count()) === 1)

  // A recheck that clears the gap.
  const headerReads = calls.filter((c) => c.startsWith('ActionSync/Store?')).length
  await page.locator('[data-reason-input]').fill('  Late receipt arrived after the repair  ')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('dialog[open]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  const sent = agreement.rechecks[agreement.rechecks.length - 1]
  check('14. the POST carries the code, the day and the trimmed reason', JSON.stringify(sent) === JSON.stringify({ code: 'P006', day: '2026-10-06', reason: 'Late receipt arrived after the repair' }), JSON.stringify(sent))
  check('14. one toast: the rails agree', /Rechecked 2026-10-06: the rails agree\./.test(await toastText(page, /the rails agree/)))
  await page.locator('[data-agreement-day="2026-10-06"][data-agrees="true"]').waitFor({ timeout: 5000 })
  const healed = strip(await page.locator('[data-agreement-day="2026-10-06"]').innerText())
  check("14. the day's row is replaced by the door's answer, in place", JSON.stringify(await dayOrder(page)) === '["2026-10-08","2026-10-07","2026-10-06","2026-10-04"]' && /Rails agree 402 402 46012.345 46012.345 0 0 0 2026-10-09 12:04/.test(healed), healed)
  check('14. the gaps are read again', await waitForCall(page, calls, 'ActionSync/Store/Agreement?code=P006&day=2026-10-06&page=1&pageSize=50') && calls.filter((c) => c === 'ActionSync/Store/Agreement?code=P006&day=2026-10-06&page=1&pageSize=50').length >= 2)
  await page.locator('[data-tab-empty="agreement-gaps"]').waitFor({ timeout: 5000 })
  check("14. …and the day's gap has cleared", /No gap/.test(await page.locator('[data-tab-empty="agreement-gaps"]').innerText()))
  let headerAgain = false
  for (let i = 0; i < 30 && !headerAgain; i++) {
    headerAgain = calls.filter((c) => c.startsWith('ActionSync/Store?')).length > headerReads
    if (!headerAgain) await page.waitForTimeout(100)
  }
  check('14. the store header is read again', headerAgain)
  await page.screenshot({ path: `${SHOTS}/agreement-recheck.png`, fullPage: true })

  // A recheck that removes the day (no NewPos receipt that day).
  await page.locator('[data-agreement-pick="2026-10-04"]').click()
  await page.locator('[data-agreement-gaps="2026-10-04"]').waitFor({ timeout: 5000 })
  await page.locator('[data-agreement-recheck="2026-10-04"]').click()
  await page.locator('[data-reason-input]').fill('Store reported no NewPos sale that day')
  await page.locator('[data-reason-confirm]').click()
  check('14. a null answer: one toast naming both meanings of no verdict', /no verdict came back\. Either the day had no NewPos receipt and its verdict was removed, or the rails could not be read/.test(await toastText(page, /no verdict came back/)))
  await page.locator('[data-agreement-day="2026-10-04"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check('14. …and the day is removed from the list', JSON.stringify(await dayOrder(page)) === '["2026-10-08","2026-10-07","2026-10-06"]', JSON.stringify(await dayOrder(page)))
  check('14. …and the gaps go back to every day', (await page.locator('[data-agreement-gaps=""]').count()) === 1 && (await page.locator('[data-agreement-all-days]').count()) === 0)
  check('14. three rechecks sent: the refused one, then one per day', agreement.rechecks.length === 3, String(agreement.rechecks.length))
  check('no page errors (recheck)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 15: on mirror, no judged day ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P004?tab=agreement`)
  await page.locator('[data-agreement-no-days]').waitFor({ timeout: 20000 })
  check('15. a store on mirror with no NewPos receipt in the window says so', /No NewPos receipt in the last seven finished business days/.test(await page.locator('[data-agreement-no-days]').innerText()))
  check('15. …and draws no day table and no gap list', (await page.locator('[data-agreement-days]').count()) === 0 && (await page.locator('[data-agreement-gaps]').count()) === 0)
  check('15. …after one read', calls.filter((c) => c.startsWith('ActionSync/Store/Agreement')).length === 1)
  check("15. …and its agreement reads not judged", /Not judged/.test(await page.locator('[data-agreement-overall]').innerText()))
  check('no page errors (no judged day)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 16: the Transactions tab, read only (ticket 467) ──────────────────────────────────────────
const txUrl = (q) => `ActionSync/Store/Transactions?${q}`
const txCalls = (calls) => calls.filter((c) => c.startsWith('ActionSync/Store/Transactions'))
const waitForCount = async (page, count, want) => {
  for (let i = 0; i < 50; i++) {
    if (count() >= want) return true
    await page.waitForTimeout(100)
  }
  return false
}
const summaryFigure = async (page, key) => {
  const el = page.locator(`[data-summary-figure="${key}"]`)
  return (await el.count()) ? strip(await el.innerText()) : null
}
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P007`)
  await page.locator('[data-store-header]').waitFor({ timeout: 20000 })
  check('16. Store/Transactions is not read before the tab is opened', txCalls(calls).length === 0)
  await page.locator('[data-tab="transactions"]').click()
  const first = txUrl('code=P007&day=2026-10-09&page=1&pageSize=50')
  check("16. the tab reads today's receipts: the day always sent, every default omitted, page 1 of 50", await waitForCall(page, calls, first), txCalls(calls).join(','))
  await page.locator('[data-tab-grid="transactions"] .ag-row').first().waitFor({ timeout: 5000 })

  // The day picker.
  const dayOptions = await page.locator('[data-transactions-day] option').evaluateAll((els) => els.map((e) => [e.value, e.textContent]))
  check('16. the day picker offers today and the 7 days before it, newest first', JSON.stringify(dayOptions.map(([v]) => v)) === JSON.stringify(['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02']), JSON.stringify(dayOptions))
  check('16. …today first, named, and picked', strip(dayOptions[0][1]) === 'Today (2026-10-09)' && (await page.locator('[data-transactions-day]').inputValue()) === '2026-10-09', dayOptions[0][1])
  check('16. …each day isolated once in its option', dayOptions.every(([, text]) => (text.match(/⁨/g) || []).length === 1))
  check('16. today says it is re-read every minute', (await page.locator('[data-transactions-polling]').count()) === 1)

  // The summary: the door's, of the day it served.
  const today = txSummary(txOfDay('2026-10-09'))
  check('16. the summary is titled with the day the door served, isolated once', strip(await page.locator('[data-transactions-summary] h3').innerText()).toLowerCase() === 'receipts on 2026-10-09' && (await page.locator('[data-transactions-summary="2026-10-09"] h3 bdi').count()) === 1)
  check("16. …sales and returns", (await summaryFigure(page, 'sales')) === `Sales ${today.sales}` && (await summaryFigure(page, 'returns')) === `Returns ${today.returns}`, `${await summaryFigure(page, 'sales')} | ${await summaryFigure(page, 'returns')}`)
  check('16. …the signed total to 3 decimals', (await summaryFigure(page, 'total')) === `Signed total ${today.total.toFixed(3)}`, await summaryFigure(page, 'total'))
  check('16. …last completed, unshifted', (await summaryFigure(page, 'lastCompletedAt')) === 'Last completed 2026-10-09 11:59', await summaryFigure(page, 'lastCompletedAt'))
  check('16. …not yet on the counter rail', (await summaryFigure(page, 'notYet')) === `Not yet on the counter rail ${today.notYet}`, await summaryFigure(page, 'notYet'))
  check('16. …and mismatches, since there are some, in the danger token', (await summaryFigure(page, 'mismatches')) === `Totals differ from the counter rail ${today.mismatches}` && (await page.locator('[data-summary-figure="mismatches"] .text-danger-800').count()) === 1, await summaryFigure(page, 'mismatches'))

  // The list.
  check('16. a page draws 50 receipts', (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', 50)) === 50)
  const txHeaders = strip(await page.locator('[data-tab-grid="transactions"] .ag-header').innerText())
  check('16. columns: receipt, register, operator, status, sale or return, signed total, opened, completed, counter rail', ['Receipt', 'Register', 'Operator', 'Status', 'Sale or return', 'Signed total', 'Opened', 'Completed', 'Counter rail'].every((h) => txHeaders.includes(h)), txHeaders)
  check('16. …and no line, tender, customer or transaction id column', !/line|tender|customer|loyalty|transaction id/i.test(txHeaders), txHeaders)
  const sale = strip(await page.locator('.ag-row[row-id="TX-9000"]').first().innerText())
  check('16. a sale: receipt, register, operator, status, kind, total, opened, completed, its flag', sale === '0042-0009-119000 R01 OP-100 Completed Sale 25.500 2026-10-09 11:57 2026-10-09 11:59 Arrived', sale)
  const ret = strip(await page.locator('.ag-row[row-id="TX-9004"]').first().innerText())
  check("16. a return: the door's signed total, negative, never re-signed", /Return -10\.500/.test(ret), ret)
  const badgeClass = async (id) => page.locator(`.ag-row[row-id="${id}"] [data-counter] > span`).first().getAttribute('class')
  check('16. arrived is drawn in the go token', /bg-primary-050/.test((await badgeClass('TX-9000')) ?? ''))
  check('16. not yet in the warn token', /bg-attention-050/.test((await badgeClass('TX-9003')) ?? '') && /Not yet/.test(await page.locator('.ag-row[row-id="TX-9003"] [data-counter]').first().innerText()))
  check('16. totals differ in the bad token', /bg-danger-050/.test((await badgeClass('TX-9005')) ?? '') && /Totals differ/.test(await page.locator('.ag-row[row-id="TX-9005"] [data-counter]').first().innerText()))
  const unknownFlag = strip(await page.locator('.ag-row[row-id="TX-9001"] [data-counter]').first().innerText())
  check('16. an unknown flag is neutral with its raw code', unknownFlag === 'melted' && /bg-muted/.test((await badgeClass('TX-9001')) ?? ''), unknownFlag)
  const tipRaw = (await page.locator('.ag-row[row-id="TX-9005"] [data-counter]').first().getAttribute('title')) ?? ''
  check('16. the tooltip names the counter total to 3 decimals, isolated once', tipRaw === 'Counter rail total ⁨' + (25.5 + 5 + 0.5).toFixed(3) + '⁩', JSON.stringify(tipRaw))
  const tipNotYet = (await page.locator('.ag-row[row-id="TX-9003"] [data-counter]').first().getAttribute('title')) ?? ''
  check('16. …and a receipt not yet on the counter rail has its own words, never 0.000', /Not on the counter rail yet/.test(tipNotYet) && !/0\.000/.test(tipNotYet), tipNotYet)
  await page.screenshot({ path: `${SHOTS}/transactions.png`, fullPage: true })

  // Paging, and Refresh at the page.
  await page.getByRole('button', { name: 'Next' }).click()
  const p2 = txUrl('code=P007&day=2026-10-09&page=2&pageSize=50')
  check('16. Next asks for page 2', await waitForCall(page, calls, p2))
  await page.locator('.ag-row[row-id="TX-9062"]').first().waitFor({ timeout: 5000 })
  check('16. page 2 draws the last 10', (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', 10)) === 10)
  const p2Before = calls.filter((c) => c === p2).length
  await page.locator('[data-tab-refresh="transactions"]').click()
  check('16. Refresh re-reads the tab at its day and page', await waitForCount(page, () => calls.filter((c) => c === p2).length, p2Before + 1))

  // Each filter asks the door, from page 1.
  await page.locator('[data-transactions-status]').selectOption('VOIDED')
  check('16. status Voided asks the door, from page 1', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-09&status=VOIDED&page=1&pageSize=50')), txCalls(calls).slice(-2).join(','))
  check('16. …and draws the voided receipts', (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', 3)) === 3)
  await page.locator('[data-transactions-status]').selectOption('all')
  check('16. status All is sent, since the door defaults to Completed', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-09&status=all&page=1&pageSize=50')))
  const allToday = txSummary(txOfDay('2026-10-09', 'all'))
  await page.locator(`[data-summary-figure="sales"]:has-text("Sales ${allToday.sales}")`).waitFor({ timeout: 5000 }).catch(() => {})
  check("16. …the summary is the door's for the new filter", (await summaryFigure(page, 'sales')) === `Sales ${allToday.sales}`, await summaryFigure(page, 'sales'))
  await page.locator('[data-transactions-status]').selectOption('COMPLETED')
  await page.locator('[data-transactions-kind]').selectOption('return')
  check('16. kind Returns asks the door (status Completed omitted again)', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-09&kind=return&page=1&pageSize=50')), txCalls(calls).slice(-2).join(','))
  const returns = txSummary(txOfDay('2026-10-09', 'COMPLETED', 'return'))
  await page.locator(`[data-summary-figure="total"]:has-text("${returns.total.toFixed(3)}")`).waitFor({ timeout: 5000 }).catch(() => {})
  check('16. …and the signed total of returns reads negative', (await summaryFigure(page, 'total')) === `Signed total ${returns.total.toFixed(3)}` && returns.total < 0, await summaryFigure(page, 'total'))
  check("16. …the mismatches are the door's for the filter too", (await summaryFigure(page, 'mismatches')) === `Totals differ from the counter rail ${returns.mismatches}`, await summaryFigure(page, 'mismatches'))
  await page.locator('[data-transactions-kind]').selectOption('all')
  const flags = await page.locator('[data-transactions-counter] option').evaluateAll((els) => els.map((e) => e.textContent))
  check('16. the counter filter offers every flag', JSON.stringify(flags) === '["Every flag","Arrived","Not yet","Totals differ"]', JSON.stringify(flags))
  await page.locator('[data-transactions-counter]').selectOption('notYet')
  check('16. the counter filter asks the door', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-09&counter=notYet&page=1&pageSize=50')))
  const notYetRows = txOfDay('2026-10-09').filter((r) => r.counter === 'notYet').length
  check('16. …and draws its rows', (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', notYetRows)) === notYetRows, String(notYetRows))
  await page.locator('[data-transactions-counter]').selectOption('')

  // The receipt search: exact, asked on submit only.
  // The tab's own 60 s poll may re-read the current list meanwhile (this section runs on the real clock): what
  // must not happen is a request carrying what is being typed.
  await page.locator('[data-transactions-receipt]').fill('  0042-0009-118990 ')
  await page.waitForTimeout(500)
  check('16. typing a receipt asks nothing', !txCalls(calls).some((c) => c.includes('receipt=')))
  await page.locator('[data-transactions-receipt]').press('Enter')
  check('16. Enter asks for the trimmed receipt, from page 1', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-09&receipt=0042-0009-118990&page=1&pageSize=50')), txCalls(calls).slice(-2).join(','))
  check('16. …and draws that one receipt', (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', 1)) === 1 && (await page.locator('.ag-row[row-id="TX-9010"]').count()) >= 1)
  await page.locator('[data-transactions-clear]').click()
  check('16. Clear goes back to the whole day', await waitForCount(page, () => calls.filter((c) => c === first).length, 2) && (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', 50)) === 50)
  await page.locator('[data-transactions-receipt]').fill('0042-0009-000000')
  await page.locator('[data-transactions-search]').click()
  check('16. the Search button asks too', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-09&receipt=0042-0009-000000&page=1&pageSize=50')))
  await page.locator('[data-tab-empty="transactions"]').waitFor({ timeout: 5000 })
  check('16. …a receipt not on the mirror is an empty list', /No receipt on this day matches/.test(await page.locator('[data-tab-empty="transactions"]').innerText()))
  await page.locator('[data-transactions-clear]').click()

  // A past day.
  await page.locator('[data-transactions-day]').selectOption('2026-10-08')
  check('16. a past day is asked with its day, from page 1', await waitForCall(page, calls, txUrl('code=P007&day=2026-10-08&page=1&pageSize=50')), txCalls(calls).slice(-2).join(','))
  await page.locator('[data-transactions-summary="2026-10-08"]').waitFor({ timeout: 5000 })
  check('16. …its summary is titled with it', strip(await page.locator('[data-transactions-summary] h3').innerText()).toLowerCase() === 'receipts on 2026-10-08')
  check('16. …its receipts drawn', (await rowCount(page, '[data-tab-grid="transactions"] .ag-row', 3)) === 3)
  check('16. …and it is not said to be re-read', (await page.locator('[data-transactions-polling]').count()) === 0)
  check('16. …with no mismatch that day, the mismatch figure is not drawn', txSummary(txOfDay('2026-10-08')).mismatches === 0 && (await page.locator('[data-summary-figure="mismatches"]').count()) === 0)
  await page.locator('[data-transactions-day]').selectOption('2026-10-05')
  await page.locator('[data-tab-empty="transactions"]').waitFor({ timeout: 5000 })
  check('16. a day with no receipt on a worker store is an empty list, not the WPF words', /No receipt on this day matches/.test(await page.locator('[data-tab-empty="transactions"]').innerText()) && (await page.locator('[data-transactions-tab="wpf"]').count()) === 0)
  check('16. …with a summary of none yet', (await summaryFigure(page, 'lastCompletedAt')) === 'Last completed None yet' && (await summaryFigure(page, 'sales')) === 'Sales 0', await summaryFigure(page, 'lastCompletedAt'))
  check('16. nothing ever asks the snapshot door from the list', !calls.some((c) => c.includes('Transactions/Snapshot')))
  check('no page errors (transactions)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 17: polling on today only, and only while the tab is open (ticket 467) ─────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P007?tab=transactions`)
  await page.locator('[data-tab-grid="transactions"] .ag-row').first().waitFor({ timeout: 20000 })
  const todayUrl = txUrl('code=P007&day=2026-10-09&page=1&pageSize=50')
  const asked = (u) => calls.filter((c) => c === u).length
  check('17. the tab reads today once on opening', asked(todayUrl) === 1, String(asked(todayUrl)))
  await page.clock.runFor(30_000)
  await page.waitForTimeout(500)
  check('17. …and not again before a minute', asked(todayUrl) === 1, String(asked(todayUrl)))
  await page.clock.runFor(31_000)
  check('17. today is re-read after 60 s', await waitForCount(page, () => asked(todayUrl), 2), String(asked(todayUrl)))
  await page.clock.runFor(61_000)
  check('17. …and again a minute later', await waitForCount(page, () => asked(todayUrl), 3), String(asked(todayUrl)))

  // A past day never polls.
  await page.locator('[data-transactions-day]').selectOption('2026-10-08')
  const pastUrl = txUrl('code=P007&day=2026-10-08&page=1&pageSize=50')
  await waitForCall(page, calls, pastUrl)
  await page.locator('[data-transactions-summary="2026-10-08"]').waitFor({ timeout: 5000 })
  const [pastBefore, todayBefore] = [asked(pastUrl), asked(todayUrl)]
  await page.clock.runFor(61_000)
  await page.waitForTimeout(400)
  await page.clock.runFor(61_000)
  await page.waitForTimeout(800)
  check('17. a past day is never re-read, past two minutes', asked(pastUrl) === pastBefore && asked(todayUrl) === todayBefore, `${asked(pastUrl) - pastBefore} / ${asked(todayUrl) - todayBefore}`)

  // A closed tab never reads.
  await page.locator('[data-transactions-day]').selectOption('2026-10-09')
  await page.locator('[data-transactions-summary="2026-10-09"]').waitFor({ timeout: 5000 })
  await page.locator('[data-tab="counters"]').click()
  await page.locator('[data-tab-grid="counters"] .ag-row').first().waitFor({ timeout: 5000 })
  const closedBefore = txCalls(calls).length
  await page.clock.runFor(61_000)
  await page.waitForTimeout(400)
  await page.clock.runFor(61_000)
  await page.waitForTimeout(800)
  check('17. a closed tab is never read, past two minutes', txCalls(calls).length === closedBefore, String(txCalls(calls).length - closedBefore))
  check('no page errors (polling)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 18: a mirror the door cannot read, and a WPF store (ticket 467) ───────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P008?tab=transactions`)
  await page.locator('[data-transactions-unavailable]').waitFor({ timeout: 20000 })
  check('18. available: false says the mirror is not reachable or not set up', /The mirror is not reachable or not set up/.test(await page.locator('[data-transactions-unavailable]').innerText()))
  check('18. …with no list and no summary', (await page.locator('[data-tab-grid="transactions"]').count()) === 0 && (await page.locator('[data-tab-empty="transactions"]').count()) === 0 && (await page.locator('[data-transactions-summary]').count()) === 0)
  check('18. …after asking the door for today', calls.includes(txUrl('code=P008&day=2026-10-09&page=1&pageSize=50')))
  await page.screenshot({ path: `${SHOTS}/transactions-unavailable.png`, fullPage: true })
  check('no page errors (unavailable)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P002?tab=transactions`)
  await page.locator('[data-transactions-tab="wpf"]').waitFor({ timeout: 20000 })
  check('18. a WPF store keeps the tab, open on ?tab=transactions', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'transactions')
  check('18. …which reads "No NewPos receipts"', /^No NewPos receipts/.test(await page.locator('[data-transactions-tab="wpf"]').innerText()))
  await page.locator('[data-tab-refresh="transactions"]').click()
  await page.clock.runFor(61_000)
  await page.waitForTimeout(800)
  check('18. …and Store/Transactions is never asked, Refresh and a minute included', txCalls(calls).length === 0, String(txCalls(calls).length))
  await page.screenshot({ path: `${SHOTS}/transactions-wpf.png`, fullPage: true })
  check('no page errors (WPF transactions)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
