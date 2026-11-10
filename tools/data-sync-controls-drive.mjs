// Data sync controls drive (ticket 563, spec 558) — drives the REAL /admin/data-sync/campaigns/:id
// page in Chromium against STUBBED `DataSync/*` envelopes, shaped from the OpenAPI draft (the
// Campaign and Job examples, the 409 InvalidState / StoreBusy / WpfHosted examples) and the running
// service's state machines (wire.md §5: CampaignStateMachine.Table, JobTransitions — a job's moves
// ignore its campaign's status).
// 🚩 NOTHING here is driven against a live DataSync: ticket 566 is the live walk.
//
// It verifies:
//   1. an operator sees only the legal moves: a Running campaign offers Pause + Cancel (no Resume);
//      each job row offers its own (Queued/Running: Pause + Cancel; Pausing: Cancel; Paused: Resume +
//      Cancel; Succeeded/Failed: none);
//   2. campaign Pause: the dialog names the campaign, says Pause lands at the next chunk boundary,
//      posts `Campaigns/{id}/Pause` with the trimmed note; the answer's state (Pausing) shows at once
//      and the moves follow it (Cancel only);
//   3. campaign Cancel with a blank note posts `{}`; the dialog says applied chunks are never rolled back;
//   4. a job row's Pause posts `Jobs/{id}/Pause`; the row shows the answer (Paused);
//   5. a job Resume has no note field and posts `{}`; refusals read in the dialog in words with their
//      code: 409 STORE_BUSY (pause ActionSync first), 409 STORE_WPF_HOSTED (never), and the dialog
//      stays open; a campaign Resume refused 409 INVALID_STATE likewise;
//   6. the drawer's footer carries the open job's controls: Cancel posts `Jobs/{id}/Cancel` with the note;
//   7. a viewer (canOperate false) sees no control anywhere: header, rows (no actions column), drawer;
//   8. a bare 403 on a control hides every control.
//
// Retry (ticket 866, spec 863; doors and fields from DataSync 27989cf, engine spec §2.6):
//   9. a Completed campaign with `retryableJobs: 4` offers *Retry 4 retryable* alone; the rows never
//      offer Retry (drawer only); a retryable job's drawer offers Retry, a TableFailures job's does
//      not; the drawer's Retry dialog says the store resumes where it stopped and finished tables are
//      not redone, posts `Jobs/{id}/Retry` with the trimmed note, the drawer shows Queued, and the
//      poll picks up the campaign reopened (Running);
//  10. Retry refusals read in the dialog in Retry's own words with their code: STORE_BUSY (pause
//      ActionSync first, then retry), STORE_WPF_HOSTED (never), INVALID_STATE (nothing retryable any
//      more, or cancelling / cancelled) — on a job and on the campaign; the dialog stays open;
//      the header's Retry posts `Campaigns/{id}/Retry` with the note and the answer (Running, 0
//      retryable) drops the button;
//  11. a viewer sees no Retry: not in the header, not in a retryable job's drawer.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-controls-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-controls-shots'
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
const PAUSED_CID = '01JB2C9X4E6F8G0H1J3K5M7PPP'

const campaignOf = (campaignId, status) => ({
  campaignId,
  profileId: PROFILE,
  name: 'Price-list refresh — all stores',
  mode: 'Apply',
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: [],
  status,
  totalJobs: 8,
  jobsByState: { queued: 2, running: 3, paused: 2, succeeded: 1, failed: 1, cancelled: 0 },
  reason: 'Q4 price-list cutover approved in CR-2231; reconcile all stores to HQ.',
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: '2026-10-24T09:01:00Z',
  finishedAt: null,
  asOf: '2026-10-24T09:05:00Z',
})

