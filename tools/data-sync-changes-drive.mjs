// Data sync Changes drive (ticket 562, spec 558) — drives the REAL /admin/data-sync/jobs/:jobId/changes
// view and the job drawer's link to it in Chromium against STUBBED `DataSync/*` envelopes, shaped from
// the OpenAPI draft (C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml:
// the `GET /Jobs/{jobId}/Changes` 200 and 410 examples) plus the demo's NULL-vs-"" row (ProductId 300).
// 🚩 NOTHING here is driven against a live DataSync: ticket 566 is the live walk.
//
// It verifies:
//   1. the drawer of a report-only job offers "Review changes" to a holder of Operate, and it opens the
//      view; the first read is page 1 of 50 with no filter;
//   2. rows render for each kind: Different → both sides for the differing columns only; SourceOnly →
//      the source side only; TargetOnly → the store side only; a NULL and an empty string have
//      distinct markers; the key reads `column · value`; the truncated notice names the capped table;
//   3. the table and kind filters reach the request and the URL; Next asks for page 2; a reload keeps
//      the filters; the truncated notice narrows to the filtered table;
//   4. no link on an Apply job's drawer, and none for a viewer (no Operate);
//   5. a viewer on the view's address sees the denial and the Changes door is never called;
//   6. 410 DATASYNC_MANIFEST_PRUNED says the rows were pruned and the counts remain;
//   7. a bare 403 from the Changes door shows the denial; an unknown job shows not-found;
//   8. 🚩 no row value reaches the console, localStorage or sessionStorage.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-changes-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-changes-shots'
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
const CID_R = '01JB2C9X4E6F8G0H1J3K5M7N9R' // report-only
const CID_A = '01JB2C9X4E6F8G0H1J3K5M7N9A' // apply
const J_R = '01JB2CA2R4S6T8V0W1X3Y5Z7R1'
const J_A = '01JB2CA2R4S6T8V0W1X3Y5Z7A1'
const J_PRUNED = '01JB2CA2R4S6T8V0W1X3Y5Z7P1'
const J_DENIED = '01JB2CA2R4S6T8V0W1X3Y5Z7D1'
const J_GONE = '01JB2CA2R4S6T8V0W1X3Y5ZZZZ'

const campaignOf = (campaignId, mode) => ({
  campaignId,
  profileId: PROFILE,
  name: mode === 'Apply' ? 'Product fix — Riyadh' : 'Product drift check',
  mode,
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: [],
  status: 'Completed',
  totalJobs: 1,
  jobsByState: { queued: 0, running: 0, paused: 0, succeeded: 1, failed: 0, cancelled: 0 },
  reason: mode === 'Apply' ? 'Fix drifted product names per CR-2240.' : null,
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: '2026-10-24T09:01:00Z',
  finishedAt: '2026-10-24T09:08:00Z',
  asOf: '2026-10-24T09:08:00Z',
})

const tt = (n, table, over = {}) => ({
  tableTaskId: `01JB2CA3B5C7D9E1F3G5H7J9${n}`,
  table,
  status: 'Succeeded',
  phase: null,
  disposition: 'ReportedOnly',
  strategy: 'Reconcile',
  rowsCompared: 1000,
  toInsert: 1,
  toUpdate: 2,
  toDelete: 1,
  rowsApplied: 0,
  chunksDone: 1,
  chunksTotal: 1,
  failureReason: null,
  manifestTruncated: false,
  ...over,
})

const jobOf = (jobId, campaignId, apply = false) => ({
  jobId,
  campaignId,
  store: { client: 'RIYADH', code: '0123' },
  target: { server: '10.12.0.123\\SQLEXPRESS', database: 'StorePOS' },
  status: 'Succeeded',
  phase: null,
  tableTasks: [
    tt('K1', 'dbo.Product', { manifestTruncated: true, disposition: apply ? 'Applied' : 'ReportedOnly' }),
    tt('K2', 'dbo.Category', { disposition: apply ? 'Applied' : 'ReportedOnly' }),
  ],
  startedAt: '2026-10-24T09:01:00Z',
  finishedAt: '2026-10-24T09:08:00Z',
  failureReason: null,
  attemptCount: 0,
  waitReason: null,
  notBefore: null,
  holdReason: null,
  actionSyncResumable: false,
})

const JOBS = {
  [J_R]: jobOf(J_R, CID_R),
  [J_A]: jobOf(J_A, CID_A, true),
  [J_PRUNED]: jobOf(J_PRUNED, CID_R),
  [J_DENIED]: jobOf(J_DENIED, CID_R),
}

