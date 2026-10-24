// Data sync hand-back drive (ticket 565, spec 558) — drives the REAL /admin/data-sync/campaigns/:id
// page in Chromium against STUBBED `DataSync/*` and `ActionSync/*` envelopes (DataSync shapes from the
// OpenAPI draft; ActionSync's control door from the sync console's door contract, BackOffice 2523).
// 🚩 NOTHING here is driven against a live DataSync or ActionSync: ticket 566 is the live walk.
//
// It verifies:
//   1. an Apply campaign (Running) offers "Hand back to ActionSync" to a holder of ActionSync.Operate;
//   2. opening it reads EVERY job of the campaign (all pages of 50, not just the one shown);
//   3. it pre-selects exactly the Succeeded + actionSyncResumable stores, lists every other store as
//      staying paused with why (failed / cancelled / in flight / not resumable), says how many jobs
//      are still in flight, and names the tag it sends;
//   4. confirm posts ONLY the ticked resumable stores to ActionSync/Stores/Control as `Resume`, in
//      batches of ≤ 50, each with reason `DataSync campaign <id>: <reason>`;
//   5. per-store results render: the stores back with ActionSync, and ActionSync's refusals in words;
//   6. a batch that fails outright stops the run and lists the stores never sent;
//   7. nothing shows without ActionSync.Operate, to a DataSync viewer (no DataSync.Operate) even with
//      ActionSync.Operate, on a report-only campaign, or on a Ready one.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-handback-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-handback-shots'
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
const REASON = 'Q4 price-list cutover approved in CR-2231; reconcile all stores to HQ.'
const TAG = `DataSync campaign ${CID}: ${REASON}`

const campaignOf = ({ mode = 'Apply', status = 'Running' } = {}) => ({
  campaignId: CID,
  profileId: PROFILE,
  name: 'Price-list refresh — all stores',
  mode,
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: [],
  status,
  totalJobs: TOTAL,
  jobsByState: { queued: 5, running: 14, paused: 0, succeeded: 82, failed: 14, cancelled: 14 },
  reason: mode === 'Apply' ? REASON : null,
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: status === 'Ready' ? null : '2026-10-24T09:01:00Z',
  finishedAt: null,
  asOf: '2026-10-24T09:05:00Z',
})

// 125 jobs → three pages of 50/50/25. Even i < 110: Succeeded + resumable (55 → two batches).
// Odd i by i % 8: 1 Failed, 3 Cancelled, 5 Running, 7 Succeeded but NOT resumable. Even i ≥ 110: Queued.
const TOTAL = 125
const code = (i) => `S${String(i).padStart(3, '0')}`
const jobId = (i) => `01JB2CA2R4S6T8V0W1X3Y5Z${String(i).padStart(3, '0')}`
const kindOf = (i) =>
  i % 2 === 0 ? (i < 110 ? 'resumable' : 'queued') : { 1: 'failed', 3: 'cancelled', 5: 'running', 7: 'notResumable' }[i % 8]
const STATUS = { resumable: 'Succeeded', queued: 'Queued', failed: 'Failed', cancelled: 'Cancelled', running: 'Running', notResumable: 'Succeeded' }
const makeJob = (i) => ({
  jobId: jobId(i),
  campaignId: CID,
  store: { client: '000', code: code(i) },
  target: { server: `10.12.0.${i}`, database: 'StorePOS' },
  status: STATUS[kindOf(i)],
  phase: kindOf(i) === 'running' ? 'Reconciling' : null,
  tableTasks: [],
  startedAt: '2026-10-24T09:01:00Z',
  finishedAt: null,
  failureReason: kindOf(i) === 'failed' ? 'StoreUnreachable' : null,
  attemptCount: 0,
  waitReason: null,
  notBefore: null,
  holdReason: null,
  actionSyncResumable: kindOf(i) === 'resumable',
})
const JOBS = Array.from({ length: TOTAL }, (_, i) => makeJob(i))
const idx = [...Array(TOTAL).keys()]
const RESUMABLE = idx.filter((i) => kindOf(i) === 'resumable').map(code)
const WHY = { failed: 'failed', cancelled: 'cancelled', running: 'inFlight', queued: 'inFlight', notResumable: 'notResumable' }
const EXPECT_STAY = idx.filter((i) => kindOf(i) !== 'resumable').map((i) => [code(i), WHY[kindOf(i)]])
const IN_FLIGHT = idx.filter((i) => ['running', 'queued'].includes(kindOf(i))).length