const jobId = (i) => `01JB2CA2R4S6T8V0W1X3Y5Z7${String(i).padStart(2, '0')}`
// One job per state the grid must offer moves for.
const SHOWCASE = [
  { status: 'Running', phase: 'Reconciling' }, // 0: Pause + Cancel
  { status: 'Queued' }, // 1: Pause + Cancel
  { status: 'Pausing' }, // 2: Cancel
  { status: 'Paused', holdReason: 'Operator' }, // 3: Resume + Cancel (Resume → STORE_BUSY)
  { status: 'Paused', holdReason: 'StoreBusy' }, // 4: Resume + Cancel (Resume → WPF_HOSTED)
  { status: 'Succeeded' }, // 5: none
  { status: 'Failed', failureReason: 'StoreUnreachable' }, // 6: none
  { status: 'Queued', waitReason: 'WaitingForPause' }, // 7: Pause + Cancel
]
const EXPECT_MOVES = [['Pause', 'Cancel'], ['Pause', 'Cancel'], ['Cancel'], ['Resume', 'Cancel'], ['Resume', 'Cancel'], [], [], ['Pause', 'Cancel']]
const makeJob = (i, campaignId) => ({
  jobId: jobId(i),
  campaignId,
  store: { client: '000', code: String(100 + i).padStart(4, '0') },
  target: { server: `10.12.0.${i}`, database: 'StorePOS' },
  phase: null,
  tableTasks: [],
  startedAt: null,
  finishedAt: null,
  failureReason: null,
  attemptCount: 0,
  waitReason: null,
  notBefore: null,
  holdReason: null,
  actionSyncResumable: false,
  // 866: a Failed(StoreUnreachable) job IS retryable — the row must still not offer Retry.
  retryable: SHOWCASE[i].status === 'Failed',
  ...SHOWCASE[i],
})

// ── Retry (866): a Completed campaign whose stores partly dropped out ──
const RETRY_CID = '01JB2C9X4E6F8G0H1J3K5MRTRY'
const RETRY_JOBS = [
  { status: 'Failed', failureReason: 'StoreUnreachable', retryable: true }, // 0: retried
  { status: 'Failed', failureReason: 'TargetUnresolved', retryable: true }, // 1: Retry → STORE_BUSY
  { status: 'Failed', failureReason: 'StoreUnreachable', retryable: true }, // 2: Retry → STORE_WPF_HOSTED
  { status: 'Failed', failureReason: 'TableFailures', retryable: false }, // 3: no Retry
  { status: 'Succeeded' }, // 4
  { status: 'Failed', failureReason: 'StoreUnreachable', retryable: true }, // 5: Retry → INVALID_STATE
]
const makeRetryJob = (i) => ({ ...makeJob(0, RETRY_CID), jobId: jobId(i), store: { client: '000', code: String(200 + i).padStart(4, '0') }, phase: null, ...RETRY_JOBS[i] })
const RETRY_REFUSALS = {
  [jobId(1)]: ['DATASYNC_STORE_BUSY', 'DS-0409-07', 'Store 000/0201 is actively worked and not paused.'],
  [jobId(2)]: ['DATASYNC_STORE_WPF_HOSTED', 'DS-0409-08', 'Store 000/0202 is synced by the WPF host and can never be applied to.'],
  [jobId(5)]: ['DATASYNC_INVALID_STATE', 'DS-0409-01', 'Job is not retryable.'],
}

const browser = await chromium.launch()

