// Data sync campaign drive (ticket 560, spec 558) — drives the REAL /admin/data-sync/campaigns/:id
// page in Chromium against STUBBED `DataSync/*` envelopes, shaped from the OpenAPI draft
// (C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml:
// the Campaign 201 example and the Job example) and the running service's [CODE] shapes
// (`DATASYNC_CAMPAIGN_NOT_FOUND`, a nullable `target`, a job failure `Error`).
// 🚩 NOTHING here is driven against a live DataSync: ticket 566 is the live walk.
//
// It verifies:
//   1. the header (name, profile NAME, mode, status, reason, source, times in LOCAL time), the rollup
//      tiles with their asOf stamp, and the jobs grid: store as client/code, status + phase, why it
//      waits (WaitingForPause; BackingOff until a local time) or who holds it (Operator, StoreBusy),
//      attempts, and the failure as a sentence (an unknown code raw); the first read is page 1 of 50;
//   2. the job-status filter reaches the request by its exact name and lands in the URL; paging
//      asks for page 2 and keeps it in the URL;
//   3. a store opens the drawer and puts `?job=` in the URL; the drawer shows the target, each table
//      with status, phase, disposition, strategy, a progress bar (98 % / indeterminate while
//      chunksTotal is null), the counts, the failure sentence + detail, the truncated flag; closing
//      drops `?job=` and keeps the filter;
//   4. a link with `?job=` opens the drawer straight from the URL (GET Jobs/{id}); an unresolved
//      target says so;
//   5. polling (Playwright clock): a Running campaign is re-read every 5 s; once the stub turns
//      Completed (all jobs terminal) one more read lands, the jobs and the open job are read once
//      more so the grid ends terminal, and then nothing for 30 s;
//   6. a hidden tab does not poll;
//   7. an unknown campaign (404 DATASYNC_CAMPAIGN_NOT_FOUND) shows not-found, an unknown job
//      (404 DATASYNC_JOB_NOT_FOUND) shows not-found in the drawer.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-campaign-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-campaign-shots'
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
const refusal = (status, errorCode, internalErrorCode, message, errorMessage) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode, internalErrorCode, errorMessage }] })

// ── Stubs ───────────────────────────────────────────────────────────────────────────────────────

const PROFILE = '01JAZ8M4QX7R3T2V5W6Y9K0BCD'
const CID = '01JB2C9X4E6F8G0H1J3K5M7N9P'
const GONE = '01JB2C9X4E6F8G0H1J3K5M7ZZZ'
const GONE_JOB = '01JB2CA2R4S6T8V0W1X3Y5ZZZZ'

const PROFILES = [
  {
    profileId: PROFILE,
    name: 'HQ price-list → stores',
    source: { server: 'OMS-HQ', database: 'DMSCO' },
    tableSet: [],
    allowsApply: true,
  },
]

const campaignOf = (status, byState) => ({
  campaignId: CID,
  profileId: PROFILE,
  name: 'Price-list refresh — all stores',
  mode: 'Apply',
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: [],
  status,
  totalJobs: 60,
  jobsByState: byState,
  reason: 'Q4 price-list cutover approved in CR-2231; reconcile all stores to HQ.',
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: '2026-10-24T09:01:00Z',
  finishedAt: status === 'Completed' ? '2026-10-24T09:30:00Z' : null,
  asOf: '2026-10-24T09:05:00Z',
})

const tt = (over) => ({
  tableTaskId: `01JB2CA3B5C7D9E1F3G5H7J9${over.n ?? 'K1'}`,
  table: 'dbo.Product',
  status: 'Pending',
  phase: null,
  disposition: 'Applied',
  strategy: 'Reconcile',
  rowsCompared: 0,
  toInsert: 0,
  toUpdate: 0,
  toDelete: 0,
  rowsApplied: 0,
  chunksDone: 0,
  chunksTotal: null,
  failureReason: null,
  manifestTruncated: false,
  ...over,
})