const AT = '2026-10-24T09:07:12Z'
// The draft's two example rows, a TargetOnly row, the demo's NULL-vs-"" row, and a Category row.
const SHOWCASE = [
  { table: 'dbo.Product', kind: 'Different', key: { ProductId: 10452 }, sourceValues: { Name: 'McCavity Tea 250g' }, targetValues: { Name: 'Mccavity Tea 250g' }, capturedAt: AT },
  { table: 'dbo.Product', kind: 'SourceOnly', key: { ProductId: 10990 }, sourceValues: { Name: 'Oat Bar', Price: 4.5 }, targetValues: null, capturedAt: AT },
  { table: 'dbo.Product', kind: 'TargetOnly', key: { ProductId: 20001 }, sourceValues: null, targetValues: { Name: 'Retired Biscuit' }, capturedAt: AT },
  { table: 'dbo.Product', kind: 'Different', key: { ProductId: 300 }, sourceValues: { Notes: null }, targetValues: { Notes: '' }, capturedAt: AT },
  { table: 'dbo.Category', kind: 'Different', key: { CategoryId: 7 }, sourceValues: { Title: 'تمور' }, targetValues: { Title: 'Dates' }, capturedAt: AT },
]
// 50 + 3 rows in all, so page 1 of the unfiltered view comes back full.
const FILLER = Array.from({ length: 48 }, (_, i) => ({
  table: 'dbo.Product',
  kind: 'Different',
  key: { ProductId: 50000 + i },
  sourceValues: { Price: 10 + i },
  targetValues: { Price: 11 + i },
  capturedAt: AT,
}))
const ALL_ROWS = [...SHOWCASE, ...FILLER]

const browser = await chromium.launch()

async function open({ canOperate = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const consoleText = []
  const calls = { changes: [] }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    consoleText.push(m.text())
    if (m.type() === 'error' && !/status of [45]\d\d/.test(m.text())) errors.push(m.text())
  })
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DataSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate }))
    if (p === 'DataSync/Health') return route.fulfill(envelope({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() }))
    if (p === 'DataSync/Profiles') return route.fulfill(envelope([{ profileId: PROFILE, name: 'Products', source: { server: 'OMS-HQ', database: 'DMSCO' }, tableSet: [], allowsApply: true }]))
    for (const [cid, mode] of [[CID_R, 'ReportOnly'], [CID_A, 'Apply']]) {
      if (p === `DataSync/Campaigns/${cid}`) return route.fulfill(envelope(campaignOf(cid, mode)))
      if (p === `DataSync/Campaigns/${cid}/Jobs`) return route.fulfill(envelope(Object.values(JOBS).filter((j) => j.campaignId === cid)))
    }
    const m = /^DataSync\/Jobs\/([^/]+)(\/Changes)?$/.exec(p)
    if (m) {
      const [, id, changes] = m
      const job = JOBS[id]
      if (!job) return route.fulfill(refusal(404, 'DATASYNC_JOB_NOT_FOUND', 'DS-0404-02', 'Job not found.', `No job ${id}.`))
      if (!changes) return route.fulfill(envelope(job))
      calls.changes.push({ id, search: url.search })
      if (!canOperate || id === J_DENIED) return route.fulfill({ status: 403, body: '' })
      if (id === J_PRUNED)
        return route.fulfill(refusal(410, 'DATASYNC_MANIFEST_PRUNED', 'DS-0410-01', 'Row-level changes for this job have been pruned.', 'Manifest rows are kept 30 days; summary counts remain on the job.'))
      if (id === J_A) return route.fulfill(envelope([]))
      const table = url.searchParams.get('table')
      const kind = url.searchParams.get('kind')
      const pg = Number(url.searchParams.get('page') ?? 1)
      const size = Number(url.searchParams.get('pageSize') ?? 50)
      const rows = ALL_ROWS.filter((r) => (!table || r.table.toLowerCase() === table.toLowerCase()) && (!kind || r.kind.toLowerCase() === kind.toLowerCase()))
      return route.fulfill(envelope(rows.slice((pg - 1) * size, pg * size)))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, consoleText, calls }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const changesUrl = (id) => `${BASE}/admin/data-sync/jobs/${id}/changes`
const valuesOf = (page, productId) =>
  page.locator('[data-changes-grid] .ag-row').filter({ has: page.locator('[data-change-key]', { hasText: `ProductId · ${productId}` }) }).locator('[data-change-values]')

