// Data sync campaigns drive (ticket 559, spec 558) — drives the REAL /admin/data-sync page in
// Chromium against STUBBED `DataSync/*` envelopes, shaped from the OpenAPI draft
// (C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml)
// and the running service's [CODE] shapes (the Health 503 is enveloped with data and no code).
// 🚩 NOTHING here is driven against a live DataSync: ticket 566 is the live walk.
//
// It verifies:
//   1. the Admin menu shows the Data sync leaf when `screenAllowed` is true, the first read asks for
//      page 1 of 50, and the grid renders: a name linking to the campaign page, the profile's NAME
//      (resolved from Profiles), the mode and status in words, the jobs by state, the total and the
//      created time in LOCAL time (the browser runs in Asia/Riyadh, UTC+3);
//   2. the Profiles panel lists each profile's source and tables, with strategy, compare window and
//      whether each may be applied;
//   3. the status filter reaches the request (exact enum name), lands in the URL, and a short page
//      disables Next;
//   4. Next pages (page 2 of 50), Previous comes back, Next disables on the short last page;
//   5. a URL with a status and a page opens on them;
//   6. the service banner: none when healthy; worker off; stale tick; a 503 from Health;
//   7. the list refetches every 30 s;
//   8. with `screenAllowed: false` the leaf is hidden and the page guards itself, with no list read;
//   9. a row's link opens the campaign page (a placeholder until 560).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-campaigns-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-campaigns-shots'
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

const P_RECONCILE = '01JAZ8M4QX7R3T2V5W6Y9K0BCD'
const P_SEED = '01JAZ8N1DF4G6H8J0K2M3P5Q7R'
const P_GONE = '01JAZ8ZZZZZZZZZZZZZZZZZZZZ' // a campaign's profile no longer enabled: shows its raw id

const spec = (over) => ({
  table: 'dbo.Product',
  where: null,
  includeColumns: null,
  excludeColumns: null,
  applyAllowed: false,
  strategy: 'Reconcile',
  deletesAllowed: true,
  caseInsensitiveCompare: false,
  ...over,
})

const PROFILES = [
  {
    profileId: P_RECONCILE,
    name: 'HQ price-list → stores',
    source: { server: 'OMS-HQ', database: 'DMSCO' },
    tableSet: [
      spec({ table: 'dbo.Product', matchKeys: ['ProductId'], where: 'IsActive = 1', applyAllowed: true }),
      spec({ table: 'dbo.PriceList', matchKeys: ['PriceListId', 'ProductId'], applyAllowed: true, strategy: 'Seed' }),
    ],
    allowsApply: true,
  },
  {
    profileId: P_SEED,
    name: 'Report-only audit',
    source: { server: 'demo-source', database: 'DataSyncDemo_Source' },
    tableSet: [spec({ table: 'dbo.Customer' })],
    allowsApply: false,
  },
]

const STATUSES = ['Running', 'Completed', 'Ready', 'Paused', 'Cancelled', 'Completed', 'Completed']
// 60 campaigns, newest first: page 1 is a full 50, page 2 a short 10. Ids sort like ULIDs.
const CAMPAIGNS = Array.from({ length: 60 }, (_, i) => {
  const n = 60 - i
  const status = STATUSES[i % STATUSES.length]
  return {
    campaignId: `01JB2C9X4E6F8G0H1J3K5M7N${String(n).padStart(2, '0')}`,
    profileId: i === 2 ? P_GONE : i % 2 ? P_SEED : P_RECONCILE,
    name: i === 1 ? null : `Campaign ${n}`,
    mode: i % 2 ? 'ReportOnly' : 'Apply',
    source: { server: 'OMS-HQ', database: 'DMSCO' },
    tableSet: [],
    status,
    totalJobs: 48,
    jobsByState:
      status === 'Running'
        ? { queued: 10, running: 3, paused: 0, succeeded: 34, failed: 1, cancelled: 0 }
        : { queued: 0, running: 0, paused: 0, succeeded: 48, failed: 0, cancelled: 0 },
    reason: i % 2 ? null : 'Q4 price-list cutover approved in CR-2231.',
    // 09:00Z is 12:00 in Riyadh; one minute earlier per older campaign.
    createdAt: new Date(Date.parse('2026-10-24T09:00:00Z') - i * 60_000).toISOString().replace('.000Z', 'Z'),
    startedAt: null,
    finishedAt: null,
    asOf: '2026-10-24T09:05:00Z',
  }
})
const NEWEST = CAMPAIGNS[0].campaignId