// The draft's Job example, as the drawer's showcase: one table mid-run, one not yet sized.
const RUNNING_TABLES = [
  tt({ n: 'K1', table: 'dbo.Product', status: 'Running', phase: 'Reconciling', rowsCompared: 120345, toInsert: 42, toUpdate: 17, toDelete: 3, rowsApplied: 60, chunksDone: 118, chunksTotal: 120, manifestTruncated: true }),
  tt({ n: 'K2', table: 'dbo.PriceList', strategy: 'Seed' }),
  tt({ n: 'K3', table: 'dbo.Customer', status: 'Failed', disposition: 'ReportedOnly', failureReason: 'ConstraintViolation: FK_Customer_Region failed WITH CHECK', chunksDone: 4, chunksTotal: 4 }),
]

const jobId = (i) => `01JB2CA2R4S6T8V0W1X3Y5Z7${String(i).padStart(2, '0')}`
const CODES = (i) => ({ client: 'RIYADH', code: String(100 + i).padStart(4, '0') })
// 60 jobs: the first few each show one state; the rest Succeeded.
const SHOWCASE = [
  { status: 'Running', phase: 'Reconciling', tableTasks: RUNNING_TABLES, startedAt: '2026-10-24T09:05:00Z', target: { server: '10.12.0.123\\SQLEXPRESS', database: 'StorePOS' } },
  { status: 'Queued', waitReason: 'WaitingForPause' },
  { status: 'Queued', waitReason: 'BackingOff', notBefore: '2026-10-24T09:10:00Z', attemptCount: 2 },
  { status: 'Paused', holdReason: 'Operator' },
  { status: 'Paused', holdReason: 'StoreBusy' },
  { status: 'Failed', failureReason: 'StoreUnreachable', attemptCount: 3, finishedAt: '2026-10-24T09:20:00Z' },
  { status: 'Failed', failureReason: 'DiskFull', target: null },
]
const makeJobs = (done) =>
  Array.from({ length: 60 }, (_, i) => {
    const s = done ? (i === 5 || i === 6 ? SHOWCASE[i] : { status: 'Succeeded' }) : (SHOWCASE[i] ?? { status: 'Succeeded' })
    return {
      jobId: jobId(i),
      campaignId: CID,
      store: CODES(i),
      target: { server: `10.12.0.${i}`, database: 'StorePOS' },
      phase: null,
      tableTasks: [tt({ n: 'K9', status: 'Succeeded', chunksDone: 2, chunksTotal: 2 })],
      startedAt: null,
      finishedAt: null,
      failureReason: null,
      attemptCount: 0,
      waitReason: null,
      notBefore: null,
      holdReason: null,
      actionSyncResumable: false,
      ...s,
      ...(done && i === 0 ? { status: 'Succeeded', phase: null } : {}),
    }
  })

const browser = await chromium.launch()

