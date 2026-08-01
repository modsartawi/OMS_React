// Nphies eligibility drive (tickets 211 + 212 + 213, spec 209, contract v1.0) — drives the
// REAL app in Chromium against MOCKED `Nphies/*` envelopes.
//
// ⚠ SIS.Api is down and NONE of this slice's four server dependencies exist yet
// (BackOffice 912–922 are being written in parallel): the grant filter, `Nphies/Access`,
// `Nphies/Providers` and `Nphies/LastEligibility/{patientId}` are all new, and even
// `Nphies/CheckEligibility` — the one route that ships today — carries no grant filter
// yet. So the network is stubbed at Playwright against the contract's own shapes, the
// same code-complete / runtime-blocked posture BBY 062 and NC 032–038 shipped under.
// Every stubbed field name below is read from CONTRACT.md or from the Nphies service's
// own DTOs, which makes the stub a contract assertion rather than a convenience.
//
// It verifies ticket 211's flow Proof bullet:
//   1. the nav leaf is HIDDEN for an agent without the grant, PRESENT with it;
//   2. submit is blocked until a provider is chosen, with no default ever supplied;
//   3. Fill completes the identity block on a COLD form and does not choose a provider;
//   4. the check submits and renders BOTH axes — including the site qualifier folded
//      into the verdict inline, the blank verdict on a non-Complete request, and the
//      failure message read in exactly one branch.
//
// 212 adds the list (scenarios 13–20) and 213 the response detail (21–28): the detail
// lists every coverage, auto-selects a lone one — expired included — forces a pick on
// two or more with no default, and **Raise authorization** carries the eligibility id
// and the chosen member id in the URL.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/nphies-eligibility-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const URL = BASE + '/nphies/eligibility/new'

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

// `ProviderDto` — code, id, license. Already filtered to unblocked upstream.
const PROVIDERS = [
  { providerCode: 'P001', providerId: '10000000146421', license: 'PR-FHIR-001' },
  { providerCode: 'P002', providerId: '10000000146422', license: 'PR-FHIR-002' },
]

// `LastEligibilityModel` — what Fill completes a cold form from. Note it names a
// PROVIDER (P002): the form must NOT take it (no memory of a last pick).
const LAST = {
  id: 'ELG-77',
  providerCode: 'P002',
  patientId: '0000000003',
  patientIdType: 'PRC',
  patientGender: 'male',
  patientName: 'Muhammad Ali Abbas',
  patientBirthDate: '2010-08-21T00:00:00',
  payerCode: 'PAY-9',
  transfer: false,
  newborn: false,
  occupation: 'student',
  maritalStatus: 'U',
  memberId: 'M-4417',
}

// `EligibilityResponse` — header fields + `Coverages`. The axes are DERIVED from
// `outcome` / `success` / `inforce` / `isEligible` / `siteEligibility`.
const RESPONSE = (over = {}) => ({
  id: 'ELG-78',
  eligibilityPurpose: 'benefits',
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '0000000003',
  patientIdType: 'PRC',
  patientGender: 'male',
  patientName: 'Muhammad Ali Abbas',
  patientBirthDate: '2010-08-21T00:00:00',
  actionDateTime: '2026-08-01T10:00:00',
  errorMessage: '',
  inforce: true,
  outcome: 'complete',
  disposition: 'Eligibility confirmed by the payer.',
  notInForceReason: '',
  success: true,
  coverage: true,
  coverageId: 'COV-1',
  network: 'Gold',
  class: 'Class A',
  statusCode: 200,
  isEligible: true,
  siteEligibility: 'eligible',
  transfer: false,
  newborn: false,
  occupation: 'student',
  maritalStatus: 'U',
  coverages: [
    {
      id: 'COV-1',
      sequence: 1,
      coverageId: 'COV-1',
      memberId: 'M-4417',
      subscriberId: 'S-1',
      network: 'Gold',
      coveragePlan: 'Comprehensive',
      coverageClass: 'Class A',
      coverageGroup: 'G-1',
      policyHolderName: 'Al Dawaa Medical Services',
      inForce: true,
      benefitStart: '2026-01-01',
      benefitEnd: '2026-12-31',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
    },
  ],
  ...over,
})

// ---- ticket 212: the list -------------------------------------------------
//
// The in-window rows are stamped from the REAL clock, not a frozen date: the
// screen's default window is derived from today, so a hard-coded fixture would
// quietly fall out of the window tomorrow and the drive would assert against an
// empty list.
const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const NOW = new Date()
const DAYS_AGO = (n) =>
  isoOf(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n)) + 'T09:15:00'
//
// One row of `GET Nphies/EligibilityResponses` — the eligibility equivalent of
// `AuthForListDto`. 🚩 Every row here carries **no `outcome`**, deliberately:
// `NEligibility` has no such column (`Data/Eligibility/NEligibility.cs`), the
// value is read off the live FHIR bundle at `EligibilityService.cs:670` and
// discarded. So the axes on a stored row come from `success` / `inforce` /
// `isEligible` / `siteEligibility` alone, and a stub that helpfully supplied an
// outcome would be testing a shape the endpoint cannot produce.
const ROW = (over = {}) => ({
  id: 'ELG-1',
  eligibilityPurpose: 'benefits',
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '0000000003',
  patientIdType: 'PRC',
  patientGender: 'male',
  patientName: 'Muhammad Ali Abbas',
  patientBirthDate: '2010-08-21T00:00:00',
  actionDateTime: DAYS_AGO(0),
  success: true,
  inforce: true,
  coverage: true,
  isEligible: true,
  siteEligibility: 'eligible',
  errorMessage: '',
  disposition: 'Eligibility confirmed by the payer.',
  statusCode: 200,
  transfer: false,
  newborn: false,
  occupation: 'student',
  maritalStatus: 'U',
  ...over,
})

