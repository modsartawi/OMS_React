// Sync console "Resume all paused…" drive (ticket 903, BackOffice spec 3913) — drives the REAL Fleet page in
// Chromium against STUBBED `ActionSync/*` envelopes, in the amended 2523 contract's shapes (BackOffice 3916/3917,
// pricing2 merge d5e48c4a2): `Stores/Paused` answering `{ items: [{ code, description, pausedBy, pausedAt,
// pauseReason }] }`, the bulk door `{ batchId, results }`.
// 🚩 NOTHING here is driven against a live SIS.Api. The staging walk is owed.
//
// It verifies:
//   1. "Resume all paused…" is on the Fleet page with canOperate, not in the disabled view, not without canOperate;
//   2. it reads `Stores/Paused` and lists all 120 paused stores (never a disabled one), all ticked, with who paused
//      each, when and why — a DataSync campaign's tag as written, a pre-3914 pause as "Not recorded";
//   3. unticking a store: the count and the confirm label follow, the tick-all box goes mixed;
//   4. Confirm waits for a reason; then ONE POST to `Stores/Control/Bulk` (never `Stores/Control`) carries the 119
//      ticked codes in preview order, Resume, the trimmed reason;
//   5. the toast counts and names the batch, a DISABLED refusal is listed, the fleet refetches; the unticked store
//      stays paused and the disabled stores stay disabled;
//   6. reopened, the preview lists only what is still paused; tick-all off turns Confirm off;
//   7. no paused store: the dialog's empty state, no error, Confirm off;
//   8. a failed read says so;
//   9. under `oms.locale = ar` (RTL) the counts stay isolated (chrome pinned to `en` app-wide; the ar bundle's keys
//      are proven in control-helpers.test.ts).
//
//   1. run the app:  npx vite --port 5293
//   2. DRIVE_PORT=5293 node tools/sync-console-resume-all-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-resume-all-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const loop = () => ({ lastPassAt: '2026-11-16T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null })

const workerStore = (code, { paused = false, disabled = false, pausedBy = null, pausedAt = null, pauseReason = null } = {}) => ({
  code,
  description: `Store ${code}`,
  host: 'Worker',
  isPaused: paused || disabled,
  isDisabled: disabled,
  disabledBy: disabled ? 'ops.ali' : null,
  disabledAt: disabled ? '2026-11-10T09:00:00' : null,
  disableReason: disabled ? 'Store closed' : null,
  pausedBy,
  pausedAt,
  pauseReason,
  controlPending: false,
  states: disabled ? ['onWorker', 'paused', 'disabled'] : paused ? ['onWorker', 'paused'] : ['onWorker'],
  lastConnectOkAt: '2026-11-16T12:03:10',
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: loop(),
  pull: loop(),
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: '2026-11-16T12:02:00',
  healthUpdatedAt: '2026-11-16T12:03:30',
  controlVersion: 4,
  appliedVersion: 4,
  appliedAt: '2026-11-16T09:00:00',
})

const pad = (i) => String(i).padStart(3, '0')
// 120 paused by a DataSync campaign (P001–P120; P007 paused by a person for a store-side fault, P120 paused before
// 3914 stamped the pause fields), 3 disabled (paused underneath), 10 running. P050 is disabled by someone else after
// the preview was read, so the bulk Resume refuses it DISABLED.
const makeStores = ({ none = false } = {}) => {
  const out = []
  if (!none)
    for (let i = 1; i <= 120; i++) {
      const code = `P${pad(i)}`
      const at = `2026-11-15T22:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`
      out.push(
        code === 'P007'
          ? workerStore(code, { paused: true, pausedBy: 'ops.huda', pausedAt: at, pauseReason: 'store-side fault: till DB rebuilt' })
          : code === 'P120'
            ? workerStore(code, { paused: true })
            : workerStore(code, { paused: true, pausedBy: 'datasync', pausedAt: at, pauseReason: 'DATASYNC:CAMPAIGN-0042' }),
      )
    }
  for (let i = 1; i <= 3; i++) out.push(workerStore(`D${pad(i)}`, { disabled: true, pausedBy: 'ops.ali', pausedAt: '2026-11-10T09:00:00', pauseReason: 'Store closed' }))
  for (let i = 1; i <= 10; i++) out.push(workerStore(`W${pad(i)}`))
  return out
}

const HOUR = (hour) => ({ hour, pushPasses: 1, pullPasses: 1, connectFailures: 0, chunksPushed: 1, actionsPushed: 1, trxPulled: 1, errors: 0 })
const WORKERS = { items: [{ instance: 'SISAPI-SYNC-01', version: '1.4.2', gateOn: true, pushWidth: 64, pullWidth: 64, pushInFlight: 1, pullInFlight: 1, lastFlushAt: '2026-11-16T12:04:20', isStale: false, settings: {} }] }