async function open({ clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  if (clock) await page.clock.install({ time: new Date() })
  const errors = []
  const calls = { jobs: [], campaign: 0, job: [] }
  const state = { done: false }
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
    if (p === 'DataSync/Profiles') return route.fulfill(envelope(PROFILES))
    if (p === `DataSync/Campaigns/${GONE}` || p === `DataSync/Campaigns/${GONE}/Jobs`)
      return route.fulfill(refusal(404, 'DATASYNC_CAMPAIGN_NOT_FOUND', 'DS-0404-03', 'Campaign not found.', `No campaign ${GONE}.`))
    if (p === `DataSync/Campaigns/${CID}`) {
      calls.campaign++
      return route.fulfill(
        envelope(
          state.done
            ? campaignOf('Completed', { queued: 0, running: 0, paused: 0, succeeded: 58, failed: 2, cancelled: 0 })
            : campaignOf('Running', { queued: 2, running: 1, paused: 2, succeeded: 53, failed: 2, cancelled: 0 }),
        ),
      )
    }
    if (p === `DataSync/Campaigns/${CID}/Jobs`) {
      calls.jobs.push(url.search)
      const pg = Number(url.searchParams.get('page') ?? 1)
      const size = Number(url.searchParams.get('pageSize') ?? 50)
      const status = url.searchParams.get('status')
      const rows = makeJobs(state.done).filter((j) => !status || j.status === status)
      return route.fulfill(envelope(rows.slice((pg - 1) * size, pg * size)))
    }
    if (p.startsWith('DataSync/Jobs/')) {
      const id = p.slice('DataSync/Jobs/'.length)
      calls.job.push(id)
      const job = makeJobs(state.done).find((j) => j.jobId === id)
      if (!job) return route.fulfill(refusal(404, 'DATASYNC_JOB_NOT_FOUND', 'DS-0404-02', 'Job not found.', `No job ${id}.`))
      return route.fulfill(envelope(job))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, state }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const cell = (page, i, col) => page.locator(`[data-jobs-grid] [row-id="${jobId(i)}"] [col-id="${col}"]`)
const cellText = async (page, i, col) => strip(await cell(page, i, col).first().innerText())
const PAGE = `${BASE}/admin/data-sync/campaigns/${CID}`

// ── 1: header, rollup, grid ────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(PAGE)
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 20000 })
  const h = page.locator('[data-campaign-header]')
  const field = async (k) => strip(await h.locator(`[data-field="${k}"] dd`).innerText())
  check('1. the header names the campaign', strip(await h.locator('[data-campaign-name]').innerText()) === 'Price-list refresh — all stores')
  check('1. …its status as a badge', (await h.locator('[data-campaign-status="Running"]').count()) === 1)
  check('1. …the profile by NAME', (await field('profile')) === 'HQ price-list → stores', await field('profile'))
  check('1. …the mode in words', (await field('mode')) === 'Apply')
  check('1. …the source', (await field('source')) === 'OMS-HQ · DMSCO', await field('source'))
  check('1. …the reason', /CR-2231/.test(await field('reason')))
  check('1. …created and started in LOCAL time (09:00Z → 12:00)', (await field('createdAt')) === '2026-10-24 12:00' && (await field('startedAt')) === '2026-10-24 12:01', `${await field('createdAt')} ${await field('startedAt')}`)
  check('1. …not finished yet', (await field('finishedAt')) === '—')
  const tile = async (k) => strip(await page.locator(`[data-tile="${k}"] [data-tile-count]`).innerText())
  check('1. the rollup tiles carry jobsByState', (await tile('total')) === '60' && (await tile('queued')) === '2' && (await tile('running')) === '1' && (await tile('paused')) === '2' && (await tile('succeeded')) === '53' && (await tile('failed')) === '2' && (await tile('cancelled')) === '0')
  check('1. …with the asOf stamp, local', strip(await page.locator('[data-as-of]').innerText()) === 'As of 2026-10-24 12:05', strip(await page.locator('[data-as-of]').innerText()))
  check('1. the first jobs read is page 1 of 50, no status', calls.jobs[0] === '?page=1&pageSize=50', calls.jobs[0])
  check('1. a store reads client/code', (await cellText(page, 0, 'store')) === 'RIYADH/0100', await cellText(page, 0, 'store'))
  check('1. Running shows its phase', (await cellText(page, 0, 'status')) === 'Running Reconciling', await cellText(page, 0, 'status'))
  check('1. WaitingForPause says why', (await cellText(page, 1, 'why')) === 'Waiting for ActionSync to pause this store', await cellText(page, 1, 'why'))
  check('1. BackingOff says until when (local)', (await cellText(page, 2, 'why')) === 'Backing off after a fault, until 2026-10-24 12:10', await cellText(page, 2, 'why'))
  check('1. …with its attempts', (await cellText(page, 2, 'attemptCount')) === '2')
  check('1. Paused by a person', (await cellText(page, 3, 'why')) === 'Paused by a person')
  check('1. Paused because the store is busy', (await cellText(page, 4, 'why')) === 'Held: ActionSync is working this store')
  check('1. a failure reads as a sentence', (await cellText(page, 5, 'failure')) === 'The store could not be reached after three attempts.', await cellText(page, 5, 'failure'))
  check('1. an unknown failure code shows raw', (await cellText(page, 6, 'failure')) === 'DiskFull')
  check('1. finished time is local', (await cellText(page, 5, 'finishedAt')) === '2026-10-24 12:20')
  check('1. a viewer sees no actions column (seam for 563)', (await page.locator('[data-jobs-grid] .ag-header-cell[col-id="actions"]').count()) === 0)
  check('1. the pager reads Page 1 with Next on (a full page)', strip(await page.locator('[data-ds-page]').innerText()) === 'Page 1' && !(await page.locator('[data-ds-next]').isDisabled()))
  await page.screenshot({ path: `${SHOTS}/campaign.png`, fullPage: true })

  // ── 2: filter + paging ──
  await page.locator('[data-ds-next]').click()
  check('2. Next asks for page 2 of 50', await until(page, () => calls.jobs.includes('?page=2&pageSize=50')), JSON.stringify(calls.jobs))
  await page.locator('[data-ds-pager="2"]').waitFor({ timeout: 10000 })
  check('2. the URL keeps the page', new URL(page.url()).search === '?page=2', page.url())
  await page.locator('[data-job-status-filter]').selectOption('Failed')
  check('2. the status filter reaches the request by its exact name, page 1', await until(page, () => calls.jobs.includes('?status=Failed&page=1&pageSize=50')), JSON.stringify(calls.jobs))
  await page.waitForTimeout(400)
  check('2. the URL keeps the status', new URL(page.url()).search === '?status=Failed', page.url())
  const statuses = await page.locator('[data-jobs-grid] [data-job-status]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-job-status')))])
  check('2. only Failed jobs are drawn', JSON.stringify(statuses) === '["Failed"]', JSON.stringify(statuses))

  // ── 3: the drawer from a click ──
  await page.locator('[data-job-status-filter]').selectOption('')
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 10000 })
  await page.locator(`[data-job-open="${jobId(0)}"]`).click()
  const drawer = page.locator(`dialog[open][data-job-drawer="${jobId(0)}"]`)
  await drawer.locator('[data-table-tasks-grid] [row-id]').first().waitFor({ timeout: 10000 })
  check('3. the store opens the drawer and puts ?job= in the URL', new URL(page.url()).searchParams.get('job') === jobId(0), page.url())
  check('3. the drawer reads GET DataSync/Jobs/{id}', calls.job.includes(jobId(0)))
  check('3. the drawer names the store', strip(await drawer.locator('[data-job-title]').innerText()) === 'RIYADH/0100')
  check('3. …the target server and database', strip(await drawer.locator('[data-field="target"] dd').innerText()) === '10.12.0.123\\SQLEXPRESS · StorePOS', strip(await drawer.locator('[data-field="target"] dd').innerText()))
  const tcell = (id, col) => drawer.locator(`[data-table-tasks-grid] [row-id="01JB2CA3B5C7D9E1F3G5H7J9${id}"] [col-id="${col}"]`)
  const tText = async (id, col) => strip(await tcell(id, col).innerText())
  check('3. a table shows status + phase', (await tText('K1', 'status')) === 'Running Reconciling', await tText('K1', 'status'))
  check('3. …disposition and strategy', (await tText('K1', 'disposition')) === 'Applied' && (await tText('K3', 'disposition')) === 'Reported only' && (await tText('K2', 'strategy')) === 'Seed')
  check('3. …progress 118 / 120 at 98 %', (await tText('K1', 'progress')) === '118 / 120' && (await tcell('K1', 'progress').locator('[data-progress="98"]').count()) === 1, await tText('K1', 'progress'))
  check('3. …indeterminate while chunksTotal is null', (await tcell('K2', 'progress').locator('[data-progress="indeterminate"]').count()) === 1)
  check('3. …the counts', (await tText('K1', 'rowsCompared')) === '120,345' && (await tText('K1', 'toInsert')) === '42' && (await tText('K1', 'toUpdate')) === '17' && (await tText('K1', 'toDelete')) === '3' && (await tText('K1', 'rowsApplied')) === '60')
  check('3. …a table failure as a sentence with its detail', (await tText('K3', 'failure')) === 'A constraint check failed after the apply (for example a child row without its parent). FK_Customer_Region failed WITH CHECK', await tText('K3', 'failure'))
  check('3. …the manifest-truncated flag', (await tcell('K1', 'flags').locator('[data-truncated]').count()) === 1 && (await tcell('K2', 'flags').locator('[data-truncated]').count()) === 0)
  check('3. a viewer sees no drawer footer (seam for 562/563)', (await drawer.locator('[data-job-drawer-footer]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/drawer.png`, fullPage: true })
  await drawer.locator('[data-job-drawer-close]').click()
  await page.waitForTimeout(300)
  check('3. closing drops ?job=', !new URL(page.url()).searchParams.has('job') && (await page.locator('dialog[open][data-job-drawer]').count()) === 0, page.url())
  check('no page errors (page, filter, drawer)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: the drawer straight from the URL ─────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${PAGE}?status=Failed&job=${jobId(6)}`)
  const drawer = page.locator(`dialog[open][data-job-drawer="${jobId(6)}"]`)
  await drawer.locator('[data-field="target"]').waitFor({ timeout: 20000 })
  check('4. a ?job= link opens the drawer from the URL', calls.job.includes(jobId(6)))
  check('4. …beside its filter', calls.jobs[0] === '?status=Failed&page=1&pageSize=50', calls.jobs[0])
  check('4. an unresolved target says so', strip(await drawer.locator('[data-field="target"] dd').innerText()) === 'Not resolved')
  check('4. the job failure shows raw for an unknown code', strip(await drawer.locator('[data-job-failure]').innerText()) === 'DiskFull')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('4. Escape closes it and keeps the filter', new URL(page.url()).search === '?status=Failed', page.url())
  check('no page errors (drawer from URL)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: polling stops on Completed ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, state } = await open({ clock: true })
  await page.goto(`${PAGE}?job=${jobId(0)}`)
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 20000 })
  await page.locator('[data-table-tasks-grid] [row-id]').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  const c0 = calls.campaign, j0 = calls.jobs.length, d0 = calls.job.length
  await page.clock.fastForward(5_500)
  await until(page, () => calls.campaign > c0 && calls.jobs.length > j0)
  check('5. a Running campaign is re-read at 5 s (campaign, jobs and the open job)', calls.campaign > c0 && calls.jobs.length > j0 && calls.job.length > d0, `${c0}→${calls.campaign} ${j0}→${calls.jobs.length} ${d0}→${calls.job.length}`)
  state.done = true
  const c1 = calls.campaign, j1 = calls.jobs.length, d1 = calls.job.length
  await page.clock.fastForward(5_500)
  await until(page, () => calls.campaign > c1)
  await page.locator('[data-campaign-header] [data-campaign-status="Completed"]').waitFor({ timeout: 5000 })
  check('5. the next read sees Completed', (await page.locator('[data-campaign-header] [data-campaign-status="Completed"]').count()) === 1)
  await until(page, () => calls.jobs.length > j1 && calls.job.length > d1)
  check('5. …and the jobs and the open job are read once more, so the grid ends terminal', calls.jobs.length > j1 && calls.job.length > d1, `${j1}→${calls.jobs.length} ${d1}→${calls.job.length}`)
  await page.waitForTimeout(500)
  check('5. …the grid shows the last Running job Succeeded', (await page.locator(`[data-jobs-grid] [row-id="${jobId(0)}"] [data-job-status="Succeeded"]`).count()) === 1)
  const c2 = calls.campaign, j2 = calls.jobs.length, d2 = calls.job.length
  await page.clock.fastForward(30_000)
  await page.waitForTimeout(800)
  check('5. then nothing is re-read for 30 s', calls.campaign === c2 && calls.jobs.length === j2 && calls.job.length === d2, `${c2}→${calls.campaign} ${j2}→${calls.jobs.length} ${d2}→${calls.job.length}`)
  check('no page errors (polling)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: a hidden tab does not poll ──────────────────────────────────────────────────────────────
{
  const { context, page, calls } = await open({ clock: true })
  await page.goto(PAGE)
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 20000 })
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(300)
  const c0 = calls.campaign
  await page.clock.fastForward(16_000)
  await page.waitForTimeout(800)
  check('6. a hidden tab does not poll', calls.campaign === c0, `${c0}→${calls.campaign}`)
  await context.close()
}

// ── 7: not found ───────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/admin/data-sync/campaigns/${GONE}`)
  await page.locator('[data-campaign-not-found]').waitFor({ timeout: 20000 })
  check('7. an unknown campaign shows not-found', /Campaign not found/.test(strip(await page.locator('[data-campaign-not-found]').innerText())))
  check('7. …with a way back', (await page.locator('[data-campaign-not-found] a[href="/admin/data-sync"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/not-found.png`, fullPage: true })

  await page.goto(`${PAGE}?job=${GONE_JOB}`)
  await page.locator('[data-job-not-found]').waitFor({ timeout: 20000 })
  check('7. an unknown job shows not-found in the drawer', /Job not found/.test(strip(await page.locator('[data-job-not-found]').innerText())))
  check('7. …while the campaign page still renders behind it', (await page.locator('[data-campaign-header]').count()) === 1)
  check('no page errors (not found)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
