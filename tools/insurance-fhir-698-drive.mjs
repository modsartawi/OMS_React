// Publish warnings drive (BackOffice spec 3271; oms ticket 698). STUBBED: every door is on the real envelope, never a
// live SIS.Api; 711 swaps in the live doors.
//
// In LTR and RTL:
//   1. the author sees all three warnings and an unknown kind, each with its rule, fact and server text, and asks for approval;
//   2. the approver's Approve waits until they are shown, then one rule with all three publishes;
//   3. the guard editor's checks pill counts them, and it can still be saved;
//   4. a payer-key override is refused: it reads differently, Ask for approval and Approve hold, nothing is written;
//   5. a coverage rule with warnings publishes; a refusal only the door makes reads as a refusal;
//   6. Validate failing holds the publish and says why; no raw keys or page errors.
//
//   1. npx vite --port 5208 --strictPort
//   2. DRIVE_PORT=5208 node tools/insurance-fhir-698-drive.mjs
import { createRequire } from 'node:module'
import { publishChecksStub } from './fhir-rules-stubs-698.mjs'
import { NO_DEDUCTIBLE, RULES, approvalStub, coverageStub, envelope, insuranceMetricsStub, insuranceRulesStub, newApprovalStore, newCoverageState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`
const AUTHOR = { user: 'nalharbi', viewer: { author: true, approver: false } }
const APPROVER = { user: 'falotaibi', viewer: { author: false, approver: true } }
const RULE = RULES[0].id

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
const errorsAll = []

async function open(dir, who, path, { store, state, checks = {} }) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  page.on('pageerror', (e) => errorsAll.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errorsAll.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: who.user, currentStoreCode: 'P001' }))
    const body = req.postData() ? JSON.parse(req.postData()) : undefined
    const hit =
      (await publishChecksStub(req.method(), p, body, checks)) ??
      (store ? approvalStub(req.method(), p, body, { store, ...who, now: '2026-10-27T10:30:00' }) : null) ??
      (state ? coverageStub(req.method(), p, body, { state, query: url.searchParams, user: who.user, viewer: who.viewer }) : null) ??
      insuranceMetricsStub(req.method(), p, url.searchParams) ??
      insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}${path}`)
  return { context, page }
}

const noRawKeys = async (page) => !/insurance-(rules|approvals):|\bpublishChecks\.[a-zA-Z]/.test(await page.locator('main').innerText())
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '')
const item = (page, kind) => page.locator(`[data-publish-item="${kind}"]`)
const isHeld = async (loc) => (await loc.getAttribute('aria-disabled')) === 'true' || (await loc.isDisabled())

