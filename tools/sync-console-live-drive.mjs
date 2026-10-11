// Sync console LIVE drive (tickets 450 and 460, spec 444) — the console against the REAL ActionSync doors.
//
// Ticket 460 (BackOffice spec 2563) added the mirror rail and rail agreement: the lane on every store
// row, the mirror workers, the Mirror line of the strip and the last hour, the Mirror and Agreement
// tabs, and their refusals. With --write it also retries one dead letter, acknowledges another and
// rechecks one store-day — each named by the inputs, never picked by the drive.
//
// The five stubbed drives (tools/sync-console-{fleet,store,controls,commands,onboard}-drive.mjs) stay
// the regression for the screens' behaviour: they pin fixture values and timings no real fleet holds.
// This drive is their live twin. It stubs NOTHING, signs in for real, and asserts what holds for any
// real fleet: every door answers on the envelope with exactly the contract's keys
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md), the refusals carry
// their codes, the fleet tiles add up, and each page draws what came back.
//
// The inputs are real values the owner picks, in tools/sync-console-live-inputs.json. A "TODO" input
// SKIPs its checks, and a SKIP is not green.
//
//   1. point the dev proxy at the SIS.Api under test and run the app:
//        $env:SIS_API='https://<staging-host>'; npx vite --port 5250 --strictPort
//      (SIS_API unset = the local SIS.Api on :5111)
//   2. sign in one of two ways, the secret never in the repo:
//        SIS_USER=<id> SIS_PASS=<pw>   — POST Auth/Login through the proxy
//        SIS_COOKIE=<sis_session>      — a cookie copied from a browser session
//   3. DRIVE_PORT=5250 node tools/sync-console-live-drive.mjs [--only fleet,store,mirror,agreement,feeds,refusals,repush] [--write]
//
// Without --write the drive writes NOTHING: reads, refusals that write nothing, and a re-push PREVIEW.
// With --write it also runs the owner walk's writes, on the TEST stores the inputs name only:
// Move to worker → pending → applied → Hand back, a connection test, and a store onboarded through
// both steps; and (460) a retry and an acknowledgement of the dead letters the inputs name, and a
// recheck of the store-day they name. It never confirms a re-push.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5250}`
const SHOTS = 'tools/.sync-console-live-shots'
mkdirSync(SHOTS, { recursive: true })

const argv = process.argv.slice(2)
const onlyAt = argv.indexOf('--only')
const READS = ['fleet', 'store', 'mirror', 'agreement', 'feeds', 'refusals', 'repush']
const WRITES = ['control', 'test', 'onboard', 'deadletters', 'recheck']
const WRITE = argv.includes('--write')
const ONLY = onlyAt === -1 ? [...READS, ...(WRITE ? WRITES : [])] : (argv[onlyAt + 1] ?? '').split(',').filter(Boolean)
const blocked = ONLY.filter((s) => WRITES.includes(s) && !WRITE)
if (blocked.length) {
  console.error(`--only ${blocked} writes to the fleet: add --write to run it.`)
  process.exit(2)
}

const INPUTS = JSON.parse(readFileSync('tools/sync-console-live-inputs.json', 'utf8'))
const todo = (v) =>
  v === undefined || v === null || v === '' || (typeof v === 'string' && /^TODO/.test(v)) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.values(v).some(todo))
const REASON = INPUTS.reason || 'Ticket 450 live drive'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const skipped = []
const skip = (name, why) => {
  skipped.push(name)
  console.log(`SKIP  ${name} — ${why}`)
}
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()

// ── The contract's keys, door by door ─────────────────────────────────────────────────────────────
// Restated by hand from src/core/models/sync-console.ts (a plain-node drive cannot import TypeScript):
// a contract change edits both.

const LOOP = ['lastPassAt', 'lastPassOutcome', 'lastErrorAt', 'lastError']
const STORE_ROW = [
  'code', 'description', 'host', 'isPaused', 'controlPending', 'states', 'lastConnectOkAt', 'lastConnectFailAt',
  'lastConnectError', 'backoffUntil', 'push', 'pull', 'pendingActions', 'oldestPendingActionAt', 'lastTrxPulledAt',
  'healthUpdatedAt', 'mirror', 'agreement',
]
const MIRROR_LANE = [
  'onMirror', 'lastPullAt', 'lastPullOkAt', 'lastConnectOkAt', 'lastConnectFailAt', 'lastConnectError', 'tillBacklogCount',
  'tillBacklogOldestAt', 'inboxPending', 'inboxDeferred', 'oldestDeferredAt', 'openDeadLetters',
]
const AGREEMENT_DAY = [
  'businessDay', 'judgedAt', 'agrees', 'mirrorCount', 'counterCount', 'mirrorTotal', 'counterTotal', 'missingAtCounter',
  'missingAtMirror', 'totalMismatches',
]
const PAGED = ['items', 'total', 'page', 'pageSize']
const HOUR_TOTALS = [
  'hour', 'pushPasses', 'pullPasses', 'connectFailures', 'chunksPushed', 'actionsPushed', 'trxPulled', 'errors',
  'mirrorSweeps', 'mirrorConnectFailures', 'mirrorPulled', 'mirrorApplied', 'mirrorDeferred', 'mirrorDeadLettered',
]
const KEYS = {
  // canEnrol is the enrolment doors' (BackOffice 2558); the console does not read it yet.
  access: ['screenAllowed', 'canOperate', 'canOnboard', 'canEnrol'],
  worker: ['rail', 'instance', 'version', 'gateOn', 'pushWidth', 'pullWidth', 'pushInFlight', 'pullInFlight', 'lastFlushAt', 'isStale', 'settings'],
  mirrorWorker: [
    'rail', 'instance', 'version', 'startedAt', 'lastTickAt', 'lastTickOutcome', 'lastTickMessage', 'inboxPending',
    'backpressureThreshold', 'isStale', 'settings',
  ],
  summary: ['asOf', 'total', 'counts'],
  counts: [
    'all', 'onWorker', 'onWpf', 'paused', 'offline', 'behind', 'erroring', 'controlPending',
    'mirrorOffline', 'mirrorBehind', 'deadLetters', 'deferredTooLong', 'railsDisagree',
  ],
  lastHour: ['current', 'previous'],
  hourTotals: HOUR_TOTALS,
  storeRow: STORE_ROW,
  loop: LOOP,
  mirrorLane: MIRROR_LANE,
  store: [...STORE_ROW, 'controlVersion', 'appliedVersion', 'appliedAt'],
  hour: ['hour', 'cell', 'pushPasses', 'pullPasses', 'connectFailures', 'actionsPushed', 'trxPulled', 'errors', 'mirror'],
  mirrorHour: ['cell', 'sweeps', 'connectFailures', 'rowsPulled', 'applied', 'deferred', 'errored', 'deadLettered'],
  storeMirror: ['lane', 'byEntityType', 'deadLetters'],
  entityCounts: ['entityType', 'pending', 'deferred', 'deadLetters'],
  // 🚩 No payload: a dead letter that carried one would be drift, and this list is what catches it.
  deadLetter: [
    'id', 'stage', 'reason', 'entityType', 'entityId', 'action', 'attempts', 'firstSeenAt', 'lastSeenAt', 'error', 'canRetry',
    'acknowledgedAt', 'acknowledgedBy', 'acknowledgeReason',
  ],
  deadLetterAction: ['auditId', 'results'],
  deadLetterResult: ['stage', 'id', 'ok', 'error'],
  storeAgreement: ['days', 'gaps'],
  agreementDay: AGREEMENT_DAY,
  agreementGap: ['businessDay', 'receiptNumber', 'kind', 'mirrorTotal', 'counterTotal'],
  recheck: ['auditId', 'day'],
  counter: ['objectId', 'bound', 'lineNumber', 'counter', 'logHead', 'lag', 'oldestPendingAt'],
  pass: ['processId', 'loop', 'startOn', 'finishOn', 'status', 'actionsCount', 'errorMessage'],
  passLine: ['lineNumber', 'objectId', 'identifiers', 'actionType', 'counter', 'lineStatus', 'startOn', 'finishOn', 'errorMessage'],
  script: ['scriptId', 'createdAt', 'isExecuted', 'lastAttempt', 'errorMessage'],
  location: ['code', 'description', 'ip', 'instance', 'dbName', 'groupId', 'father', 'isPosSyncEnabled'],
  command: ['id', 'batchId', 'code', 'kind', 'objectId', 'fromDate', 'status', 'result', 'requestedBy', 'requestedAt', 'finishedAt'],
  audit: ['id', 'at', 'who', 'action', 'codes', 'batchId', 'before', 'after', 'reason'],
  pending: ['code', 'description', 'city', 'createdAt'],
  control: ['auditId', 'results'],
  controlResult: ['code', 'ok', 'error', 'controlVersion'],
  sendCommand: ['batchId', 'auditId', 'results'],
  commandResult: ['code', 'ok', 'commandId', 'error'],
  rePush: ['preview', 'effectiveFromDate', 'totalActions', 'perStore', 'batchId', 'auditId'],
  rePushStore: ['code', 'actions', 'ok', 'error', 'commandId'],
  onboard: ['results'],
  onboardResult: ['code', 'storeCreated', 'storeSkipped', 'locationCreated', 'ok', 'error', 'warning'],
}
const STATES = KEYS.counts.slice(1)
const MIRROR_STATES = ['mirrorOffline', 'mirrorBehind', 'deadLetters', 'deferredTooLong']
const AGREEMENTS = ['agree', 'disagree', 'notJudged']
const TICK_OUTCOMES = ['Swept', 'Applied', 'SkippedLockHeld', 'SkippedBackpressure', 'Faulted', 'None']
const HOUR_CELLS = ['work', 'idle', 'passErrors', 'connectFailOnly', 'noData']
const DAY = /^\d{4}-\d{2}-\d{2}$/
/** `yyyy-MM-dd` of today minus `n` days, local — the agreement window is D-1..D-7. */
const dayAgo = (n) => {
  const d = new Date(Date.now() - n * 86400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/** The keys an object carries that the contract does not, and the contract's keys it lacks. */
function keyDrift(obj, expected) {
  if (!obj || typeof obj !== 'object') return 'not an object'
  const have = Object.keys(obj)
  const extra = have.filter((k) => !expected.includes(k))
  const missing = expected.filter((k) => !have.includes(k))
  return extra.length || missing.length ? `extra [${extra}] missing [${missing}]` : ''
}
const shapeCheck = (name, obj, expected) => {
  const drift = keyDrift(obj, expected)
  check(name, drift === '', drift)
}
/** Checks the first item's keys, or SKIPs when the door returned none. */
const firstShape = (name, items, expected) =>
  Array.isArray(items) && items.length ? shapeCheck(name, items[0], expected) : skip(name, 'the door returned no rows')
/** Every timestamp the door sends is local wall-clock, no offset (`no-utc-time`). */
const timesOk = (obj, fields) => fields.every((f) => obj?.[f] === null || TIME.test(obj?.[f] ?? ''))

// ── Sign-in and the page harness ──────────────────────────────────────────────────────────────────

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })

if (process.env.SIS_COOKIE) {
  await context.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: BASE }])
} else if (process.env.SIS_USER) {
  const res = await context.request
    .post(`${BASE}/api/Auth/Login`, {
      headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' },
      data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' },
    })
    .catch((e) => {
      console.error(`No dev server answers on ${BASE} (${e.message.split('\n')[0]}). Start vite with SIS_API first.`)
      process.exit(2)
    })
  const body = await res.json().catch(() => null)
  const cookies = await context.cookies(BASE)
  if (!cookies.some((c) => c.name === 'sis_session')) {
    console.error(`Login did not set a session cookie (HTTP ${res.status()}): ${body?.message ?? ''}`)
    console.error('If the account needs an OTP, sign in in a browser and pass SIS_COOKIE instead.')
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
} else {
  console.error('Set SIS_USER + SIS_PASS, or SIS_COOKIE.')
  process.exit(2)
}

/** Every ActionSync / Store answer the page receives: path, query, status, envelope. */
const answers = []
const errors = []
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
page.on('response', async (res) => {
  const url = new URL(res.url())
  const at = url.pathname.search(/\/api\/(ActionSync|Store)\//)
  if (at === -1) return
  const body = await res.json().catch(() => null)
  answers.push({ path: url.pathname.slice(at + 5), query: url.searchParams, status: res.status(), body })
})
await page.addInitScript(() => {
  localStorage.setItem('oms.locale', 'en')
  localStorage.setItem('oms.railExpanded', 'true')
})

/** The latest answer of one door (exact path), after `since` answers had been seen. */
const answerOf = (door, since = 0, where = () => true) =>
  answers.slice(since).filter((a) => a.path === door && where(a)).at(-1)
const waitAnswer = async (door, since, where) => {
  for (let i = 0; i < 300; i++) {
    const a = answerOf(door, since, where)
    if (a) return a
    await page.waitForTimeout(100)
  }
  return null
}
const ok = (a) => !!a && a.status === 200 && a.body?.success === true
const why = (a) => (a ? `HTTP ${a.status} ${a.body?.errors?.[0]?.errorCode ?? ''} ${a.body?.message ?? ''}`.trim() : 'no answer')
const waitFor = async (fn, ms = 10000, step = 200) => {
  for (let t = 0; t < ms; t += step) {
    if (await fn().catch(() => false)) return true
    await page.waitForTimeout(step)
  }
  return false
}

/** A door read straight off the proxy, outside the page — for the refusals no screen can send. */
async function direct(path) {
  const res = await context.request.get(`${BASE}/api/${path}`, { headers: { 'X-Web-Client': '1' } })
  return { status: res.status(), body: await res.json().catch(() => null) }
}
/** A write door posted straight off the proxy — only for refusals that write nothing. */
async function directPost(path, data) {
  const res = await context.request.post(`${BASE}/api/${path}`, { headers: { 'X-Web-Client': '1', 'Content-Type': 'application/json' }, data })
  return { status: res.status(), body: await res.json().catch(() => null) }
}
const refusedWith = (a, status, code) => a.status === status && a.body?.success === false && a.body?.errors?.[0]?.errorCode === code

/** Opens a control's reason dialog, gives the reason and confirms it. */
async function control(kind) {
  await page.locator(`[data-control="${kind}"]`).click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.locator('[data-reason-input]').fill(REASON)
  await dialog.locator('[data-reason-confirm]').click()
}
const openStore = async (code) => {
  await page.goto(`${BASE}/admin/sync/store/${code}`)
  await page.locator('[data-store-header], [data-store-page]').first().waitFor({ timeout: 20000 })
}

// ── The access probe ──────────────────────────────────────────────────────────────────────────────

await page.goto(`${BASE}/admin/sync`)
const probe = await waitAnswer('ActionSync/Access', 0)
check('access: ActionSync/Access answers', ok(probe), why(probe))
const grants = probe?.body?.data ?? {}
shapeCheck('access: exactly the four flags', grants, KEYS.access)
console.log(`      this session: ${JSON.stringify(grants)}`)
await page.locator('nav a[href="/admin/sync"]').first().waitFor({ timeout: 20000 }).catch(() => {})
check(`access: the menu ${grants.screenAllowed ? 'offers' : 'hides'} the Store sync leaf`,
  ((await page.locator('nav a[href="/admin/sync"]').count()) > 0) === (grants.screenAllowed === true))

if (grants.screenAllowed !== true) {
  console.error('This session lacks ActionSync.Health.View: nothing more to drive.')
  await finish()
}

// ── Fleet: the worker card, the tiles, the last hour and the table ───────────────────────────────

if (ONLY.includes('fleet')) {
  const since = 0
  const [workers, summary, lastHour, fleet] = await Promise.all(
    ['ActionSync/Workers', 'ActionSync/Fleet/Summary', 'ActionSync/Fleet/LastHour', 'ActionSync/Fleet'].map((d) => waitAnswer(d, since)),
  )
  for (const [name, a] of [['Workers', workers], ['Fleet/Summary', summary], ['Fleet/LastHour', lastHour], ['Fleet', fleet]]) {
    check(`fleet: ActionSync/${name} answers`, ok(a), why(a))
  }
  shapeCheck('fleet: Workers is { items }', workers?.body?.data, ['items'])
  const allWorkers = workers?.body?.data?.items ?? []
  check('fleet: every worker names its rail', allWorkers.every((x) => ['store', 'mirrorPull', 'mirrorApply'].includes(x.rail)),
    allWorkers.map((x) => x.rail).join())
  const w = allWorkers.filter((x) => x.rail === 'store')
  const mw = allWorkers.filter((x) => x.rail === 'mirrorPull' || x.rail === 'mirrorApply')
  firstShape('fleet: a store worker carries the contract\'s keys', w, KEYS.worker)
  // OWNER walk (460): the mirror workers show; none is a failure only where the host runs no mirror.
  firstShape('fleet: a mirror worker carries the contract\'s keys', mw, KEYS.mirrorWorker)
  check('fleet: a mirror worker\'s tick outcome is the contract\'s', mw.every((x) => TICK_OUTCOMES.includes(x.lastTickOutcome)))
  check('fleet: …its times are local wall-clock', mw.every((x) => timesOk(x, ['startedAt', 'lastTickAt'])))
  console.log(`      mirror workers: ${mw.map((x) => `${x.rail}@${x.instance} ${x.lastTickOutcome} at ${x.lastTickAt} stale=${x.isStale}`).join(' · ') || 'none'}`)
  check('fleet: the card draws one block per mirror worker',
    await waitFor(async () => (await page.locator('[data-mirror-worker]').count()) === mw.length), `${mw.length}`)
  console.log(`      workers: ${w.map((x) => `${x.instance} v${x.version} gate=${x.gateOn} stale=${x.isStale}`).join(' · ') || 'none'}`)
  check('fleet: the worker card draws, with a banner exactly when no worker is fresh',
    (await page.locator('[data-worker-card]').count()) === 1 &&
    ((await page.locator('[data-worker-banner]').count()) > 0) === (w.length === 0 || w.every((x) => x.isStale)))

  const s = summary?.body?.data
  shapeCheck('fleet: Fleet/Summary carries asOf, total, counts', s, KEYS.summary)
  shapeCheck('fleet: counts carry all + every StoreState', s?.counts, KEYS.counts)
  check('fleet: asOf is local wall-clock', TIME.test(s?.asOf ?? ''), s?.asOf)
  console.log(`      counts: ${JSON.stringify(s?.counts)}`)
  // OWNER walk: "the fleet tiles add up".
  check('fleet: the tiles add up — all = total', s?.counts?.all === s?.total, `${s?.counts?.all} vs ${s?.total}`)
  check('fleet: …onWorker + onWpf = all (every store has one host)', s?.counts?.onWorker + s?.counts?.onWpf === s?.counts?.all,
    `${s?.counts?.onWorker} + ${s?.counts?.onWpf} vs ${s?.counts?.all}`)
  check('fleet: …no tile counts more than the fleet', STATES.every((k) => s?.counts?.[k] >= 0 && s?.counts?.[k] <= s?.total))
  check('fleet: the unfiltered table counts the same stores as the summary', fleet?.body?.data?.total === s?.total,
    `${fleet?.body?.data?.total} vs ${s?.total}`)

  const lh = lastHour?.body?.data
  shapeCheck('fleet: Fleet/LastHour is { current, previous }', lh, KEYS.lastHour)
  shapeCheck('fleet: an hour\'s totals carry the contract\'s keys', lh?.current, KEYS.hourTotals)
  console.log(`      mirror last hour: ${KEYS.hourTotals.filter((k) => k.startsWith('mirror')).map((k) => `${k}=${lh?.current?.[k]}`).join(' ')}`)

  const f = fleet?.body?.data
  shapeCheck('fleet: Fleet is paged', f, PAGED)
  firstShape('fleet: a store row carries the contract\'s keys', f?.items, KEYS.storeRow)
  firstShape('fleet: …and its push loop the LoopHealth keys', f?.items?.map((r) => r.push), KEYS.loop)
  firstShape('fleet: …and its mirror lane the MirrorLane keys', f?.items?.map((r) => r.mirror), KEYS.mirrorLane)
  const rows = f?.items ?? []
  check('fleet: a row\'s agreement is the contract\'s', rows.every((r) => AGREEMENTS.includes(r.agreement)), [...new Set(rows.map((r) => r.agreement))].join())
  check('fleet: railsDisagree is drawn exactly where the agreement is disagree',
    rows.every((r) => r.states.includes('railsDisagree') === (r.agreement === 'disagree')))
  check('fleet: a store off the mirror has an empty lane and no mirror state',
    rows.filter((r) => !r.mirror.onMirror).every((r) =>
      r.mirror.tillBacklogCount === null && r.mirror.inboxPending === 0 && r.mirror.openDeadLetters === 0 &&
      !r.states.some((x) => MIRROR_STATES.includes(x))))
  check('fleet: deadLetters is drawn exactly where the lane counts open dead letters',
    rows.every((r) => r.states.includes('deadLetters') === (r.mirror.openDeadLetters > 0)))
  check('fleet: a lane\'s times are local wall-clock (the till clock too)',
    rows.every((r) => timesOk(r.mirror, ['lastPullAt', 'lastPullOkAt', 'lastConnectOkAt', 'lastConnectFailAt', 'tillBacklogOldestAt', 'oldestDeferredAt'])))
  const onMirror = rows.filter((r) => r.mirror.onMirror)
  console.log(`      on the mirror (this page): ${onMirror.length} of ${rows.length}; red lanes: ${
    onMirror.filter((r) => r.states.some((x) => ['mirrorOffline', 'deadLetters'].includes(x))).map((r) => `${r.code} [${r.states.filter((x) => MIRROR_STATES.includes(x))}]`).join(', ') || 'none'}`)
  check('fleet: rows only carry known states', (f?.items ?? []).every((r) => r.states.every((x) => STATES.includes(x))))
  check('fleet: a WPF row has no health row', (f?.items ?? []).filter((r) => r.host === 'Wpf').every((r) => r.healthUpdatedAt === null && r.pendingActions === 0 && r.states.includes('onWpf')))
  const first = f?.items?.[0]
  if (first) {
    check('fleet: the table draws the door\'s rows', await waitFor(async () => (await page.locator(`[data-store-link="${first.code}"]`).count()) > 0, 20000), first.code)
  }
  await page.screenshot({ path: `${SHOTS}/fleet.png`, fullPage: true })

  // Each tile filters to exactly its count (one tile; AND of several is the stub drive's).
  for (const tile of ['onWorker', 'onWpf', 'deadLetters', 'railsDisagree']) {
    const before = answers.length
    await page.locator(`[data-tile="${tile}"]`).click()
    const a = await waitAnswer('ActionSync/Fleet', before, (x) => x.query.getAll('state').join() === tile)
    check(`fleet: the ${tile} tile reads ${s?.counts?.[tile]} stores`, ok(a) && a.body.data.total === s?.counts?.[tile], why(a) + ` total ${a?.body?.data?.total}`)
    await page.locator(`[data-tile="${tile}"]`).click()
  }
}

// ── One store: header, strip, counters, passes, scripts, location ────────────────────────────────

if (ONLY.includes('store')) {
  if (todo(INPUTS.storeCode)) {
    skip('store', 'storeCode is TODO')
  } else {
    const code = INPUTS.storeCode
    const since = answers.length
    await openStore(code)
    const header = await waitAnswer('ActionSync/Store', since)
    check(`store ${code}: ActionSync/Store answers`, ok(header), why(header))
    shapeCheck(`store ${code}: the header carries the row + control versions`, header?.body?.data, KEYS.store)
    const h = header?.body?.data
    shapeCheck(`store ${code}: …and its mirror lane the MirrorLane keys`, h?.mirror, KEYS.mirrorLane)
    // A WPF store gets the reduced view (no strip, no Scripts or Location tab): its doors are read directly.
    const wpf = h?.host === 'Wpf'
    const q = `code=${encodeURIComponent(code)}`
    check(`store ${code}: controlPending = appliedVersion < controlVersion`, h?.controlPending === (h?.appliedVersion < h?.controlVersion),
      `${h?.appliedVersion} / ${h?.controlVersion}`)
    check(`store ${code}: its times are local wall-clock`, timesOk(h, ['lastConnectOkAt', 'lastConnectFailAt', 'backoffUntil', 'oldestPendingActionAt', 'lastTrxPulledAt', 'healthUpdatedAt', 'appliedAt']))
    const hours = wpf ? await direct(`ActionSync/Store/Hours?${q}`) : await waitAnswer('ActionSync/Store/Hours', since)
    check(`store ${code}: Store/Hours answers 24 hours`, ok(hours) && hours.body.data.items.length === 24, why(hours) + ` ${hours?.body?.data?.items?.length}`)
    firstShape(`store ${code}: an hour carries the contract's keys`, hours?.body?.data?.items, KEYS.hour)
    const hs = hours?.body?.data?.items ?? []
    check(`store ${code}: …oldest first`, hs.every((x, i) => i === 0 || hs[i - 1].hour < x.hour))
    firstShape(`store ${code}: an hour's Mirror line carries the contract's keys`, hs.map((x) => x.mirror), KEYS.mirrorHour)
    check(`store ${code}: …its cells are the contract's`, hs.every((x) => HOUR_CELLS.includes(x.mirror?.cell)))
    if (!h?.mirror?.onMirror) check(`store ${code}: a store off the mirror has an empty Mirror line`, hs.every((x) => x.mirror?.cell === 'noData'))
    if (wpf) check(`store ${code}: a WPF store draws no strip`, (await page.locator('[data-hour-cell]').count()) === 0)
    else check(`store ${code}: the strip draws 24 cells`, await waitFor(async () => (await page.locator('[data-hour-cell]').count()) === 24))
    if (h?.mirror?.onMirror) check(`store ${code}: …and a Mirror line of 24`, await waitFor(async () => (await page.locator('[data-mirror-hour-cell]').count()) === 24))

    const counters = await waitAnswer('ActionSync/Store/Counters', since)
    check(`store ${code}: Store/Counters answers`, ok(counters), why(counters))
    firstShape(`store ${code}: a counter carries the contract's keys`, counters?.body?.data?.items, KEYS.counter)
    check(`store ${code}: logHead is push-only`, (counters?.body?.data?.items ?? []).filter((c) => c.bound === 'In').every((c) => c.logHead === null))

    let at = answers.length
    await page.locator('[data-tab="passes"]').click()
    const passes = await waitAnswer('ActionSync/Store/Passes', at)
    check(`store ${code}: Store/Passes answers`, ok(passes), why(passes))
    shapeCheck(`store ${code}: Passes is paged`, passes?.body?.data, PAGED)
    firstShape(`store ${code}: a pass carries the contract's keys`, passes?.body?.data?.items, KEYS.pass)
    const p0 = passes?.body?.data?.items?.[0]
    if (p0) {
      await page.locator(`[data-pass="${p0.processId}"]`).click()
      const detail = await waitAnswer('ActionSync/Store/PassDetail', at)
      check(`store ${code}: Store/PassDetail answers`, ok(detail), why(detail))
      firstShape(`store ${code}: a pass line carries the contract's keys`, detail?.body?.data?.items, KEYS.passLine)
      await page.locator('[data-pass-detail-close]').click().catch(() => {})
    }

    at = answers.length
    if (!wpf) await page.locator('[data-tab="scripts"]').click()
    const scripts = wpf ? await direct(`ActionSync/Store/Scripts?${q}`) : await waitAnswer('ActionSync/Store/Scripts', at)
    check(`store ${code}: Store/Scripts answers`, ok(scripts), why(scripts))
    firstShape(`store ${code}: a script carries the contract's keys (never its SQL)`, scripts?.body?.data?.items, KEYS.script)

    at = answers.length
    if (!wpf) await page.locator('[data-tab="location"]').click()
    const loc = wpf ? await direct(`ActionSync/Store/Location?${q}`) : await waitAnswer('ActionSync/Store/Location', at)
    check(`store ${code}: Store/Location answers`, ok(loc), why(loc))
    shapeCheck(`store ${code}: the location carries exactly the contract's keys — no credentials`, loc?.body?.data, KEYS.location)
    await page.screenshot({ path: `${SHOTS}/store-${code}.png`, fullPage: true })
  }

  if (todo(INPUTS.wpfStoreCode)) {
    skip('store (WPF)', 'wpfStoreCode is TODO')
  } else {
    const code = INPUTS.wpfStoreCode
    const since = answers.length
    await openStore(code)
    const header = await waitAnswer('ActionSync/Store', since)
    const h = header?.body?.data
    check(`store ${code}: a WPF store has no health row`, ok(header) && h.host === 'Wpf' && h.states.includes('onWpf') && h.healthUpdatedAt === null, why(header))
    check(`store ${code}: …and the reduced view`, await waitFor(async () => (await page.locator('[data-wpf-note]').count()) === 1))
    if (grants.canOperate) {
      const offered = await page.locator('[data-store-controls]').getAttribute('data-store-controls').catch(() => null)
      check(`store ${code}: a WPF store offers only Move to worker and Test connection`, offered === 'Move ConnectionTest', offered)
    }
  }
}

// ── The Mirror tab: the lane, the inbox by entity type, the dead letters (460) ───────────────────

const mirrorCode = todo(INPUTS.mirrorStoreCode) ? INPUTS.storeCode : INPUTS.mirrorStoreCode

if (ONLY.includes('mirror')) {
  if (todo(mirrorCode)) {
    skip('mirror', 'mirrorStoreCode and storeCode are TODO')
  } else {
    const code = mirrorCode
    const since = answers.length
    await page.goto(`${BASE}/admin/sync/store/${code}?tab=mirror`)
    const a = await waitAnswer('ActionSync/Store/Mirror', since)
    check(`mirror ${code}: Store/Mirror answers`, ok(a), why(a))
    const m = a?.body?.data
    shapeCheck(`mirror ${code}: it carries lane, byEntityType, deadLetters`, m, KEYS.storeMirror)
    shapeCheck(`mirror ${code}: the lane carries the MirrorLane keys`, m?.lane, KEYS.mirrorLane)
    firstShape(`mirror ${code}: an entity type's counts carry the contract's keys`, m?.byEntityType, KEYS.entityCounts)
    shapeCheck(`mirror ${code}: the dead letters are paged`, m?.deadLetters, PAGED)
    const dl = m?.deadLetters?.items ?? []
    firstShape(`mirror ${code}: a dead letter carries exactly the contract's keys — no payload`, dl, KEYS.deadLetter)
    check(`mirror ${code}: open only by default (no acknowledged row)`, dl.every((x) => x.acknowledgedAt === null))
    check(`mirror ${code}: canRetry = apply stage and unacknowledged`, dl.every((x) => x.canRetry === (x.stage === 'apply' && x.acknowledgedAt === null)))
    check(`mirror ${code}: a pull-stage row has no action`, dl.filter((x) => x.stage === 'pull').every((x) => x.action === null))
    check(`mirror ${code}: newest last seen first`, dl.every((x, i) => i === 0 || (dl[i - 1].lastSeenAt ?? '') >= (x.lastSeenAt ?? '')))
    check(`mirror ${code}: its times are local wall-clock`, dl.every((x) => timesOk(x, ['firstSeenAt', 'lastSeenAt', 'acknowledgedAt'])))
    check(`mirror ${code}: the lane counts every open dead letter the list holds`, (m?.lane?.openDeadLetters ?? -1) >= dl.length,
      `${m?.lane?.openDeadLetters} vs ${dl.length}`)
    console.log(`      lane: ${JSON.stringify(m?.lane)}`)
    console.log(`      dead letters: ${m?.deadLetters?.total ?? 0} open; first: ${dl.slice(0, 5).map((x) => `${x.stage}-${x.id} ${x.reason} ${x.entityType}`).join(' · ') || 'none'}`)
    if (m?.lane?.onMirror) {
      check(`mirror ${code}: the tab draws the dead letters`, await waitFor(async () =>
        (await page.locator('[data-tab-grid="mirror-dead-letters"] .ag-row').count()) === Math.min(dl.length, 50) ||
        (dl.length === 0 && (await page.locator('[data-mirror-tab]').count()) === 1), 20000))
      if (dl[0]) check(`mirror ${code}: …by stage and id`, (await page.locator(`.ag-row[row-id="${dl[0].stage}-${dl[0].id}"]`).count()) > 0)
    } else {
      check(`mirror ${code}: a store off the mirror says so`, await waitFor(async () => (await page.locator('[data-mirror-not-on], [data-mirror-tab]').count()) > 0))
    }
    const all = await direct(`ActionSync/Store/Mirror?code=${encodeURIComponent(code)}&includeAcknowledged=true`)
    check(`mirror ${code}: includeAcknowledged=true answers`, ok(all), why(all))
    check(`mirror ${code}: …and lists at least the open rows`, (all?.body?.data?.deadLetters?.total ?? -1) >= (m?.deadLetters?.total ?? 0))
    await page.screenshot({ path: `${SHOTS}/mirror-${code}.png`, fullPage: true })
  }
}

// ── The Agreement tab: the judged days and their gaps (460) ──────────────────────────────────────

const agreementCode = todo(INPUTS.agreementStoreCode) ? mirrorCode : INPUTS.agreementStoreCode

if (ONLY.includes('agreement')) {
  if (todo(agreementCode)) {
    skip('agreement', 'agreementStoreCode, mirrorStoreCode and storeCode are TODO')
  } else {
    const code = agreementCode
    const since = answers.length
    await page.goto(`${BASE}/admin/sync/store/${code}?tab=agreement`)
    const header = await waitAnswer('ActionSync/Store', since)
    const a = await waitAnswer('ActionSync/Store/Agreement', since)
    check(`agreement ${code}: Store/Agreement answers`, ok(a), why(a))
    const g = a?.body?.data
    shapeCheck(`agreement ${code}: it carries days and gaps`, g, KEYS.storeAgreement)
    const days = g?.days ?? []
    firstShape(`agreement ${code}: a day carries the contract's keys`, days, KEYS.agreementDay)
    const window = [1, 2, 3, 4, 5, 6, 7].map(dayAgo)
    check(`agreement ${code}: every day is within D-1..D-7`, days.every((d) => window.includes(d.businessDay)), days.map((d) => d.businessDay).join())
    check(`agreement ${code}: …newest first`, days.every((d, i) => i === 0 || days[i - 1].businessDay > d.businessDay))
    check(`agreement ${code}: a day agrees exactly when it has no gap`,
      days.every((d) => d.agrees === (d.missingAtCounter + d.missingAtMirror + d.totalMismatches === 0)))
    check(`agreement ${code}: judgedAt is local wall-clock`, days.every((d) => TIME.test(d.judgedAt ?? '')))
    shapeCheck(`agreement ${code}: the gaps are paged`, g?.gaps, PAGED)
    const gaps = g?.gaps?.items ?? []
    firstShape(`agreement ${code}: a gap carries the contract's keys`, gaps, KEYS.agreementGap)
    check(`agreement ${code}: a gap's kind is the contract's`, gaps.every((x) => ['missingAtCounter', 'missingAtMirror', 'totalMismatch'].includes(x.kind)))
    check(`agreement ${code}: a missing receipt has no total on the rail it is missing from`,
      gaps.every((x) => (x.kind === 'missingAtCounter' ? x.counterTotal === null : x.kind === 'missingAtMirror' ? x.mirrorTotal === null : true)))
    check(`agreement ${code}: the gaps add up to the days' counts`, (g?.gaps?.total ?? -1) ===
      days.reduce((n, d) => n + d.missingAtCounter + d.missingAtMirror + d.totalMismatches, 0),
      `${g?.gaps?.total} vs the days' sum`)
    const h = header?.body?.data
    if (h) {
      // The header's verdict comes from the same verdicts, but a nightly run between the two reads can move it.
      const want = days.length === 0 ? 'notJudged' : days.some((d) => !d.agrees) ? 'disagree' : 'agree'
      check(`agreement ${code}: the header's agreement matches the days`, h.agreement === want, `${h.agreement} vs ${want}`)
    }
    console.log(`      days: ${days.map((d) => `${d.businessDay} ${d.agrees ? 'agree' : 'DISAGREE'} m${d.mirrorCount}/c${d.counterCount} ${d.mirrorTotal}/${d.counterTotal}`).join(' · ') || 'none judged'}`)
    check(`agreement ${code}: the tab draws one row per judged day`,
      await waitFor(async () => (await page.locator('[data-agreement-day]').count()) === days.length || (days.length === 0 && (await page.locator('[data-agreement-no-days], [data-agreement-tab]').count()) > 0), 20000))
    if (days[0]) {
      const at = answers.length
      await page.locator(`[data-agreement-pick="${days[0].businessDay}"]`).click()
      const picked = await waitAnswer('ActionSync/Store/Agreement', at, (x) => x.query.get('day') === days[0].businessDay)
      check(`agreement ${code}: picking a day reads its gaps`, ok(picked) && (picked.body.data.gaps.items ?? []).every((x) => x.businessDay === days[0].businessDay), why(picked))
    }
    await page.screenshot({ path: `${SHOTS}/agreement-${code}.png`, fullPage: true })
  }
}

// ── The fleet-wide feeds: commands, audit, sync pending ──────────────────────────────────────────

if (ONLY.includes('feeds')) {
  for (const [route, door, keys] of [
    ['commands', 'ActionSync/Commands', KEYS.command],
    ['audit', 'ActionSync/Audit', KEYS.audit],
    ['pending', 'ActionSync/PendingStores', KEYS.pending],
  ]) {
    const since = answers.length
    await page.goto(`${BASE}/admin/sync/${route}`)
    const a = await waitAnswer(door, since)
    check(`feeds: ${door} answers`, ok(a), why(a))
    shapeCheck(`feeds: ${door} is paged`, a?.body?.data, PAGED)
    firstShape(`feeds: a ${route} row carries the contract's keys`, a?.body?.data?.items, keys)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/${route}.png`, fullPage: true })
  }
}

// ── Refusals that write nothing: the codes the client branches on ────────────────────────────────

if (ONLY.includes('refusals')) {
  const old = new Date(Date.now() - 40 * 86400_000)
  const day = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}-${String(old.getDate()).padStart(2, '0')}`
  const cases = [
    ['an unknown sort', 'ActionSync/Fleet?sort=sideways', 400, 'BAD_FILTER'],
    ['an unknown state', 'ActionSync/Fleet?state=asleep', 400, 'BAD_FILTER'],
    ['a page size over 200', 'ActionSync/Fleet?pageSize=201', 400, 'BAD_PAGING'],
    ['an unknown store', 'ActionSync/Store?code=ZZ%3F9', 404, 'NO_STORE'],
    ['hours over 168', `ActionSync/Store/Hours?code=${encodeURIComponent(INPUTS.storeCode)}&hours=169`, 400, 'BAD_FILTER'],
    ['passes older than 30 days', `ActionSync/Store/Passes?code=${encodeURIComponent(INPUTS.storeCode)}&from=${day}`, 400, 'BAD_DATE'],
    ['an unknown command status', 'ActionSync/Commands?status=Sleeping', 400, 'BAD_FILTER'],
    ['a malformed audit date', 'ActionSync/Audit?from=yesterday', 400, 'BAD_DATE'],
    // 460: the mirror and agreement reads.
    ['an unknown dead-letter stage', `ActionSync/Store/Mirror?code=${encodeURIComponent(INPUTS.storeCode)}&stage=middle`, 400, 'BAD_FILTER'],
    ['an unknown dead-letter reason', `ActionSync/Store/Mirror?code=${encodeURIComponent(INPUTS.storeCode)}&reason=gremlins`, 400, 'BAD_FILTER'],
    ['includeAcknowledged that is not a boolean', `ActionSync/Store/Mirror?code=${encodeURIComponent(INPUTS.storeCode)}&includeAcknowledged=maybe`, 400, 'BAD_FILTER'],
    ['an unknown store on the Mirror tab', 'ActionSync/Store/Mirror?code=ZZ%3F9', 404, 'NO_STORE'],
    ['today on the Agreement tab (outside D-1..D-7)', `ActionSync/Store/Agreement?code=${encodeURIComponent(INPUTS.storeCode)}&day=${dayAgo(0)}`, 400, 'BAD_DATE'],
    ['D-8 on the Agreement tab', `ActionSync/Store/Agreement?code=${encodeURIComponent(INPUTS.storeCode)}&day=${dayAgo(8)}`, 400, 'BAD_DATE'],
    ['an unknown store on the Agreement tab', 'ActionSync/Store/Agreement?code=ZZ%3F9', 404, 'NO_STORE'],
  ]
  for (const [name, path, status, code] of cases) {
    if (/code=/.test(path) && todo(INPUTS.storeCode)) {
      skip(`refusals: ${name}`, 'storeCode is TODO')
      continue
    }
    const a = await direct(path)
    check(`refusals: ${name} is a ${status} ${code}`, refusedWith(a, status, code), why(a))
  }
  // 460: the added sorts and states are accepted.
  for (const path of ['ActionSync/Fleet?sort=largestBacklog', 'ActionSync/Fleet?sort=mostDeadLetters', ...MIRROR_STATES.map((x) => `ActionSync/Fleet?state=${x}`), 'ActionSync/Fleet?state=railsDisagree']) {
    const a = await direct(path)
    check(`refusals: ${path.slice('ActionSync/'.length)} is accepted`, ok(a), why(a))
  }
  // 460: the write doors' whole-request refusals. Each is refused before anything is written.
  if (!grants.canOperate) {
    skip('refusals: the dead-letter and recheck doors', 'this session lacks canOperate')
  } else if (todo(INPUTS.storeCode)) {
    skip('refusals: the dead-letter and recheck doors', 'storeCode is TODO')
  } else {
    const code = INPUTS.storeCode
    const one = [{ stage: 'apply', id: '0' }]
    const posts = [
      ['a retry with a blank reason', 'ActionSync/Mirror/DeadLetters/Retry', { code, items: one, reason: '  ' }, 400, 'REASON_REQUIRED'],
      ['a retry of 51 dead letters', 'ActionSync/Mirror/DeadLetters/Retry',
        { code, items: Array.from({ length: 51 }, (_, i) => ({ stage: 'apply', id: String(i + 1) })), reason: REASON }, 400, 'TOO_MANY'],
      ['a retry of no dead letter', 'ActionSync/Mirror/DeadLetters/Retry', { code, items: [], reason: REASON }, 400, 'BAD_REQUEST'],
      ['an acknowledgement on an unknown store', 'ActionSync/Mirror/DeadLetters/Acknowledge', { code: 'ZZ?9', items: one, reason: REASON }, 404, 'NO_STORE'],
      ['a recheck of today', 'ActionSync/Agreement/Recheck', { code, day: dayAgo(0), reason: REASON }, 400, 'BAD_DATE'],
      ['a recheck with a blank reason', 'ActionSync/Agreement/Recheck', { code, day: dayAgo(1), reason: '' }, 400, 'REASON_REQUIRED'],
      ['a recheck on an unknown store', 'ActionSync/Agreement/Recheck', { code: 'ZZ?9', day: dayAgo(1), reason: REASON }, 404, 'NO_STORE'],
    ]
    for (const [name, path, body, status, refusal] of posts) {
      const a = await directPost(path, body)
      check(`refusals: ${name} is a ${status} ${refusal}`, refusedWith(a, status, refusal), why(a))
    }
  }
}

// ── A re-push PREVIEW: its counts match the door's (OWNER walk) — never confirmed ─────────────────

if (ONLY.includes('repush')) {
  if (!grants.canOperate) {
    skip('repush', 'this session lacks canOperate')
  } else if (todo(INPUTS.rePushStoreCode)) {
    skip('repush', 'rePushStoreCode is TODO')
  } else {
    const code = INPUTS.rePushStoreCode
    await openStore(code)
    await page.locator('[data-control="RePush"]').click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor()
    await dialog.locator('[data-reason-input]').fill(REASON)
    const since = answers.length
    await dialog.locator('[data-repush-preview-button]').click()
    const a = await waitAnswer('ActionSync/Commands/RePush', since)
    check(`repush ${code}: the preview answers`, ok(a), why(a))
    const d = a?.body?.data
    shapeCheck(`repush ${code}: the answer carries the contract's keys`, d, KEYS.rePush)
    firstShape(`repush ${code}: …and its per-store row`, d?.perStore, KEYS.rePushStore)
    check(`repush ${code}: a preview writes nothing (no batch, no audit)`, d?.preview === true && d?.batchId === null && d?.auditId === null)
    check(`repush ${code}: the effective date is local wall-clock`, TIME.test(d?.effectiveFromDate ?? ''), d?.effectiveFromDate)
    check(`repush ${code}: the total is the per-store sum`, d?.totalActions === (d?.perStore ?? []).reduce((n, r) => n + (r.actions ?? 0), 0))
    await dialog.locator('[data-repush-sentence]').waitFor({ timeout: 10000 }).catch(() => {})
    const sentence = strip(await dialog.locator('[data-repush-sentence]').innerText().catch(() => ''))
    check(`repush ${code}: the sentence shows the door's count and its echoed date`,
      sentence.includes(Number(d?.totalActions).toLocaleString('en-US')) && sentence.includes(String(d?.effectiveFromDate).slice(0, 10)), sentence)
    await page.screenshot({ path: `${SHOTS}/repush-preview.png` })
    await dialog.locator('[data-reason-cancel]').click()
    check(`repush ${code}: cancelled, never confirmed`, await waitFor(async () => (await page.locator('dialog[open]').count()) === 0) &&
      !answers.slice(since).some((x) => x.path === 'ActionSync/Commands/RePush' && x.body?.data?.preview === false))
  }
}

// ── --write: Move to worker → pending → applied → Hand back (OWNER walk) ─────────────────────────

if (ONLY.includes('control')) {
  if (!grants.canOperate) {
    skip('control', 'this session lacks canOperate')
  } else if (todo(INPUTS.testStoreOnWpf)) {
    skip('control', 'testStoreOnWpf is TODO')
  } else {
    const code = INPUTS.testStoreOnWpf
    await openStore(code)
    for (const [action, host] of [['Move', 'Worker'], ['HandBack', 'Wpf']]) {
      const since = answers.length
      await control(action)
      const a = await waitAnswer('ActionSync/Stores/Control', since)
      check(`control ${code}: ${action} answers`, ok(a), why(a))
      shapeCheck(`control ${code}: …with the contract's keys`, a?.body?.data, KEYS.control)
      firstShape(`control ${code}: …and its row`, a?.body?.data?.results, KEYS.controlResult)
      check(`control ${code}: ${action} applied to the row`, a?.body?.data?.results?.[0]?.ok === true, a?.body?.data?.results?.[0]?.error)
      // The worker applies a control on its next poll and the header refetches every 30 s, so a fast
      // worker can apply it before the badge is ever drawn: not seeing it is a note, not a failure.
      const sawPending = await waitFor(async () => (await page.locator('[data-control-pending]').count()) === 1, 35000)
      console.log(`      ${action}: the pending badge was ${sawPending ? 'seen' : 'not seen (applied before the header refetched)'}`)
      check(`control ${code}: …and clears once the worker applied it (≤ 3 min)`,
        await waitFor(async () => (await page.locator('[data-control-pending]').count()) === 0, 180000, 1000))
      check(`control ${code}: the header reads host ${host}`, await waitFor(async () => (await page.locator(`[data-store-host="${host}"]`).count()) === 1, 35000))
      await page.screenshot({ path: `${SHOTS}/control-${action}.png`, fullPage: true })
    }
  }
}

// ── --write: a connection test returns (OWNER walk) ──────────────────────────────────────────────

if (ONLY.includes('test')) {
  if (!grants.canOperate) {
    skip('test', 'this session lacks canOperate')
  } else if (todo(INPUTS.testStoreForTest)) {
    skip('test', 'testStoreForTest is TODO')
  } else {
    const code = INPUTS.testStoreForTest
    await openStore(code)
    const since = answers.length
    await control('ConnectionTest')
    const a = await waitAnswer('ActionSync/Commands', since, (x) => x.query.size === 0)
    check(`test ${code}: POST ActionSync/Commands answers`, ok(a), why(a))
    shapeCheck(`test ${code}: …with the contract's keys`, a?.body?.data, KEYS.sendCommand)
    firstShape(`test ${code}: …and its row`, a?.body?.data?.results, KEYS.commandResult)
    const batch = a?.body?.data?.batchId
    const polled = await waitAnswer('ActionSync/Commands', since, (x) => x.query.get('batch') === batch)
    firstShape(`test ${code}: the batch poll returns its command`, polled?.body?.data?.items, KEYS.command)
    const ended = await waitFor(async () => ['ok', 'failed'].includes(await page.locator('[data-command-run]').getAttribute('data-run-verdict')), 70000, 1000)
    const verdict = await page.locator('[data-command-run]').getAttribute('data-run-verdict').catch(() => null)
    check(`test ${code}: the test returns (OK or failed, not stuck)`, ended, `${verdict}: ${strip(await page.locator('[data-command-run]').innerText().catch(() => ''))}`)
    await page.screenshot({ path: `${SHOTS}/connection-test.png`, fullPage: true })
  }
}

// ── --write: a test store onboarded through both steps (OWNER walk) ──────────────────────────────

if (ONLY.includes('onboard')) {
  const o = INPUTS.onboard
  if (!grants.canOnboard || !grants.canOperate) {
    skip('onboard', 'this session lacks canOnboard or canOperate')
  } else if (todo(o)) {
    skip('onboard', 'an onboard input is TODO')
  } else {
    await page.goto(`${BASE}/admin/sync/new-store`)
    await page.locator('[data-wizard]').waitFor({ timeout: 20000 })
    const field = (name) => page.locator(`[data-field="${name}"]`)
    for (const k of ['code', 'description', 'city', 'area', 'address', 'phone', 'cr']) await field(k).fill(o[k])
    await field('template-store').fill(o.templateStore)
    await page.locator('[data-wizard-next]').click()
    await field('ip').fill(o.ip)
    await field('template-location').fill(o.templateLocation)
    await page.locator('[data-reason-input]').fill(REASON)
    let since = answers.length
    await page.locator('[data-wizard-preview-button]').click()
    const pv = await waitAnswer('Store/Onboard/Preview', since)
    check(`onboard ${o.code}: the preview answers`, ok(pv), why(pv))
    shapeCheck(`onboard ${o.code}: …with the contract's keys`, pv?.body?.data, KEYS.onboard)
    firstShape(`onboard ${o.code}: …and its row`, pv?.body?.data?.results, KEYS.onboardResult)
    const r = pv?.body?.data?.results?.[0]
    check(`onboard ${o.code}: the preview would create the store and its location`, r?.ok === true && r.storeCreated && r.locationCreated, JSON.stringify(r))
    await page.locator('[data-wizard-preview="fresh"]').waitFor({ timeout: 10000 }).catch(() => {})
    if (r?.ok) {
      since = answers.length
      await page.locator('[data-wizard-create]').click()
      const done = await waitAnswer('Store/Onboard', since)
      const d = done?.body?.data?.results?.[0]
      check(`onboard ${o.code}: both steps ran`, ok(done) && d?.ok === true && d.storeCreated && d.locationCreated, why(done) + ' ' + JSON.stringify(d))
      check(`onboard ${o.code}: the result links to the new store`, await waitFor(async () => (await page.locator(`[data-result-store="${o.code}"]`).count()) === 1))
      await page.screenshot({ path: `${SHOTS}/onboard.png`, fullPage: true })
      since = answers.length
      await openStore(o.code)
      const h = await waitAnswer('ActionSync/Store', since)
      check(`onboard ${o.code}: the new store opens, counters at 0`, ok(h), why(h))
    }
  }
}

// ── --write: retry one dead letter and acknowledge another (OWNER walk, 460) ─────────────────────

/** Ticks one dead letter's checkbox on the Mirror tab, by its row id (`stage-id`). */
const tickDeadLetter = (rowId) => page.locator(`.ag-row[row-id="${rowId}"] .ag-selection-checkbox input`).first().click()
const split = (rowId) => {
  const at = String(rowId).indexOf('-')
  return { stage: rowId.slice(0, at), id: rowId.slice(at + 1) }
}

if (ONLY.includes('deadletters')) {
  const { retryDeadLetter, acknowledgeDeadLetter } = INPUTS
  if (!grants.canOperate) {
    skip('deadletters', 'this session lacks canOperate')
  } else if (todo(INPUTS.mirrorStoreCode) || todo(retryDeadLetter) || todo(acknowledgeDeadLetter)) {
    skip('deadletters', 'mirrorStoreCode, retryDeadLetter or acknowledgeDeadLetter is TODO')
  } else {
    const code = INPUTS.mirrorStoreCode
    for (const [action, rowId] of [['retry', retryDeadLetter], ['acknowledge', acknowledgeDeadLetter]]) {
      const door = action === 'retry' ? 'Retry' : 'Acknowledge'
      await page.goto(`${BASE}/admin/sync/store/${code}?tab=mirror`)
      const listed = await waitFor(async () => (await page.locator(`.ag-row[row-id="${rowId}"]`).count()) > 0, 20000)
      check(`deadletters ${code}: ${rowId} is listed open`, listed)
      if (!listed) continue
      await tickDeadLetter(rowId)
      await page.locator(`[data-dead-letter-action="${action}"]`).click()
      const dialog = page.locator('dialog[open]')
      await dialog.waitFor()
      await dialog.locator('[data-reason-input]').fill(REASON)
      const since = answers.length
      await dialog.locator('[data-reason-confirm]').click()
      const a = await waitAnswer(`ActionSync/Mirror/DeadLetters/${door}`, since)
      check(`deadletters ${code}: ${door} answers`, ok(a), why(a))
      shapeCheck(`deadletters ${code}: …with the contract's keys`, a?.body?.data, KEYS.deadLetterAction)
      firstShape(`deadletters ${code}: …and its row`, a?.body?.data?.results, KEYS.deadLetterResult)
      const r = a?.body?.data?.results?.[0]
      check(`deadletters ${code}: ${door} done for ${rowId}`, r?.ok === true && `${r.stage}-${r.id}` === rowId, JSON.stringify(r))
      check(`deadletters ${code}: …audited (an auditId, the sink is HQ)`, typeof a?.body?.data?.auditId === 'string', String(a?.body?.data?.auditId))
      check(`deadletters ${code}: …and the row leaves the open list`,
        await waitFor(async () => (await page.locator(`.ag-row[row-id="${rowId}"]`).count()) === 0, 15000))
      await page.screenshot({ path: `${SHOTS}/dead-letter-${action}.png`, fullPage: true })
    }
    // The acknowledged row is kept, with who and why.
    const all = await direct(`ActionSync/Store/Mirror?code=${encodeURIComponent(code)}&includeAcknowledged=true&pageSize=200`)
    const ackd = (all?.body?.data?.deadLetters?.items ?? []).find((x) => `${x.stage}-${x.id}` === acknowledgeDeadLetter)
    check(`deadletters ${code}: the acknowledged row is kept, with its reason`,
      !!ackd && ackd.acknowledgedAt !== null && ackd.acknowledgeReason === REASON && ackd.canRetry === false, JSON.stringify(ackd))
    // OWNER walk: "is retried and applies". The retried row goes back to the inbox; the apply worker takes
    // it on its next tick. It must not come back as a dead letter (open or acknowledged) within 6 minutes.
    const { stage, id } = split(retryDeadLetter)
    let back = null
    for (let t = 0; t < 6 * 60; t += 30) {
      await page.waitForTimeout(30000)
      const again = await direct(`ActionSync/Store/Mirror?code=${encodeURIComponent(code)}&includeAcknowledged=true&pageSize=200`)
      back = (again?.body?.data?.deadLetters?.items ?? []).find((x) => x.stage === stage && x.id === id) ?? null
      if (back) break
    }
    check(`deadletters ${code}: the retried row did not dead-letter again within 6 minutes`, back === null, JSON.stringify(back))
    console.log('      the owner confirms it APPLIED (the entity is on the mirror), which no door shows')
  }
}

// ── --write: recheck one store-day (OWNER walk, 460) ─────────────────────────────────────────────

if (ONLY.includes('recheck')) {
  const { recheckStoreCode: code, recheckDay: day } = INPUTS
  if (!grants.canOperate) {
    skip('recheck', 'this session lacks canOperate')
  } else if (todo(code) || todo(day)) {
    skip('recheck', 'recheckStoreCode or recheckDay is TODO')
  } else {
    await page.goto(`${BASE}/admin/sync/store/${code}?tab=agreement`)
    const listed = await waitFor(async () => (await page.locator(`[data-agreement-recheck="${day}"]`).count()) === 1, 20000)
    check(`recheck ${code}: ${day} is listed with a Recheck`, listed)
    if (listed) {
      await page.locator(`[data-agreement-recheck="${day}"]`).click()
      const dialog = page.locator('dialog[open]')
      await dialog.waitFor()
      await dialog.locator('[data-reason-input]').fill(REASON)
      const since = answers.length
      await dialog.locator('[data-reason-confirm]').click()
      const a = await waitAnswer('ActionSync/Agreement/Recheck', since)
      check(`recheck ${code}: the recheck answers`, ok(a), why(a))
      shapeCheck(`recheck ${code}: …with the contract's keys`, a?.body?.data, KEYS.recheck)
      const d = a?.body?.data?.day
      if (d === null) {
        console.log('      the answer is no verdict: no NewPos receipt that day, or the sink cannot be judged (see the audit row)')
        check(`recheck ${code}: …and the day leaves the list`,
          await waitFor(async () => (await page.locator(`[data-agreement-day="${day}"]`).count()) === 0, 15000))
      } else {
        shapeCheck(`recheck ${code}: the fresh verdict carries the day's keys`, d, KEYS.agreementDay)
        check(`recheck ${code}: …for the day asked`, d?.businessDay === day, d?.businessDay)
        console.log(`      ${day}: ${d?.agrees ? 'the rails agree' : 'still disagree'} (m${d?.mirrorCount}/c${d?.counterCount}, gaps ${d?.missingAtCounter}/${d?.missingAtMirror}/${d?.totalMismatches})`)
        check(`recheck ${code}: the tab draws the verdict`, await waitFor(async () =>
          (await page.locator(`[data-agreement-day="${day}"][data-agrees="${d?.agrees}"]`).count()) === 1, 15000))
      }
      check(`recheck ${code}: …audited (an auditId, the sink is HQ)`, typeof a?.body?.data?.auditId === 'string', String(a?.body?.data?.auditId))
      await page.screenshot({ path: `${SHOTS}/agreement-recheck.png`, fullPage: true })
    }
  }
}

// ── The audit feed shows every action with its reason (OWNER walk) ───────────────────────────────

if (WRITE && ONLY.some((s) => WRITES.includes(s))) {
  const since = answers.length
  await page.goto(`${BASE}/admin/sync/audit`)
  const a = await waitAnswer('ActionSync/Audit', since)
  const mine = (a?.body?.data?.items ?? []).filter((x) => x.reason === REASON)
  const want = [
    ...(ONLY.includes('control') && !todo(INPUTS.testStoreOnWpf) ? ['Move', 'HandBack'] : []),
    ...(ONLY.includes('test') && !todo(INPUTS.testStoreForTest) ? ['ConnectionTest'] : []),
    ...(ONLY.includes('onboard') && !todo(INPUTS.onboard) ? ['OnboardStore', 'CreateLocation'] : []),
    ...(ONLY.includes('deadletters') && grants.canOperate && ![INPUTS.mirrorStoreCode, INPUTS.retryDeadLetter, INPUTS.acknowledgeDeadLetter].some(todo)
      ? ['MirrorRetry', 'MirrorAcknowledge'] : []),
    ...(ONLY.includes('recheck') && grants.canOperate && !todo(INPUTS.recheckStoreCode) && !todo(INPUTS.recheckDay) ? ['AgreementRecheck'] : []),
  ]
  check('audit: every action of this run is in the feed with its reason', want.every((w) => mine.some((x) => x.action === w)),
    `want [${want}] got [${mine.map((x) => x.action)}]`)
  await page.screenshot({ path: `${SHOTS}/audit-after.png`, fullPage: true })
}

await finish()

async function finish() {
  check('no page error', errors.length === 0, errors.join(' | '))
  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed, ${skipped.length} skipped${skipped.length ? ` (${skipped.join(', ')})` : ''}`)
  process.exit(failed.length ? 1 : 0)
}
