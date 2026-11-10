// Data sync jobs search drive (ticket 867, spec 863) — drives the REAL /admin/data-sync/campaigns/:id
// page in Chromium against STUBBED `DataSync/*` envelopes. The stub answers
// `GET DataSync/Campaigns/{id}/Jobs` the way the door does (DataSync `JobRepository.ListByCampaignPageAsync`):
// `status` and `failureReason` exact, `store` a case-insensitive contains on the store CODE (never the
// client), all ANDed, paged over the filtered set. 🚩 Nothing here is driven against a live DataSync.
//
// It verifies:
//   1. a store whose job sits on page 2 of a 60-store fleet is found from page 1 by typing part of
//      its code: the search reaches the door as `store=` once typing stops, the page goes back to 1,
//      and the address keeps the search;
//   2. picking a failure reason reaches the door by its exact name beside the search, and lands in
//      the address; the grid draws only what matches;
//   3. a search that matches nothing says nothing matches the filter (not that there are no jobs);
//   4. a link carrying `store` + `failureReason` fills the box and the select and asks the door for both;
//   5. clearing every filter asks for the whole campaign again.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-jobs-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-jobs-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL envelope `src/core/api.ts` reads.
const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// ── Stubs ───────────────────────────────────────────────────────────────────────────────────────

const PROFILE = '01JAZ8M4QX7R3T2V5W6Y9K0BCD'
const CID = '01JB2C9X4E6F8G0H1J3K5M7N9P'

const CAMPAIGN = {
  campaignId: CID,
  profileId: PROFILE,
  name: 'Fleet catch-up',
  mode: 'ReportOnly',
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: [],
  status: 'Completed',
  totalJobs: 60,
  jobsByState: { queued: 0, running: 0, paused: 0, succeeded: 54, failed: 6, cancelled: 0 },
  reason: null,
  createdAt: '2026-11-10T09:00:00',
  startedAt: '2026-11-10T09:01:00',
  finishedAt: '2026-11-10T09:30:00',
  asOf: '2026-11-10T09:31:00',
}

const jobId = (i) => `01JB2CA2R4S6T8V0W1X3Y5Z7${String(i).padStart(2, '0')}`
// 60 stores under client RYD: S000…S059, except three P01… stores and two P02… stores on page 2.
const CODE = { 52: 'P0141', 55: 'P0142', 58: 'P0143', 53: 'P0201', 56: 'P0202' }
// Failures: P0141 + P0201 unreachable, P0142 table failures, three S… stores unreachable.
const FAILED = { 52: 'StoreUnreachable', 53: 'StoreUnreachable', 55: 'TableFailures', 3: 'StoreUnreachable', 7: 'StoreUnreachable', 9: 'StoreWpfHosted' }
const JOBS = Array.from({ length: 60 }, (_, i) => ({
  jobId: jobId(i),
  campaignId: CID,
  store: { client: 'RYD', code: CODE[i] ?? `S${String(i).padStart(3, '0')}` },
  target: { server: `10.12.0.${i}`, database: 'StorePOS' },
  status: FAILED[i] ? 'Failed' : 'Succeeded',
  phase: null,
  tableTasks: [],
  startedAt: '2026-11-10T09:01:00',
  finishedAt: '2026-11-10T09:20:00',
  failureReason: FAILED[i] ?? null,
  attemptCount: FAILED[i] === 'StoreUnreachable' ? 3 : 0,
  waitReason: null,
  notBefore: null,
  holdReason: null,
  actionSyncResumable: false,
}))

const browser = await chromium.launch()

