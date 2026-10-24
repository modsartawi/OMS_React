// Data sync apply drive (ticket 564, spec 558) — drives the REAL /admin/data-sync New campaign
// dialog in Apply mode in Chromium against STUBBED `DataSync/*` and `ActionSync/*` envelopes.
// DataSync shapes from the OpenAPI draft + [CODE] `Refusal.cs`; ActionSync shapes from
// `@/core/models/sync-console` (door contract BackOffice 2523).
// 🚩 NOTHING here is driven against a live DataSync or ActionSync: ticket 566 is the live walk.
//
// The apply order is the orchestrator's standing ruling (DataSync ask B not built, ADR 0004 §2):
//   pause untagged (`DataSync campaign (pending): <reason>`) → create → re-pause the SAME stores
//   tagged `DataSync campaign <id>: <reason>` → Start. Every call is logged in one ordered list
//   and the drive asserts that exact order.
//
// It verifies:
//   1. the whole fleet (two ActionSync fleet pages, 230 stores on the worker + 2 WPF): Apply is
//      chosen, written vs reported tables listed, the reason checked as typed; WPF stores named as
//      never appliable (no drop for the fleet); the order pause×5 (≤ 50, pending) → create →
//      pause×5 (tagged with the new id, the same stores) → start is exact; the outcome names the
//      campaign, says it started, counts the tagged stores, lists ActionSync's refusal and the
//      create's warnings;
//   2. picked stores: readiness grouped (ready / will pause / never: WPF + not on ActionSync);
//      "Drop them" removes the never ones; a create refused 409 DATASYNC_STORE_BUSY shows in words
//      and the dialog lists the stores that were paused and are still paused — no re-pause, no start;
//   3. "pause ActionSync first" turned off: a warning; only the create is posted, no ActionSync call
//      and no Start;
//   4. without ActionSync.Operate the toggle is disabled with the "someone must pause" sentence, and
//      no ActionSync control is posted;
//   5. Apply can't be chosen when no ticked table is applyAllowed;
//   6. a pause batch failing outright stops before the create and lists the stores still paused.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/data-sync-apply-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.data-sync-apply-shots'
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
const refusal = (status, errorCode, internalErrorCode, message, errorMessage) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode, internalErrorCode, errorMessage }] })

// ── Stubs ───────────────────────────────────────────────────────────────────────────────────────

const P_APPLY = '01JAZ8M4QX7R3T2V5W6Y9K0APP'
const P_REPORT = '01JAZ8M4QX7R3T2V5W6Y9K0REP'
const NEW_ID = '01JB2C9X4E6F8G0H1J3K5M7N9P'
const REASON = 'Fix the price drift after the 10/20 outage'

const spec = (table, applyAllowed) => ({
  table,
  where: null,
  includeColumns: null,
  excludeColumns: null,
  applyAllowed,
  strategy: 'Reconcile',
  deletesAllowed: true,
  caseInsensitiveCompare: false,
})
const PROFILES = [
  {
    profileId: P_APPLY,
    name: 'HQ prices → stores',
    source: { server: 'OMS-HQ', database: 'DMSCO' },
    tableSet: [spec('dbo.Category', true), spec('dbo.Product', false), spec('dbo.PriceList', true)],
    allowsApply: true,
  },
  {
    profileId: P_REPORT,
    name: 'Report-only catalogue',
    source: { server: 'OMS-HQ', database: 'DMSCO' },
    tableSet: [spec('dbo.Customer', false)],
    allowsApply: false,
  },
]