const healthy = () => ({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() })

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true, canOperate: true }, health = 'ok', clock = false, othersOpen = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  if (clock) await page.clock.install({ time: new Date() })
  const errors = []
  const calls = [] // the Campaigns door's url.search, in order
  const counts = { campaigns: 0, access: 0 }
  page.on('pageerror', (e) => errors.push(String(e)))
  // 4xx/5xx console noise from stubbed refusals (the Health 503) is expected — filtered out.
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DataSync/Access') {
      counts.access++
      return route.fulfill(envelope(access))
    }
    if (p === 'DataSync/Health') {
      if (health === 'ok') return route.fulfill(envelope(healthy()))
      if (health === 'off') return route.fulfill(envelope({ ...healthy(), workerEnabled: false }))
      if (health === 'stale') return route.fulfill(envelope({ ...healthy(), lastWorkerTick: '2026-10-24T06:00:00Z' }))
      // [CODE] the 503: enveloped, success:false, NO error code, data still Health.
      return route.fulfill(
        envelope(
          { stateDb: 'Unreachable', workerEnabled: true, lastWorkerTick: null },
          { status: 503, success: false, message: 'The state database is unreachable.' },
        ),
      )
    }
    if (p === 'DataSync/Profiles') return route.fulfill(envelope(PROFILES))
    if (p === 'DataSync/Campaigns' && route.request().method() === 'GET') {
      counts.campaigns++
      calls.push(url.search)
      const pg = Number(url.searchParams.get('page') ?? 1)
      const size = Number(url.searchParams.get('pageSize') ?? 50)
      const status = url.searchParams.get('status')
      const rows = CAMPAIGNS.filter((c) => !status || c.status === status)
      return route.fulfill(envelope(rows.slice((pg - 1) * size, pg * size))) // plain array, no total
    }
    // Every OTHER feature's access probe: shut, or open to see the leaf among its siblings.
    if (/\/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: othersOpen, screenAllowed: othersOpen, allowed: othersOpen, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, counts }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitForCall = async (page, calls, want) => {
  for (let i = 0; i < 50; i++) {
    if (calls.includes(want)) return true
    await page.waitForTimeout(100)
  }
  return false
}
const cell = (page, id, col) => page.locator(`[data-campaigns-grid] [row-id="${id}"] [col-id="${col}"]`)
const cellText = async (page, id, col) => strip(await cell(page, id, col).first().innerText())

