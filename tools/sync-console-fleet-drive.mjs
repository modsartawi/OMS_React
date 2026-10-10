// Sync console Fleet drive (ticket 445, spec 444) — drives the REAL Fleet page in Chromium against
// STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2539 is unbuilt, and ticket 450 is the
// live walk.
//
// It verifies:
//   1. the Admin menu shows the Store sync leaf LAST when `screenAllowed` is true, and the page renders
//      the worker card (no banner while fresh), the tiles with their counts, the last-hour totals, the
//      store table and the "as of" stamp from `Fleet/Summary.asOf`;
//   2. a row shows its door states as badges, its pending control, and links to /admin/sync/store/:code;
//      a WPF row's health cells are blank;
//   3. the tiles reach the request as a REPEATED `state` (AND), and All clears them;
//   4. search, host and sort reach the request, each back on page 1;
//   5. paging walks the door's pages at 50;
//   6. a stale worker shows the red banner, and no worker at all shows one too;
//   7. the page refetches every 30 s;
//   8. with `screenAllowed: false` the leaf is hidden and the page guards itself;
//   9. a failed read under a new tile draws no rows from the previous filter;
//  10. (ticket 456, spec 2563) the mirror lane: a chip per row coloured by the worst mirror state,
//      "not on mirror" for a store off the rail AND for an old door's row with no lane, a WPF store
//      keeping its lane, a never-measured till backlog, the till-clock hint; the four mirror tiles
//      driving `state`, the two mirror sorts; the worker card narrowed on `rail` with a stale Mirror
//      apply carrying its own banner and backpressure as a warning; the last-hour mirror totals.
//
//  11. (ticket 459, spec 2563) rail agreement: the "Rails disagree" tile drives `state=railsDisagree`
//      (the door has NO agreement parameter, and none is ever sent), in the danger token; the Agreement
//      column reads the door's agree / disagree / notJudged, and an old door's row reads not judged.
//
//  🚩 Two assertions above were changed on purpose by 456, because the ticket grows them: "eight
//  tiles" is now twelve (the four mirror tiles; railsDisagree is 459's) and "the four sorts" six.
//  459 changed two more, again because its ticket grows them: the tile count (twelve → thirteen, in
//  section 1) and section 10's "no rails-disagree tile yet", which now finds that tile closing the row.
//  Every other assertion is as 445 left it, and the default stubs stay in the PRE-2563 shape (no
//  `mirror`, `agreement`, `rail` or mirror totals), so the boundary fill is driven too.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-fleet-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-fleet-shots'
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
  ...over,
})
const wpfStore = (code) => ({
  code,
  description: `Store ${code}`,
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
})

// The mirror lane (spec 2563), in the contract's shape.
const lane = (over = {}) => ({
  onMirror: true,
  lastPullAt: '2026-10-09T12:03:40',
  lastPullOkAt: '2026-10-09T12:03:40',
  lastConnectOkAt: '2026-10-09T12:03:40',
  lastConnectFailAt: null,
  lastConnectError: null,
  tillBacklogCount: 0,
  tillBacklogOldestAt: null,
  inboxPending: 0,
  inboxDeferred: 0,
  oldestDeferredAt: null,
  openDeadLetters: 0,
  ...over,
})
const offMirror = () => lane({ onMirror: false, lastPullAt: null, lastPullOkAt: null, lastConnectOkAt: null, tillBacklogCount: null })

