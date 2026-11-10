// Data sync re-run drive (tickets 864 + 865, spec 863) — drives the REAL campaign page's *New campaign from
// failed (N)* in Chromium against STUBBED `DataSync/*` envelopes, shaped from the DataSync change of
// the same ticket (`GET /Campaigns/{id}/RerunTargets` → RerunOffer; `rerunOf` on create;
// `rerunOf` / `rerunBy` / `rerunnableJobs` / `rerunnableWpfHostedJobs` on the Campaign read model).
// 🚩 NOTHING here is driven against a live DataSync: ticket 566 is the live walk.
//
// It verifies:
//   1. an operator on a campaign with failed stores sees New campaign from failed (N), N = the
//      campaign's rerunnableJobs (the offer is NOT read until the click); the dialog opens pre-filled: the profile shown and locked, the offer's stores as
//      codes, the union of their unfinished tables ticked (the others not), the original's mode,
//      an empty reason; Create posts the exact body WITH rerunOf; the new campaign's page shows
//      Re-run of <original> as a link, and the original then shows Re-run by <new> with its status;
//   2. an Apply original: N leaves the WPF-hosted store out; so does the pre-fill, naming it in a
//      note; the mode starts Apply and the reason is empty. Switching to report only puts the store
//      back and drops the note; back to Apply drops it again; unticking every table (the mode falls
//      back to report only) puts it back too;
//   3. rerunnableJobs 0 → no button (and no offer read); an Apply campaign whose only failures are
//      WPF-hosted → no button either;
//   4. a viewer (no canOperate) sees the Re-run of / Re-run by links but no button;
//   5. (865) a second click on an original whose first re-run holds two stores: N is smaller, the
//      dialog pre-fills only the free store and names each held store with its re-run; putting a
//      held store back is refused 422 DATASYNC_STORE_IN_LIVE_RERUN, shown as a sentence naming it;
//   6. an Apply re-run's create ends on its outcome, and the outcome stays up although the original's
//      rerunnableJobs drops to 0 under it (the button goes, the dialog does not).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-rerun-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-rerun-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// ── Stubs ───────────────────────────────────────────────────────────────────────────────────────

const PROFILE = '01JAZ8M4QX7R3T2V5W6Y9K0BCD'
const ORIG = '01JB2C9X4E6F8G0H1J3K5M7N9P'
const NEW_ID = '01JB3D0Y5F7G9H1J2K4M6N8P0Q'

const spec = (table) => ({
  table,
  where: null,
  includeColumns: null,
  excludeColumns: null,
  applyAllowed: true,
  strategy: 'Reconcile',
  deletesAllowed: true,
  caseInsensitiveCompare: false,
})
const TABLES = ['dbo.Category', 'dbo.Product', 'dbo.PriceList', 'dbo.Supplier']
const PROFILES = [{ profileId: PROFILE, name: 'HQ catalogue → stores', source: { server: 'OMS-HQ', database: 'DMSCO' }, tableSet: TABLES.map(spec), allowsApply: true }]

const campaign = (over) => ({
  campaignId: ORIG,
  profileId: PROFILE,
  name: 'Price roll-out',
  mode: 'ReportOnly',
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: PROFILES[0].tableSet,
  status: 'Completed',
  totalJobs: 6,
  jobsByState: { queued: 0, running: 0, paused: 0, succeeded: 3, failed: 3, cancelled: 0 },
  retryableJobs: 0,
  rerunnableJobs: 0,
  rerunnableWpfHostedJobs: 0,
  reason: null,
  createdAt: '2026-11-09T09:00:00Z',
  startedAt: '2026-11-09T09:01:00Z',
  finishedAt: '2026-11-09T10:00:00Z',
  asOf: '2026-11-10T09:00:00Z',
  rerunOf: null,
  rerunBy: [],
  ...over,
})

