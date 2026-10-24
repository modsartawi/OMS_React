// Data sync create drive (ticket 561, spec 558) — drives the REAL /admin/data-sync page's New
// campaign dialog and the campaign page's Start in Chromium against STUBBED `DataSync/*`
// envelopes, shaped from the OpenAPI draft
// (C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml:
// CreateCampaignRequest, the Campaign 201 example) and the running service's [CODE] refusals
// (`Refusal.cs`: summary in `message`, the detail in `errors[0].errorMessage`).
// 🚩 NOTHING here is driven against a live DataSync: ticket 566 is the live walk. Stores are sent
// by `{ code }` alone (DataSync ask A, not built: the live door would refuse them with a 400).
//
// It verifies:
//   1. an operator's New campaign: Create waits for a profile; the profile's tables are listed and
//      all ticked; the whole fleet → the exact body (no tables, fleet:'all', name trimmed); the
//      dialog closes onto the new campaign's page, Ready, with Start; Start posts and the status
//      moves to Running, and Start is gone;
//   2. pasted stores: a malformed code is flagged with its line and blocks Create; fixed, the codes
//      are split on lines, commas and tabs and de-duplicated; one table unticked → the body carries
//      the ticked tables in the profile's order and the stores as { code };
//   3. each create refusal shows in the dialog in words (the unknown store and the table named) with
//      its code, and the dialog keeps what was typed;
//   4. a Start refused 409 DATASYNC_INVALID_STATE shows in words;
//   5. a viewer (no canOperate) sees no New campaign and no Start;
//   6. a bare 403 from the create door hides the button.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-create-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-create-shots'
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

const P_REPORT = '01JAZ8M4QX7R3T2V5W6Y9K0BCD'
const NEW_ID = '01JB2C9X4E6F8G0H1J3K5M7N9P'

const spec = (table) => ({
  table,
  where: null,
  includeColumns: null,
  excludeColumns: null,
  applyAllowed: false,
  strategy: 'Reconcile',
  deletesAllowed: true,
  caseInsensitiveCompare: false,
})
const PROFILES = [
  {
    profileId: P_REPORT,
    name: 'HQ catalogue → stores',
    source: { server: 'OMS-HQ', database: 'DMSCO' },
    tableSet: [spec('dbo.Category'), spec('dbo.Product'), spec('dbo.PriceList')],
    allowsApply: false,
  },
]

const campaignOf = (status, body) => ({
  campaignId: NEW_ID,
  profileId: P_REPORT,
  name: body?.name ?? null,
  mode: 'ReportOnly',
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: PROFILES[0].tableSet,
  status,
  totalJobs: 3,
  jobsByState: { queued: status === 'Ready' ? 3 : 2, running: status === 'Ready' ? 0 : 1, paused: 0, succeeded: 0, failed: 0, cancelled: 0 },
  reason: null,
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: status === 'Ready' ? null : '2026-10-24T09:01:00Z',
  finishedAt: null,
  asOf: '2026-10-24T09:01:00Z',
})

// The create refusals as [CODE] `Refusal.cs` sends them.
const CREATE_REFUSALS = {
  DATASYNC_PROFILE_NOT_FOUND: [404, 'DS-0404-01', 'Profile not found.', `No enabled profile ${P_REPORT}.`],
  DATASYNC_TABLE_NOT_IN_PROFILE: [422, 'DS-0422-03', 'Only tables already in the profile can be selected.', "dbo.PriceList is not in profile 'HQ catalogue → stores'; ask an admin to add it."],
  DATASYNC_UNKNOWN_STORE: [422, 'DS-0422-04', 'Unknown target store.', '000/P003 is not in DistributionLocation.'],
  DATASYNC_SOURCE_UNAVAILABLE: [422, 'DS-0422-05', "The profile's source is not available to this service.", 'No DataSync:Sources entry for OMS-HQ/DMSCO.'],
  DATASYNC_INVALID_REQUEST: [400, 'DS-0400-01', 'The request is malformed.', 'every storeCodes entry needs a client and a code.'],
}

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true, canOperate: true } } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const posts = { create: [], start: [] }
  const state = { status: null, body: null, createRefusal: null, createDenied: false, startRefusal: false }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const method = route.request().method()
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DataSync/Access') return route.fulfill(envelope(access))
    if (p === 'DataSync/Health') return route.fulfill(envelope({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() }))
    if (p === 'DataSync/Profiles') return route.fulfill(envelope(PROFILES))
    if (p === 'DataSync/Campaigns' && method === 'POST') {
      const body = route.request().postDataJSON()
      posts.create.push(body)
      if (state.createDenied) return route.fulfill({ status: 403, body: '' })
      const r = state.createRefusal && CREATE_REFUSALS[state.createRefusal]
      if (r) return route.fulfill(refusal(r[0], state.createRefusal, r[1], r[2], r[3]))
      state.status = 'Ready'
      state.body = body
      return route.fulfill(envelope(campaignOf('Ready', body), { status: 201, message: 'Campaign created.' }))
    }
    if (p === 'DataSync/Campaigns' && method === 'GET') return route.fulfill(envelope(state.status ? [campaignOf(state.status, state.body)] : []))
    if (p === `DataSync/Campaigns/${NEW_ID}/Start` && method === 'POST') {
      posts.start.push(route.request().postData())
      if (state.startRefusal) {
        state.status = 'Running' // someone else started it first
        return route.fulfill(refusal(409, 'DATASYNC_INVALID_STATE', 'DS-0409-01', 'Start is not valid from status Running.', `Campaign ${NEW_ID} is Running.`))
      }
      state.status = 'Running'
      return route.fulfill(envelope(campaignOf('Running', state.body)))
    }
    if (p === `DataSync/Campaigns/${NEW_ID}`) return route.fulfill(envelope(campaignOf(state.status ?? 'Ready', state.body)))
    if (p === `DataSync/Campaigns/${NEW_ID}/Jobs`) return route.fulfill(envelope([]))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, posts, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const LIST = `${BASE}/admin/data-sync`