async function open({ canOperate = true, campaignId = CID, campaignStatus = 'Running', bare403 = false, retryableJobs = 0, jobs = null, refuseCampaignRetry = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const posts = []
  const state = {
    campaign: { ...campaignOf(campaignId, campaignStatus), retryableJobs },
    jobs: jobs ?? SHOWCASE.map((_, i) => makeJob(i, campaignId)),
  }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DataSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate }))
    if (p === 'DataSync/Health') return route.fulfill(envelope({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() }))
    if (p === 'DataSync/Profiles') return route.fulfill(envelope([]))

    if (req.method() === 'POST') {
      const body = req.postData() ? JSON.parse(req.postData()) : null
      posts.push({ path: p, body })
      if (bare403) return route.fulfill({ status: 403, body: '' })
      // 866: Retry, as DataSync §2.6 answers it — a job back to Queued, a Completed campaign reopened.
      let m = p.match(/^DataSync\/Campaigns\/([^/]+)\/Retry$/)
      if (m) {
        const c = state.campaign
        if (refuseCampaignRetry)
          return route.fulfill(refusal(409, 'DATASYNC_INVALID_STATE', 'DS-0409-01', 'No job of this campaign is retryable.', `Campaign ${c.campaignId} has no retryable job.`))
        for (const j of state.jobs) if (j.retryable) Object.assign(j, { status: 'Queued', failureReason: null, retryable: false, attemptCount: 0 })
        Object.assign(c, { status: 'Running', retryableJobs: 0, finishedAt: null })
        return route.fulfill(envelope(c))
      }
      m = p.match(/^DataSync\/Jobs\/([^/]+)\/Retry$/)
      if (m) {
        const id = m[1]
        if (RETRY_REFUSALS[id]) {
          const [code, internal, message] = RETRY_REFUSALS[id]
          return route.fulfill(refusal(409, code, internal, message, message))
        }
        const job = state.jobs.find((j) => j.jobId === id)
        Object.assign(job, { status: 'Queued', failureReason: null, retryable: false, attemptCount: 0 })
        Object.assign(state.campaign, { status: 'Running', retryableJobs: state.campaign.retryableJobs - 1, finishedAt: null })
        return route.fulfill(envelope(job))
      }
      m = p.match(/^DataSync\/Campaigns\/([^/]+)\/(Pause|Resume|Cancel)$/)
      if (m) {
        const [, , action] = m
        const c = state.campaign
        if (action === 'Resume' && c.status === 'Paused')
          return route.fulfill(
            refusal(409, 'DATASYNC_INVALID_STATE', 'DS-0409-01', 'Resume is not valid from status Running.', `Campaign ${c.campaignId} is Running.`),
          )
        c.status = action === 'Pause' ? 'Pausing' : action === 'Cancel' ? 'Cancelling' : 'Running'
        return route.fulfill(envelope(c))
      }
      m = p.match(/^DataSync\/Jobs\/([^/]+)\/(Pause|Resume|Cancel)$/)
      if (m) {
        const [, id, action] = m
        const job = state.jobs.find((j) => j.jobId === id)
        if (action === 'Resume' && id === jobId(3))
          return route.fulfill(
            refusal(409, 'DATASYNC_STORE_BUSY', 'DS-0409-07', 'Store 000/0103 is actively worked and not paused.', 'The live ActionSync worker is driving 000/0103; pause it before applying to it.'),
          )
        if (action === 'Resume' && id === jobId(4))
          return route.fulfill(
            refusal(409, 'DATASYNC_STORE_WPF_HOSTED', 'DS-0409-08', 'Store 000/0104 is synced by the WPF host and can never be applied to.', '000/0104 has Host=Wpf (or no ActionSyncStore row); the WPF host cannot be paused.'),
          )
        if (action === 'Pause') Object.assign(job, job.status === 'Queued' ? { status: 'Paused', holdReason: 'Operator', waitReason: null } : { status: 'Pausing', phase: null })
        if (action === 'Cancel') Object.assign(job, job.status === 'Running' || job.status === 'Pausing' ? { status: 'Cancelling', phase: null } : { status: 'Cancelled', holdReason: null, waitReason: null })
        if (action === 'Resume') Object.assign(job, { status: 'Queued', holdReason: null })
        return route.fulfill(envelope(job))
      }
      return route.fulfill(envelope(null))
    }

    if (p === `DataSync/Campaigns/${campaignId}`) return route.fulfill(envelope(state.campaign))
    if (p === `DataSync/Campaigns/${campaignId}/Jobs`) return route.fulfill(envelope(state.jobs))
    if (p.startsWith('DataSync/Jobs/')) {
      const job = state.jobs.find((j) => j.jobId === p.slice('DataSync/Jobs/'.length))
      return route.fulfill(job ? envelope(job) : refusal(404, 'DATASYNC_JOB_NOT_FOUND', 'DS-0404-02', 'Job not found.', 'No job.'))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/admin/data-sync/campaigns/${campaignId}`)
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 20000 })
  return { context, page, errors, posts, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (await pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const header = (page) => page.locator('[data-campaign-header]')
const headerMoves = (page) => header(page).locator('[data-control-scope="campaign"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-control')))
const rowMoves = (page, i) =>
  page.locator(`[data-jobs-grid] [row-id="${jobId(i)}"] [data-control-scope="job"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-control')))
const dialog = (page) => page.locator('[data-control-dialog]')
const dialogText = async (page) => strip(await page.locator('dialog:has([data-control-dialog])').innerText())

// ── 1–5: an operator ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  check('1. a Running campaign offers Pause + Cancel, no Resume', JSON.stringify(await headerMoves(page)) === '["Pause","Cancel"]', JSON.stringify(await headerMoves(page)))
  check('1. the jobs grid has an actions column', (await page.locator('[data-jobs-grid] .ag-header-cell[col-id="actions"]').count()) === 1)
  for (let i = 0; i < SHOWCASE.length; i++) {
    const got = await rowMoves(page, i)
    check(`1. a ${SHOWCASE[i].status} job offers ${EXPECT_MOVES[i].join(' + ') || 'nothing'}`, JSON.stringify(got) === JSON.stringify(EXPECT_MOVES[i]), JSON.stringify(got))
  }
  await page.screenshot({ path: `${SHOTS}/operator.png`, fullPage: true })

  // ── 2: campaign Pause ──
  await header(page).locator('[data-control="Pause"]').click()
  await dialog(page).waitFor()
  const t2 = await dialogText(page)
  check('2. the Pause dialog is titled for the campaign', /Pause the campaign/.test(t2), t2)
  check('2. …names the campaign and its id', /Price-list refresh — all stores/.test(t2) && t2.includes(CID))
  check('2. …says Pause lands at the next chunk boundary (Pausing → Paused)', /next chunk boundary/.test(t2) && /Pausing/.test(t2))
  check('2. …offers an optional note', (await page.locator('[data-control-note]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/pause-dialog.png` })
  await page.locator('[data-control-note]').fill('  store 0123 is reindexing  ')
  await page.locator('[data-control-confirm]').click()
  check('2. posts Campaigns/{id}/Pause with the trimmed note', await until(page, () => posts.some((x) => x.path === `DataSync/Campaigns/${CID}/Pause` && x.body?.reason === 'store 0123 is reindexing')), JSON.stringify(posts))
  check('2. the dialog closes', await until(page, async () => (await dialog(page).count()) === 0))
  check('2. the answer\'s state shows at once (Pausing)', await until(page, async () => (await header(page).locator('[data-campaign-status="Pausing"]').count()) === 1))
  check('2. …and the moves follow it (Cancel only)', await until(page, async () => JSON.stringify(await headerMoves(page)) === '["Cancel"]'), JSON.stringify(await headerMoves(page)))

  // ── 3: campaign Cancel, blank note ──
  await header(page).locator('[data-control="Cancel"]').click()
  await dialog(page).waitFor()
  const t3 = await dialogText(page)
  check('3. the Cancel dialog says applied chunks are never rolled back', /never rolled back/.test(t3), t3)
  await page.locator('[data-control-note]').fill('   ')
  await page.locator('[data-control-confirm]').click()
  check('3. a blank note posts {} to Campaigns/{id}/Cancel', await until(page, () => posts.some((x) => x.path === `DataSync/Campaigns/${CID}/Cancel` && JSON.stringify(x.body) === '{}')), JSON.stringify(posts.at(-1)))
  check('3. the campaign reads Cancelling and offers nothing', await until(page, async () => (await header(page).locator('[data-campaign-status="Cancelling"]').count()) === 1 && (await headerMoves(page)).length === 0))

  // ── 4: a job row's Pause ──
  await page.locator(`[data-jobs-grid] [row-id="${jobId(1)}"] [data-control="Pause"]`).click()
  await dialog(page).waitFor()
  const t4 = await dialogText(page)
  check('4. the job dialog names the store and the job', /Pause the job for store 000\/0101/.test(t4) && t4.includes(jobId(1)), t4)
  await page.locator('[data-control-note]').fill('hold this one')
  await page.locator('[data-control-confirm]').click()
  check('4. posts Jobs/{id}/Pause with the note', await until(page, () => posts.some((x) => x.path === `DataSync/Jobs/${jobId(1)}/Pause` && x.body?.reason === 'hold this one')))
  check('4. the row shows the answer (Paused, so Resume + Cancel)', await until(page, async () => JSON.stringify(await rowMoves(page, 1)) === '["Resume","Cancel"]'), JSON.stringify(await rowMoves(page, 1)))

  // ── 5: refusals ──
  await page.locator(`[data-jobs-grid] [row-id="${jobId(3)}"] [data-control="Resume"]`).click()
  await dialog(page).waitFor()
  check('5. Resume offers no note', (await page.locator('[data-control-note]').count()) === 0)
  const t5 = await dialogText(page)
  check('5. the Resume dialog says an apply job re-checks its store', /checks again/.test(t5), t5)
  await page.locator('[data-control-confirm]').click()
  await page.locator('[data-control-error]').waitFor({ timeout: 10000 })
  check('5. Resume posts {} to Jobs/{id}/Resume', posts.some((x) => x.path === `DataSync/Jobs/${jobId(3)}/Resume` && JSON.stringify(x.body) === '{}'))
  check('5. STORE_BUSY reads in words in the dialog (pause ActionSync first)', /Pause the store on ActionSync first/.test(strip(await page.locator('[data-control-refusal]').innerText())))
  check('5. …with the door\'s message and the code', /actively worked/.test(await dialogText(page)) && (await page.locator('[data-control-error="DATASYNC_STORE_BUSY"]').count()) === 1)
  check('5. …and the dialog stays open', (await dialog(page).count()) === 1)
  await page.screenshot({ path: `${SHOTS}/store-busy.png` })
  await page.locator('[data-control-close]').click()
  await until(page, async () => (await dialog(page).count()) === 0)

  await page.locator(`[data-jobs-grid] [row-id="${jobId(4)}"] [data-control="Resume"]`).click()
  await dialog(page).waitFor()
  await page.locator('[data-control-confirm]').click()
  await page.locator('[data-control-error]').waitFor({ timeout: 10000 })
  check('5. STORE_WPF_HOSTED reads in words (it can never be applied)', /can never be applied to/.test(strip(await page.locator('[data-control-refusal]').innerText())) && (await page.locator('[data-control-error="DATASYNC_STORE_WPF_HOSTED"]').count()) === 1)
  await page.locator('[data-control-close]').click()
  await until(page, async () => (await dialog(page).count()) === 0)

  // ── 6: the drawer's controls ──
  await page.locator(`[data-job-open="${jobId(0)}"]`).click()
  await page.locator('[data-job-drawer-footer]').waitFor({ timeout: 10000 })
  const drawerMoves = await page.locator('[data-job-drawer-footer] [data-control-scope="job"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-control')))
  check('6. the drawer offers the open job\'s moves (Running: Pause + Cancel)', JSON.stringify(drawerMoves) === '["Pause","Cancel"]', JSON.stringify(drawerMoves))
  await page.locator('[data-job-drawer-footer] [data-control="Cancel"]').click()
  await dialog(page).waitFor()
  check('6. the dialog opens above the drawer', await page.locator('[data-control-note]').isVisible())
  await page.locator('[data-control-note]').fill('wrong store')
  await page.screenshot({ path: `${SHOTS}/drawer-cancel.png` })
  await page.locator('[data-control-confirm]').click()
  check('6. posts Jobs/{id}/Cancel with the note', await until(page, () => posts.some((x) => x.path === `DataSync/Jobs/${jobId(0)}/Cancel` && x.body?.reason === 'wrong store')))
  check('6. the drawer shows the answer (Cancelling, nothing left to offer)', await until(page, async () => (await page.locator('[data-job-drawer] [data-control-scope="job"]').count()) === 0 && /Cancelling/.test(strip(await page.locator('[data-job-drawer] header').innerText()))))
  check('6. …and the drawer stays open', (await page.locator('[data-job-drawer]').count()) === 1)
  check('no page errors (operator)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5b: campaign Resume refused INVALID_STATE ──────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open({ campaignId: PAUSED_CID, campaignStatus: 'Paused' })
  check('5b. a Paused campaign offers Resume + Cancel', JSON.stringify(await headerMoves(page)) === '["Resume","Cancel"]', JSON.stringify(await headerMoves(page)))
  await header(page).locator('[data-control="Resume"]').click()
  await dialog(page).waitFor()
  check('5b. campaign Resume offers no note', (await page.locator('[data-control-note]').count()) === 0)
  await page.locator('[data-control-confirm]').click()
  await page.locator('[data-control-error]').waitFor({ timeout: 10000 })
  check('5b. posts Campaigns/{id}/Resume with {}', posts.some((x) => x.path === `DataSync/Campaigns/${PAUSED_CID}/Resume` && JSON.stringify(x.body) === '{}'))
  check('5b. INVALID_STATE reads in words in the dialog', /no longer allowed from its current status/.test(strip(await page.locator('[data-control-refusal]').innerText())) && (await page.locator('[data-control-error="DATASYNC_INVALID_STATE"]').count()) === 1)
  check('no page errors (refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: a viewer ──────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ canOperate: false })
  check('7. a viewer sees no campaign control', (await page.locator('[data-control]').count()) === 0)
  check('7. …no actions column', (await page.locator('[data-jobs-grid] .ag-header-cell[col-id="actions"]').count()) === 0)
  await page.locator(`[data-job-open="${jobId(0)}"]`).click()
  await page.locator('[data-job-drawer] [data-table-tasks-grid], [data-job-drawer] dl').first().waitFor({ timeout: 10000 })
  check('7. …and no drawer controls', (await page.locator('[data-job-drawer-footer]').count()) === 0 && (await page.locator('[data-control]').count()) === 0)
  check('no page errors (viewer)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: a bare 403 hides the controls ─────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open({ bare403: true })
  await header(page).locator('[data-control="Pause"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-control-confirm]').click()
  check('8. the control was sent', await until(page, () => posts.some((x) => x.path === `DataSync/Campaigns/${CID}/Pause`)))
  check('8. a bare 403 closes the dialog and hides every control', await until(page, async () => (await page.locator('[data-control]').count()) === 0 && (await dialog(page).count()) === 0))
  check('8. …and the actions column', await until(page, async () => (await page.locator('[data-jobs-grid] .ag-header-cell[col-id="actions"]').count()) === 0))
  check('no page errors (403)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9–10: Retry from the drawer and from the header (ticket 866) ───────────────────────────────────
const openRetry = (opts = {}) =>
  open({ campaignId: RETRY_CID, campaignStatus: 'Completed', retryableJobs: 4, jobs: RETRY_JOBS.map((_, i) => makeRetryJob(i)), ...opts })
const drawerMoves = (page) => page.locator('[data-job-drawer-footer] [data-control-scope="job"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-control')))
const openDrawer = async (page, i) => {
  await page.locator(`[data-job-open="${jobId(i)}"]`).click()
  await page.locator(`[data-job-drawer]`).waitFor({ timeout: 10000 })
  await until(page, async () => (await page.locator('[data-job-drawer] header').innerText()).includes(`0${200 + i}`))
}
const closeDrawer = async (page) => {
  await page.locator('[data-job-drawer-close]').click()
  await until(page, async () => (await page.locator('[data-job-drawer]').count()) === 0)
}
{
  const { context, page, errors, posts } = await openRetry()
  check('9. a Completed campaign with 4 retryable offers Retry alone', JSON.stringify(await headerMoves(page)) === '["Retry"]', JSON.stringify(await headerMoves(page)))
  check('9. …labelled "Retry 4 retryable"', strip(await header(page).locator('[data-control="Retry"]').innerText()) === 'Retry 4 retryable', strip(await header(page).locator('[data-control="Retry"]').innerText()))
  let rowRetry = 0
  for (let i = 0; i < RETRY_JOBS.length; i++) rowRetry += (await rowMoves(page, i)).filter((a) => a === 'Retry').length
  check('9. no row offers Retry (drawer only)', rowRetry === 0, String(rowRetry))
  await page.screenshot({ path: `${SHOTS}/retry-header.png`, fullPage: true })

  await openDrawer(page, 3)
  check('9. a TableFailures job\'s drawer offers no Retry', (await page.locator('[data-job-drawer] [data-control="Retry"]').count()) === 0)
  await closeDrawer(page)

  await openDrawer(page, 0)
  await page.locator('[data-job-drawer-footer]').waitFor({ timeout: 10000 })
  check('9. a retryable job\'s drawer offers Retry', JSON.stringify(await drawerMoves(page)) === '["Retry"]', JSON.stringify(await drawerMoves(page)))
  await page.locator('[data-job-drawer-footer] [data-control="Retry"]').click()
  await dialog(page).waitFor()
  const t9 = await dialogText(page)
  check('9. the drawer Retry dialog is titled for the store', /Retry the job for store 000\/0200/.test(t9) && t9.includes(jobId(0)), t9)
  check('9. …says the store resumes where it stopped and finished tables are not redone', /resumes from where it stopped/.test(t9) && /finished tables are not redone/.test(t9))
  check('9. …offers an optional note', (await page.locator('[data-control-note]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/retry-drawer-dialog.png` })
  await page.locator('[data-control-note]').fill('  link to 0200 is back  ')
  await page.locator('[data-control-confirm]').click()
  check('9. posts Jobs/{id}/Retry with the trimmed note', await until(page, () => posts.some((x) => x.path === `DataSync/Jobs/${jobId(0)}/Retry` && x.body?.reason === 'link to 0200 is back')), JSON.stringify(posts))
  check('9. the dialog closes', await until(page, async () => (await dialog(page).count()) === 0))
  check('9. the drawer shows the answer (Queued, no Retry left)', await until(page, async () => /Queued/.test(strip(await page.locator('[data-job-drawer] header').innerText())) && (await page.locator('[data-job-drawer] [data-control="Retry"]').count()) === 0))
  check('9. the campaign reopens: the header reads Running', await until(page, async () => (await header(page).locator('[data-campaign-status="Running"]').count()) === 1))
  check('9. …and counts 3 retryable', await until(page, async () => (await header(page).locator('[data-control="Retry"]').count()) === 1 && strip(await header(page).locator('[data-control="Retry"]').innerText()) === 'Retry 3 retryable'))
  await closeDrawer(page)

  // ── 10: refusals, in Retry's own words ──
  const refused = async (i, code, words) => {
    await openDrawer(page, i)
    await page.locator('[data-job-drawer-footer] [data-control="Retry"]').click()
    await dialog(page).waitFor()
    await page.locator('[data-control-confirm]').click()
    await page.locator('[data-control-error]').waitFor({ timeout: 10000 })
    const said = strip(await page.locator('[data-control-refusal]').innerText())
    check(`10. a job Retry refused ${code} reads in words with its code`, words.test(said) && (await page.locator(`[data-control-error="${code}"]`).count()) === 1, said)
    check(`10. …posted to Jobs/{id}/Retry, and the dialog stays open`, posts.some((x) => x.path === `DataSync/Jobs/${jobId(i)}/Retry`) && (await dialog(page).count()) === 1)
    if (code === 'DATASYNC_STORE_BUSY') await page.screenshot({ path: `${SHOTS}/retry-store-busy.png` })
    await page.locator('[data-control-close]').click()
    await until(page, async () => (await dialog(page).count()) === 0)
    await closeDrawer(page)
  }
  await refused(1, 'DATASYNC_STORE_BUSY', /Pause the store on ActionSync first, then retry this job/)
  await refused(2, 'DATASYNC_STORE_WPF_HOSTED', /can never be applied to/)
  await refused(5, 'DATASYNC_INVALID_STATE', /Nothing here can be retried any more.*cancelling or cancelled/)

  // ── 10: the header's Retry ──
  await header(page).locator('[data-control="Retry"]').click()
  await dialog(page).waitFor()
  const t10 = await dialogText(page)
  check('10. the header Retry dialog is titled for the campaign', /Retry the retryable jobs/.test(t10), t10)
  check('10. …counts the jobs and says finished tables are not redone', /Retry sends the 3 jobs/.test(t10) && /finished tables are not redone/.test(t10))
  await page.screenshot({ path: `${SHOTS}/retry-campaign-dialog.png` })
  await page.locator('[data-control-note]').fill('network blip at 03:10 is over')
  await page.locator('[data-control-confirm]').click()
  check('10. posts Campaigns/{id}/Retry with the note', await until(page, () => posts.some((x) => x.path === `DataSync/Campaigns/${RETRY_CID}/Retry` && x.body?.reason === 'network blip at 03:10 is over')), JSON.stringify(posts.at(-1)))
  check('10. the answer (Running, 0 retryable) drops the Retry button', await until(page, async () => (await dialog(page).count()) === 0 && JSON.stringify(await headerMoves(page)) === '["Pause","Cancel"]'), JSON.stringify(await headerMoves(page)))
  check('no page errors (retry)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10b: a campaign Retry refused INVALID_STATE ────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await openRetry({ refuseCampaignRetry: true })
  await header(page).locator('[data-control="Retry"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-control-confirm]').click()
  await page.locator('[data-control-error]').waitFor({ timeout: 10000 })
  check('10b. posts Campaigns/{id}/Retry with {} for a blank note', posts.some((x) => x.path === `DataSync/Campaigns/${RETRY_CID}/Retry` && JSON.stringify(x.body) === '{}'))
  check('10b. INVALID_STATE reads in Retry\'s words in the dialog', /Nothing here can be retried any more/.test(strip(await page.locator('[data-control-refusal]').innerText())) && (await page.locator('[data-control-error="DATASYNC_INVALID_STATE"]').count()) === 1)
  check('10b. …and the dialog stays open', (await dialog(page).count()) === 1)
  check('no page errors (retry refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11: a viewer sees no Retry ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await openRetry({ canOperate: false })
  check('11. a viewer sees no Retry in the header', (await header(page).locator('[data-control]').count()) === 0)
  await openDrawer(page, 0)
  check('11. …nor in a retryable job\'s drawer', (await page.locator('[data-job-drawer-footer]').count()) === 0 && (await page.locator('[data-control]').count()) === 0)
  check('no page errors (retry viewer)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