// ── 1 + 2 + 8: the link, the rows, nothing kept ───────────────────────────────────────────────
{
  const { context, page, errors, consoleText, calls } = await open()
  await page.goto(`${BASE}/admin/data-sync/campaigns/${CID_R}?job=${J_R}`)
  await page.locator('[data-job-drawer-footer]').waitFor({ timeout: 20000 })
  const link = page.locator(`[data-changes-link="${J_R}"]`)
  check('1. a report-only job\'s drawer offers the Changes link to Operate', (await link.count()) === 1)
  check('1. …in words', strip(await link.innerText()) === 'Review changes', strip(await link.innerText()))
  await page.screenshot({ path: `${SHOTS}/drawer-link.png` })
  await link.click()
  await page.locator('[data-changes-grid] .ag-row').first().waitFor({ timeout: 20000 })
  check('1. the link opens the view', new URL(page.url()).pathname === `/admin/data-sync/jobs/${J_R}/changes`, page.url())
  check('1. the first read is page 1 of 50, no filter', calls.changes[0]?.search === '?page=1&pageSize=50', calls.changes[0]?.search)
  check('1. the view names the job\'s store', strip(await page.locator('[data-changes-job] h2').innerText()) === 'RIYADH/0123')
  check('1. …and leads back to the campaign with the drawer open', (await page.locator(`[data-changes-back][href="/admin/data-sync/campaigns/${CID_R}?job=${J_R}"]`).count()) === 1)

  const diff = valuesOf(page, 10452)
  check('2. Different: the key reads column · value', (await page.locator('[data-change-key]', { hasText: 'ProductId · 10452' }).count()) === 1)
  check('2. Different: the source value', strip(await diff.locator('[data-change-text="source"]').innerText()) === 'McCavity Tea 250g')
  check('2. Different: the store value beside it', strip(await diff.locator('[data-change-text="target"]').innerText()) === 'Mccavity Tea 250g')
  check('2. Different: only the differing column', (await diff.locator('[data-change-column]').count()) === 1 && (await diff.locator('[data-change-column="Name"]').count()) === 1)
  check('2. Different: the kind in words', (await page.locator('[data-changes-grid] .ag-row [col-id="kind"]', { hasText: 'Different' }).count()) >= 1)

  const src = valuesOf(page, 10990)
  check('2. SourceOnly: both of its columns, source side only', (await src.locator('[data-change-text="source"]').count()) === 2 && (await src.locator('[data-change-text="target"]').count()) === 0)
  check('2. SourceOnly: the store side says not at store', (await src.locator('[data-change-absent="target"]').count()) === 2)
  check('2. SourceOnly: a number reads as written', (await src.locator('[data-change-column="Price"] [data-change-text="source"]').innerText()) === '4.5')
  check('2. SourceOnly: kind "Only at source"', (await page.locator('[data-changes-grid] .ag-row [col-id="kind"]', { hasText: 'Only at source' }).count()) === 1)

  const tgt = valuesOf(page, 20001)
  check('2. TargetOnly: the store side only', (await tgt.locator('[data-change-text="target"]').count()) === 1 && (await tgt.locator('[data-change-text="source"]').count()) === 0 && (await tgt.locator('[data-change-absent="source"]').count()) === 1)
  check('2. TargetOnly: kind "Only at store"', (await page.locator('[data-changes-grid] .ag-row [col-id="kind"]', { hasText: 'Only at store' }).count()) === 1)

  const nul = valuesOf(page, 300)
  check('2. a NULL shows a NULL marker', strip(await nul.locator('[data-change-null="source"]').innerText()) === 'NULL')
  check('2. …an empty string its own marker, not NULL', strip(await nul.locator('[data-change-empty="target"]').innerText()) === '(empty)' && (await nul.locator('[data-change-null="target"]').count()) === 0)
  check('2. free-text values are isolated as <bdi>', (await diff.locator('bdi[data-change-text]').count()) === 2)

  const trunc = page.locator('[data-changes-truncated]')
  check('2. the truncated notice says the counts are exact', /counts are exact, but the rows stop at the cap/.test(strip(await trunc.innerText())))
  check('2. …and names the capped table only', (await trunc.locator('[data-truncated-table="dbo.Product"]').count()) === 1 && (await trunc.locator('[data-truncated-table]').count()) === 1)
  check('2. a full page enables Next', await page.locator('[data-ds-next]').isEnabled())
  check('2. no export or download affordance', (await page.locator('[data-changes-page] :is(a[download], [data-export], button:has-text("Export"), button:has-text("CSV"))').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/changes.png`, fullPage: true })

  // ── 3: filters + paging in the URL ──
  await page.locator('[data-changes-table-filter]').selectOption('dbo.Category')
  check('3. the table filter reaches the request', await until(page, () => calls.changes.some((c) => c.search === '?table=dbo.Category&page=1&pageSize=50')), calls.changes.map((c) => c.search).join(' '))
  await page.locator('[data-changes-grid] [data-change-key]', { hasText: 'CategoryId · 7' }).waitFor({ timeout: 10000 })
  check('3. …and lands in the URL', new URL(page.url()).searchParams.get('table') === 'dbo.Category', page.url())
  check('3. the truncated notice is gone for an uncapped table', (await page.locator('[data-changes-truncated]').count()) === 0)
  check('3. an Arabic value is drawn isolated', strip(await page.locator('[data-change-column="Title"] [data-change-text="source"]').innerText()) === 'تمور')

  await page.locator('[data-changes-table-filter]').selectOption('dbo.Product')
  await page.locator('[data-changes-kind-filter]').selectOption('TargetOnly')
  check('3. the kind filter reaches the request by its name', await until(page, () => calls.changes.some((c) => c.search === '?table=dbo.Product&kind=TargetOnly&page=1&pageSize=50')), calls.changes.map((c) => c.search).join(' '))
  await page.waitForFunction(() => document.querySelectorAll('[data-changes-grid] .ag-row').length === 1, null, { timeout: 10000 })
  check('3. …only that kind is shown', (await page.locator('[data-changes-grid] [data-change-values="TargetOnly"]').count()) === 1)
  check('3. both filters in the URL', new URL(page.url()).search === '?table=dbo.Product&kind=TargetOnly', new URL(page.url()).search)

  await page.reload()
  await page.locator('[data-changes-grid] .ag-row').first().waitFor({ timeout: 20000 })
  check('3. a reload keeps the filters', (await page.locator('[data-changes-table-filter]').inputValue()) === 'dbo.Product' && (await page.locator('[data-changes-kind-filter]').inputValue()) === 'TargetOnly')

  await page.locator('[data-changes-kind-filter]').selectOption('')
  await page.locator('[data-changes-table-filter]').selectOption('')
  await until(page, () => calls.changes.filter((c) => c.search === '?page=1&pageSize=50').length >= 2)
  await page.waitForFunction(() => document.querySelectorAll('[data-changes-grid] .ag-row').length === 50, null, { timeout: 10000 })
  await page.locator('[data-ds-next]:not([disabled])').click()
  check('3. Next asks for page 2', await until(page, () => calls.changes.some((c) => c.search === '?page=2&pageSize=50')), calls.changes.map((c) => c.search).join(' '))
  await page.waitForFunction(() => document.querySelectorAll('[data-changes-grid] .ag-row').length === 3, null, { timeout: 10000 })
  check('3. …and keeps it in the URL', new URL(page.url()).searchParams.get('page') === '2')
  check('3. a short page disables Next', !(await page.locator('[data-ds-next]').isEnabled()))

  // ── 8 ──
  const leaked = (s) => /McCavity|Mccavity|Oat Bar|Retired Biscuit/.test(s)
  check('8. no row value reached the console', !consoleText.some(leaked), consoleText.filter(leaked).join(' | '))
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  check('8. no row value in localStorage or sessionStorage', !leaked(stored))
  check('no page errors (changes)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: no link on an Apply job, none for a viewer ──────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/admin/data-sync/campaigns/${CID_A}?job=${J_A}`)
  await page.locator('[data-job-drawer] [data-table-tasks-grid]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('4. an Apply job\'s drawer has no Changes link', (await page.locator('[data-changes-link]').count()) === 0)
  check('no page errors (apply)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open({ canOperate: false })
  await page.goto(`${BASE}/admin/data-sync/campaigns/${CID_R}?job=${J_R}`)
  await page.locator('[data-job-drawer] [data-table-tasks-grid]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('4. a viewer sees no Changes link on a report-only job', (await page.locator('[data-changes-link]').count()) === 0)

  // ── 5: a viewer on the address ──
  await page.goto(changesUrl(J_R))
  await page.getByText('No access to changes').waitFor({ timeout: 20000 })
  check('5. a viewer on the view\'s address sees the denial', (await page.locator('[data-changes-grid]').count()) === 0)
  check('5. …and the Changes door is never called', calls.changes.length === 0, String(calls.changes.length))
  check('no page errors (viewer)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6 + 7: pruned, bare 403, not found ─────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(changesUrl(J_PRUNED))
  await page.locator('[data-changes-pruned]').waitFor({ timeout: 20000 })
  check('6. a pruned manifest says the rows were pruned', /pruned after the retention window/.test(strip(await page.locator('[data-changes-pruned]').innerText())))
  check('6. …and that the counts remain on the job', /counts remain on the job/.test(strip(await page.locator('[data-changes-pruned]').innerText())))
  check('6. …with no grid and no error banner', (await page.locator('[data-changes-grid]').count()) === 0 && (await page.locator('[data-changes-page] [role="alert"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/pruned.png`, fullPage: true })

  await page.goto(changesUrl(J_DENIED))
  await page.locator('[data-changes-denied]').waitFor({ timeout: 20000 })
  check('7. a bare 403 from the door shows the denial', /No access to changes/.test(strip(await page.locator('[data-changes-denied]').innerText())))

  await page.goto(changesUrl(J_GONE))
  await page.locator('[data-changes-not-found]').waitFor({ timeout: 20000 })
  check('7. an unknown job shows not-found', /Job not found/.test(strip(await page.locator('[data-changes-not-found]').innerText())))
  check('no page errors (pruned/denied/not found)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