for (const dir of ['ltr', 'rtl']) {
  // ── 1. the author sees them and asks ──────────────────────────────────────────────────────────
  const store = newApprovalStore()
  const warnOn = RULE
  const a = await open(dir, AUTHOR, '/insurance-rules/approvals', { store, checks: { warnOn } })
  await a.page.locator('[data-publish-warnings]').waitFor({ timeout: 60000 })
  check(`${dir} 1. four warnings, no refusal`, (await a.page.locator('[data-publish-warnings="4"]').count()) === 1 && (await a.page.locator('[data-publish-refusals]').count()) === 0)
  for (const [kind, fact, text] of [
    ['channelNever', '$claimResponse.benefit', 'On bupa this condition is always unknown.'],
    ['fieldFlagged', '$claimResponse.copay', 'flagged by drift'],
    ['arabicMissing', '$claim.category[*]', 'English label or a bare code'],
  ]) {
    const row = item(a.page, kind)
    const shown = strip(await row.innerText())
    check(`${dir} 1. ${kind} names its rule, its fact and HQ's words`, (await row.getAttribute('data-publish-rule')) === RULE && shown.includes(RULE) && shown.includes(fact) && shown.includes(text), shown)
  }
  const other = strip(await item(a.page, 'other').innerText())
  check(`${dir} 1. an unknown kind still shows its server text`, other.includes('HQ says something this client has no word for.'), other)
  check(`${dir} 1. the fact is one ltr isolate`, (await item(a.page, 'channelNever').locator('[data-fact] bdi[dir="ltr"]').count()) === 1)
  check(`${dir} 1. the warning block is not read as a refusal`, /none of these stops/i.test(await a.page.locator('[data-publish-warnings] h3').innerText()))
  const submit = a.page.locator('[data-action="submit"]')
  check(`${dir} 1. Ask for approval stays open`, !(await isHeld(submit)) && (await a.page.locator('[data-why]').count()) === 0)
  check(`${dir} 1. no raw keys`, await noRawKeys(a.page))
  await submit.click()
  await a.page.locator('[data-approval-state="waiting"]').waitFor({ timeout: 10000 })
  check(`${dir} 1. the ask went through with the warnings standing`, store.meta.state === 'pending' && store.writes.some((w) => w.path.endsWith('/Submit')))
  await a.context.close()

  // ── 2. the approver: held until shown, then publishes ─────────────────────────────────────────
  let release
  const hold = new Promise((r) => (release = r))
  const b = await open(dir, APPROVER, '/insurance-rules/approvals', { store, checks: { warnOn, hold } })
  const approve = b.page.locator('[data-action="approve"]')
  await approve.waitFor({ timeout: 60000 })
  check(`${dir} 2. Approve waits for the checks to be shown`, (await isHeld(approve)) && (await b.page.locator('[data-why="checking"]').count()) === 1)
  check(`${dir} 2. sending back does not wait`, !(await isHeld(b.page.locator('[data-action="sendBack"]'))))
  await approve.click({ force: true })
  await b.page.waitForTimeout(200)
  check(`${dir} 2. a held Approve writes nothing`, !store.writes.some((w) => w.path.endsWith('/Approve')))
  release()
  await b.page.locator('[data-publish-warnings="4"]').waitFor({ timeout: 10000 })
  check(`${dir} 2. then the approver reads all of them and Approve opens`, !(await isHeld(approve)))
  const versions = store.versions.length
  await approve.click()
  await b.page.locator('[data-approval-state="draft"]').waitFor({ timeout: 10000 })
  check(`${dir} 2. one rule with all three warnings publishes`, store.versions.length === versions + 1 && store.meta.state === 'none')
  await b.context.close()

  // ── 3. the guard editor's pill ────────────────────────────────────────────────────────────────
  const ed = await open(dir, AUTHOR, `/insurance-rules/guards/${RULE}/edit`, { store: newApprovalStore(), checks: { warnOn } })
  const pill = ed.page.locator('[data-checks-pill]')
  await pill.waitFor({ timeout: 60000 })
  await pill.click()
  await ed.page.locator('[data-checks-pill="warnings"]').waitFor({ timeout: 10000 })
  check(`${dir} 3. the pill counts the warnings`, (await ed.page.locator('[data-checks-pill] [data-warnings="4"]').count()) === 1)
  check(`${dir} 3. the rule shows them in HQ's words`, /always unknown/.test(await ed.page.locator('[data-issues="rule"]').innerText()))
  await ed.context.close()

  // ── 4. a payer-key override is a refusal ──────────────────────────────────────────────────────
  const state = newCoverageState()
  state.coverage.rules.push({ id: 'C-OVR', state: 'draft', ...structuredClone(NO_DEDUCTIBLE) })
  const c = await open(dir, AUTHOR, '/insurance-rules/coverage', { state })
  await c.page.locator('[data-publish-refusals]').waitFor({ timeout: 60000 })
  const refusal = strip(await item(c.page, 'refusal').innerText())
  check(`${dir} 4. the override is refused, naming its rule and fact`, (await item(c.page, 'refusal').getAttribute('data-publish-rule')) === 'C-OVR' && refusal.includes('$request.deductible') && refusal.includes('cannot override'), refusal)
  check(`${dir} 4. it reads as a refusal, not a warning`, /does not publish until/i.test(await c.page.locator('[data-publish-refusals] h3').innerText()) && (await c.page.locator('[data-publish-refusals].bg-danger-050').count()) === 1 && (await c.page.locator('[data-publish-warnings]').count()) === 0)
  const asks = c.page.locator('[data-action="submit"]')
  check(`${dir} 4. Ask for approval holds, saying why`, (await isHeld(asks)) && (await c.page.locator('[data-why="checks"]').count()) === 1)
  await asks.click({ force: true }).catch(() => {})
  await c.page.waitForTimeout(200)
  check(`${dir} 4. nothing is written`, !(state.writes ?? []).some((w) => w.door === 'submitCoverage') && state.meta.coverage.state === 'editing')
  await c.context.close()

  state.meta.coverage = { ...state.meta.coverage, state: 'pending', requestedBy: 'nalharbi', updatedBy: 'nalharbi' }
  const d = await open(dir, APPROVER, '/insurance-rules/coverage', { state })
  await d.page.locator('[data-publish-refusals]').waitFor({ timeout: 60000 })
  check(`${dir} 4. Approve holds on a refusal; sending back does not`, (await isHeld(d.page.locator('[data-action="approve"]'))) && !(await isHeld(d.page.locator('[data-action="sendBack"]'))))
  await d.context.close()

  // ── 5. coverage with warnings publishes; a door-only refusal reads as one ─────────────────────
  const state2 = newCoverageState()
  state2.meta.coverage = { ...state2.meta.coverage, state: 'pending', requestedBy: 'nalharbi', updatedBy: 'nalharbi' }
  const coverageWarnOn = state2.coverage.rules[0].id
  const e = await open(dir, APPROVER, '/insurance-rules/coverage', { state: state2, checks: { coverageWarnOn } })
  await e.page.locator('[data-publish-warnings="4"]').waitFor({ timeout: 60000 })
  const eApprove = e.page.locator('[data-action="approve"]')
  check(`${dir} 5. a coverage rule's warnings leave Approve open`, !(await isHeld(eApprove)))
  await eApprove.click()
  await e.page.locator('[data-ruleset-approval="none"]').waitFor({ timeout: 10000 })
  check(`${dir} 5. and it publishes`, state2.meta.coverage.state === 'none' && state2.versions.coverage[0].action === 'approve')
  await e.context.close()

  const state3 = newCoverageState()
  state3.meta.coverage = { ...state3.meta.coverage, state: 'pending', requestedBy: 'nalharbi', updatedBy: 'nalharbi' }
  const f = await open(dir, APPROVER, '/insurance-rules/coverage', { state: state3, checks: { lateRefusal: true } })
  const fApprove = f.page.locator('[data-action="approve"]')
  await f.page.waitForFunction(() => document.querySelector('[data-action="approve"]') && !document.querySelector('[data-action="approve"]').disabled, null, { timeout: 60000 })
  await fApprove.click()
  await f.page.locator('[data-action-refused]').waitFor({ timeout: 10000 })
  check(`${dir} 5. a refusal only the door makes shows the door's words, and nothing publishes`, /cannot be overridden/.test(await f.page.locator('[data-action-refused]').innerText()) && state3.meta.coverage.state === 'pending')
  await f.context.close()

  // ── 6. Validate failing ───────────────────────────────────────────────────────────────────────
  const failStore = newApprovalStore({ draftState: 'pending' })
  failStore.meta.requestedBy = 'nalharbi'
  failStore.meta.updatedBy = 'nalharbi'
  const g = await open(dir, APPROVER, '/insurance-rules/approvals', { store: failStore, checks: { fail: true } })
  await g.page.locator('[data-checks="failed"]').waitFor({ timeout: 60000 })
  check(`${dir} 6. guards: failed checks hold Approve`, await isHeld(g.page.locator('[data-action="approve"]')))
  await g.context.close()
  const state4 = newCoverageState()
  const h = await open(dir, AUTHOR, '/insurance-rules/coverage', { state: state4, checks: { fail: true } })
  await h.page.locator('[data-checks-failed]').waitFor({ timeout: 60000 })
  check(`${dir} 6. coverage: failed checks say so and hold the ask`, (await isHeld(h.page.locator('[data-action="submit"]'))) && (await noRawKeys(h.page)))
  await h.context.close()
}

check('no page errors', errorsAll.length === 0, errorsAll.join(' | '))
await browser.close()
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