const CAMPAIGN = `/admin/data-sync/campaigns/${NEW_ID}`

async function openDialog(page) {
  await page.goto(LIST)
  await page.locator('[data-create-open]').waitFor({ timeout: 20000 })
  await page.locator('[data-create-open]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-create-profile]').waitFor({ timeout: 10000 })
  return dialog
}

// ── 1: the whole fleet, then Start ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  const dialog = await openDialog(page)
  check('1. the dialog is titled New campaign', strip(await dialog.locator('#modal-title').innerText()) === 'New campaign')
  check('1. Create waits for a profile', await dialog.locator('[data-create-submit]').isDisabled())
  check('1. the mode is report-only', (await dialog.locator('[data-create-mode="ReportOnly"]').count()) === 1)
  await dialog.locator('[data-create-profile]').selectOption(P_REPORT)
  const boxes = dialog.locator('[data-create-tables] input[type="checkbox"]')
  check('1. the profile lists its tables', (await boxes.count()) === 3)
  check('1. …all ticked by default', (await boxes.evaluateAll((els) => els.every((e) => e.checked))) === true)
  check('1. the whole fleet is the default target', await dialog.locator('[data-create-target="fleet"]').isChecked())
  await dialog.locator('[data-create-name]').fill('  Weekly drift check  ')
  await page.screenshot({ path: `${SHOTS}/dialog-fleet.png` })
  check('1. Create is ready', !(await dialog.locator('[data-create-submit]').isDisabled()))
  await dialog.locator('[data-create-submit]').click()
  await until(page, () => posts.create.length === 1)
  check(
    '1. the create posts the exact body (no tables, fleet all, name trimmed)',
    JSON.stringify(posts.create[0]) === JSON.stringify({ profileId: P_REPORT, mode: 'ReportOnly', targets: { fleet: 'all' }, name: 'Weekly drift check' }),
    JSON.stringify(posts.create[0]),
  )
  await page.locator('[data-campaign-header]').waitFor({ timeout: 10000 })
  check('1. the dialog closes onto the campaign page', new URL(page.url()).pathname === CAMPAIGN && (await page.locator('dialog[open]').count()) === 0, page.url())
  check('1. …which is Ready', (await page.locator('[data-campaign-header] [data-campaign-status="Ready"]').count()) === 1)
  check('1. …and offers Start', (await page.locator('[data-start-campaign]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/ready.png`, fullPage: true })
  await page.locator('[data-start-campaign]').click()
  await until(page, () => posts.start.length === 1)
  check('1. Start posts to Campaigns/{id}/Start', posts.start.length === 1)
  await page.locator('[data-campaign-header] [data-campaign-status="Running"]').waitFor({ timeout: 10000 })
  check('1. the status moves to Running', (await page.locator('[data-campaign-header] [data-campaign-status="Running"]').count()) === 1)
  check('1. …and Start is gone', (await page.locator('[data-start-campaign]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/running.png`, fullPage: true })
  check('no page errors (fleet + start)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2 + 3: pasted stores, then each refusal ─────────────────────────────────────────────────────
{
  const { context, page, errors, posts, state } = await open()
  const dialog = await openDialog(page)
  await dialog.locator('[data-create-profile]').selectOption(P_REPORT)
  await dialog.locator('[data-create-table="dbo.Product"]').uncheck()
  await dialog.locator('[data-create-target="stores"]').check()
  const codes = dialog.locator('[data-create-codes]')
  await codes.fill('P003\nP001, p003\tP002\nP 9')
  await dialog.locator('[data-create-malformed]').waitFor({ timeout: 5000 })
  check('2. a malformed code is flagged with its line', strip(await dialog.locator('[data-malformed-line="3"]').innerText()) === 'Line 3: P 9', strip(await dialog.locator('[data-create-malformed]').innerText()))
  check('2. …and blocks Create', await dialog.locator('[data-create-submit]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/malformed.png` })
  await codes.fill('P003\nP001, p003\tP002\n')
  check('2. fixed, the codes are counted once each', (await dialog.locator('[data-create-codes-count="3"]').count()) === 1 && /^3 stores/.test(strip(await dialog.locator('[data-create-codes-count]').innerText())), strip(await dialog.locator('[data-create-codes-count]').innerText()))
  check('2. …and the repeat is said to be dropped', (await dialog.locator('[data-create-duplicates="1"]').count()) === 1)
  check('2. no malformed list remains', (await dialog.locator('[data-create-malformed]').count()) === 0)

  // ── 3: each refusal shows in the dialog, in words ──
  const WORDS = {
    DATASYNC_PROFILE_NOT_FOUND: 'This profile no longer exists or has been disabled. Choose another profile.',
    DATASYNC_TABLE_NOT_IN_PROFILE: "The table dbo.PriceList is not in this profile. Reopen the dialog to see the profile's current tables.",
    DATASYNC_UNKNOWN_STORE: "The store 000/P003 is not in HQ's store list. Remove it and create again.",
    DATASYNC_SOURCE_UNAVAILABLE: "This profile's HQ source is not available to DataSync. Ask an administrator to configure it.",
    DATASYNC_INVALID_REQUEST: 'DataSync could not read this request. Check the stores and tables and try again.',
  }
  for (const [code, words] of Object.entries(WORDS)) {
    state.createRefusal = code
    const n = posts.create.length
    await dialog.locator('[data-create-submit]').click()
    await until(page, () => posts.create.length === n + 1)
    await dialog.locator(`[data-create-error="${code}"]`).waitFor({ timeout: 5000 })
    const said = strip(await dialog.locator('[data-create-refusal]').innerText())
    check(`3. ${code} shows in the dialog in words`, said === words, said)
    if (code === 'DATASYNC_UNKNOWN_STORE') await page.screenshot({ path: `${SHOTS}/unknown-store.png` })
  }
  check(
    '2. the body carries the ticked tables in profile order and the stores by code',
    JSON.stringify(posts.create[0]) ===
      JSON.stringify({ profileId: P_REPORT, mode: 'ReportOnly', targets: { storeCodes: [{ code: 'P003' }, { code: 'P001' }, { code: 'P002' }] }, tables: ['dbo.Category', 'dbo.PriceList'] }),
    JSON.stringify(posts.create[0]),
  )
  check('3. the dialog stays open and keeps the codes', (await page.locator('dialog[open]').count()) === 1 && (await codes.inputValue()) === 'P003\nP001, p003\tP002\n')
  check('no page errors (stores + refusals)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: a Start refused ─────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, state } = await open()
  state.status = 'Ready'
  state.startRefusal = true
  await page.goto(`${BASE}${CAMPAIGN}`)
  await page.locator('[data-start-campaign]').waitFor({ timeout: 20000 })
  await page.locator('[data-start-campaign]').click()
  await page.locator('[data-start-error="DATASYNC_INVALID_STATE"]').waitFor({ timeout: 10000 })
  check('4. a 409 on Start shows in words', strip(await page.locator('[data-start-refusal]').innerText()) === 'The campaign is no longer Ready, so it cannot be started. The page shows its current status.')
  await page.locator('[data-campaign-header] [data-campaign-status="Running"]').waitFor({ timeout: 10000 })
  check('4. …the page is re-read and shows the real status, without Start', (await page.locator('[data-start-campaign]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/start-refused.png`, fullPage: true })
  check('no page errors (start refused)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: a viewer ────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, state } = await open({ access: { screenAllowed: true, canOperate: false } })
  await page.goto(LIST)
  await page.locator('[data-campaigns]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  check('5. a viewer has no New campaign button', (await page.locator('[data-create-open]').count()) === 0)
  state.status = 'Ready'
  await page.goto(`${BASE}${CAMPAIGN}`)
  await page.locator('[data-campaign-header] [data-campaign-status="Ready"]').waitFor({ timeout: 20000 })
  check('5. …and no Start on a Ready campaign', (await page.locator('[data-start-campaign]').count()) === 0)
  check('no page errors (viewer)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: a bare 403 hides the button ─────────────────────────────────────────────────────────────
{
  const { context, page, errors, state } = await open()
  state.createDenied = true
  const dialog = await openDialog(page)
  await dialog.locator('[data-create-profile]').selectOption(P_REPORT)
  await dialog.locator('[data-create-submit]').click()
  await page.waitForTimeout(800)
  check('6. a bare 403 closes the dialog and hides New campaign', (await page.locator('dialog[open]').count()) === 0 && (await page.locator('[data-create-open]').count()) === 0)
  check('no page errors (bare 403)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