const offer = (mode) => ({
  campaignId: ORIG,
  profileId: PROFILE,
  mode,
  tables: ['dbo.Product', 'dbo.PriceList'],
  targets: [
    { client: '000', code: 'P003', failureReason: 'TableFailures', unfinishedTables: ['dbo.PriceList'] },
    { client: '000', code: 'P007', failureReason: 'StoreWpfHosted', unfinishedTables: ['dbo.Product', 'dbo.PriceList'] },
    { client: '000', code: 'P001', failureReason: 'Error', unfinishedTables: ['dbo.Product'] },
  ],
  excluded: [],
})

const browser = await chromium.launch()

const FIRST_RERUN = '01JE4F6G8H0J2K4M6N8P0Q2R4S'
// The answer once FIRST_RERUN (live) holds P003 and P001: only P007 is still offered (865).
const heldOffer = (mode) => ({
  ...offer(mode),
  tables: ['dbo.Product', 'dbo.PriceList'],
  targets: offer(mode).targets.filter((t) => t.code === 'P007'),
  excluded: [
    { client: '000', code: 'P003', rerunCampaignId: FIRST_RERUN },
    { client: '000', code: 'P001', rerunCampaignId: FIRST_RERUN },
  ],
})

async function open({ access = { screenAllowed: true, canOperate: true }, mode = 'ReportOnly', targets = true, created = false, held = false, counts = null } = {}) {
  // The original's own counts, as the door would compute them from the offer below; 0 once a re-run took them all.
  const own = counts ?? (held ? { all: 1, wpf: 1 } : targets ? { all: 3, wpf: 1 } : { all: 0, wpf: 0 })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const posts = { create: [] }
  const reads = { rerunTargets: 0 }
  const state = { created }
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
      posts.create.push(route.request().postDataJSON())
      const asked = (route.request().postDataJSON().targets?.storeCodes ?? []).map((k) => k.code)
      const clash = held ? heldOffer(mode).excluded.filter((e) => asked.includes(e.code)) : []
      if (clash.length)
        return route.fulfill(
          envelope(null, {
            status: 422,
            success: false,
            message: 'A store is already in a live re-run of this campaign.',
            errors: [
              {
                errorCode: 'DATASYNC_STORE_IN_LIVE_RERUN',
                internalErrorCode: 'DS-0422-07',
                errorMessage:
                  clash.map((e) => `${e.client}/${e.code} is in re-run ${e.rerunCampaignId}`).join('; ') +
                  ` of campaign ${ORIG}; cancel that re-run or leave the store out.`,
              },
            ],
          }),
        )
      state.created = true
      return route.fulfill(envelope(newCampaign(), { status: 201, message: 'Campaign created.' }))
    }
    if (p === `DataSync/Campaigns/${ORIG}/RerunTargets`) {
      reads.rerunTargets++
      return route.fulfill(envelope(held ? heldOffer(mode) : targets ? offer(mode) : { ...offer(mode), tables: [], targets: [] }))
    }
    if (p === `DataSync/Campaigns/${NEW_ID}/RerunTargets`) return route.fulfill(envelope({ ...offer(mode), campaignId: NEW_ID, tables: [], targets: [] }))
    if (p === `DataSync/Campaigns/${ORIG}`)
      return route.fulfill(
        envelope(
          campaign({
            mode,
            rerunnableJobs: state.created && state.takesAll ? 0 : own.all,
            rerunnableWpfHostedJobs: state.created && state.takesAll ? 0 : own.wpf,
            rerunBy: state.created ? [{ campaignId: NEW_ID, name: 'Price fix', status: 'Ready' }] : [],
          }),
        ),
      )
    if (p === `DataSync/Campaigns/${NEW_ID}`) return route.fulfill(envelope(newCampaign()))
    if (/^DataSync\/Campaigns\/[^/]+\/Jobs$/.test(p)) return route.fulfill(envelope([]))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canOperate: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, posts, reads, state }
}