// 120 stores: three pages at 50. P001 is offline + pending, P002 is on WPF. P003–P007 carry 2563's lane
// (P003 bad, P005 healthy but never measured, P006 a WPF store on the mirror, P007 off the rail); P004 and
// every other row come from an old door, with no lane at all.
const STORES = Array.from({ length: 120 }, (_, i) => {
  const code = `P${String(i + 1).padStart(3, '0')}`
  if (i === 0)
    return workerStore(code, {
      states: ['onWorker', 'offline', 'controlPending'],
      controlPending: true,
      lastConnectFailAt: '2026-10-09T12:03:00',
      push: loop({ lastErrorAt: '2026-10-09T11:00:00', lastError: 'old push error' }),
      pull: loop({ lastErrorAt: '2026-10-09T12:01:00', lastError: 'A network-related error occurred' }),
    })
  if (i === 1) return wpfStore(code)
  if (i === 2)
    return workerStore(code, {
      states: ['onWorker', 'mirrorBehind', 'mirrorOffline', 'deadLetters'],
      mirror: lane({ lastConnectFailAt: '2026-10-09T12:03:00', tillBacklogCount: 1234, tillBacklogOldestAt: '2026-10-09T11:20:00', inboxPending: 56, openDeadLetters: 7 }),
      agreement: 'notJudged',
    })
  if (i === 4) return workerStore(code, { mirror: lane({ tillBacklogCount: null, inboxPending: 3 }), agreement: 'agree' })
  if (i === 5)
    return {
      ...wpfStore(code),
      states: ['onWpf', 'mirrorBehind'],
      mirror: lane({ tillBacklogCount: 80, tillBacklogOldestAt: '2026-10-09T11:40:00', inboxPending: 2 }),
      agreement: 'agree',
    }
  if (i === 6) return workerStore(code, { mirror: offMirror(), agreement: 'notJudged' })
  // 459: a store whose rails disagree — healthy on mirror, so the lane stays go while agreement is bad.
  if (i === 7) return workerStore(code, { states: ['onWorker', 'railsDisagree'], mirror: lane(), agreement: 'disagree' })
  return workerStore(code)
})

const SUMMARY = {
  asOf: '2026-10-09T12:04:31',
  total: 120,
  counts: { all: 120, onWorker: 119, onWpf: 1, paused: 0, offline: 1, behind: 7, erroring: 2, controlPending: 1 },
}
// The same summary from a 2563 door: the mirror tile counts, and railsDisagree's (its tile is 459's).
const SUMMARY_2563 = {
  ...SUMMARY,
  counts: { ...SUMMARY.counts, mirrorOffline: 1, mirrorBehind: 2, deadLetters: 1, deferredTooLong: 0, railsDisagree: 4 },
}
const HOUR = (hour, n) => ({ hour, pushPasses: 11820 * n, pullPasses: 23400 * n, connectFailures: 312 * n, chunksPushed: 40 * n, actionsPushed: 4912 * n, trxPulled: 18230 * n, errors: 9 * n })
const LAST_HOUR = { current: HOUR('2026-10-09T12:00:00', 1), previous: HOUR('2026-10-09T11:00:00', 2) }
const MIRROR_HOUR = (n) => ({ mirrorSweeps: 120 * n, mirrorConnectFailures: 3 * n, mirrorPulled: 800 * n, mirrorApplied: 790 * n, mirrorDeferred: 4 * n, mirrorDeadLettered: 2 * n })
const LAST_HOUR_2563 = { current: { ...LAST_HOUR.current, ...MIRROR_HOUR(1) }, previous: { ...LAST_HOUR.previous, ...MIRROR_HOUR(2) } }
const worker = (instance, isStale) => ({
  instance,
  version: '1.4.2',
  gateOn: true,
  pushWidth: 64,
  pullWidth: 64,
  pushInFlight: 41,
  pullInFlight: 17,
  lastFlushAt: isStale ? '2026-10-09T11:40:00' : '2026-10-09T12:04:20',
  isStale,
  settings: { ChunkSize: '500', BudgetSeconds: '60' },
})