async function open() {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = { jobs: [] }
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
    if (p === 'DataSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate: false }))
    if (p === 'DataSync/Health') return route.fulfill(envelope({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() }))
    if (p === 'DataSync/Profiles') return route.fulfill(envelope([{ profileId: PROFILE, name: 'Fleet', source: CAMPAIGN.source, tableSet: [], allowsApply: false }]))
    if (p === `DataSync/Campaigns/${CID}`) return route.fulfill(envelope(CAMPAIGN))
    if (p === `DataSync/Campaigns/${CID}/Jobs`) {
      calls.jobs.push(url.search)
      const q = url.searchParams
      const pg = Number(q.get('page') ?? 1)
      const size = Number(q.get('pageSize') ?? 50)
      const status = q.get('status')
      const reason = q.get('failureReason')
      const store = (q.get('store') ?? '').trim().toLowerCase()
      const rows = JOBS.filter(
        (j) => (!status || j.status === status) && (!reason || j.failureReason === reason) && (!store || j.store.code.toLowerCase().includes(store)),
      )
      return route.fulfill(envelope(rows.slice((pg - 1) * size, pg * size)))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const drawnStores = (page) =>
  page.locator('[data-jobs-grid] [row-id] [col-id="store"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/[\u2068\u2069]/g, '').trim()))
const PAGE = `${BASE}/admin/data-sync/campaigns/${CID}`

// ── 1–3, 5: search, reason, filtered-empty, clear ────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${PAGE}?page=2`)
  await page.locator(`[data-job-open="${jobId(50)}"]`).waitFor({ timeout: 20000 })
  check('0. opened on page 2 of the fleet', calls.jobs[0] === '?page=2&pageSize=50', calls.jobs[0])
  await page.goto(PAGE)
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 20000 })
  const page1 = await drawnStores(page)
  check('1. P0142 is not among page 1 (rows drawn so far)', page1.length > 0 && !page1.includes('RYD/P0142'), String(page1.length))
  await page.goto(`${PAGE}?page=2`)
  await page.locator(`[data-job-open="${jobId(50)}"]`).waitFor({ timeout: 20000 })

  const box = page.locator('input[data-job-store-search]')
  await box.pressSequentially('p01', { delay: 40 })
  check('1. typing reaches the door once, as store=p01 on page 1', await until(page, () => calls.jobs.includes('?store=p01&page=1&pageSize=50')), JSON.stringify(calls.jobs))
  check('1. …not once per key', !calls.jobs.some((s) => /store=p(&|0&)/.test(s)), JSON.stringify(calls.jobs))
  await page.locator(`[data-job-open="${jobId(52)}"]`).waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check('1. the address keeps the search and drops the page', new URL(page.url()).search === '?store=p01', page.url())
  const found = await drawnStores(page)
  check('1. only the P01… stores are drawn', JSON.stringify(found) === '["RYD/P0141","RYD/P0142","RYD/P0143"]', JSON.stringify(found))
  await page.screenshot({ path: `${SHOTS}/search.png`, fullPage: true })

  await page.locator('[data-job-failure-filter]').selectOption('StoreUnreachable')
  check('2. the failure reason reaches the door by its exact name beside the search',
    await until(page, () => calls.jobs.includes('?store=p01&failureReason=StoreUnreachable&page=1&pageSize=50')), JSON.stringify(calls.jobs))
  await page.waitForTimeout(400)
  check('2. the address keeps both', new URL(page.url()).search === '?store=p01&failureReason=StoreUnreachable', page.url())
  check('2. only P0141 is drawn', JSON.stringify(await drawnStores(page)) === '["RYD/P0141"]', JSON.stringify(await drawnStores(page)))
  const options = await page.locator('[data-job-failure-filter] option').allInnerTexts()
  check('2. the reasons read as words', options.includes('Store unreachable') && options.includes('Table failures') && options[0] === 'Any failure reason', JSON.stringify(options))

  await box.fill('ZZ9')
  check('3. a search that matches nothing reaches the door', await until(page, () => calls.jobs.includes('?store=ZZ9&failureReason=StoreUnreachable&page=1&pageSize=50')), JSON.stringify(calls.jobs))
  await page.locator('[data-jobs-empty]').waitFor({ timeout: 10000 })
  check('3. it says nothing matches the filter', strip(await page.locator('[data-jobs-empty]').innerText()) === 'Nothing matches the filter.', strip(await page.locator('[data-jobs-empty]').innerText()))
  await page.screenshot({ path: `${SHOTS}/filtered-empty.png`, fullPage: true })

  await box.fill('')
  await page.locator('[data-job-failure-filter]').selectOption('')
  check('5. clearing every filter asks for the whole campaign', await until(page, () => calls.jobs.at(-1) === '?page=1&pageSize=50'), JSON.stringify(calls.jobs.slice(-3)))
  await page.waitForTimeout(400)
  check('5. …and the address is bare', new URL(page.url()).search === '', page.url())
  check('no page errors (search, reason, empty, clear)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: a link carrying the filters ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${PAGE}?status=Failed&store=P02&failureReason=StoreUnreachable`)
  await page.locator(`[data-job-open="${jobId(53)}"]`).waitFor({ timeout: 20000 })
  check('4. a link asks the door for every filter it carries', calls.jobs[0] === '?status=Failed&store=P02&failureReason=StoreUnreachable&page=1&pageSize=50', calls.jobs[0])
  check('4. …fills the search box', (await page.locator('input[data-job-store-search]').inputValue()) === 'P02')
  check('4. …and the selects', (await page.locator('[data-job-failure-filter]').inputValue()) === 'StoreUnreachable' && (await page.locator('[data-job-status-filter]').inputValue()) === 'Failed')
  await page.waitForTimeout(600)
  check('4. …and asks nothing more once the debounce settles', calls.jobs.length === 1, JSON.stringify(calls.jobs))
  check('no page errors (link)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