const newCampaign = () =>
  campaign({
    campaignId: NEW_ID,
    name: 'Price fix',
    status: 'Ready',
    totalJobs: 3,
    jobsByState: { queued: 3, running: 0, paused: 0, succeeded: 0, failed: 0, cancelled: 0 },
    startedAt: null,
    finishedAt: null,
    rerunOf: { campaignId: ORIG, name: 'Price roll-out' },
  })

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const ORIG_PAGE = `${BASE}/admin/data-sync/campaigns/${ORIG}`
const ticked = (dialog) =>
  dialog.locator('[data-create-tables] [data-checklist-row]').evaluateAll((rows) =>
    rows.filter((r) => r.querySelector('input[type="checkbox"]')?.checked).map((r) => r.getAttribute('data-checklist-row')),
  )

// ── 1: report-only re-run, end to end ──────────────────────────────────────────────────────────
{
  const { context, page, errors, posts, reads } = await open()
  await page.goto(ORIG_PAGE)
  const button = page.locator('[data-campaign-actions] [data-rerun-open]')
  await button.waitFor({ timeout: 20000 })
  check('1. the offer is not read before the click', reads.rerunTargets === 0, String(reads.rerunTargets))
  check('1. the button shows N = the campaign\'s rerunnableJobs', (await button.getAttribute('data-rerun-open')) === '3' && strip(await button.innerText()).replace(/\(\s*(\d+)\s*\)/, '($1)') === 'New campaign from failed (3)', strip(await button.innerText()))
  check('1. the original reads as no re-run yet', (await page.locator('[data-field="rerunOf"]').count()) === 0 && (await page.locator('[data-field="rerunBy"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/original.png`, fullPage: true })
  await button.click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-create-dialog]').waitFor({ timeout: 10000 })
  check('1. the dialog is titled New campaign from failed', strip(await dialog.locator('#modal-title').innerText()) === 'New campaign from failed')
  check('1. it names the original', /Price roll-out/.test(strip(await dialog.locator('[data-rerun-intro]').innerText())))
  check('1. the profile is shown and locked', (await dialog.locator('[data-create-profile]').inputValue()) === PROFILE && (await dialog.locator('[data-create-profile]').isDisabled()) && (await dialog.locator('[data-create-profile-locked]').count()) === 1)
  check('1. the union of unfinished tables is ticked, nothing else', JSON.stringify(await ticked(dialog)) === JSON.stringify(['dbo.Product', 'dbo.PriceList']), JSON.stringify(await ticked(dialog)))
  check('1. the targets are the offer\'s stores by code', (await dialog.locator('[data-create-target="stores"]').isChecked()) && (await dialog.locator('[data-create-codes]').inputValue()) === 'P003\nP007\nP001')
  check('1. the mode is the original\'s (report only)', (await dialog.locator('[data-create-mode="ReportOnly"]').count()) === 1)
  check('1. report only leaves no store out', (await dialog.locator('[data-rerun-wpf-left-out]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/dialog-report-only.png` })
  // Removable: drop a store and a table.
  await dialog.locator('[data-create-codes]').fill('P003\nP001')
  await dialog.locator('[data-checklist-row="dbo.Product"] input').uncheck()
  await dialog.locator('[data-create-name]').fill('Price fix')
  await dialog.locator('[data-create-submit]').click()
  await until(page, () => posts.create.length === 1)
  check(
    '1. the create carries rerunOf with the narrowed stores and tables',
    JSON.stringify(posts.create[0]) ===
      JSON.stringify({ profileId: PROFILE, mode: 'ReportOnly', targets: { storeCodes: [{ code: 'P003' }, { code: 'P001' }] }, tables: ['dbo.PriceList'], name: 'Price fix', rerunOf: ORIG }),
    JSON.stringify(posts.create[0]),
  )
  await page.locator(`[data-campaign-header="${NEW_ID}"]`).waitFor({ timeout: 10000 })
  const of = page.locator(`[data-field="rerunOf"] a[data-rerun-of="${ORIG}"]`)
  check('1. the new campaign shows Re-run of <original> as a link', (await of.count()) === 1 && strip(await of.innerText()) === 'Price roll-out' && (await of.getAttribute('href')) === `/admin/data-sync/campaigns/${ORIG}`)
  check('1. the new campaign offers no re-run of its own', (await page.locator('[data-rerun-open]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/rerun.png`, fullPage: true })
  await of.click()
  await page.locator(`[data-campaign-header="${ORIG}"]`).waitFor({ timeout: 10000 })
  const by = page.locator(`[data-field="rerunBy"] a[data-rerun-by="${NEW_ID}"]`)
  await by.waitFor({ timeout: 10000 })
  check('1. the original shows Re-run by <new> as a link, with its status', strip(await by.innerText()) === 'Price fix' && strip(await page.locator('[data-field="rerunBy"]').innerText()).includes('Ready'), strip(await page.locator('[data-field="rerunBy"]').innerText()))
  await page.screenshot({ path: `${SHOTS}/original-rerun-by.png`, fullPage: true })
  check('no page errors (report-only re-run)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2: an Apply original — WPF-hosted left out with a note ──────────────────────────────────────
{
  const { context, page, errors } = await open({ mode: 'Apply' })
  await page.goto(ORIG_PAGE)
  await page.locator('[data-rerun-open]').waitFor({ timeout: 20000 })
  check('2. N leaves the WPF-hosted store out, as the dialog does', (await page.locator('[data-rerun-open]').getAttribute('data-rerun-open')) === '2')
  await page.locator('[data-rerun-open]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-create-dialog]').waitFor({ timeout: 10000 })
  check('2. the mode starts Apply', (await dialog.locator('[data-create-mode="Apply"]').count()) === 1)
  check('2. the WPF-hosted store is left out of the codes', (await dialog.locator('[data-create-codes]').inputValue()) === 'P003\nP001')
  check('2. …and named in a note', (await dialog.locator('[data-rerun-wpf-left-out="1"] [data-rerun-wpf-store="P007"]').count()) === 1, strip(await dialog.locator('[data-rerun-notes]').innerText()))
  check('2. the reason starts empty', (await dialog.locator('[data-apply-reason]').inputValue()) === '')
  await page.screenshot({ path: `${SHOTS}/dialog-apply.png` })
  const codes = () => dialog.locator('[data-create-codes]').inputValue()
  const wpfNote = () => dialog.locator('[data-rerun-wpf-left-out]').count()
  await dialog.locator('[data-create-mode-pick="ReportOnly"]').check()
  check('2. report only puts the WPF-hosted store back, and drops the note', (await codes()) === 'P003\nP001\nP007' && (await wpfNote()) === 0, JSON.stringify(await codes()))
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  check('2. back to Apply leaves it out again, with the note', (await codes()) === 'P003\nP001' && (await wpfNote()) === 1, JSON.stringify(await codes()))
  for (const table of ['dbo.Product', 'dbo.PriceList']) await dialog.locator(`[data-checklist-row="${table}"] input`).uncheck()
  check(
    '2. no ticked table: the mode falls back to report only, and the store is back',
    (await dialog.locator('[data-create-mode="ReportOnly"]').count()) === 1 && (await codes()) === 'P003\nP001\nP007' && (await wpfNote()) === 0,
    JSON.stringify(await codes()),
  )
  check('no page errors (apply pre-fill)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 3: nothing to re-run → no button ────────────────────────────────────────────────────────────
{
  const { context, page, errors, reads } = await open({ targets: false })
  await page.goto(ORIG_PAGE)
  await page.locator(`[data-campaign-header="${ORIG}"]`).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  check('3. rerunnableJobs 0 shows no button, and the offer is never read', reads.rerunTargets === 0 && (await page.locator('[data-rerun-open]').count()) === 0)
  check('no page errors (empty offer)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open({ mode: 'Apply', counts: { all: 1, wpf: 1 } })
  await page.goto(ORIG_PAGE)
  await page.locator(`[data-campaign-header="${ORIG}"]`).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  check('3. an Apply campaign whose only failure is WPF-hosted shows no button', (await page.locator('[data-rerun-open]').count()) === 0)
  check('no page errors (WPF-only Apply)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: a viewer ────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, reads } = await open({ access: { screenAllowed: true, canOperate: false }, created: true })
  await page.goto(ORIG_PAGE)
  await page.locator(`[data-field="rerunBy"] a[data-rerun-by="${NEW_ID}"]`).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  check('4. a viewer sees Re-run by', (await page.locator('[data-field="rerunBy"]').count()) === 1)
  check('4. …but no New campaign from failed (and the offer is not read)', (await page.locator('[data-rerun-open]').count()) === 0 && reads.rerunTargets === 0)
  check('no page errors (viewer)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: a second click — the stores a live re-run holds are left out and named (865) ─────────────
{
  const { context, page, errors, posts } = await open({ held: true })
  await page.goto(ORIG_PAGE)
  const button = page.locator('[data-campaign-actions] [data-rerun-open]')
  await button.waitFor({ timeout: 20000 })
  check('5. N counts only the store no live re-run holds', (await button.getAttribute('data-rerun-open')) === '1', strip(await button.innerText()))
  await button.click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-create-dialog]').waitFor({ timeout: 10000 })
  check('5. only the free store is pre-filled', (await dialog.locator('[data-create-codes]').inputValue()) === 'P007')
  const notes = dialog.locator('[data-rerun-excluded="2"]')
  check(
    '5. each held store is named with its re-run',
    (await notes.locator('[data-rerun-excluded-store="P003"]').count()) === 1 &&
      (await notes.locator('[data-rerun-excluded-store="P001"]').count()) === 1 &&
      strip(await notes.locator('[data-rerun-excluded-store="P003"]').innerText()) === `P003 is already in re-run ${FIRST_RERUN}.`,
    strip(await dialog.locator('[data-rerun-notes]').innerText()),
  )
  await page.screenshot({ path: `${SHOTS}/dialog-held.png` })
  // The refusal is the guard: put a held store back and create anyway.
  await dialog.locator('[data-create-codes]').fill('P007\nP003')
  await dialog.locator('[data-create-submit]').click()
  await until(page, () => posts.create.length === 1)
  const refusal = dialog.locator('[data-create-refusal]')
  await refusal.waitFor({ timeout: 10000 })
  check(
    '5. a create naming a held store is refused in words, naming it',
    strip(await refusal.innerText()) === '000/P003 is already in a live re-run of this campaign. Remove it, or cancel that re-run, and create again.',
    strip(await refusal.innerText()),
  )
  check('5. the dialog stays open on the refusal', (await dialog.locator('[data-create-dialog]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/dialog-held-refused.png` })
  check('no page errors (second click)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: an Apply re-run's outcome survives N → 0 ─────────────────────────────────────────────────
{
  const { context, page, errors, posts, state } = await open({ mode: 'Apply' })
  state.takesAll = true
  let origReads = 0
  page.on('request', (r) => new URL(r.url()).pathname === `/api/DataSync/Campaigns/${ORIG}` && origReads++)
  await page.goto(ORIG_PAGE)
  await page.locator('[data-rerun-open]').waitFor({ timeout: 20000 })
  await page.locator('[data-rerun-open]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-create-dialog]').waitFor({ timeout: 10000 })
  await dialog.locator('[data-apply-reason]').fill('Fixed the PriceList key on the stores')
  const before = origReads
  await dialog.locator('[data-create-submit]').click()
  await until(page, () => posts.create.length === 1)
  await dialog.locator(`[data-apply-outcome="${NEW_ID}"]`).waitFor({ timeout: 10000 })
  await until(page, () => origReads > before)
  await page.waitForTimeout(800)
  check('6. the original was re-read after the create (N is now 0)', origReads > before && (await page.locator('[data-rerun-open]').count()) === 0)
  check('6. ...and the outcome is still up, with its way to the new campaign', (await dialog.locator(`[data-apply-outcome="${NEW_ID}"]`).count()) === 1 && (await dialog.locator('[data-apply-open]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/apply-outcome-after-n0.png` })
  await dialog.locator('[data-apply-open]').click()
  await page.locator(`[data-campaign-header="${NEW_ID}"]`).waitFor({ timeout: 10000 })
  check('6. Open campaign goes to the re-run', (await page.locator(`[data-campaign-header="${NEW_ID}"]`).count()) === 1)
  check('no page errors (apply outcome)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
