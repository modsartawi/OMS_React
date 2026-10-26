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
  ...SHOWCASE[i],
})

const browser = await chromium.launch()

async function open({ canOperate = true, campaignId = CID, campaignStatus = 'Running', bare403 = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const posts = []
  const state = { campaign: campaignOf(campaignId, campaignStatus), jobs: SHOWCASE.map((_, i) => makeJob(i, campaignId)) }
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
      let m = p.match(/^DataSync\/Campaigns\/([^/]+)\/(Pause|Resume|Cancel)$/)
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

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