// The whole (stubbed) estate. Four rows the drive can tell apart by any of the
// five filters, plus enough padding to make paging real.
const IN_WINDOW = [
  ROW({ id: 'ELG-1', patientId: '0000000003', patientName: 'Muhammad Ali Abbas' }),
  // Six days back — the far edge of the seven-day window, INSIDE it. If the
  // window were computed one day short this row would vanish.
  ROW({ id: 'ELG-0', patientId: '0000000002', patientName: 'Edge Of The Window', actionDateTime: DAYS_AGO(6) }),
  // Complete + outside network — the qualifier must render INSIDE the verdict.
  ROW({ id: 'ELG-2', patientId: '0000000004', patientName: 'Sara Al Otaibi', siteEligibility: 'outside-network' }),
  // Complete + not in force.
  ROW({ id: 'ELG-3', patientId: '0000000005', patientName: 'Omar Nasser', payerCode: 'PAY-7', providerCode: 'P002', isEligible: false, inforce: false }),
  // 🚩 Failed: the row still carries `isEligible: true`, and the verdict must
  // stay BLANK anyway. This is the row `showAll=false` would hide entirely.
  ROW({ id: 'ELG-4', patientId: '0000000006', patientName: 'Layla Hassan', success: false, isEligible: true, errorMessage: 'BV-00123: invalid member id' }),
]
// Older than the default window — only reachable once the chip is removed.
const OUT_OF_WINDOW = Array.from({ length: 60 }, (_, i) =>
  ROW({
    id: `OLD-${i + 1}`,
    patientId: '0000009999',
    patientName: `Older Patient ${i + 1}`,
    // Comfortably outside seven days, and outside the seven-day edge row too.
    actionDateTime: DAYS_AGO(90),
  }),
)

/** The re-modelled read, in the stub: filter, then page. SIS.Api owns sort/page/
 *  total (§3.3), so the stub owns them here — a stub that returned everything
 *  would make the pager untestable. */
function eligibilityList(q) {
  const showAll = q.get('showAll') === 'true'
  const from = q.get('fromDate')
  const to = q.get('toDate')
  let rows = [...IN_WINDOW, ...OUT_OF_WINDOW]
  // Upstream: `if (!showAll) query.Where(c => c.IsEligible)`.
  if (!showAll) rows = rows.filter((r) => r.isEligible)
  if (from) rows = rows.filter((r) => r.actionDateTime.slice(0, 10) >= from)
  if (to) rows = rows.filter((r) => r.actionDateTime.slice(0, 10) <= to)
  for (const [param, field] of [
    ['patientId', 'patientId'],
    ['payerCode', 'payerCode'],
    ['providerCode', 'providerCode'],
  ]) {
    const value = q.get(param)
    if (value) rows = rows.filter((r) => r[field] === value)
  }
  // The two axes, derived server-side in the stub exactly as the client derives
  // them — a stored row has no outcome, so `success` is what separates them.
  const request = (r) => (r.success === false ? 'failed' : 'complete')
  const verdict = (r) => (r.isEligible ? 'eligible' : r.inforce ? 'notEligible' : 'notInForce')
  if (q.get('request')) rows = rows.filter((r) => request(r) === q.get('request'))
  if (q.get('verdict')) rows = rows.filter((r) => request(r) === 'complete' && verdict(r) === q.get('verdict'))

  rows.sort((a, b) => b.actionDateTime.localeCompare(a.actionDateTime))
  const page = Number(q.get('page') || 1)
  const pageSize = Number(q.get('pageSize') || 50)
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  }
}

// ---- ticket 213: the response detail, and the seam out of it ---------------
//
// `GET Nphies/EligibilityResponse/{id}` (§1.1 #4) answers the SAME
// `EligibilityResponse` DTO the check act does — header fields plus every
// coverage — which is why the fixtures below are `RESPONSE()` with a different
// `coverages` array and nothing else invented.
const COVERAGE = (over = {}) => ({
  id: 'COV-1',
  sequence: 1,
  coverageId: 'COV-1',
  memberId: 'M-4417',
  subscriberId: 'S-1',
  network: 'Gold',
  coveragePlan: 'Comprehensive',
  coverageClass: 'Class A',
  coverageGroup: 'G-1',
  policyHolderName: 'Al Dawaa Medical Services',
  inForce: true,
  benefitStart: '2026-01-01',
  benefitEnd: '2026-12-31',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  ...over,
})

// Contract fixture 1 — an eligible check, ONE coverage: auto-selected, no picker.
const DETAIL_ONE = RESPONSE({ id: 'ELG-1', coverages: [COVERAGE()] })
// Ticket 213's own case — a LONE EXPIRED coverage. Still auto-selected: the
// Verdict column is what says it is not in force.
const DETAIL_LONE_EXPIRED = RESPONSE({
  id: 'ELG-3',
  isEligible: false,
  inforce: false,
  notInForceReason: 'Policy expired on 2026-06-30',
  coverages: [COVERAGE({ id: 'COV-X', memberId: 'M-EXPIRED', inForce: false })],
})
// Contract fixture 2 — three coverages: the pick is forced, no default.
const DETAIL_THREE = RESPONSE({
  id: 'ELG-2',
  coverages: [
    COVERAGE({ id: 'COV-1', sequence: 1, memberId: 'M-1', coveragePlan: 'Comprehensive' }),
    COVERAGE({ id: 'COV-2', sequence: 2, memberId: 'M-2', coveragePlan: 'Basic', inForce: false }),
    COVERAGE({ id: 'COV-3', sequence: 3, memberId: 'M-3', coveragePlan: 'Dental' }),
  ],
})
// A SECOND multi-coverage patient, reachable from the list by a client-side
// navigation — which is what makes the stale-pick trap below reachable at all.
const DETAIL_TWO = RESPONSE({
  id: 'ELG-0',
  patientName: 'Edge Of The Window',
  patientId: '0000000002',
  coverages: [
    COVERAGE({ id: 'COV-A', sequence: 1, memberId: 'M-5A' }),
    COVERAGE({ id: 'COV-B', sequence: 2, memberId: 'M-5B', coveragePlan: 'Basic' }),
  ],
})
// 🚩 `MemberId` is nullable on `EligibilityCoverageResponse`, and §7.1's `Open`
// takes one. A lone coverage without it is still auto-selected, and still cannot
// be raised.
const DETAIL_NO_MEMBER = RESPONSE({ id: 'ELG-9', coverages: [COVERAGE({ memberId: '' })] })
const DETAIL_NONE = RESPONSE({ id: 'ELG-4', coverages: [] })