// ── 1–2, 9: the page, the grid, the profiles, a row's link ─────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ othersOpen: true })
  await page.goto(`${BASE}/admin/data-sync`)
  await page.locator(`[data-campaign-link="${NEWEST}"]`).waitFor({ timeout: 20000 })

  const adminLeaves = await page.locator('nav a[href^="/admin/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1. the Data sync leaf is in the Admin group', adminLeaves.includes('/admin/data-sync'), JSON.stringify(adminLeaves))
  check('1. the first read asks for page 1 of 50, no status', calls[0] === '?page=1&pageSize=50', calls[0])
  // The grid virtualises rows: scroll to its foot and look for the 50th (row-index 49) and no 51st.
  const box = await page.locator('[data-campaigns-grid]').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 10_000)
  await page.waitForTimeout(500)
  check('1. page 1 draws 50 rows',
    (await page.locator('[data-campaigns-grid] [row-index="49"]').count()) > 0 && (await page.locator('[data-campaigns-grid] [row-index="50"]').count()) === 0)
  await page.mouse.wheel(0, -10_000)
  await page.waitForTimeout(500)
  check('1. the row names the campaign', (await cellText(page, NEWEST, 'name')) === 'Campaign 60')
  const second = CAMPAIGNS[1].campaignId
  check('1. an unnamed campaign says so', (await cellText(page, second, 'name')) === '(unnamed)', await cellText(page, second, 'name'))
  check('1. the profile column shows the profile NAME', (await cellText(page, NEWEST, 'profile')) === 'HQ price-list → stores')
  check('1. a profile not in Profiles shows its raw id', (await cellText(page, CAMPAIGNS[2].campaignId, 'profile')) === P_GONE)
  check('1. the mode reads in words', (await cellText(page, NEWEST, 'mode')) === 'Apply' && (await cellText(page, second, 'mode')) === 'Report only')
  check('1. the status is a badge in words', (await cellText(page, NEWEST, 'status')) === 'Running' && (await cell(page, NEWEST, 'status').locator('[data-campaign-status="Running"]').count()) === 1)
  const buckets = await cell(page, NEWEST, 'jobsByState').locator('[data-bucket]').evaluateAll((els) => els.map((e) => e.getAttribute('data-bucket')))
  check('1. jobs by state lists only the non-empty buckets, in order', JSON.stringify(buckets) === '["queued","running","succeeded","failed"]', JSON.stringify(buckets))
  check('1. …each with its count', (await cellText(page, NEWEST, 'jobsByState')) === 'Queued 10 Running 3 Succeeded 34 Failed 1', await cellText(page, NEWEST, 'jobsByState'))
  check('1. the total jobs', (await cellText(page, NEWEST, 'totalJobs')) === '48')
  check('1. created shows LOCAL time (09:00Z → 12:00 Riyadh)', (await cellText(page, NEWEST, 'createdAt')) === '2026-10-24 12:00', await cellText(page, NEWEST, 'createdAt'))
  check('1. healthy service: no banner', (await page.locator('[data-service-banner]').count()) === 0)
  check('1. the pager reads Page 1, Previous off, Next on (a full page)',
    strip(await page.locator('[data-ds-page]').innerText()) === 'Page 1' &&
      (await page.locator('[data-ds-prev]').isDisabled()) &&
      !(await page.locator('[data-ds-next]').isDisabled()))

  // 2. Profiles
  const prof = page.locator(`[data-profile="${P_RECONCILE}"]`)
  check('2. both profiles are listed', (await page.locator('[data-profile]').count()) === 2)
  check('2. a profile shows its source', strip(await prof.locator('[data-profile-source]').innerText()) === 'OMS-HQ · DMSCO')
  const product = prof.locator('[data-profile-table="dbo.Product"]')
  check('2. a table shows its strategy, compare window and that it may be applied',
    strip(await product.innerText()) === 'dbo.Product Reconcile IsActive = 1 May be applied', strip(await product.innerText()))
  const price = prof.locator('[data-profile-table="dbo.PriceList"]')
  check('2. a Seed table with no window reads "Whole table"', strip(await price.innerText()) === 'dbo.PriceList Seed Whole table May be applied', strip(await price.innerText()))
  const audit = page.locator(`[data-profile="${P_SEED}"]`)
  check('2. a table that may not be applied reads Report only', (await audit.locator('[data-apply="no"]').count()) === 1 && /Report only/.test(await audit.innerText()))
  check('2. a profile with no appliable table says it runs report-only', /runs report-only/.test(await audit.innerText()))
  await page.screenshot({ path: `${SHOTS}/campaigns.png`, fullPage: true })

  // 9. the row's link
  await page.locator(`[data-campaign-link="${NEWEST}"]`).click()
  await page.locator(`[data-campaign-page="${NEWEST}"]`).waitFor({ timeout: 10000 })
  check('9. a row links to /admin/data-sync/campaigns/:campaignId', new URL(page.url()).pathname === `/admin/data-sync/campaigns/${NEWEST}`, page.url())
  check('no page errors (campaigns)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 3–4: the status filter and the pager ───────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/data-sync`)
  await page.locator(`[data-campaign-link="${NEWEST}"]`).waitFor({ timeout: 20000 })

  // 4. Next → page 2 (10 rows, short) → Next disabled → Previous back.
  await page.locator('[data-ds-next]').click()
  check('4. Next asks for page 2 of 50', await waitForCall(page, calls, '?page=2&pageSize=50'), JSON.stringify(calls))
  await page.locator('[data-ds-pager="2"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check('4. page 2 draws the short last 10', (await page.locator('[data-campaigns-grid] [data-campaign-link]').count()) === 10)
  check('4. the URL keeps the page', new URL(page.url()).search === '?page=2', page.url())
  check('4. on a short page Next is disabled, Previous enabled',
    (await page.locator('[data-ds-next]').isDisabled()) && !(await page.locator('[data-ds-prev]').isDisabled()))
  check('4. the readout says Page 2', strip(await page.locator('[data-ds-page]').innerText()) === 'Page 2')
  await page.locator('[data-ds-prev]').click()
  await page.locator('[data-ds-pager="1"]').waitFor({ timeout: 10000 })
  check('4. Previous comes back to page 1', calls.at(-1) === '?page=1&pageSize=50' && new URL(page.url()).search === '', `${calls.at(-1)} ${page.url()}`)

  // 3. the status filter, from page 2 → back on page 1.
  await page.locator('[data-ds-next]').click()
  await page.locator('[data-ds-pager="2"]').waitFor({ timeout: 10000 })
  await page.locator('[data-status-filter]').selectOption('Running')
  check('3. the status reaches the request by its exact name, on page 1', await waitForCall(page, calls, '?status=Running&page=1&pageSize=50'), JSON.stringify(calls))
  await page.waitForTimeout(400)
  check('3. the URL keeps the status', new URL(page.url()).search === '?status=Running', page.url())
  const statuses = await page.locator('[data-campaigns-grid] [data-campaign-status]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-campaign-status')))])
  check('3. only Running campaigns are drawn', JSON.stringify(statuses) === '["Running"]', JSON.stringify(statuses))
  check('3. a short filtered page: no pager on page 1', (await page.locator('[data-ds-pager]').count()) === 0)
  const sent = calls.length
  await page.locator('[data-status-filter]').selectOption('')
  for (let i = 0; i < 50 && calls.length === sent; i++) await page.waitForTimeout(100)
  check('3. Any status drops the parameter', calls.at(-1) === '?page=1&pageSize=50' && new URL(page.url()).search === '', `${calls.at(-1)} ${page.url()}`)
  await page.screenshot({ path: `${SHOTS}/filtered.png`, fullPage: true })
  check('no page errors (filter + pager)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: a link with a status and a page ─────────────────────────────────────────────────────────
{
  const { context, page, calls } = await open()
  await page.goto(`${BASE}/admin/data-sync?status=Completed&page=2`)
  await page.locator('[data-ds-pager="2"]').waitFor({ timeout: 20000 })
  check('5. a URL opens on its status and page', calls[0] === '?status=Completed&page=2&pageSize=50', calls[0])
  check('5. the filter shows the status', (await page.locator('[data-status-filter]').inputValue()) === 'Completed')
  await context.close()
}

// ── 6: the service banner ──────────────────────────────────────────────────────────────────────
for (const [health, kind, text] of [
  ['off', 'workerDisabled', /worker is turned off/],
  ['stale', 'workerStale', /has not ticked since 2026-10-24 09:00/],
  ['503', 'stateDbUnreachable', /state database is unreachable/],
]) {
  const { context, page, errors } = await open({ health })
  await page.goto(`${BASE}/admin/data-sync`)
  await page.locator('[data-service-banner]').waitFor({ timeout: 20000 })
  const banner = page.locator('[data-service-banner]')
  check(`6. ${health}: the ${kind} banner`, (await banner.getAttribute('data-service-banner')) === kind, await banner.getAttribute('data-service-banner'))
  check(`6. ${health}: …in words`, text.test(strip(await banner.innerText())), strip(await banner.innerText()))
  await page.locator(`[data-campaign-link="${NEWEST}"]`).waitFor({ timeout: 20000 })
  check(`6. ${health}: the campaigns still render under it`, true)
  if (health === '503') await page.screenshot({ path: `${SHOTS}/banner-503.png`, fullPage: true })
  check(`no page errors (banner ${health})`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: the 30 s refresh ────────────────────────────────────────────────────────────────────────
{
  const { context, page, counts } = await open({ clock: true })
  await page.goto(`${BASE}/admin/data-sync`)
  await page.locator(`[data-campaign-link="${NEWEST}"]`).waitFor({ timeout: 20000 })
  const before = counts.campaigns
  // 25 s, not 29: real time has already run on the installed clock while the page loaded.
  await page.clock.runFor(25_000)
  await page.waitForTimeout(200)
  const at25 = counts.campaigns
  await page.clock.runFor(6_000)
  await page.waitForTimeout(500)
  check('7. nothing refetches well before 30 s', at25 === before, `${before} → ${at25}`)
  check('7. the list refetches at 30 s', counts.campaigns > before, `${before} → ${counts.campaigns}`)
  await context.close()
}

// ── 8: no view grant ───────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, counts } = await open({ access: { screenAllowed: false, canOperate: false } })
  await page.goto(`${BASE}/admin/data-sync`)
  await page.getByText('No access to data sync').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('8. without the grant the leaf is hidden', (await page.locator('nav a[href="/admin/data-sync"]').count()) === 0)
  check('8. …and the page guards itself, with no list read', (await page.locator('[data-campaigns]').count()) === 0 && counts.campaigns === 0, `reads ${counts.campaigns}`)
  check('8. the leaf and the gate share one probe call', counts.access === 1, `access calls ${counts.access}`)
  await page.screenshot({ path: `${SHOTS}/denied.png`, fullPage: true })
  check('no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