const row = (code, host, isPaused, controlPending) => ({
  code,
  description: `Store ${code}`,
  host,
  isPaused,
  controlPending,
  states: [],
  lastConnectOkAt: null,
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: { lastPassAt: null, lastPassOutcome: null, lastErrorAt: null, lastError: null },
  pull: { lastPassAt: null, lastPassOutcome: null, lastErrorAt: null, lastError: null },
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: null,
  healthUpdatedAt: null,
})
// The big fleet: 230 worker stores (S000 paused+acked, the rest running) + 2 WPF — two pages of 200.
const BIG_FLEET = [
  ...Array.from({ length: 230 }, (_, i) => row(`S${String(i).padStart(3, '0')}`, 'Worker', i === 0, false)),
  row('W001', 'Wpf', false, false),
  row('W002', 'Wpf', false, false),
]
// The small fleet for picked stores.
const SMALL_FLEET = [row('P001', 'Worker', false, false), row('P002', 'Worker', true, false), row('P003', 'Wpf', false, false)]

const campaignOf = (status, body) => ({
  campaignId: NEW_ID,
  profileId: P_APPLY,
  name: body?.name ?? null,
  mode: 'Apply',
  source: { server: 'OMS-HQ', database: 'DMSCO' },
  tableSet: PROFILES[0].tableSet,
  status,
  totalJobs: 2,
  jobsByState: { queued: 2, running: 0, paused: 0, succeeded: 0, failed: 0, cancelled: 0 },
  reason: body?.reason ?? null,
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: status === 'Ready' ? null : '2026-10-24T09:01:00Z',
  finishedAt: null,
  asOf: '2026-10-24T09:01:00Z',
})

const browser = await chromium.launch()