const DETAILS = {
  'ELG-1': DETAIL_ONE,
  'ELG-2': DETAIL_THREE,
  'ELG-3': DETAIL_LONE_EXPIRED,
  'ELG-0': DETAIL_TWO,
  'ELG-9': DETAIL_NO_MEMBER,
  'ELG-4': DETAIL_NONE,
}

// Scenario state, mutated between steps.
let scenario = { access: { canOpenNphies: true }, response: RESPONSE(), lastEligibility: LAST }
let lastCheckBody = null
let lastListQuery = null

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'Nphies/Access') {
      if (scenario.accessDown)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'down' }))
      return route.fulfill(envelope(scenario.access))
    }
    if (path === 'Nphies/Providers') return route.fulfill(envelope(PROVIDERS))
    if (path === 'Nphies/EligibilityResponses') {
      lastListQuery = new URLSearchParams(url.split('?')[1] || '')
      // A guardrail refusal (taxonomy kind 2): non-2xx carrying the envelope
      // with `success:false` and a human, server-supplied message.
      if (scenario.listDown)
        return route.fulfill(
          envelope(null, {
            status: 409,
            success: false,
            message: 'The date range is wider than this report allows.',
            errors: [{ errorCode: 'INVALID_DATE_RANGE', errorMessage: 'range too wide' }],
          }),
        )
      return route.fulfill(envelope(eligibilityList(lastListQuery)))
    }
    if (path.startsWith('Nphies/EligibilityResponse/')) {
      const id = decodeURIComponent(path.split('Nphies/EligibilityResponse/')[1] || '')
      if (scenario.detailDown)
        return route.fulfill(
          envelope(null, {
            status: 404,
            success: false,
            message: 'That eligibility response no longer exists.',
            errors: [{ errorCode: 'NOT_FOUND', errorMessage: 'no such response' }],
          }),
        )
      const found = DETAILS[id]
      if (!found)
        return route.fulfill(
          envelope(null, {
            status: 404,
            success: false,
            message: 'That eligibility response no longer exists.',
          }),
        )
      return route.fulfill(envelope(found))
    }
    if (path.startsWith('Nphies/LastEligibility/')) {
      // `fillDelayMs` holds the answer back so the stale-response race is
      // reachable from a drive at all.
      if (scenario.fillDelayMs) await new Promise((r) => setTimeout(r, scenario.fillDelayMs))
      return route.fulfill(envelope(scenario.lastEligibility))
    }
    if (path === 'Nphies/CheckEligibility') {
      lastCheckBody = JSON.parse(route.request().postData() || '{}')
      if (scenario.refusal)
        return route.fulfill(
          envelope(null, {
            status: 409,
            success: false,
            message: "Provider doesn't configured!",
            errors: [
              { errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: "Provider doesn't configured!" },
            ],
          }),
        )
      return route.fulfill(envelope(scenario.response))
    }
    // Any other probe → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  // ---- Scenario 1: granted → leaf present, form open, provider unchosen ----
  await page.goto(URL)
  await page.getByRole('button', { name: /^Check eligibility$/ }).waitFor({ timeout: 15000 })

  const leaf = await page.getByRole('link', { name: /Check eligibility/i }).count()
  check('granted → the Nphies nav leaf is present', leaf >= 1, `${leaf} leaves`)

  const provider = page.getByLabel('Provider', { exact: true })
  check('the provider select opens on NO default', (await provider.inputValue()) === '')
  const options = await provider.locator('option').allInnerTexts()
  check(
    'only the two (unblocked) providers are offered, plus the unchosen prompt',
    options.length === 3 && options.some((o) => o.includes('P001')),
    options.join(' | '),
  )

  check(
    '🚩 gender and ID type open UNCHOSEN too — no invented identity',
    (await page.getByLabel('Gender').inputValue()) === '' &&
      (await page.getByLabel('ID type').inputValue()) === '',
  )

  const submit = page.getByRole('button', { name: /^Check eligibility$/ })
  // Withheld with `aria-disabled` so it stays focusable and can state its reason
  // (core/ui/Button's rule); the form's onSubmit is the enforcement.
  const blocked = async () => (await submit.getAttribute('aria-disabled')) === 'true'
  check('submit is BLOCKED with no provider chosen', await blocked())
  check(
    'the withheld submit states its reason on hover/focus',
    /choose the provider/i.test((await submit.getAttribute('title')) || ''),
  )
  const blockerText = await page.locator('[role="status"]').first().innerText().catch(() => '')
  check(
    'the blocker names the provider as the thing to do',
    /choose the provider/i.test(blockerText),
    blockerText.replace(/\n/g, ' ').slice(0, 90),
  )

  // ---- Scenario 2: Fill on a COLD form, from a patient id alone ----
  await page.getByLabel('Patient ID', { exact: true }).fill('0000000003')
  await page.getByRole('button', { name: /^Fill$/ }).click()
  await page.waitForTimeout(400)
  check(
    'Fill completes the identity block on a cold form',
    (await page.getByLabel('Patient name').inputValue()) === 'Muhammad Ali Abbas' &&
      (await page.getByLabel('Member ID').inputValue()) === 'M-4417' &&
      (await page.getByLabel('Payer code').inputValue()) === 'PAY-9',
  )
  check(
    'Fill trims the service DateTime to the date the input speaks',
    (await page.getByLabel('Date of birth').inputValue()) === '2010-08-21',
  )
  check(
    'Fill completes the identity fields that would otherwise block',
    (await page.getByLabel('ID type').inputValue()) === 'PRC' &&
      (await page.getByLabel('Gender').inputValue()) === 'male',
  )
  check(
    '🚩 Fill does NOT choose a provider, though the last check names one',
    (await provider.inputValue()) === '',
  )
  check('submit is STILL blocked after Fill', await blocked())

  // ---- Scenario 3: choosing a provider unblocks submit ----
  await provider.selectOption('P001')
  await page.waitForTimeout(150)
  check('choosing a provider unblocks submit', !(await blocked()))
  check(
    'the blocker banner is gone',
    !/choose the provider/i.test(await page.locator('main').innerText()),
  )

  // ---- Scenario 4: a Complete + Eligible + outside-network answer ----
  scenario.response = RESPONSE({ siteEligibility: 'outside-network' })
  await submit.click()
  await page.getByText(/^Verdict$/).waitFor({ timeout: 10000 })
  const result = await page.locator('main').innerText()
  check('Request axis renders Complete', /Complete/.test(result))
  check(
    '🚩 the verdict is ONE qualified cell — "Eligible · outside network"',
    /Eligible · outside network/.test(result),
    (result.match(/Eligible[^\n]*/) || [''])[0],
  )
  const badges = await page.locator('main span.rounded-full').allInnerTexts()
  check(
    'the qualifier lives INSIDE the verdict badge, not beside it',
    badges.some((b) => /^Eligible · outside network$/.test(b.trim())),
    badges.join(' | '),
  )
  check('the payer’s coverage is listed under the answer', /M-4417/.test(result) && /Gold/.test(result))
  check(
    'a completed check never renders the dual-meaning message field',
    !/Could not reach the payer/i.test(result),
  )

  // The body that was sent — law 7: the browser stamps no identity.
  check(
    'the request body is EligibilityRequest verbatim, purpose pinned',
    lastCheckBody &&
      lastCheckBody.providerCode === 'P001' &&
      lastCheckBody.eligibilityPurpose === 'benefits' &&
      lastCheckBody.patientId === '0000000003',
    JSON.stringify(lastCheckBody),
  )
  check(
    '🚩 no server-stamped identity and no claim/request type left the browser',
    lastCheckBody &&
      !('distributionChannel' in lastCheckBody) &&
      !('userId' in lastCheckBody) &&
      !('staffId' in lastCheckBody) &&
      !('sourceCode' in lastCheckBody) &&
      !('claimType' in lastCheckBody) &&
      !('claimRequestType' in lastCheckBody) &&
      !('hidpReference' in lastCheckBody),
  )

  // ---- Scenario 5: not in force — verdict populated, reason shown ----
  scenario.response = RESPONSE({
    isEligible: false,
    inforce: false,
    notInForceReason: 'Policy expired on 2026-06-30, ',
  })
  await submit.click()
  await page.getByText(/Why the policy is not in force/).waitFor({ timeout: 10000 })
  const notInForce = await page.locator('main').innerText()
  check('a not-in-force check renders its verdict', /Not in force/.test(notInForce))
  check('and the payer’s decoded reason beside it', /Policy expired on 2026-06-30/.test(notInForce))

  // ---- Scenario 6: Failed — verdict BLANK, message under a failure label ----
  scenario.response = RESPONSE({
    outcome: 'error',
    success: false,
    isEligible: true, // 🚩 the trap: the row carries it whatever happened
    errorMessage: 'The exchange could not be reached.',
  })
  await submit.click()
  await page.getByText(/Could not reach the payer/).waitFor({ timeout: 10000 })
  const failed = await page.locator('main').innerText()
  check('a failed request renders Failed', /Failed/.test(failed))
  check(
    '🚩 the verdict is BLANK on a Failed request, even with isEligible:true on the row',
    !/Eligible/.test(failed.split('Verdict')[1] || ''),
    (failed.match(/Verdict[\s\S]{0,40}/) || [''])[0].replace(/\n/g, ' '),
  )
  check(
    'the message is read under a FAILURE label, not a neutral one',
    /Could not reach the payer/.test(failed) && /exchange could not be reached/.test(failed),
  )

  // ---- Scenario 7: Pending — waiting is the normal path to a verdict ----
  scenario.response = RESPONSE({ outcome: 'queued', success: true, isEligible: false })
  await submit.click()
  // Wait for the badge itself, not a timeout: a `split('Verdict')` over a page
  // that never rendered the result would pass this vacuously.
  await page.locator('main span.rounded-full', { hasText: /^Pending$/ }).waitFor({ timeout: 10000 })
  const pending = await page.locator('main').innerText()
  check('a queued check renders Pending', /Pending/.test(pending))
  check(
    'with a blank verdict',
    pending.includes('Verdict') && !/Eligible|Not eligible/.test(pending.split('Verdict')[1] || ''),
  )

  // ---- Scenario 8: a guardrail refusal explains itself from its code ----
  scenario.refusal = true
  await submit.click()
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  const refusal = await page.locator('[role="alert"]').innerText()
  check(
    'a business refusal surfaces the server’s own message, never "unexpected"',
    /doesn't configured/i.test(refusal) && !/unexpected/i.test(refusal),
    refusal.replace(/\n/g, ' ').slice(0, 90),
  )
  check(
    'and the CODE drives a remedy naming the control, rather than being printed at the agent',
    /not configured at the exchange/i.test(await page.locator('main').innerText()) &&
      !/PROVIDER_NOT_CONFIGURED/.test(await page.locator('main').innerText()),
  )
  scenario.refusal = false

  // ---- Scenario 8b: the outcome/success trap — a refusal is NOT a verdict ----
  // `Outcome` is filled before the exchange's validation errors throw, so a
  // refused check can arrive saying `complete` with `success:false`.
  scenario.response = RESPONSE({
    outcome: 'complete',
    success: false,
    isEligible: true,
    errorMessage: 'BV-00123: invalid member id',
  })
  await submit.click()
  await page.getByText(/Could not reach the payer/).waitFor({ timeout: 10000 })
  const trap = await page.locator('main').innerText()
  check(
    '🚩 outcome:complete + success:false renders Failed, never a payer verdict',
    /Failed/.test(trap) && !/Eligible/.test(trap.split('Verdict')[1] || ''),
    (trap.match(/Verdict[\s\S]{0,40}/) || [''])[0].replace(/\n/g, ' '),
  )

  // ---- Scenario 9: no grant → leaf hidden, in-page backstop ----
  scenario.access = { canOpenNphies: false }
  await page.goto(URL)
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  const denied = await page.locator('main').innerText()
  check('no grant → the in-page denied card', /No access to Nphies/.test(denied))
  check('no grant → the form is NOT rendered', (await page.getByLabel('Patient ID').count()) === 0)
  check(
    'no grant → the nav leaf is HIDDEN',
    (await page.getByRole('link', { name: /Check eligibility/i }).count()) === 0,
  )

  // ---- Scenario 10: an errored probe FAILS CLOSED ----
  // 🚩 The grant goes back to TRUE first. Without it scenario 9's
  // `canOpenNphies:false` is still in force and both assertions below would pass
  // with the 500 branch deleted — the path this scenario exists for, untested.
  scenario.access = { canOpenNphies: true }
  scenario.accessDown = true
  await page.goto(URL)
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  const probeDown = await page.locator('main').innerText()
  check(
    '🚩 an ERRORED probe fails closed — the screen stays shut',
    (await page.getByLabel('Patient ID').count()) === 0,
  )
  check(
    'and it says UNAVAILABLE, not "you lack the grant" — a retry, not an administrator',
    /Nphies is unavailable/.test(probeDown) && !/does not hold the Nphies grant/.test(probeDown),
    probeDown.replace(/\n/g, ' ').slice(0, 90),
  )
  check(
    'an errored probe hides the nav leaf too',
    (await page.getByRole('link', { name: /Check eligibility/i }).count()) === 0,
  )
  scenario.accessDown = false

  // ---- Scenario 11: a slow Fill must not overwrite a corrected patient id ----
  scenario.access = { canOpenNphies: true }
  scenario.response = RESPONSE()
  await page.goto(URL)
  await page.getByLabel('Patient ID', { exact: true }).waitFor({ timeout: 15000 })
  scenario.fillDelayMs = 900
  await page.getByLabel('Patient ID', { exact: true }).fill('1111111111')
  await page.getByRole('button', { name: /^Fill$/ }).click()
  // The agent spots the typo while the read is still in flight.
  await page.waitForTimeout(150)
  await page.getByLabel('Patient ID', { exact: true }).fill('2222222222')
  await page.waitForTimeout(1400)
  check(
    '🚩 a Fill answer for an id the agent has since corrected is DISCARDED',
    (await page.getByLabel('Patient ID', { exact: true }).inputValue()) === '2222222222' &&
      (await page.getByLabel('Patient name').inputValue()) === '',
    `id=${await page.getByLabel('Patient ID', { exact: true }).inputValue()} name=${await page.getByLabel('Patient name').inputValue()}`,
  )
  scenario.fillDelayMs = 0

  // ---- Scenario 12: the previous answer is dropped when the form changes ----
  await page.getByLabel('Patient ID', { exact: true }).fill('0000000003')
  await page.getByRole('button', { name: /^Fill$/ }).click()
  await page.waitForTimeout(400)
  await page.getByLabel('Provider', { exact: true }).selectOption('P001')
  await page.getByRole('button', { name: /^Check eligibility$/ }).click()
  await page.getByText(/^Verdict$/).waitFor({ timeout: 10000 })
  check('a result renders for the patient that was asked about', /Verdict/.test(await page.locator('main').innerText()))
  await page.getByLabel('Patient ID', { exact: true }).fill('0000000009')
  await page.waitForTimeout(200)
  check(
    '🚩 editing the form drops the previous answer — no verdict under another patient’s name',
    !/Verdict/.test(await page.locator('main').innerText()),
  )

  // ==== ticket 212: the list opens on a VISIBLE window =====================
  const LIST_URL = BASE + '/nphies/eligibility'
  const iso = isoOf
  const today = NOW
  // SEVEN calendar dates inclusive: today-6 … today. Not today-7, which is eight.
  const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)

  await page.goto(LIST_URL)
  await page.getByRole('button', { name: /^Search$/ }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)

  // ---- Scenario 13: the default window, and the chip that states it -------
  check(
    'the list opens on the LAST 7 DAYS, in the query',
    lastListQuery &&
      lastListQuery.get('fromDate') === iso(weekAgo) &&
      lastListQuery.get('toDate') === iso(today),
    lastListQuery ? lastListQuery.toString() : 'no query',
  )
  check(
    '🚩 and it asks for EVERY row — showAll=true, or the refusals are invisible',
    lastListQuery && lastListQuery.get('showAll') === 'true',
  )
  check(
    'the list is server-paged: page and pageSize travel with every read',
    lastListQuery && lastListQuery.get('page') === '1' && lastListQuery.get('pageSize') === '50',
  )
  const chip = await page.locator('main').innerText()
  check(
    '🚩 the window is VISIBLE as a chip, not applied silently',
    /Last 7 days/.test(chip) && chip.includes(iso(weekAgo)) && chip.includes(iso(today)),
    (chip.match(/Last 7 days[^\n]*/) || [''])[0],
  )
  check(
    'the seven-day window spans SEVEN dates — the row on its far edge is inside',
    /Edge Of The Window/.test(chip),
  )

  // ---- Scenario 14: both axes render, and the traps hold on a LIST row ----
  const listText = await page.locator('main').innerText()
  check('the in-window checks are listed', /Muhammad Ali Abbas/.test(listText) && /Layla Hassan/.test(listText))
  const listBadges = await page.locator('main span.rounded-full').allInnerTexts()
  check(
    '🚩 a stored row (no `outcome` column exists) reads as Complete, not Pending',
    listBadges.some((b) => /^Complete$/.test(b.trim())) && !listBadges.some((b) => /^Pending$/.test(b.trim())),
    listBadges.join(' | '),
  )
  check(
    '🚩 the verdict is ONE qualified cell on the list too — "Eligible · outside network"',
    listBadges.some((b) => /^Eligible · outside network$/.test(b.trim())),
    listBadges.join(' | '),
  )
  check('a not-in-force row states its verdict', listBadges.some((b) => /^Not in force$/.test(b.trim())))
  check(
    '🚩 a Failed row shows Failed and a BLANK verdict, though it carries isEligible:true',
    listBadges.some((b) => /^Failed$/.test(b.trim())) &&
      /Could not reach the payer/.test(listText) &&
      /BV-00123/.test(listText),
  )

  // ---- Scenario 15: removing the chip DROPS the window --------------------
  await page.getByRole('button', { name: /Remove the date window/i }).click()
  await page.waitForTimeout(500)
  check(
    '🚩 removing the chip drops the window from the query — no wider one substituted',
    lastListQuery && !lastListQuery.has('fromDate') && !lastListQuery.has('toDate'),
    lastListQuery ? lastListQuery.toString() : 'no query',
  )
  const removed = await page.locator('main').innerText()
  check(
    'and the screen SAYS the window is gone rather than falling silent',
    /No date window/.test(removed) && !/Last 7 days/.test(removed),
  )
  check(
    'the older checks the window was hiding are now reachable',
    /65 checks/.test(removed),
    (removed.match(/\d+ checks?/) || [''])[0],
  )
  check(
    '🚩 the count, the chip and the rows all describe the SAME read — no "everything" over a week',
    !(/No date window/.test(removed) && /\b5 checks\b/.test(removed)),
    (removed.match(/\d+ checks?/) || [''])[0],
  )

  // ---- Scenario 16: paging moves through the results ----------------------
  check('a result past one page grows a pager', (await page.getByRole('navigation', { name: /pages/i }).count()) === 1)
  check('the readout counts pages from the TRUE total', /Page 1 of 2/.test(removed))
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.waitForTimeout(500)
  check('Next asks the server for page 2', lastListQuery && lastListQuery.get('page') === '2')
  const page2 = await page.locator('main').innerText()
  check('page 2 renders its own rows', /Page 2 of 2/.test(page2) && /Older Patient/.test(page2))
  check(
    'the window stays removed while paging — a page step is not a new search',
    lastListQuery && !lastListQuery.has('fromDate'),
  )
  await page.getByRole('button', { name: /^Previous$/ }).click()
  await page.waitForTimeout(400)
  check('Previous walks back', lastListQuery && lastListQuery.get('page') === '1')

  // ---- Scenario 17: the five filters narrow, and the axes do so alone -----
  const providerFilter = page.getByLabel('Provider', { exact: true })
  check(
    '🚩 the provider filter defaults to ALL providers — the opposite of a till',
    (await providerFilter.inputValue()) === '',
  )
  await providerFilter.selectOption('P002')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(500)
  check('the provider filter narrows the list', lastListQuery && lastListQuery.get('providerCode') === 'P002')
  check(
    'a new filter starts back at page 1',
    lastListQuery && lastListQuery.get('page') === '1',
  )
  check('and only that provider’s rows remain', /Omar Nasser/.test(await page.locator('main').innerText()))

  await providerFilter.selectOption('')
  await page.getByLabel('Patient ID', { exact: true }).fill('0000000004')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(500)
  check(
    'the patient id filter narrows the list, and the cleared provider is dropped',
    lastListQuery &&
      lastListQuery.get('patientId') === '0000000004' &&
      !lastListQuery.has('providerCode'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  check('and only that patient’s check remains', /1 check\b/.test(await page.locator('main').innerText()))

  await page.getByLabel('Patient ID', { exact: true }).fill('')
  await page.getByLabel('Payer code', { exact: true }).fill('PAY-7')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(500)
  check(
    'the payer filter narrows the list, and the blank patient id is dropped',
    lastListQuery && lastListQuery.get('payerCode') === 'PAY-7' && !lastListQuery.has('patientId'),
    lastListQuery ? lastListQuery.toString() : '',
  )

  await page.getByLabel('Payer code', { exact: true }).fill('')
  const requestFilter = page.getByLabel('Request', { exact: true })
  const requestOptions = await requestFilter.locator('option').allInnerTexts()
  check(
    '🚩 the Request filter offers only what a stored row can BE — no Cancelled, no Pending',
    !requestOptions.some((o) => /Cancelled|Pending/.test(o)) &&
      requestOptions.some((o) => /Failed/.test(o)) &&
      requestOptions.some((o) => /Complete/.test(o)),
    requestOptions.join(' | '),
  )
  await requestFilter.selectOption('failed')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(500)
  check(
    'the Request axis narrows on its own',
    lastListQuery && lastListQuery.get('request') === 'failed' && !lastListQuery.has('verdict'),
  )
  check('and only the refused check remains', /Layla Hassan/.test(await page.locator('main').innerText()))

  await requestFilter.selectOption('')
  await page.getByLabel('Verdict', { exact: true }).selectOption('notInForce')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(500)
  check(
    '🚩 the Verdict axis narrows WITHOUT a Request filter — a legal question on its own',
    lastListQuery && lastListQuery.get('verdict') === 'notInForce' && !lastListQuery.has('request'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  check('and only the not-in-force check remains', /Omar Nasser/.test(await page.locator('main').innerText()))

  // ---- Scenario 17b: a WIDENED window stops calling itself "last 7 days" --
  await page.getByLabel('Verdict', { exact: true }).selectOption('')
  await page.getByLabel('From', { exact: true }).fill('2020-01-01')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(500)
  const widened = await page.locator('main').innerText()
  check(
    '🚩 a widened window is stated as itself, NOT as "Last 7 days"',
    widened.includes('2020-01-01') && !/Last 7 days/.test(widened),
    (widened.match(/2020-01-01[^\n]*/) || [''])[0],
  )
  check(
    'and widening really does reach the older checks',
    /65 checks/.test(widened),
    (widened.match(/\d+ checks?/) || [''])[0],
  )

  // ---- Scenario 18: Reset restores the window it opened on ----------------
  await page.getByRole('button', { name: /^Reset$/ }).click()
  await page.waitForTimeout(500)
  check(
    'Reset restores the seven-day window and clears every filter',
    lastListQuery &&
      lastListQuery.get('fromDate') === iso(weekAgo) &&
      !lastListQuery.has('verdict') &&
      !lastListQuery.has('patientId'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  check('and the chip is back', /Last 7 days/.test(await page.locator('main').innerText()))

  // ---- Scenario 19: the list leaf, and the gate behind it -----------------
  check(
    'the Nphies group carries BOTH leaves for a granted agent',
    (await page.getByRole('link', { name: /^Eligibility checks$/ }).count()) === 1 &&
      (await page.getByRole('link', { name: /^Check eligibility$/ }).count()) === 1,
  )
  scenario.access = { canOpenNphies: false }
  await page.goto(LIST_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  check(
    'no grant → the list refuses in page too, and its leaf is hidden',
    /No access to Nphies/.test(await page.locator('main').innerText()) &&
      (await page.getByRole('link', { name: /^Eligibility checks$/ }).count()) === 0,
  )
  scenario.access = { canOpenNphies: true }

  // ---- Scenario 20: a failed read explains itself, it does not blank ------
  scenario.listDown = true
  await page.goto(LIST_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  const listRefused = await page.locator('main').innerText()
  check(
    'a refused list read surfaces the server’s own message, never "unexpected"',
    /wider than this report allows/i.test(listRefused) && !/unexpected/i.test(listRefused),
    listRefused.replace(/\n/g, ' ').slice(0, 100),
  )
  check(
    'and it does not leave an empty grid reading as "no checks match"',
    !/No checks match/.test(listRefused),
  )
  scenario.listDown = false

  // ==== ticket 213: two coverages force a pick =============================
  //
  // ⚠ `GET Nphies/EligibilityResponse/{id}` does not exist yet either — stubbed
  // above against §1.1 #4's shape, which is the same `EligibilityResponse` DTO
  // the check act answers with.

  /** The LIVE seam, or `null` when the act is withheld. Read off the anchor
   *  rather than the role: the withheld act is deliberately a focusable
   *  `role="link"` span carrying its reason, so a role query would find it and a
   *  "no link" assertion would pass for the wrong reason. */
  const raiseLink = page.locator('main a[href^="/nphies/authorizations/new"]')
  const raiseHref = async () =>
    (await raiseLink.count()) === 1 ? await raiseLink.getAttribute('href') : null

  // ---- Scenario 21: the list OPENS the detail, and it is a real link -------
  await page.goto(LIST_URL)
  await page.getByRole('button', { name: /^Search$/ }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  const openLinks = page.getByRole('link', { name: /^Open$/ })
  check('every row offers a way into its response', (await openLinks.count()) >= 5)
  check(
    '🚩 and it is an ANCHOR carrying the id — linkable, not a row-click handler',
    /\/nphies\/eligibility\/ELG-\d+$/.test((await openLinks.first().getAttribute('href')) || ''),
    (await openLinks.first().getAttribute('href')) || 'no href',
  )

  // ---- Scenario 22: ONE coverage — auto-selected, no picker ---------------
  await page.goto(BASE + '/nphies/eligibility/ELG-1')
  await raiseLink.waitFor({ timeout: 15000 })
  const one = await page.locator('main').innerText()
  check('the detail lists the coverage in full', /M-4417/.test(one) && /Comprehensive/.test(one) && /Al Dawaa Medical Services/.test(one))
  check(
    '🚩 one coverage costs NO click — there is no picker at all',
    (await page.locator('main input[type="radio"]').count()) === 0,
  )
  check('and the raise is not held', !/Cannot raise an authorization yet/.test(one))
  check(
    '🚩 the seam carries BOTH ids — the eligibility and the chosen member',
    (await raiseHref()) ===
      '/nphies/authorizations/new?from=ELG-1&coverage=M-4417',
    (await raiseHref()) || '',
  )
  check(
    'the detail states both axes from the same shared derivation as the list',
    /Request/.test(one) && /Verdict/.test(one) && /Complete/.test(one) && /Eligible/.test(one),
  )
  check(
    'and it lists the patient it is about, read-only',
    /Muhammad Ali Abbas/.test(one) &&
      (await page.locator('main input[type="text"]').count()) === 0,
  )

  // ---- Scenario 23: a LONE EXPIRED coverage is still auto-selected --------
  await page.goto(BASE + '/nphies/eligibility/ELG-3')
  await raiseLink.waitFor({ timeout: 15000 })
  const expired = await page.locator('main').innerText()
  check(
    '🚩 a lone EXPIRED coverage is auto-selected — the rule is keyed on the COUNT',
    (await page.locator('main input[type="radio"]').count()) === 0 &&
      !/Cannot raise an authorization yet/.test(expired),
  )
  check(
    'and the Verdict column is what says it is not in force, not an empty screen',
    /Not in force/.test(expired) && /Policy expired on 2026-06-30/.test(expired),
  )
  check(
    'the seam still carries the expired policy’s member id',
    (await raiseHref()) ===
      '/nphies/authorizations/new?from=ELG-3&coverage=M-EXPIRED',
  )

  // ---- Scenario 24: THREE coverages — the pick is forced, no default ------
  await page.goto(BASE + '/nphies/eligibility/ELG-2')
  await page.getByText(/Pick the policy/).waitFor({ timeout: 15000 })
  const three = await page.locator('main').innerText()
  check('the detail lists EVERY coverage the patient holds', /M-1/.test(three) && /M-2/.test(three) && /M-3/.test(three))
  const radios = page.locator('main input[type="radio"]')
  check('two or more grows a picker', (await radios.count()) === 3)
  check(
    '🚩 with NO default — not the first, not the in-force one',
    (await radios.nth(0).isChecked()) === false &&
      (await radios.nth(1).isChecked()) === false &&
      (await radios.nth(2).isChecked()) === false,
  )
  // 🚩 Asserted on the ANCHOR, not on the accessible role: the withheld act is a
  // `role="link"` + `aria-disabled` span on purpose — a command withheld WITH a
  // reason stays focusable so it can state it. What must not exist is a live
  // href, which is what `a[href…]` asks about.
  check(
    '🚩 and the raise is BLOCKED until the agent picks — no live href anywhere',
    (await raiseHref()) === null && /pick one of the policies above/i.test(three),
  )
  const withheld = page.locator('[role="link"][aria-disabled="true"]')
  check(
    'the withheld act states its reason on hover/focus rather than going dead',
    /pick one of the policies/i.test((await withheld.getAttribute('title')) || ''),
    (await withheld.getAttribute('title')) || '',
  )

  await radios.nth(1).check()
  await page.waitForTimeout(200)
  const picked = await page.locator('main').innerText()
  check('picking releases the act', !/Cannot raise an authorization yet/.test(picked))
  check(
    '🚩 and the seam carries the member id the agent MEANT, not the first row’s',
    (await raiseHref()) ===
      '/nphies/authorizations/new?from=ELG-2&coverage=M-2',
    (await raiseHref()) || '',
  )
  await radios.nth(2).check()
  await page.waitForTimeout(200)
  check(
    'changing the pick moves the seam with it',
    (await raiseHref()) ===
      '/nphies/authorizations/new?from=ELG-2&coverage=M-3',
  )

  // ---- Scenario 24b: another patient opens unpicked, in a live session -----
  //
  // The client-side path — Back, then Open — rather than a `goto`, so the app's
  // own router does the work an agent's clicks would. ⚠ Stated honestly: today
  // this leaves the detail's route, so the screen remounts and the assertion
  // cannot fail; the page ALSO stamps its pick with the response id, which is
  // what would hold if a detail ever linked straight to another detail.
  //
  // The pick is moved back to the SECOND row first: the next patient holds two
  // coverages, so an index of 2 would fall out of range and this would pass for
  // the wrong reason whatever the screen did. Index 1 is in range on both.
  await radios.nth(1).check()
  await page.waitForTimeout(150)
  await page.getByRole('link', { name: /Back to eligibility checks/ }).click()
  await page.getByRole('button', { name: /^Search$/ }).waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  await page.locator('a[href="/nphies/eligibility/ELG-0"]').first().click()
  await page.getByText(/Pick the policy/).waitFor({ timeout: 15000 })
  const nextPatient = await page.locator('main').innerText()
  check(
    'another patient’s response opens with NO policy picked, mid-session',
    (await page.locator('main input[type="radio"]:checked').count()) === 0 &&
      (await raiseHref()) === null &&
      /M-5A/.test(nextPatient) &&
      /pick one of the policies above/i.test(nextPatient),
  )

  // ---- Scenario 25: the two cases that cannot be raised at all ------------
  await page.goto(BASE + '/nphies/eligibility/ELG-9')
  await page.getByText(/Cannot raise an authorization yet/).waitFor({ timeout: 15000 })
  const noMember = await page.locator('main').innerText()
  check(
    '🚩 a lone coverage with no member ID is selected, and still cannot be raised',
    (await page.locator('main input[type="radio"]').count()) === 0 &&
      /carries no member ID/i.test(noMember) &&
      (await raiseHref()) === null,
    noMember.replace(/\n/g, ' ').match(/Cannot raise[^.]*/)?.[0] || '',
  )

  await page.goto(BASE + '/nphies/eligibility/ELG-4')
  await page.getByText(/Cannot raise an authorization yet/).waitFor({ timeout: 15000 })
  const none = await page.locator('main').innerText()
  check(
    'no coverages at all: no picker, and the act names the fact rather than a control',
    /no coverage for this patient/i.test(none) &&
      (await page.locator('main input[type="radio"]').count()) === 0,
  )

  // ---- Scenario 26: the detail is a ROUTE — it survives a reload ----------
  await page.goto(BASE + '/nphies/eligibility/ELG-2')
  await page.getByText(/Pick the policy/).waitFor({ timeout: 15000 })
  await page.reload()
  await page.getByText(/Pick the policy/).waitFor({ timeout: 15000 })
  check(
    '🚩 a refresh lands back on the same response — a route, never a modal',
    /M-1/.test(await page.locator('main').innerText()),
  )
  check(
    'and the pick is NOT restored — no default survives a reload either',
    (await page.locator('main input[type="radio"]:checked').count()) === 0,
  )

  // ---- Scenario 27: a response that cannot be read says so ----------------
  scenario.detailDown = true
  await page.goto(BASE + '/nphies/eligibility/ELG-1')
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  const detailRefused = await page.locator('main').innerText()
  check(
    'a refused detail read surfaces the server’s own message, never "unexpected"',
    /no longer exists/i.test(detailRefused) && !/unexpected/i.test(detailRefused),
    detailRefused.replace(/\n/g, ' ').slice(0, 100),
  )
  check(
    'and it offers no raise over a response it could not read',
    (await raiseHref()) === null,
  )
  scenario.detailDown = false

  // ---- Scenario 28: the gate holds on the detail too ----------------------
  scenario.access = { canOpenNphies: false }
  await page.goto(BASE + '/nphies/eligibility/ELG-1')
  await page.waitForSelector('[role="alert"]', { timeout: 10000 })
  check(
    'no grant → the detail refuses in page, and nothing about the patient renders',
    /No access to Nphies/.test(await page.locator('main').innerText()) &&
      !/Muhammad Ali Abbas/.test(await page.locator('main').innerText()),
  )
  scenario.access = { canOpenNphies: true }

  // The refusal + probe-down scenarios intentionally answer 409/500, which the
  // browser logs as resource errors. Expected, not app faults.
  const realErrors = errors.filter((e) => !/status of (403|404|409|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed_ = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed_}/${results.length} passed`)
  process.exit(failed_ ? 1 : 0)
}

run()

