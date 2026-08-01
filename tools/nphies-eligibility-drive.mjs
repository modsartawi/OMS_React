// Nphies eligibility-check drive (ticket 211, spec 209, contract v1.0) — drives the
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

// Scenario state, mutated between steps.
let scenario = { access: { canOpenNphies: true }, response: RESPONSE(), lastEligibility: LAST }
let lastCheckBody = null

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

  // The refusal + probe-down scenarios intentionally answer 409/500, which the
  // browser logs as resource errors. Expected, not app faults.
  const realErrors = errors.filter((e) => !/status of (409|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed_ = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed_}/${results.length} passed`)
  process.exit(failed_ ? 1 : 0)
}

run()