const browser = await chromium.launch()

async function open({ locale = 'en', canOperate = true, none = false, pausedFails = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1300 } })
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-11-16T12:04:00') })
  const errors = []
  const calls = []
  const posts = []
  const stores = makeStores({ none })
  const byCode = (c) => stores.find((s) => s.code === c)
  let batches = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((loc) => {
    localStorage.setItem('oms.locale', loc)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)

  const restate = (s) => {
    s.states = s.isDisabled ? ['onWorker', 'paused', 'disabled'] : s.isPaused ? ['onWorker', 'paused'] : ['onWorker']
  }
  const apply = (action, code) => {
    const s = byCode(code)
    if (!s) return { code, ok: false, error: 'NO_STORE', controlVersion: 0 }
    if (code === 'P050') {
      Object.assign(s, { isDisabled: true, isPaused: true })
      restate(s)
    }
    if (s.isDisabled) return { code, ok: false, error: 'DISABLED', controlVersion: s.controlVersion }
    if (action === 'Resume') Object.assign(s, { isPaused: false, pausedBy: null, pausedAt: null, pauseReason: null })
    s.controlVersion += 1
    restate(s)
    return { code, ok: true, error: null, controlVersion: s.controlVersion }
  }

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const q = url.searchParams
    calls.push(p + url.search)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate, canOnboard: false }))
    if (p === 'ActionSync/Workers') return route.fulfill(envelope(WORKERS))
    if (p === 'ActionSync/Fleet/Summary') {
      const active = stores.filter((s) => !s.isDisabled)
      const n = (st) => active.filter((s) => s.states.includes(st)).length
      return route.fulfill(
        envelope({
          asOf: '2026-11-16T12:04:31',
          total: active.length,
          counts: { all: active.length, onWorker: n('onWorker'), onWpf: 0, paused: n('paused'), offline: 0, behind: 0, erroring: 0, controlPending: 0, mirrorOffline: 0, mirrorBehind: 0, deadLetters: 0, deferredTooLong: 0, railsDisagree: 0, disabled: 0, closedNotDisabled: 0 },
          disabled: stores.length - active.length,
        }),
      )
    }
    if (p === 'ActionSync/Fleet/LastHour') return route.fulfill(envelope({ current: HOUR('2026-11-16T12:00:00'), previous: HOUR('2026-11-16T11:00:00') }))
    if (p === 'ActionSync/Fleet') {
      const only = q.get('disabled') === 'only'
      const states = q.getAll('state')
      const all = stores.filter((s) => !!s.isDisabled === only && states.every((st) => s.states.includes(st)))
      const pg = Number(q.get('page'))
      const size = Number(q.get('pageSize'))
      return route.fulfill(envelope({ items: all.slice((pg - 1) * size, pg * size), total: all.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/Stores/Paused') {
      if (pausedFails) return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      const paused = stores
        .filter((s) => s.isPaused && !s.isDisabled)
        .sort((a, b) => String(a.pausedAt ?? '').localeCompare(String(b.pausedAt ?? '')))
        .map(({ code, description, pausedBy, pausedAt, pauseReason }) => ({ code, description, pausedBy, pausedAt, pauseReason }))
      return route.fulfill(envelope({ items: paused }))
    }
    if (p === 'ActionSync/Stores/Control') {
      posts.push({ door: 'control', ...route.request().postDataJSON() })
      return route.fulfill(envelope({ auditId: 'A-1', results: [] }))
    }
    if (p === 'ActionSync/Stores/Control/Bulk') {
      const body = route.request().postDataJSON()
      posts.push({ door: 'bulk', ...body })
      return route.fulfill(envelope({ batchId: `01JRESUME${++batches}`, results: body.codes.map((c) => apply(body.action, c)) }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, posts, byCode }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitFor = async (page, fn, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const toastText = async (page) => strip((await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | '))
const dialog = (page) => page.locator('dialog[open]')
const ticks = (page) =>
  dialog(page)
    .locator('[data-resume-row]')
    .evaluateAll((rs) => rs.map((r) => `${r.getAttribute('data-resume-row')}:${r.getAttribute('data-ticked')}`))
const summaryOf = async (page) => dialog(page).locator('[data-resume-summary]').getAttribute('data-resume-summary')
const confirmBtn = (page) => dialog(page).locator('[data-reason-confirm]')

// ── 1–6: the Fleet page ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, posts, byCode } = await open()
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  const openBtn = page.locator('[data-resume-all-open]')
  await openBtn.waitFor({ timeout: 5000 })
  check('1. "Resume all paused…" is on the Fleet page', strip(await openBtn.innerText()) === 'Resume all paused…', strip(await openBtn.innerText()))

  // 2: the preview.
  await openBtn.click()
  await dialog(page).locator('[data-resume-all="list"]').waitFor({ timeout: 5000 })
  check('2. it reads Stores/Paused', calls.includes('ActionSync/Stores/Paused'))
  check('2. the dialog is titled', /Resume all paused stores/.test(await dialog(page).innerText()))
  const t0 = await ticks(page)
  check('2. all 120 paused stores listed, every one ticked', t0.length === 120 && t0.every((x) => x.endsWith(':true')), String(t0.length))
  check('2. no disabled store and no running store is listed', !t0.some((x) => /^[DW]/.test(x)))
  check('2. …in the door\'s pausedAt order (the unstamped pause first)', t0[0].startsWith('P120:') && t0[1].startsWith('P001:'), t0.slice(0, 2).join(' '))
  check('2. the summary reads 120 of 120 ticked', (await summaryOf(page)) === '120/120' && /120 of 120 paused stores ticked/.test(strip(await dialog(page).locator('[data-resume-summary]').innerText())))
  const r7 = strip(await dialog(page).locator('[data-resume-row="P007"]').innerText())
  check('2. P007: code · description, who, when, why', /P007 · Store P007/.test(r7) && /ops\.huda/.test(r7) && /store-side fault: till DB rebuilt/.test(r7), r7)
  check('2. the DataSync campaign tag shows as written', strip(await dialog(page).locator('[data-resume-row="P001"] [data-resume-reason]').innerText()) === 'DATASYNC:CAMPAIGN-0042')
  check('2. a pause with no stamp reads "Not recorded" three times', (strip(await dialog(page).locator('[data-resume-row="P120"]').innerText()).match(/Not recorded/g) || []).length === 3)
  check('2. tick-all is on', (await dialog(page).locator('[data-resume-tick-all]').getAttribute('data-resume-tick-all')) === 'all')
  check('2. the confirm label counts 120', strip(await confirmBtn(page).innerText()) === 'Resume 120 stores', strip(await confirmBtn(page).innerText()))
  await page.screenshot({ path: `${SHOTS}/preview.png`, fullPage: true })

  // 3: untick P007.
  await dialog(page).locator('[data-resume-tick="P007"]').click()
  check('3. P007 unticked', (await dialog(page).locator('[data-resume-row="P007"]').getAttribute('data-ticked')) === 'false')
  check('3. the summary reads 119 of 120', (await summaryOf(page)) === '119/120')
  check(
    '3. tick-all goes mixed',
    (await dialog(page).locator('[data-resume-tick-all]').getAttribute('data-resume-tick-all')) === 'some' &&
      (await dialog(page).locator('[data-resume-tick-all]').evaluate((e) => e.indeterminate)),
  )
  check('3. the confirm label counts 119', strip(await confirmBtn(page).innerText()) === 'Resume 119 stores')

  // 4: the reason, then the send.
  check('4. Confirm waits for a reason', await confirmBtn(page).isDisabled())
  await dialog(page).locator('[data-reason-input]').fill('   ')
  check('4. …a blank one too', await confirmBtn(page).isDisabled())
  await dialog(page).locator('[data-reason-input]').fill('  DataSync CAMPAIGN-0042 finished ')
  check('4. a reason turns Confirm on', !(await confirmBtn(page).isDisabled()))
  const fleetCallsBefore = calls.filter((c) => c.startsWith('ActionSync/Fleet?')).length
  await confirmBtn(page).click()
  await waitFor(page, async () => (await dialog(page).count()) === 0)
  check('4. the dialog closes', (await dialog(page).count()) === 0)
  check('4. ONE POST, to Stores/Control/Bulk', posts.length === 1 && posts[0].door === 'bulk', JSON.stringify(posts.map((x) => x.door)))
  const sent = posts[0]
  const expected = t0.map((x) => x.split(':')[0]).filter((c) => c !== 'P007')
  check(
    '4. …Resume, the 119 ticked codes in preview order, the trimmed reason',
    sent.action === 'Resume' && JSON.stringify(sent.codes) === JSON.stringify(expected) && sent.reason === 'DataSync CAMPAIGN-0042 finished',
    `${sent.action} ${sent.codes.length} "${sent.reason}"`,
  )
  check('4. …and never P007 or a disabled store', !sent.codes.includes('P007') && !sent.codes.some((c) => c.startsWith('D')))

  // 5: the answer.
  await page.locator('[data-failure="P050"]').waitFor({ timeout: 5000 })
  const toast = await toastText(page)
  check('5. the toast counts 118 of 119 and names the batch', /118 of 119/.test(toast) && /Batch 01JRESUME1/.test(toast), toast)
  check('5. the DISABLED refusal is listed, and only it', (await page.locator('[data-failure="P050"]').getAttribute('data-failure-code')) === 'DISABLED' && (await page.locator('[data-failure]').count()) === 1)
  check('5. the fleet refetches', await waitFor(page, async () => calls.filter((c) => c.startsWith('ActionSync/Fleet?')).length > fleetCallsBefore))
  check(
    '5. P001 and P120 resumed, P007 stays paused, the disabled stay disabled',
    !byCode('P001').isPaused && !byCode('P120').isPaused && byCode('P007').isPaused && byCode('D001').isDisabled && byCode('D001').isPaused && byCode('P050').isDisabled,
  )
  await page.screenshot({ path: `${SHOTS}/after-resume.png`, fullPage: true })

  // 6: reopened.
  await openBtn.click()
  await dialog(page).locator('[data-resume-all="list"]').waitFor({ timeout: 5000 })
  const t1 = await ticks(page)
  check('6. reopened, only P007 is still listed (P050 is disabled now)', t1.join(' ') === 'P007:true', t1.join(' '))
  await dialog(page).locator('[data-resume-tick-all]').click()
  await dialog(page).locator('[data-reason-input]').fill('nothing')
  check('6. tick-all off: none ticked, Confirm off', (await summaryOf(page)) === '0/1' && (await confirmBtn(page).isDisabled()))
  await dialog(page).locator('[data-resume-tick-all]').click()
  check('6. tick-all on again', (await summaryOf(page)) === '1/1' && !(await confirmBtn(page).isDisabled()))
  await dialog(page).locator('[data-reason-cancel]').click()
  check('6. Cancel sends nothing', posts.length === 1)

  // 1 again: the disabled view has no Resume all.
  await page.locator('[data-show-disabled]').click()
  await page.locator('.ag-row[row-id="D001"]').waitFor({ timeout: 5000 })
  check('1. not offered in the disabled view', (await page.locator('[data-resume-all-open]').count()) === 0)
  check('no page errors (fleet)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 1: without canOperate ───────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ canOperate: false })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('1. not offered without canOperate', (await page.locator('[data-resume-all-open]').count()) === 0)
  check('no page errors (view only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: no paused store ──────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open({ none: true })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="W001"]').waitFor({ timeout: 20000 })
  await page.locator('[data-resume-all-open]').click()
  await dialog(page).locator('[data-resume-all="empty"]').waitFor({ timeout: 5000 })
  check('7. the empty state, in words', strip(await dialog(page).locator('[data-resume-all="empty"]').innerText()) === 'No store is paused. There is nothing to resume.')
  check('7. …no error, no list', (await dialog(page).locator('[data-resume-all="failed"], [data-resume-table]').count()) === 0)
  await dialog(page).locator('[data-reason-input]').fill('reason')
  check('7. …Confirm off', await confirmBtn(page).isDisabled())
  await page.screenshot({ path: `${SHOTS}/empty.png`, fullPage: true })
  check('7. nothing sent', posts.length === 0)
  check('no page errors (empty)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: a failed read ────────────────────────────────────────────────────────────────────────
{
  const { context, page, posts } = await open({ pausedFails: true })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  await page.locator('[data-resume-all-open]').click()
  await dialog(page).locator('[data-resume-all="failed"]').waitFor({ timeout: 5000 })
  check('8. a failed read says so', /The paused stores could not be read/.test(await dialog(page).innerText()))
  await dialog(page).locator('[data-reason-input]').fill('reason')
  check('8. …Confirm off, nothing sent', (await confirmBtn(page).isDisabled()) && posts.length === 0)
  await context.close()
}

// ── 9: Arabic ───────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ locale: 'ar' })
  await page.goto(`${BASE}/admin/sync`)
  await page.locator('.ag-row[row-id="P001"]').waitFor({ timeout: 20000 })
  check('9. the page is RTL', (await page.locator('html').getAttribute('dir')) === 'rtl')
  await page.locator('[data-resume-all-open]').click()
  await dialog(page).locator('[data-resume-all="list"]').waitFor({ timeout: 5000 })
  const sum = dialog(page).locator('[data-resume-summary]')
  check('9. the counts are isolated, each once', (await sum.locator('bdi[dir="ltr"]').count()) === 2 && /120 of 120/.test(strip(await sum.innerText())), strip(await sum.innerText()))
  check('9. code · description isolated once, as a pair', (await dialog(page).locator('[data-resume-row="P007"] td').nth(1).locator('bdi[dir="ltr"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/preview-ar.png`, fullPage: true })
  check('no page errors (ar)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