async function open({ asAccess = { screenAllowed: true, canOperate: true, canOnboard: false, canReplay: false }, fleet = BIG_FLEET } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const log = [] // every write, in order
  const posts = { create: [], control: [], start: [] }
  const state = { createRefusal: null, failControlAt: null, refuse: new Set(['S017']) }
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
    if (p === 'DataSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate: true }))
    if (p === 'DataSync/Health') return route.fulfill(envelope({ stateDb: 'Ok', workerEnabled: true, lastWorkerTick: new Date().toISOString() }))
    if (p === 'DataSync/Profiles') return route.fulfill(envelope(PROFILES))
    if (p === 'ActionSync/Access') return route.fulfill(envelope(asAccess, { errors: null }))
    if (p === 'ActionSync/Fleet') {
      const pg = Number(url.searchParams.get('page') || 1)
      const size = Number(url.searchParams.get('pageSize') || 50)
      log.push(`fleet page ${pg} size ${size}`)
      return route.fulfill(envelope({ items: fleet.slice((pg - 1) * size, pg * size), total: fleet.length, page: pg, pageSize: size }, { errors: null }))
    }
    if (p === 'ActionSync/Stores/Control' && method === 'POST') {
      const body = route.request().postDataJSON()
      const n = posts.control.length
      posts.control.push(body)
      log.push({ kind: 'control', action: body.action, reason: body.reason, codes: body.codes })
      if (state.failControlAt === n) return route.fulfill(envelope(null, { status: 500, success: false, message: 'ActionSync is down.' }))
      return route.fulfill(
        envelope(
          {
            auditId: `A${n}`,
            results: body.codes.map((code) => ({
              code,
              ok: !state.refuse.has(code),
              error: state.refuse.has(code) ? 'NOT_ON_WORKER' : null,
              controlVersion: 3,
            })),
          },
          { errors: null },
        ),
      )
    }
    if (p === 'DataSync/Campaigns' && method === 'POST') {
      const body = route.request().postDataJSON()
      posts.create.push(body)
      log.push({ kind: 'create', mode: body.mode })
      if (state.createRefusal === 'DATASYNC_STORE_BUSY')
        return route.fulfill(
          refusal(409, 'DATASYNC_STORE_BUSY', 'DS-0409-07', 'No target store is safe to apply.', 'None of the 2 targets is paused-and-acknowledged on the ActionSync worker or Host=None; pause them first.'),
        )
      return route.fulfill(
        envelope(campaignOf('Ready', body), {
          status: 201,
          message: 'Campaign created.',
          errors: [
            { errorCode: 'DATASYNC_STORE_WPF_HOSTED', internalErrorCode: 'DS-0409-08', errorMessage: '000/W001 has Host=Wpf (or no ActionSyncStore row); the WPF host cannot be paused.' },
            { errorCode: 'DATASYNC_STORE_BUSY', internalErrorCode: 'DS-0409-07', errorMessage: 'The live ActionSync worker is driving 000/S017; pause it before applying to it.' },
          ],
        }),
      )
    }
    if (p === 'DataSync/Campaigns' && method === 'GET') return route.fulfill(envelope([]))
    if (p === `DataSync/Campaigns/${NEW_ID}/Start` && method === 'POST') {
      posts.start.push(p)
      log.push({ kind: 'start', id: NEW_ID })
      return route.fulfill(envelope(campaignOf('Running', posts.create.at(-1))))
    }
    if (p === `DataSync/Campaigns/${NEW_ID}`) return route.fulfill(envelope(campaignOf('Running', posts.create.at(-1))))
    if (p === `DataSync/Campaigns/${NEW_ID}/Jobs`) return route.fulfill(envelope([]))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, log, posts, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const until = async (page, pred, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const LIST = `${BASE}/admin/data-sync`
const PENDING = `DataSync campaign (pending): ${REASON}`
const TAGGED = `DataSync campaign ${NEW_ID}: ${REASON}`
const writes = (log) => log.filter((e) => typeof e !== 'string')

async function openDialog(page, profile = P_APPLY) {
  await page.goto(LIST)
  await page.locator('[data-create-open]').waitFor({ timeout: 20000 })
  await page.locator('[data-create-open]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-create-profile]').waitFor({ timeout: 10000 })
  await dialog.locator('[data-create-profile]').selectOption(profile)
  return dialog
}

// ── 1: the whole fleet — the exact order ───────────────────────────────────────────────────────
{
  const { context, page, errors, log, posts } = await open()
  const dialog = await openDialog(page)
  check('1. report only is the default mode', (await dialog.locator('[data-create-mode="ReportOnly"]').count()) === 1)
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  await dialog.locator('[data-apply-panel]').waitFor({ timeout: 5000 })
  check('1. Apply is chosen', (await dialog.locator('[data-create-mode="Apply"]').count()) === 1)
  const written = await dialog.locator('[data-apply-written]').evaluateAll((els) => els.map((e) => e.dataset.applyWritten))
  const reported = await dialog.locator('[data-apply-reported]').evaluateAll((els) => els.map((e) => e.dataset.applyReported))
  check('1. written vs reported tables come from applyAllowed', JSON.stringify(written) === '["dbo.Category","dbo.PriceList"]' && JSON.stringify(reported) === '["dbo.Product"]', `${written} | ${reported}`)
  check('1. the empty reason is asked for', (await dialog.locator('[data-apply-reason-problem="required"]').count()) === 1)
  check('1. …and blocks Create', await dialog.locator('[data-create-submit]').isDisabled())
  await dialog.locator('[data-apply-reason]').fill('  too short')
  check('1. a reason under 10 characters is flagged as typed', (await dialog.locator('[data-apply-reason-problem="tooShort"]').count()) === 1, strip(await dialog.locator('[data-apply-reason-problem]').innerText()))
  check('1. …and still blocks Create', await dialog.locator('[data-create-submit]').isDisabled())
  await dialog.locator('[data-apply-reason]').fill(`  ${REASON}  `)
  check('1. a 10+ character reason clears the check', (await dialog.locator('[data-apply-reason-problem]').count()) === 0)
  await dialog.locator('[data-apply-never]').waitFor({ timeout: 10000 })
  check('1. the fleet was read over both pages of 200', log.includes('fleet page 1 size 200') && log.includes('fleet page 2 size 200'), log.filter((e) => typeof e === 'string').join(', '))
  check('1. readiness: 1 ready, 229 will be paused', (await dialog.locator('[data-apply-ready="1"]').count()) === 1 && (await dialog.locator('[data-apply-will-pause="229"]').count()) === 1)
  const never = await dialog.locator('[data-apply-never-store]').evaluateAll((els) => els.map((e) => `${e.dataset.applyNeverStore}:${e.dataset.why}`))
  check('1. the WPF stores are named as never appliable', JSON.stringify(never) === '["W001:wpf","W002:wpf"]', JSON.stringify(never))
  check('1. …with no drop for the whole fleet', (await dialog.locator('[data-apply-drop]').count()) === 0)
  check('1. "pause ActionSync first" is on by default', await dialog.locator('[data-apply-pause-first]').isChecked())
  await page.screenshot({ path: `${SHOTS}/apply-fleet.png`, fullPage: true })
  await dialog.locator('[data-create-submit]').click()
  await page.locator('[data-apply-outcome]').waitFor({ timeout: 20000 })

  const w = writes(log)
  const kinds = w.map((e) => (e.kind === 'control' ? (e.reason === PENDING ? 'hold' : e.reason === TAGGED ? 'tag' : 'control?') : e.kind))
  check('1. the order is exact: pause ×5 (pending) → create → pause ×5 (tagged) → start', kinds.join(',') === 'hold,hold,hold,hold,hold,create,tag,tag,tag,tag,tag,start', kinds.join(','))
  check('1. every batch is at most 50 stores and a Pause', w.filter((e) => e.kind === 'control').every((e) => e.codes.length <= 50 && e.codes.length > 0 && e.action === 'Pause'))
  const held = w.filter((e) => e.kind === 'control' && e.reason === PENDING).flatMap((e) => e.codes)
  const tagged = w.filter((e) => e.kind === 'control' && e.reason === TAGGED).flatMap((e) => e.codes)
  check('1. the first pause takes all 230 worker stores, no WPF one', held.length === 230 && !held.includes('W001'))
  check('1. the tag carries the new campaign id', w.some((e) => e.kind === 'control' && e.reason === TAGGED))
  check('1. the tagged pause re-pauses the same stores (less the one ActionSync refused)', tagged.length === 229 && !tagged.includes('S017') && tagged.every((c) => held.includes(c)))
  check('1. the create body is Apply with the reason trimmed and the whole fleet', JSON.stringify(posts.create[0]) === JSON.stringify({ profileId: P_APPLY, mode: 'Apply', targets: { fleet: 'all' }, reason: REASON }), JSON.stringify(posts.create[0]))
  check('1. no pause flag is sent on create (ask B not built)', !('pauseActionSyncFirst' in posts.create[0]))
  check('1. the outcome names the campaign', strip(await page.locator('[data-apply-created]').innerText()) === `Campaign ${NEW_ID} was created.`)
  check('1. …says it started', (await page.locator('[data-apply-started="Running"]').count()) === 1)
  check('1. …counts the tagged stores', (await page.locator('[data-apply-tagged="229"]').count()) === 1)
  check('1. …lists ActionSync\'s refusal in words', strip(await page.locator('[data-apply-refused="S017"]').innerText()) === 'S017 not on the ActionSync worker')
  const warns = await page.locator('[data-apply-warning]').evaluateAll((els) => els.map((e) => `${e.dataset.applyWarning}@${e.dataset.store}`))
  check('1. …and the create warnings, as warnings on the new campaign', JSON.stringify(warns) === '["DATASYNC_STORE_WPF_HOSTED@000/W001","DATASYNC_STORE_BUSY@000/S017"]', JSON.stringify(warns))
  check('1. …the WPF warning in words', /000\/W001 synced by the WPF host; it will never be applied to/.test(strip(await page.locator('[data-apply-warning="DATASYNC_STORE_WPF_HOSTED"]').innerText())))
  check('1. no failure banner on a success with warnings', (await page.locator('[data-create-error]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/apply-outcome.png`, fullPage: true })
  await page.locator('[data-apply-open]').click()
  await page.waitForURL(`**/admin/data-sync/campaigns/${NEW_ID}`, { timeout: 10000 })
  check('1. Open the campaign goes to its page', new URL(page.url()).pathname === `/admin/data-sync/campaigns/${NEW_ID}`)
  check('no page errors (fleet apply)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2: picked stores — readiness, drop, then a create refused after the pause ─────────────────
{
  const { context, page, errors, log, state } = await open({ fleet: SMALL_FLEET })
  state.refuse = new Set()
  const dialog = await openDialog(page)
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  await dialog.locator('[data-create-target="stores"]').check()
  await dialog.locator('[data-create-codes]').fill('p001\nP002\nP003\nX999')
  await dialog.locator('[data-apply-reason]').fill(REASON)
  await dialog.locator('[data-apply-never]').waitFor({ timeout: 10000 })
  check('2. readiness: P002 ready, P001 will be paused', (await dialog.locator('[data-apply-ready="1"]').count()) === 1 && (await dialog.locator('[data-apply-will-pause="1"]').count()) === 1)
  const never = await dialog.locator('[data-apply-never-store]').evaluateAll((els) => els.map((e) => `${e.dataset.applyNeverStore}:${e.dataset.why}`))
  check('2. never: the WPF store and the one not on ActionSync', JSON.stringify(never) === '["P003:wpf","X999:notFound"]', JSON.stringify(never))
  check('2. …in words', /P003 synced by the WPF host/.test(strip(await dialog.locator('[data-apply-never]').innerText())) && /X999 not on ActionSync/.test(strip(await dialog.locator('[data-apply-never]').innerText())))
  await page.screenshot({ path: `${SHOTS}/apply-stores-never.png`, fullPage: true })
  await dialog.locator('[data-apply-drop]').click()
  check('2. "Drop them" removes the never-appliable stores', (await dialog.locator('[data-create-codes]').inputValue()) === 'p001\nP002', JSON.stringify(await dialog.locator('[data-create-codes]').inputValue()))
  check('2. …and the never list is gone', (await dialog.locator('[data-apply-never]').count()) === 0)

  state.createRefusal = 'DATASYNC_STORE_BUSY'
  await dialog.locator('[data-create-submit]').click()
  await dialog.locator('[data-create-error="DATASYNC_STORE_BUSY"]').waitFor({ timeout: 10000 })
  const w = writes(log)
  check('2. the stores were paused (pending, by ActionSync\'s spelling) then the create was refused — nothing else', JSON.stringify(w.map((e) => e.kind)) === '["control","create"]' && w[0].reason === PENDING && JSON.stringify(w[0].codes) === '["P001","P002"]', JSON.stringify(w))
  check('2. the 409 shows in words', strip(await dialog.locator('[data-create-refusal]').innerText()) === 'No target store is safe to apply yet. Pause them on ActionSync first.')
  const still = await dialog.locator('[data-apply-still-paused-store]').evaluateAll((els) => els.map((e) => e.dataset.applyStillPausedStore))
  check('2. the dialog says which stores were paused and are still paused', JSON.stringify(still) === '["P001","P002"]', JSON.stringify(still))
  check('2. …in words', /were paused on ActionSync and are still paused/.test(strip(await dialog.locator('[data-apply-still-paused]').innerText())))
  check('2. no Start was posted', !w.some((e) => e.kind === 'start'))
  await page.screenshot({ path: `${SHOTS}/apply-create-refused.png`, fullPage: true })
  check('no page errors (picked stores)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 3: the toggle off ──────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, log, posts } = await open({ fleet: SMALL_FLEET })
  const dialog = await openDialog(page)
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  await dialog.locator('[data-apply-reason]').fill(REASON)
  await dialog.locator('[data-apply-pause-first]').waitFor({ timeout: 5000 })
  await until(page, () => false, 5)
  await dialog.locator('[data-apply-pause-first]').uncheck()
  check('3. turned off, the dialog warns unpaused stores will wait', /Unpaused stores will wait until someone pauses them/.test(strip(await dialog.locator('[data-apply-pause-off]').innerText())))
  await dialog.locator('[data-create-submit]').click()
  await page.locator('[data-apply-outcome]').waitFor({ timeout: 10000 })
  check('3. only the create is posted: no ActionSync control, no Start', JSON.stringify(writes(log).map((e) => e.kind)) === '["create"]' && posts.control.length === 0 && posts.start.length === 0)
  check('3. the outcome says it is Ready, to Start on its page', /It is Ready\. Press Start on its page\./.test(strip(await page.locator('[data-apply-outcome]').innerText())))
  check('no page errors (toggle off)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: without ActionSync.Operate ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open({ fleet: SMALL_FLEET, asAccess: { screenAllowed: true, canOperate: false, canOnboard: false, canReplay: false } })
  const dialog = await openDialog(page)
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  await dialog.locator('[data-apply-pause-needs-grant]').waitFor({ timeout: 10000 })
  check('4. the toggle is disabled', await dialog.locator('[data-apply-pause-first]').isDisabled())
  check('4. …and off', !(await dialog.locator('[data-apply-pause-first]').isChecked()))
  check('4. the dialog says someone who holds it must pause the stores', /Someone who holds it must pause the stores/.test(strip(await dialog.locator('[data-apply-pause-needs-grant]').innerText())))
  await page.screenshot({ path: `${SHOTS}/apply-no-grant.png`, fullPage: true })
  await dialog.locator('[data-apply-reason]').fill(REASON)
  await dialog.locator('[data-create-submit]').click()
  await page.locator('[data-apply-outcome]').waitFor({ timeout: 10000 })
  check('4. the create goes through with no ActionSync control and no Start', posts.create.length === 1 && posts.control.length === 0 && posts.start.length === 0)
  check('no page errors (no ActionSync grant)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: no appliable table ──────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ fleet: SMALL_FLEET })
  const dialog = await openDialog(page, P_REPORT)
  check('5. a profile with no applyAllowed table cannot be applied', await dialog.locator('[data-create-mode-pick="Apply"]').isDisabled())
  check('5. …and says so', (await dialog.locator('[data-apply-unavailable]').count()) === 1)
  await dialog.locator('[data-create-profile]').selectOption(P_APPLY)
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  await dialog.locator('[data-create-table="dbo.Category"]').uncheck()
  await dialog.locator('[data-create-table="dbo.PriceList"]').uncheck()
  check('5. unticking every appliable table falls back to report only', (await dialog.locator('[data-create-mode="ReportOnly"]').count()) === 1 && (await dialog.locator('[data-create-mode-pick="Apply"]').isDisabled()))
  check('no page errors (no appliable table)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: a pause batch failing outright ──────────────────────────────────────────────────────────
{
  const { context, page, errors, log, state } = await open()
  state.failControlAt = 1
  state.refuse = new Set()
  const dialog = await openDialog(page)
  await dialog.locator('[data-create-mode-pick="Apply"]').check()
  await dialog.locator('[data-apply-reason]').fill(REASON)
  await dialog.locator('[data-apply-never]').waitFor({ timeout: 10000 })
  await dialog.locator('[data-create-submit]').click()
  await dialog.locator('[data-apply-still-paused]').waitFor({ timeout: 10000 })
  const w = writes(log)
  check('6. the run stops at the failed batch: no create, no Start', JSON.stringify(w.map((e) => e.kind)) === '["control","control"]', JSON.stringify(w.map((e) => e.kind)))
  check('6. the dialog says no campaign was created', /no campaign was created/.test(strip(await dialog.innerText())))
  check('6. the first batch\'s 50 stores are listed as still paused', (await dialog.locator('[data-apply-still-paused="50"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/apply-hold-failed.png`, fullPage: true })
  check('no page errors (pause failed)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