const browser = await chromium.launch()

async function open({ mode = 'Apply', status = 'Running', actionSyncOperate = true, dataSyncOperate = true, failSecondBatch = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const controls = []
  const jobPages = []
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
    if (p === 'DataSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate: dataSyncOperate }))
    if (p === 'ActionSync/Access')
      return route.fulfill(envelope({ screenAllowed: true, canOperate: actionSyncOperate, canOnboard: false, canEnrol: false, canReplay: false }))
    if (p === 'DataSync/Health') return route.fulfill(envelope({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() }))
    if (p === 'DataSync/Profiles') return route.fulfill(envelope([]))
    if (p === 'ActionSync/Stores/Control' && req.method() === 'POST') {
      const body = JSON.parse(req.postData())
      controls.push(body)
      if (failSecondBatch && controls.length === 2)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'ActionSync is unavailable.' }))
      return route.fulfill(
        envelope({
          auditId: `A-${controls.length}`,
          results: body.codes.map((c, k) =>
            c === 'S004' ? { code: c, ok: false, error: 'NOT_ON_WORKER', controlVersion: 7 } : { code: c, ok: true, error: null, controlVersion: 8 + k },
          ),
        }),
      )
    }
    if (p === `DataSync/Campaigns/${CID}`) return route.fulfill(envelope(campaignOf({ mode, status })))
    if (p === `DataSync/Campaigns/${CID}/Jobs`) {
      const pg = Number(url.searchParams.get('page') || 1)
      const size = Number(url.searchParams.get('pageSize') || 50)
      jobPages.push(pg)
      return route.fulfill(envelope(JOBS.slice((pg - 1) * size, pg * size)))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/admin/data-sync/campaigns/${CID}`)
  await page.locator(`[data-job-open="${jobId(0)}"]`).waitFor({ timeout: 20000 })
  return { context, page, errors, controls, jobPages }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (await pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const attrs = (page, sel, a) => page.locator(sel).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), a)

// ── 1–5: an operator hands back ─────────────────────────────────────────────────────────────────
{
  const { context, page, errors, controls, jobPages } = await open()
  const button = page.locator('[data-campaign-header] [data-hand-back]')
  check('1. an Apply campaign offers Hand back to ActionSync', await until(page, async () => (await button.count()) === 1))
  check('1. nothing is resumed before a person asks', controls.length === 0)
  const shownBefore = jobPages.length
  await button.click()
  await page.locator('[data-hand-back-ready]').waitFor({ timeout: 10000 })
  const read = jobPages.slice(shownBefore)
  check('2. opening it reads every page of jobs (1, 2, 3)', JSON.stringify(read) === '[1,2,3]', JSON.stringify(read))

  const picks = await attrs(page, '[data-hand-back-pick]', 'data-hand-back-pick')
  check(`3. pre-selects exactly the ${RESUMABLE.length} resumable stores`, JSON.stringify(picks) === JSON.stringify(RESUMABLE), `${picks.length}`)
  const ticked = await page.locator('[data-hand-back-pick]').evaluateAll((els) => els.every((e) => e.checked))
  check('3. …all ticked', ticked)
  const stay = await page.locator('[data-stay-paused]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-stay-paused'), e.getAttribute('data-why')]))
  check(`3. lists the other ${EXPECT_STAY.length} stores as staying paused, each with why`, JSON.stringify(stay) === JSON.stringify(EXPECT_STAY))
  const stayText = strip(await page.locator('[data-hand-back-stay]').innerText())
  check(
    '3. …in words (failed / cancelled / not finished / not resumable)',
    /000\/S001 its job failed/.test(stayText) &&
      /000\/S003 its job was cancelled/.test(stayText) &&
      /000\/S005 its job has not finished/.test(stayText) &&
      /000\/S007 not resumable: it was already paused before the campaign, ActionSync's control changed since the job began/.test(stayText),
  )
  check(
    `3. says ${IN_FLIGHT} jobs are still in flight`,
    (await page.locator(`[data-hand-back-in-flight="${IN_FLIGHT}"]`).count()) === 1 &&
      new RegExp(`${IN_FLIGHT} jobs are still in flight`).test(strip(await page.locator('[data-hand-back-in-flight]').innerText())),
  )
  check('3. names the tag it sends', strip(await page.locator('[data-hand-back-tag]').innerText()).includes(TAG))
  await page.screenshot({ path: `${SHOTS}/dialog.png`, fullPage: true })

  // Untick one store: it must not be sent.
  await page.locator('[data-hand-back-pick="S010"]').uncheck()
  const want = RESUMABLE.filter((c) => c !== 'S010')
  check(`4. the confirm counts the ticked stores (${want.length})`, (await page.locator(`[data-hand-back-confirm="${want.length}"]`).count()) === 1 && strip(await page.locator('[data-hand-back-confirm]').innerText()) === `Hand back ${want.length} stores`)
  await page.locator('[data-hand-back-confirm]').click()
  await page.locator('[data-hand-back-result]').waitFor({ timeout: 10000 })

  check('4. two batches were posted (50 + the rest)', controls.length === 2 && controls[0].codes.length === 50 && controls[1].codes.length === want.length - 50, controls.map((c) => c.codes.length).join('+'))
  check('4. every batch is a Resume', controls.every((c) => c.action === 'Resume'))
  check('4. every batch carries the campaign tag', controls.every((c) => c.reason === TAG), controls[0]?.reason)
  const sent = controls.flatMap((c) => c.codes)
  check('4. only the ticked resumable stores were posted', JSON.stringify(sent) === JSON.stringify(want))
  check('4. no stay-paused store was posted', !sent.some((c) => EXPECT_STAY.some(([s]) => s === c)) && !sent.includes('S010'))

  const ok = await attrs(page, '[data-hand-back-ok-store]', 'data-hand-back-ok-store')
  check(`5. the result lists the ${want.length - 1} stores back with ActionSync`, JSON.stringify(ok) === JSON.stringify(want.filter((c) => c !== 'S004')) && strip(await page.locator('[data-hand-back-ok]').innerText()).startsWith(`${want.length - 1} stores are back with ActionSync`))
  check('5. ActionSync\'s refusal reads in words', (await page.locator('[data-hand-back-refused] [data-apply-refused="S004"][data-error="NOT_ON_WORKER"]').count()) === 1 && /S004 not on the ActionSync worker/.test(strip(await page.locator('[data-hand-back-refused]').innerText())))
  check('5. the confirm is gone once sent (no double send)', (await page.locator('[data-hand-back-confirm]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/result.png`, fullPage: true })
  await page.locator('[data-hand-back-close]').click()
  check('5. Close closes the dialog', await until(page, async () => (await page.locator('[data-hand-back-dialog]').count()) === 0))
  check('no page errors (operator)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: a batch failing outright stops the run ───────────────────────────────────────────────────
{
  const { context, page, errors, controls } = await open({ failSecondBatch: true })
  await page.locator('[data-campaign-header] [data-hand-back]').click()
  await page.locator('[data-hand-back-ready]').waitFor({ timeout: 10000 })
  await page.locator('[data-hand-back-confirm]').click()
  await page.locator('[data-hand-back-result]').waitFor({ timeout: 10000 })
  const unsent = await attrs(page, '[data-hand-back-unsent-store]', 'data-hand-back-unsent-store')
  check('6. both batches were tried, the run stopped at the second', controls.length === 2)
  check('6. the second batch\'s stores are listed as not sent', JSON.stringify(unsent) === JSON.stringify(RESUMABLE.slice(50)), unsent.join(','))
  check('6. the first batch still shows as handed back', (await page.locator('[data-hand-back-ok-store]').count()) === 49)
  check('no page errors (failure)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: nothing without both Operate grants, on report-only, or on Ready ────────────────────────
for (const [label, opts] of [
  ['without ActionSync.Operate', { actionSyncOperate: false }],
  ['to a DataSync viewer who holds ActionSync.Operate', { dataSyncOperate: false, actionSyncOperate: true }],
  ['on a report-only campaign', { mode: 'ReportOnly' }],
  ['on a Ready campaign', { status: 'Ready' }],
]) {
  const { context, page, errors, controls } = await open(opts)
  await page.waitForTimeout(800)
  check(`7. no hand-back ${label}`, (await page.locator('[data-hand-back]').count()) === 0 && controls.length === 0)
  check(`no page errors (${label})`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
