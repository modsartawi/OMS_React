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
//   9. a failed read under a new tile draws no rows from the previous filter.
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

// 120 stores: three pages at 50. P001 is offline + pending, P002 is on WPF.
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
  return workerStore(code)
})

const SUMMARY = {
  asOf: '2026-10-09T12:04:31',
  total: 120,
  counts: { all: 120, onWorker: 119, onWpf: 1, paused: 0, offline: 1, behind: 7, erroring: 2, controlPending: 1 },
}
const HOUR = (hour, n) => ({ hour, pushPasses: 11820 * n, pullPasses: 23400 * n, connectFailures: 312 * n, chunksPushed: 40 * n, actionsPushed: 4912 * n, trxPulled: 18230 * n, errors: 9 * n })
const LAST_HOUR = { current: HOUR('2026-10-09T12:00:00', 1), previous: HOUR('2026-10-09T11:00:00', 2) }
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

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true, canOperate: false, canOnboard: false }, workers = [worker('SISAPI-SYNC-01', false)], clock = false, othersOpen = false, failState = null } = {}) {
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
      return route.fulfill(envelope(SUMMARY))
    }
    if (p === 'ActionSync/Fleet/LastHour') return route.fulfill(envelope(LAST_HOUR))
    if (p === 'ActionSync/Fleet') {
      fleetCalls.push(url.search)
      if (failState && url.searchParams.getAll('state').includes(failState))
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The fleet could not be read.', errorCode: 'BOOM' }))
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      return route.fulfill(envelope({ items: STORES.slice((pg - 1) * size, pg * size), total: STORES.length, page: pg, pageSize: size }))
    }
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
  check('1. eight tiles, each with its count', tiles.length === 8 && tiles[0] === 'all:120 All stores' && tiles.includes('offline:1 Offline') && tiles.includes('behind:7 Behind'), JSON.stringify(tiles))
  const hour = strip(await page.locator('[data-last-hour]').innerText())
  check('1. the last-hour totals show this hour and the previous one', /Push passes 11,820 23,640/.test(hour) && /Connect failures 312 624/.test(hour), hour)
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
  check('4. the four sorts are offered', JSON.stringify(sorts) === '["Most behind","Longest offline","Newest error","Code"]', JSON.stringify(sorts))

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

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