// A mirror role's heartbeat (2566).
const mirrorWorker = (rail, over = {}) => ({
  rail,
  instance: 'SISAPI-POS-01',
  version: '3.1.0',
  startedAt: '2026-10-09T06:00:00',
  lastTickAt: '2026-10-09T12:04:10',
  lastTickOutcome: rail === 'mirrorPull' ? 'Swept' : 'Applied',
  lastTickMessage: null,
  inboxPending: rail === 'mirrorPull' ? 1200 : null,
  backpressureThreshold: rail === 'mirrorPull' ? 50000 : null,
  isStale: false,
  settings: { TickSeconds: rail === 'mirrorPull' ? '30' : '15' },
  ...over,
})

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true, canOperate: false, canOnboard: false }, workers = [worker('SISAPI-SYNC-01', false)], clock = false, othersOpen = false, failState = null, summary = SUMMARY, lastHour = LAST_HOUR } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  if (clock) await page.clock.install({ time: new Date('2026-10-09T12:04:00') })
  const errors = []
  const fleetCalls = []
  const counts = { summary: 0 }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope(access))
    if (p === 'ActionSync/Workers') return route.fulfill(envelope({ items: workers }))
    if (p === 'ActionSync/Fleet/Summary') {
      counts.summary++
      return route.fulfill(envelope(summary))
    }
    if (p === 'ActionSync/Fleet/LastHour') return route.fulfill(envelope(lastHour))
    if (p === 'ActionSync/Fleet') {
      fleetCalls.push(url.search)
      if (failState && url.searchParams.getAll('state').includes(failState))
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The fleet could not be read.', errorCode: 'BOOM' }))
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      return route.fulfill(envelope({ items: STORES.slice((pg - 1) * size, pg * size), total: STORES.length, page: pg, pageSize: size }))
    }
    // The store page the code link opens (446+): its header and strip, in the contract's shapes.
    if (p === 'ActionSync/Store') {
      const row = STORES.find((x) => x.code === url.searchParams.get('code'))
      return route.fulfill(envelope({ ...row, controlVersion: 1, appliedVersion: 1, appliedAt: null }))
    }
    if (p === 'ActionSync/Store/Hours' || p === 'ActionSync/Store/Counters') return route.fulfill(envelope({ items: [] }))
    // Every other probe: shut, or (to see where the leaf sits among its siblings) open.
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: othersOpen, screenAllowed: othersOpen, allowed: othersOpen, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, fleetCalls, counts }
}

const lastFleet = (calls) => calls[calls.length - 1]
const waitForFleet = async (page, calls, want) => {
  for (let i = 0; i < 40; i++) {
    if (calls.includes(want)) return true
    await page.waitForTimeout(100)
  }
  return false
}
const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()

// ── 1–5: the page, the row, the tiles, the filters and the pager ──────────────────────────────
{
  const { context, page, errors, fleetCalls } = await open({ othersOpen: true })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-store-link="P001"]').waitFor({ timeout: 20000 })

  const adminLeaves = await page.locator('nav:not([data-console-nav]) a[href^="/admin/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1. the Store sync leaf is in the Admin group, last', adminLeaves.length > 1 && adminLeaves[adminLeaves.length - 1] === '/admin/sync', JSON.stringify(adminLeaves))
  check('1. the first read asks for page 1 of 50, most behind', lastFleet(fleetCalls) === '?sort=mostBehind&page=1&pageSize=50', lastFleet(fleetCalls))
  check('1. a fresh worker shows no banner', (await page.locator('[data-worker-banner]').count()) === 0)
  const card = strip(await page.locator('[data-worker-card]').innerText())
  check('1. the worker card shows instance, version, in-flight and settings', /SISAPI-SYNC-01/.test(card) && /1\.4\.2/.test(card) && /41 \/ 64/.test(card) && /17 \/ 64/.test(card) && /ChunkSize 500/.test(card), card)
  const tiles = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') + ':' + e.innerText.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ')))
  // 456: twelve, not eight — the four mirror tiles join (an old summary has no count for them yet).
  // 459: thirteen — the rails-disagree tile closes the row.
  check('1. thirteen tiles, each with its count', tiles.length === 13 && tiles[0] === 'all:120 All stores' && tiles.includes('offline:1 Offline') && tiles.includes('behind:7 Behind'), JSON.stringify(tiles))
  const hour = strip(await page.locator('[data-last-hour]').innerText())
  check('1. the last-hour totals show this hour and the previous one', /Push passes 11,820 23,640/.test(hour) && /Connect failures 312 624/.test(hour), hour)
  check("1. an old door's last hour reads its mirror totals as zeros", /Mirror rail Mirror sweeps 0 0/.test(hour), hour)
  check("1. an old door's worker (no rail) is the store worker, and no mirror role is drawn", (await page.locator('[data-worker="SISAPI-SYNC-01"]').count()) === 1 && (await page.locator('[data-mirror-worker]').count()) === 0)
  const asOf = strip(await page.locator('[data-as-of]').innerText())
  check('1. the "as of" stamp is Fleet/Summary.asOf, unshifted', /As of 2026-10-09 12:04/.test(asOf), asOf)
  check('1. the table counts the stores', strip(await page.locator('[data-fleet-count]').innerText()) === '120 stores')

  const rowText = strip(await page.locator('[row-id="P001"]').allInnerTexts().then((a) => a.join(' ')))
  check('2. a row shows its states as badges, not the pending one', (await page.locator('[row-id="P001"] [data-states]').first().getAttribute('data-states')) === 'onWorker offline', rowText)
  check('2. …and its pending control in its own column', /Pending/.test(rowText) && /On worker/.test(rowText) && /Offline/.test(rowText), rowText)
  check('2. …and the newer of its loop errors', /2026-10-09 12:01 A network-related error occurred/.test(rowText), rowText)
  const wpf = strip(await page.locator('[row-id="P002"] [col-id="pendingActions"]').innerText())
  check('2. a WPF row has a blank push lag, not 0', wpf === '', JSON.stringify(wpf))
  check('2. the code links to the store page', (await page.locator('[data-store-link="P001"]').getAttribute('href')) === '/admin/sync/store/P001')
  await page.screenshot({ path: `${SHOTS}/fleet.png`, fullPage: true })

  await page.locator('[data-tile="offline"]').click()
  check('3. a tile sets the state filter', await waitForFleet(page, fleetCalls, '?state=offline&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-tile="behind"]').click()
  check('3. a second tile repeats state (AND)', await waitForFleet(page, fleetCalls, '?state=offline&state=behind&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  check('3. both tiles read as pressed', (await page.locator('[data-tile][aria-pressed="true"]').count()) === 2)
  await page.locator('[data-tile="all"]').click()
  await page.waitForTimeout(300)
  check('3. All clears the states', lastFleet(fleetCalls) === '?sort=mostBehind&page=1&pageSize=50' && (await page.locator('[data-tile="all"]').getAttribute('aria-pressed')) === 'true', lastFleet(fleetCalls))

  // Paging first, so the filters can be seen to come back to page 1.
  await page.getByRole('button', { name: 'Next' }).click()
  check('5. Next asks for page 2 of 50', await waitForFleet(page, fleetCalls, '?sort=mostBehind&page=2&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-store-link="P051"]').waitFor()
  check('5. page 2 draws stores 51–100', (await page.locator('[data-store-link="P001"]').count()) === 0)
  const readout = strip(await page.locator('nav[aria-label="Result pages"]').innerText())
  check('5. the pager reads page 2 of 3', /Page 2 of 3/.test(readout), readout)

  await page.locator('[data-fleet-search]').fill('  Riy ')
  check('4. the search reaches q, trimmed, on page 1', await waitForFleet(page, fleetCalls, '?q=Riy&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-fleet-host]').selectOption('Wpf')
  check('4. the host filter reaches host', await waitForFleet(page, fleetCalls, '?host=Wpf&q=Riy&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-fleet-sort]').selectOption('longestOffline')
  check('4. the sort reaches sort', await waitForFleet(page, fleetCalls, '?host=Wpf&q=Riy&sort=longestOffline&page=1&pageSize=50'), lastFleet(fleetCalls))
  const sorts = await page.locator('[data-fleet-sort] option').allInnerTexts()
  // 456: six, not four — the two mirror sorts are appended.
  check('4. the six sorts are offered', JSON.stringify(sorts) === '["Most behind","Longest offline","Newest error","Code","Largest till backlog","Most dead letters"]', JSON.stringify(sorts))

  await page.locator('[data-store-link="P003"]').click()
  await page.locator('[data-store-page="P003"]').waitFor()
  check('2. the link opens the store page placeholder', page.url().endsWith('/admin/sync/store/P003'))
  check('no page errors (fleet)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: the banners ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ workers: [worker('SISAPI-SYNC-01', false), worker('SISAPI-SYNC-02', true)] })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-worker-banner]').waitFor({ timeout: 20000 })
  const text = strip(await page.locator('[data-worker-banner]').innerText())
  check('6. a stale worker shows the red banner', (await page.locator('[data-worker-banner="stale"][role="alert"], [data-worker-banner="stale"] [role="alert"]').count()) === 1 && /heartbeat is stale/.test(text), text)
  check('6. …naming the stale instance only', /SISAPI-SYNC-02/.test(text) && !/SISAPI-SYNC-01/.test(text), text)
  await page.screenshot({ path: `${SHOTS}/stale.png`, fullPage: true })
  check('no page errors (stale)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page } = await open({ workers: [] })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-worker-banner]').waitFor({ timeout: 20000 })
  check('6. no worker at all shows a banner too', (await page.locator('[data-worker-banner="none"]').count()) === 1)
  await context.close()
}

// ── 7: the 30 s refresh ────────────────────────────────────────────────────────────────────────
{
  const { context, page, counts } = await open({ clock: true })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-store-link="P001"]').waitFor({ timeout: 20000 })
  const before = counts.summary
  // 25 s, not 29: real time has already run on the installed clock while the page loaded.
  await page.clock.runFor(25_000)
  await page.waitForTimeout(200)
  const at25 = counts.summary
  await page.clock.runFor(6_000)
  await page.waitForTimeout(500)
  check('7. nothing refetches well before 30 s', at25 === before, `${before} → ${at25}`)
  check('7. the summary refetches at 30 s', counts.summary > before, `${before} → ${counts.summary}`)
  await context.close()
}

// ── 8: no view grant ───────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ access: { screenAllowed: false, canOperate: false, canOnboard: false } })
  await page.goto(`${BASE}/admin/sync`)
  await page.getByText('No access to store sync').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('8. without the grant the leaf is hidden', (await page.locator('nav a[href="/admin/sync"]').count()) === 0)
  check('8. …and the page guards itself, with no fleet read', (await page.locator('[data-fleet-table]').count()) === 0)
  check('no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: a failed read under a new filter ───────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ failState: 'erroring' })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-store-link="P001"]').waitFor({ timeout: 20000 })
  await page.locator('[data-tile="erroring"]').click()
  await page.getByText('The fleet could not be read.').waitFor({ timeout: 10000 })
  check('9. a failed filtered read shows its error', true)
  check('9. …and none of the previous filter rows or count', (await page.locator('[data-store-link]').count()) === 0 && (await page.locator('[data-fleet-count]').count()) === 0)
  check('no page errors (failed read)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: the mirror lane (ticket 456, spec 2563) ───────────────────────────────────────────────
{
  const workers = [
    { ...worker('SISAPI-SYNC-01', false), rail: 'store' },
    mirrorWorker('mirrorPull', {
      lastTickOutcome: 'SkippedBackpressure',
      inboxPending: 49800,
      backpressureThreshold: 50000,
      lastTickMessage: 'Inbox at the backpressure threshold; pull skipped.',
    }),
    mirrorWorker('mirrorApply', { isStale: true, lastTickAt: '2026-10-09T11:51:00', lastTickOutcome: 'Faulted', lastTickMessage: 'Timeout expired.' }),
  ]
  const { context, page, errors, fleetCalls } = await open({ workers, summary: SUMMARY_2563, lastHour: LAST_HOUR_2563 })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-store-link="P001"]').waitFor({ timeout: 20000 })
  const laneOf = (code) => page.locator(`[row-id="${code}"] [col-id="mirror"] [data-mirror-lane]`)
  const cellText = async (code, col) => strip(await page.locator(`[row-id="${code}"] [col-id="${col}"]`).innerText())

  // The lane chip.
  const p3 = laneOf('P003')
  const p3Text = await cellText('P003', 'mirror')
  check('10. a lane chip shows till backlog, inbox pending and open dead letters', p3Text === 'Till backlog 1,234 Inbox pending 56 Dead letters 7', p3Text)
  check(
    '10. …coloured by the worst mirror state (offline and dead letters beat behind; offline first on the tie)',
    (await p3.getAttribute('data-mirror-lane')) === 'onMirror' &&
      (await p3.getAttribute('data-mirror-sev')) === 'bad' &&
      (await p3.getAttribute('data-mirror-worst')) === 'mirrorOffline' &&
      (await p3.getAttribute('title')) === 'Mirror offline',
  )
  const p3Class = await page.locator('[row-id="P003"] [col-id="mirror"] [data-mirror-lane] > span').first().getAttribute('class')
  check('10. …in the danger tokens', /bg-danger-050/.test(p3Class ?? ''), p3Class)
  const p3States = await cellText('P003', 'states')
  check("10. …and the row's state badges still name each mirror state", /Mirror behind/.test(p3States) && /Mirror offline/.test(p3States) && /Dead letters/.test(p3States), p3States)
  check('10. a store off the rail reads "Not on mirror", muted, with no state', (await laneOf('P007').getAttribute('data-mirror-lane')) === 'notOnMirror' && (await cellText('P007', 'mirror')) === 'Not on mirror')
  check("10. an old door's row with no lane reads \"Not on mirror\" too, never healthy", (await laneOf('P004').getAttribute('data-mirror-lane')) === 'notOnMirror' && (await cellText('P004', 'mirror')) === 'Not on mirror')
  const p5Text = await cellText('P005', 'mirror')
  check('10. on mirror with no mirror state is healthy (go); a never-measured backlog says so, not 0', (await laneOf('P005').getAttribute('data-mirror-sev')) === 'go' && p5Text === 'Till backlog not measured Inbox pending 3 Dead letters 0', p5Text)
  check('10. a WPF store keeps its lane', (await laneOf('P006').getAttribute('data-mirror-lane')) === 'onMirror' && (await laneOf('P006').getAttribute('data-mirror-sev')) === 'warn' && (await cellText('P006', 'host')) === 'WPF')
  const till = await cellText('P003', 'tillBacklogOldestAt')
  check('10. the oldest till-backlog event carries the "till clock" hint, its time unshifted', /^2026-10-09 11:20.*till clock$/.test(till) && (await page.locator('[row-id="P003"] [data-till-clock]').count()) === 1, till)
  check('10. …and a store with no till time draws nothing there', (await cellText('P007', 'tillBacklogOldestAt')) === '')
  const lastPull = await cellText('P003', 'mirror.lastPullAt')
  check('10. the last mirror pull is drawn', /2026-10-09 12:03/.test(lastPull), lastPull)
  check('10. the chip isolates each count once', (await page.locator('[row-id="P003"] [col-id="mirror"] bdi').count()) === 3)

  // The four tiles.
  const tiles = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') + ':' + e.innerText.replace(/[⁨⁩]/g, '').replace(/\s+/g, ' ')))
  check(
    '10. the four mirror tiles with their counts, then the rails-disagree tile (459) last',
    tiles.length === 13 &&
      tiles[12] === 'railsDisagree:4 Rails disagree' &&
      tiles.includes('mirrorOffline:1 Mirror offline') &&
      tiles.includes('mirrorBehind:2 Mirror behind') &&
      tiles.includes('deadLetters:1 Dead letters') &&
      tiles.includes('deferredTooLong:0 Deferred too long'),
    JSON.stringify(tiles),
  )
  for (const state of ['mirrorOffline', 'mirrorBehind', 'deadLetters', 'deferredTooLong']) {
    await page.locator(`[data-tile="${state}"]`).click()
    check(`10. the ${state} tile sets the state filter`, await waitForFleet(page, fleetCalls, `?state=${state}&sort=mostBehind&page=1&pageSize=50`), lastFleet(fleetCalls))
    await page.locator(`[data-tile="${state}"]`).click()
  }
  await page.locator('[data-tile="deadLetters"]').click()
  await page.locator('[data-tile="offline"]').click()
  check('10. a mirror tile ANDs with a store tile, in the contract order', await waitForFleet(page, fleetCalls, '?state=offline&state=deadLetters&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-tile="all"]').click()
  const deadTile = await page.locator('[data-tile="deadLetters"]').getAttribute('class')
  const behindTile = await page.locator('[data-tile="mirrorBehind"]').getAttribute('class')
  check("10. the tiles take their state's severity token", /border-t-danger/.test(deadTile ?? '') && /border-t-attention/.test(behindTile ?? ''))

  // The two sorts.
  await page.locator('[data-fleet-sort]').selectOption('largestBacklog')
  check('10. the largest-backlog sort reaches sort', await waitForFleet(page, fleetCalls, '?sort=largestBacklog&page=1&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-fleet-sort]').selectOption('mostDeadLetters')
  check('10. the most-dead-letters sort reaches sort', await waitForFleet(page, fleetCalls, '?sort=mostDeadLetters&page=1&pageSize=50'), lastFleet(fleetCalls))

  // The worker card, narrowed on rail.
  const roles = await page.locator('[data-mirror-worker]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mirror-worker') + ':' + e.getAttribute('data-stale')))
  check('10. the worker card lists the store worker, then Mirror pull, then Mirror apply', (await page.locator('[data-worker="SISAPI-SYNC-01"]').count()) === 1 && JSON.stringify(roles) === '["mirrorPull:false","mirrorApply:true"]', JSON.stringify(roles))
  check(
    '10. a stale Mirror apply carries its own red banner; the store worker and Mirror pull none',
    (await page.locator('[data-mirror-worker="mirrorApply"] [data-worker-banner="mirrorStale"] [role="alert"]').count()) === 1 &&
      (await page.locator('[data-worker-banner="stale"], [data-worker-banner="none"]').count()) === 0 &&
      (await page.locator('[data-mirror-worker="mirrorPull"] [data-worker-banner]').count()) === 0,
  )
  const applyText = strip(await page.locator('[data-mirror-worker="mirrorApply"]').innerText())
  check(
    '10. …naming the role and its instance, with its last tick, Faulted and its message',
    /Mirror apply: the heartbeat is stale/.test(applyText) && /SISAPI-POS-01/.test(applyText) && /Last tick 2026-10-09 11:51/.test(applyText) && /Faulted/.test(applyText) && /Timeout expired\./.test(applyText),
    applyText,
  )
  const faulted = await page.locator('[data-mirror-worker="mirrorApply"] [data-tick-outcome="Faulted"] span').first().getAttribute('class')
  check('10. Faulted reads bad', /bg-danger-050/.test(faulted ?? ''), faulted)
  const pullText = strip(await page.locator('[data-mirror-worker="mirrorPull"]').innerText())
  const pullBadge = await page.locator('[data-mirror-worker="mirrorPull"] [data-tick-outcome="SkippedBackpressure"] span').first().getAttribute('class')
  check('10. Mirror pull skipped for backpressure reads as a WARNING, never idle', /Skipped: inbox backpressure/.test(pullText) && /bg-attention-050/.test(pullBadge ?? ''), pullText)
  check('10. …with inbox pending / threshold as ONE isolated value', /Inbox pending \/ backpressure threshold 49,800 \/ 50,000/.test(pullText) && (await page.locator('[data-mirror-worker="mirrorPull"] [data-inbox-pending] bdi').count()) === 1, pullText)
  check('10. Mirror apply has no inbox figure', (await page.locator('[data-mirror-worker="mirrorApply"] [data-inbox-pending]').count()) === 0)

  // The last-hour mirror totals.
  const hour = strip(await page.locator('[data-last-hour]').innerText())
  check(
    '10. the last hour adds the mirror totals, this hour and the previous',
    /Mirror rail Mirror sweeps 120 240 Events pulled 800 1,600 Events applied 790 1,580 Events deferred 4 8 Mirror connect failures 3 6 Events dead-lettered 2 4/.test(hour),
    hour,
  )
  const deadCell = await page.locator('[data-metric="mirrorDeadLettered"] td').nth(1).getAttribute('class')
  check('10. a mirror failure takes the danger ink when not zero', /text-danger-800/.test(deadCell ?? ''), deadCell)
  await page.screenshot({ path: `${SHOTS}/mirror.png`, fullPage: true })

  await page.locator('[data-fleet-sort]').selectOption('mostBehind')
  await page.locator('[data-store-link="P003"]').waitFor()
  await page.locator('[data-store-link="P003"]').click()
  await page.locator('[data-store-page="P003"]').waitFor()
  check('10. a 2563 row still opens its store page', page.url().endsWith('/admin/sync/store/P003'))
  check('no page errors (mirror)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11: rail agreement (ticket 459, spec 2563) ─────────────────────────────────────────────────
{
  const { context, page, errors, fleetCalls } = await open({ summary: SUMMARY_2563 })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('[data-store-link="P001"]').waitFor({ timeout: 20000 })
  const cellText = async (code, col) => strip(await page.locator(`[row-id="${code}"] [col-id="${col}"]`).innerText())
  const agreementOf = (code) => page.locator(`[row-id="${code}"] [col-id="agreement"] [data-agreement]`).getAttribute('data-agreement')

  // The tile.
  const tile = page.locator('[data-tile="railsDisagree"]')
  check('11. a Rails disagree tile with its count', strip(await tile.innerText()) === '4 Rails disagree', strip(await tile.innerText()))
  check('11. …in the danger token (railsDisagree is bad)', /border-t-danger/.test((await tile.getAttribute('class')) ?? ''))
  await tile.click()
  check('11. the tile filters the fleet through state=railsDisagree', await waitForFleet(page, fleetCalls, '?state=railsDisagree&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  check('11. …and reads as pressed', (await tile.getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-tile="mirrorBehind"]').click()
  check('11. …ANDing with a mirror tile, in the contract order', await waitForFleet(page, fleetCalls, '?state=mirrorBehind&state=railsDisagree&sort=mostBehind&page=1&pageSize=50'), lastFleet(fleetCalls))
  await page.locator('[data-tile="all"]').click()
  await page.waitForTimeout(300)
  check('11. All clears it', lastFleet(fleetCalls) === '?sort=mostBehind&page=1&pageSize=50', lastFleet(fleetCalls))
  check('11. no read ever sends an agreement parameter', !fleetCalls.some((c) => /agreement/i.test(c)), fleetCalls.join(' '))

  // The column.
  await page.locator('[data-store-link="P001"]').waitFor()
  const header = strip(await page.locator('.ag-header-cell[col-id="agreement"]').innerText())
  check('11. an Agreement column', header === 'Rail agreement', header)
  check('11. …agree reads "Rails agree"', (await agreementOf('P005')) === 'agree' && (await cellText('P005', 'agreement')) === 'Rails agree')
  check('11. …disagree reads "Rails disagree"', (await agreementOf('P008')) === 'disagree' && (await cellText('P008', 'agreement')) === 'Rails disagree')
  check('11. …notJudged reads "Not judged"', (await agreementOf('P003')) === 'notJudged' && (await cellText('P003', 'agreement')) === 'Not judged')
  check("11. an old door's row (no agreement) reads not judged, never agree", (await agreementOf('P004')) === 'notJudged' && (await cellText('P004', 'agreement')) === 'Not judged')
  const disagreeClass = await page.locator('[row-id="P008"] [col-id="agreement"] [data-agreement] > span').first().getAttribute('class')
  const agreeClass = await page.locator('[row-id="P005"] [col-id="agreement"] [data-agreement] > span').first().getAttribute('class')
  check('11. disagree in the danger tokens, agree in the success tokens', /bg-danger-050/.test(disagreeClass ?? '') && /bg-success-050/.test(agreeClass ?? ''), `${disagreeClass} | ${agreeClass}`)
  check("11. the row's state badges name Rails disagree", /Rails disagree/.test(await cellText('P008', 'states')))
  check("11. …while its mirror lane stays healthy: railsDisagree is agreement's, not the lane's", (await page.locator('[row-id="P008"] [col-id="mirror"] [data-mirror-lane]').getAttribute('data-mirror-sev')) === 'go')
  await page.screenshot({ path: `${SHOTS}/agreement.png`, fullPage: true })
  check('no page errors (agreement)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
