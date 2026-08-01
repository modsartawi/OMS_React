// Nphies authorizations drive (tickets 214 · 215 · 216, spec 209, contract v1.0) — drives the REAL app
// in Chromium against MOCKED `Nphies/*` envelopes.
//
// ⚠ SIS.Api is down and this slice's server dependency does not exist: the re-modelled
// `GET Nphies/AuthResponses` is BackOffice 913's half, being written in parallel. So the
// network is stubbed at Playwright against the contract's own shapes — the same
// code-complete / runtime-blocked posture 211–213 shipped under. Every stubbed field name
// below is `AuthForListDto`'s (`Features/Auth/AuthsDtos/AuthForListDto.cs`, read
// 2026-08-02) or CONTRACT.md's, which makes the stub a contract assertion rather than a
// convenience.
//
// It verifies ticket 214's flow Proof bullet — the list opens on the window, both markers
// render, Refresh restates the load time — plus the two things that fail silently:
//   🚩 `showAll=true`, without which a refused authorization is invisible (§3.3);
//   🚩 no browser polling of any kind (§3.6) — the service's own worker is the poller.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/nphies-authorizations-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const LIST_URL = BASE + '/nphies/authorizations'

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

// The in-window rows are stamped from the REAL clock, not a frozen date: the
// screen's default window is derived from today, so a hard-coded fixture would
// quietly fall out of the window tomorrow and the drive would assert against an
// empty list.
const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const NOW = new Date()
const DAYS_AGO = (n) =>
  isoOf(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n)) + 'T09:15:00'

// One row of `GET Nphies/AuthResponses` — `AuthForListDto` verbatim. Unlike the
// eligibility row it carries NO patient name: the DTO has none, and a stub that
// helpfully supplied one would be testing a shape the endpoint cannot produce.
const ROW = (over = {}) => ({
  id: 'AUTH-1',
  eligibilityId: 'ELG-1',
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '0000000003',
  preAuthRef: 'PA-1001',
  claimProcessingCodes: 'Complete',
  queued: false,
  error: false,
  cancelled: false,
  adjudicationOutcome: 'approved',
  needComm: false,
  isDispensed: false,
  dispensedTime: '',
  dispensedStore: '',
  actionDateTime: DAYS_AGO(0),
  responseDateTime: DAYS_AGO(0),
  serviceDate: DAYS_AGO(0),
  errorMessageShort: '',
  disposition: 'Approved by the payer.',
  statusCode: 200,
  claimType: 0,
  ...over,
})

// Contract fixture 9 — an authorization list page: both axes, both markers,
// `showAll=true`, and a refused row PRESENT.
const IN_WINDOW = [
  // Complete + Approved, nothing flagged.
  ROW({ id: 'AUTH-1', preAuthRef: 'PA-1001' }),
  // 🚩 The ticket's own case: a payer query on a row that ALREADY has both a
  // Request state and a Verdict. It is why the marker cannot be an axis value.
  ROW({ id: 'AUTH-2', preAuthRef: 'PA-1002', patientId: '0000000004', needComm: true }),
  // Complete + Partly approved, and dispensed — the row's end of life.
  ROW({
    id: 'AUTH-3',
    preAuthRef: 'PA-1003',
    patientId: '0000000005',
    payerCode: 'PAY-7',
    providerCode: 'P002',
    adjudicationOutcome: 'partial',
    isDispensed: true,
    dispensedTime: DAYS_AGO(0),
    dispensedStore: '1101',
  }),
  // Complete + Rejected — the payer's final word. NOT a Failed.
  ROW({ id: 'AUTH-4', preAuthRef: 'PA-1004', patientId: '0000000006', adjudicationOutcome: 'rejected' }),
  // Complete + No approval needed.
  ROW({
    id: 'AUTH-5',
    preAuthRef: 'PA-1005',
    patientId: '0000000007',
    adjudicationOutcome: 'not-required',
  }),
  // Pending — the exchange is holding the question. The service's own worker will
  // pick the answer up; waiting is the normal path to a verdict.
  ROW({
    id: 'AUTH-6',
    preAuthRef: '',
    patientId: '0000000008',
    queued: true,
    claimProcessingCodes: 'Queued',
    adjudicationOutcome: '',
    errorMessageShort: 'Awaiting the exchange.',
  }),
  // 🚩 THE ROW `showAll=false` WOULD HIDE. Refused before the payer saw it, and it
  // still carries `adjudicationOutcome: 'approved'` — the verdict must stay blank.
  ROW({
    id: 'AUTH-7',
    preAuthRef: '',
    patientId: '0000000009',
    error: true,
    claimProcessingCodes: 'Error',
    adjudicationOutcome: 'approved',
    errorMessageShort: 'BV-00123: invalid member id',
  }),
  // 🚩 Cancelled, and it STILL carries Complete + approved — a cancel happens
  // after an answer. Reading the outcome first would show a withdrawn request as
  // live.
  ROW({
    id: 'AUTH-8',
    preAuthRef: 'PA-1008',
    patientId: '0000000010',
    cancelled: true,
    claimProcessingCodes: 'Complete',
    adjudicationOutcome: 'approved',
  }),
  // Both markers at once, six days back — the far edge of the seven-day window,
  // INSIDE it. If the window were computed one day short this row would vanish.
  ROW({
    id: 'AUTH-9',
    preAuthRef: 'PA-1009',
    patientId: '0000000011',
    needComm: true,
    isDispensed: true,
    actionDateTime: DAYS_AGO(6),
  }),
]
// Older than the default window — only reachable once the chip is removed.
const OUT_OF_WINDOW = Array.from({ length: 60 }, (_, i) =>
  ROW({
    id: `OLD-${i + 1}`,
    preAuthRef: `PA-OLD-${i + 1}`,
    patientId: '0000009999',
    actionDateTime: DAYS_AGO(90),
  }),
)

/** The re-modelled read, in the stub: filter, then page. SIS.Api owns sort/page/
 *  total (§3.3), so the stub owns them here — a stub that returned everything
 *  would make the pager untestable. */
function authList(q) {
  const showAll = q.get('showAll') === 'true'
  const from = q.get('fromDate')
  const to = q.get('toDate')
  let rows = [...IN_WINDOW, ...OUT_OF_WINDOW]
  // Upstream: `if (!showAll) query.Where(c => !c.Error)` (`AuthService.cs:1377`).
  if (!showAll) rows = rows.filter((r) => !r.error)
  if (from) rows = rows.filter((r) => r.actionDateTime.slice(0, 10) >= from)
  if (to) rows = rows.filter((r) => r.actionDateTime.slice(0, 10) <= to)
  for (const [param, field] of [
    ['patientId', 'patientId'],
    ['payerCode', 'payerCode'],
    ['providerCode', 'providerCode'],
    ['preAuthRef', 'preAuthRef'],
  ]) {
    const value = q.get(param)
    if (value) rows = rows.filter((r) => r[field] === value)
  }
  // The two axes, derived server-side in the stub exactly as the client derives
  // them — cancelled outranks error outranks queued outranks the stored code.
  const request = (r) =>
    r.cancelled ? 'cancelled' : r.error ? 'failed' : r.queued ? 'pending' : 'complete'
  const VERDICTS = {
    approved: 'approved',
    partial: 'partlyApproved',
    rejected: 'rejected',
    'not-required': 'noApprovalNeeded',
  }
  if (q.get('request')) rows = rows.filter((r) => request(r) === q.get('request'))
  if (q.get('verdict'))
    rows = rows.filter(
      (r) => request(r) === 'complete' && VERDICTS[r.adjudicationOutcome] === q.get('verdict'),
    )

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

// ---------------------------------------------------------------------------
// The DETAIL (ticket 216) — `GET Nphies/AuthResponse/{id}` → `NphiesAuthHeaderDto`
// (`Sartawi.Retail.Data\Modules\Nphies\Services\Models\AuthView\`, read 2026-08-02),
// SIS.Api's copy of the upstream `AuthHeaderDto` with `AuthLines` and
// `AuthSupportingInfos` eagerly fetched. Every field name below is on that DTO.
//
// 🚩 Note what is NOT here: `isDispensed`. It is on `AuthForListDto` and absent from the
// header DTO, so the detail cannot show a dispensed marker without inventing a field.

// A 1×1 JPEG and a stub PDF. Real base64, because the point of the attachment block is
// that the response already carries the bytes and the browser renders them with no
// second fetch and no upload endpoint.
const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=='
const TINY_PDF = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+PgplbmRvYmoK'

const DETAIL_LINE = (over = {}) => ({
  id: 'L1',
  sequence: 1,
  itemNumber: '100001',
  itemDescription: 'PANADOL 500MG TAB',
  quantity: 2,
  unitPrice: 25,
  extendedPrice: 50,
  amount: 50,
  netAmount: 47.5,
  vat: 7.13,
  discountPercentage: 5,
  discountAmount: 2.5,
  actualPatientShare: 9.5,
  adjudicationOutcome: 'approved',
  approvedQuantity: 2,
  rejected: 0,
  eligible: 50,
  copay: 9.5,
  benefit: 40.5,
  benefitReason: '',
  serviceDate: DAYS_AGO(0),
  daysSupply: 30,
  selectionReason: '',
  deductibleG: 9.5,
  deductibleGroupName: 'Generic',
  diagnosis: 'C50.9',
  ...over,
})

const DETAIL_BASE = (row) => ({
  contractVersion: '1.0',
  id: row.id,
  eligibilityId: row.eligibilityId,
  memberId: 'MEM-4477',
  providerCode: row.providerCode,
  payerCode: row.payerCode,
  patientId: row.patientId,
  patientIdType: 'NI',
  patientName: 'Ahmad Ali',
  patientGender: 'male',
  patientBirthDate: '1988-04-02',
  preAuthRef: row.preAuthRef,
  claimProcessingCodes: row.claimProcessingCodes,
  queued: row.queued,
  error: row.error,
  cancelled: row.cancelled,
  adjudicationOutcome: row.adjudicationOutcome,
  needComm: row.needComm,
  actionDateTime: row.actionDateTime,
  responseDateTime: row.responseDateTime,
  serviceDate: row.serviceDate,
  errorMessageShort: row.errorMessageShort,
  disposition: '',
  processNote: '',
  statusCode: row.statusCode,
  claimType: row.claimType,
  diagnosis: 'C50.9',
  policyNumber: 'POL-77',
  policyHolder: 'ACME INSURANCE',
  prescriptionRef: 'RX-9001',
  exceptionPrescription: false,
  authLines: [],
  authSupportingInfos: [],
})

/** Contract fixture 10 — a detail with a PARTIAL approval: some lines approved, some
 *  rejected, each with a decoded `BenefitReason`, plus attachments as base64. */
function authDetail(id) {
  const row = [...IN_WINDOW, ...OUT_OF_WINDOW].find((r) => r.id === id)
  if (!row) return null
  const detail = DETAIL_BASE(row)

  // 🚩 THE TICKET'S HEADLINE, on AUTH-1: the header says **Approved** and one of its
  // lines was refused. The columns are always populated, so this is just the ordinary
  // detail — there is no second surface to build.
  if (id === 'AUTH-1') {
    detail.disposition = 'Approved with adjustments.'
    detail.processNote = 'Quantity on line 2 reduced per plan limits.'
    detail.authLines = [
      DETAIL_LINE({ id: 'L1', sequence: 1 }),
      DETAIL_LINE({
        id: 'L2',
        sequence: 2,
        itemNumber: '100002',
        itemDescription: 'AMOXICILLIN 500MG CAP',
        adjudicationOutcome: 'rejected',
        approvedQuantity: 0,
        rejected: 47.5,
        benefit: 0,
        copay: 0,
        // 🚩 Already decoded server-side against the NPHIES `AdjudicationReason` code
        // system (`ProcessAuthResponse.cs:139-146` stores the `Display`). The browser
        // does NO code-system lookup.
        benefitReason: 'Service not covered under the member benefit plan',
      }),
    ]
    // The supporting infos are NOT "the attachments" — `days-supply` rides in the same
    // collection with no base64 at all.
    detail.authSupportingInfos = [
      {
        id: 'S1',
        sequence: 1,
        category: 'attachment',
        code: '',
        attachment: TINY_JPEG,
        valueString: '',
        valueBoolean: null,
        valueDecimal: null,
        attachmentType: 'image',
        attachmentTitle: 'Prescription',
        display: '',
      },
      {
        id: 'S2',
        sequence: 2,
        category: 'attachment',
        code: '',
        attachment: TINY_PDF,
        valueString: '',
        valueBoolean: null,
        valueDecimal: null,
        attachmentType: 'pdf',
        attachmentTitle: 'Medical report',
        display: '',
      },
      {
        id: 'S3',
        sequence: 3,
        category: 'days-supply',
        code: '',
        attachment: '',
        valueString: '',
        valueBoolean: null,
        valueDecimal: 30,
        attachmentType: '',
        attachmentTitle: '',
        display: '',
      },
    ]
  }

  // 🚩 A COMPLETE + Rejected authorization whose `ErrorMessageShort` holds the DECODED
  // ADJUDICATION DISPLAY — `ProcessAuthResponse.cs:120`'s branch. It must never reach the
  // screen, under any label.
  if (id === 'AUTH-4') {
    detail.errorMessageShort = 'ADJ-DISPLAY-DO-NOT-SHOW'
    detail.disposition = 'The request was not approved.'
    detail.authLines = [
      DETAIL_LINE({
        id: 'L1',
        adjudicationOutcome: 'rejected',
        approvedQuantity: 0,
        rejected: 50,
        benefit: 0,
        benefitReason: 'Prior authorization requirements not met',
      }),
    ]
  }

  // Pending — §5 puts it under the FAILURE label alongside Failed, and its lines carry
  // an outcome the payer has not given.
  if (id === 'AUTH-6') {
    detail.authLines = [DETAIL_LINE({ id: 'L1', adjudicationOutcome: 'approved' })]
  }

  // 🚩 The header-only refusal (§3.9): the service's guards throw BEFORE the lines are
  // built, so a failed authorization really can arrive with none.
  if (id === 'AUTH-7') detail.authLines = []

  return detail
}

// The cancellation reasons (ticket 215). `GET Nphies/CodeSystem?valueSet=TaskReasonCode`
// — `ValueSetConstants.TaskReasonCode`, the value set behind the cancel task's `reasonCode`
// coding (`CancellationTaskEntry.cs:77`). `blocked` is a STRING upstream, not a boolean, and
// one row is blocked precisely so the client's filter is exercised.
const TASK_REASONS = {
  contractVersion: '1.0',
  items: [
    { code: 'WI', display: 'Wrong information', blocked: 'false', valueSetName: 'TaskReasonCode' },
    { code: 'DUPL', display: 'Duplicate request', blocked: 'false', valueSetName: 'TaskReasonCode' },
    { code: 'RETIRED', display: 'Retired reason', blocked: 'true', valueSetName: 'TaskReasonCode' },
  ],
}

// Scenario state, mutated between steps.
let scenario = { access: { canOpenNphies: true } }
let lastListQuery = null
let listCalls = 0
let detailCalls = 0
// The three acts (215): the last body each received, so the drive asserts what LEFT the
// browser and not merely that something was clicked. Law 7's fields are absences, and an
// absence is only assertable against the body itself.
let lastAct = { statusCheck: null, retry: null, cancel: null }

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // ⚠ `Failed to load resource: … 409/500` is Chromium narrating the refusals this
  // drive DELIBERATELY serves (scenarios 16, 17, 18 and 20). Counting them as defects
  // would make the taxonomy's own happy path look like a crash.
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

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
    // 🚩 The lookups answer `{ contractVersion, items }` — SIS.Api's own
    // `NphiesLookupResponse<T>`, because law 10 puts the contract version on the payload
    // model and a bare array has nowhere to hang it. This drive serves the WRAPPED shape
    // (the eligibility drives still serve the bare array), so both readings of §3.8's
    // unfrozen envelope are exercised somewhere.
    if (path === 'Nphies/Providers')
      return route.fulfill(envelope({ contractVersion: '1.0', items: PROVIDERS }))
    if (path === 'Nphies/CodeSystem') {
      const valueSet = new URLSearchParams(url.split('?')[1] || '').get('valueSet')
      // A value set the client did not ask for must not answer the reasons — the query
      // param is the whole of what distinguishes 215's read from 218's.
      return route.fulfill(
        envelope(valueSet === 'TaskReasonCode' ? TASK_REASONS : { contractVersion: '1.0', items: [] }),
      )
    }
    if (path === 'Nphies/StatusCheck' || path === 'Nphies/Retry' || path === 'Nphies/Cancellation') {
      const body = JSON.parse(route.request().postData() || '{}')
      if (path === 'Nphies/StatusCheck') lastAct.statusCheck = body
      if (path === 'Nphies/Retry') lastAct.retry = body
      if (path === 'Nphies/Cancellation') lastAct.cancel = body
      // §6 kind 2: a guardrail refusal is a non-2xx carrying the envelope, a server-supplied
      // human message and a code. `AUTH_ALREADY_DISPENSED` is the one both retry and cancel
      // raise, and the row believing otherwise is exactly the case the ticket describes.
      if (scenario.actRefused)
        return route.fulfill(
          envelope(null, {
            status: 409,
            success: false,
            message: 'This authorization has already been dispensed and can no longer be changed.',
            errors: [{ errorCode: 'AUTH_ALREADY_DISPENSED', errorMessage: 'dispensed' }],
          }),
        )
      if (path === 'Nphies/Retry')
        return route.fulfill(envelope({ contractVersion: '1.0', success: true, errorMessage: '' }))
      // 🚩 A status check on a request the payer is STILL working answers `success:false`
      // with a status — the ordinary answer of this act's own use case, and DATA.
      return route.fulfill(
        envelope({
          contractVersion: '1.0',
          id: 'ACT-1',
          reference: body.reference || '',
          providerCode: 'P001',
          payerCode: 'PAY-9',
          patientId: '0000000008',
          actionDateTime: DAYS_AGO(0),
          errorMessage: '',
          outputType: '',
          status: path === 'Nphies/Cancellation' ? 'Completed' : 'in-progress',
          disposition: '',
          adjudicationOutcome: '',
          success: path === 'Nphies/Cancellation',
          statusCode: 200,
        }),
      )
    }
    // The detail (216). `AUTH_NOT_FOUND` on an unknown id is a BUSINESS OUTCOME with the
    // server's own sentence — SIS.Api answers it rather than forwarding the upstream's
    // empty 204, which would render a blank detail for a mistyped id (BackOffice 916).
    if (path.startsWith('Nphies/AuthResponse/')) {
      const wanted = decodeURIComponent(path.slice('Nphies/AuthResponse/'.length))
      const found = authDetail(wanted)
      if (!found)
        return route.fulfill(
          envelope(null, {
            status: 404,
            success: false,
            message: 'No authorization with that reference exists.',
            errors: [{ errorCode: 'AUTH_NOT_FOUND', errorMessage: 'not found' }],
          }),
        )
      detailCalls += 1
      return route.fulfill(envelope(found))
    }
    if (path === 'Nphies/AuthResponses') {
      lastListQuery = new URLSearchParams(url.split('?')[1] || '')
      listCalls += 1
      // A guardrail refusal (taxonomy kind 2): non-2xx carrying the envelope with
      // `success:false` and a human, server-supplied message.
      if (scenario.listDown)
        return route.fulfill(
          envelope(null, {
            status: 409,
            success: false,
            message: 'The date range is wider than this report allows.',
            errors: [{ errorCode: 'INVALID_DATE_RANGE', errorMessage: 'range too wide' }],
          }),
        )
      return route.fulfill(envelope(authList(lastListQuery)))
    }
    // Any other probe → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const iso = isoOf
  const today = NOW
  // SEVEN calendar dates inclusive: today-6 … today. Not today-7, which is eight.
  const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)

  // ---- Scenario 1: granted → leaf present, list opens on the window --------
  await page.goto(LIST_URL)
  await page.getByRole('button', { name: /^Search$/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)

  check(
    'granted → the Authorizations nav leaf is present',
    (await page.getByRole('link', { name: /^Authorizations$/ }).count()) >= 1,
  )
  check(
    'the list opens on the LAST 7 DAYS, in the query',
    lastListQuery &&
      lastListQuery.get('fromDate') === iso(weekAgo) &&
      lastListQuery.get('toDate') === iso(today),
    lastListQuery ? lastListQuery.toString() : 'no query',
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
    /PA-1009/.test(chip),
  )
  check(
    'the leaf for the SIBLING screen is not co-highlighted by an area-wide prefix',
    (await page.locator('nav a[href="/nphies/eligibility"][aria-current="page"]').count()) === 0,
  )

  // ---- Scenario 2: 🚩 the refused row is REQUESTED and PRESENT -------------
  check(
    '🚩 the query asks for refused rows explicitly — showAll=true',
    lastListQuery && lastListQuery.get('showAll') === 'true',
    lastListQuery ? lastListQuery.toString() : '',
  )
  const listText = await page.locator('main').innerText()
  check(
    '🚩 and the refused authorization is ON THE LIST — the row `showAll=false` would hide',
    /BV-00123/.test(listText),
    (listText.match(/BV-00123[^\n]*/) || [''])[0],
  )
  check(
    'no claimType leaves the browser — SIS.Api pins it',
    lastListQuery && !lastListQuery.has('claimType'),
  )

  // ---- Scenario 3: both axes, over the authorization value set -------------
  const badges = await page.locator('main span.rounded-full').allInnerTexts()
  const has = (re) => badges.some((b) => re.test(b.trim()))
  check('Complete renders on the answered rows', has(/^Complete$/), badges.join(' | '))
  check(
    'all four authorization verdicts render, and only on Complete rows',
    has(/^Approved$/) && has(/^Partly approved$/) && has(/^Rejected$/) && has(/^No approval needed$/),
    badges.join(' | '),
  )
  check('a queued request renders Pending', has(/^Pending$/))
  check('a refused request renders Failed', has(/^Failed$/))
  check('🚩 a cancelled request renders Cancelled, though it stores Complete + approved', has(/^Cancelled$/))
  check(
    '🚩 the failure message is read under a FAILURE label, never a neutral one',
    /Could not reach the payer/.test(listText) && /Awaiting the exchange/.test(listText),
  )
  check(
    '🚩 no row anywhere claims it is ready to dispense',
    !/ready to dispense/i.test(listText),
  )

  // Row-level: the verdict must be BLANK on every non-Complete row, though three
  // of them carry `adjudicationOutcome: 'approved'`.
  const rowText = async (preAuthRefOrPatient) => {
    const row = page.locator('.ag-row', { hasText: preAuthRefOrPatient }).first()
    return (await row.count()) ? (await row.innerText()).replace(/\n/g, ' | ') : ''
  }
  const failedRow = await rowText('0000000009')
  check(
    '🚩 a Failed row shows a BLANK verdict, though the row carries adjudicationOutcome:approved',
    /Failed/.test(failedRow) && !/Approved/.test(failedRow),
    failedRow,
  )
  const cancelledRow = await rowText('0000000010')
  check(
    '🚩 a Cancelled row shows a BLANK verdict too',
    /Cancelled/.test(cancelledRow) && !/Approved/.test(cancelledRow),
    cancelledRow,
  )

  // ---- Scenario 4: the two markers, on rows that already have both axes ----
  const queryRow = await rowText('0000000004')
  check(
    '🚩 a payer query renders on a row that is Complete WITH a verdict',
    /Complete/.test(queryRow) && /Approved/.test(queryRow) && /Payer query/.test(queryRow),
    queryRow,
  )
  const dispensedRow = await rowText('0000000005')
  check(
    'the dispensed marker renders beside its own verdict',
    /Partly approved/.test(dispensedRow) && /Dispensed/.test(dispensedRow),
    dispensedRow,
  )
  const bothRow = await rowText('0000000011')
  check(
    'both markers can sit on one row',
    /Payer query/.test(bothRow) && /Dispensed/.test(bothRow),
    bothRow,
  )
  const plainRow = await rowText('PA-1001')
  check(
    'a row with nothing flagged says so rather than rendering an empty column',
    /—/.test(plainRow) && !/Payer query|Dispensed/.test(plainRow),
    plainRow,
  )
  check(
    'the payer-query marker states WHY it matters — the row now needs the till',
    /till application/i.test(
      (await page.locator('main [title*="till application"]').first().getAttribute('title')) || '',
    ),
  )

  // ---- Scenario 5: Refresh, the load time, and NO polling ------------------
  const loadedAt = async () => {
    const text = await page.locator('main').innerText()
    return (text.match(/Loaded at (\d\d:\d\d:\d\d)/) || [])[1] || ''
  }
  const firstLoad = await loadedAt()
  check('the load time is stated beside Refresh', /^\d\d:\d\d:\d\d$/.test(firstLoad), firstLoad)

  const callsBefore = listCalls
  await page.waitForTimeout(3500)
  check(
    '🚩 NO browser polling — the service polls the exchange itself every 15 s (§3.6)',
    listCalls === callsBefore,
    `${listCalls - callsBefore} unrequested reads in 3.5 s`,
  )
  check('and the readout does not move on its own either', (await loadedAt()) === firstLoad)

  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(1400)
  check('Refresh asks the server again', listCalls === callsBefore + 1)
  const secondLoad = await loadedAt()
  check(
    'and Refresh RESTATES the load time — the readout is how stale the rows are',
    /^\d\d:\d\d:\d\d$/.test(secondLoad) && secondLoad !== firstLoad,
    `${firstLoad} → ${secondLoad}`,
  )
  check(
    'a refresh does not silently change the window it refreshed',
    lastListQuery && lastListQuery.get('fromDate') === iso(weekAgo),
  )

  // ---- Scenario 6: removing the chip DROPS the window ---------------------
  await page.getByRole('button', { name: /Remove the date window/i }).click()
  await page.waitForTimeout(600)
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
    'the older authorizations the window was hiding are now reachable',
    /69 authorizations/.test(removed),
    (removed.match(/\d+ authorizations?/) || [''])[0],
  )
  check(
    '🚩 the count, the chip and the rows all describe the SAME read',
    !(/No date window/.test(removed) && /\b9 authorizations\b/.test(removed)),
    (removed.match(/\d+ authorizations?/) || [''])[0],
  )

  // ---- Scenario 7: paging moves through the results ------------------------
  check(
    'a result past one page grows a pager',
    (await page.getByRole('navigation', { name: /pages/i }).count()) === 1,
  )
  check('the readout counts pages from the TRUE total', /Page 1 of 2/.test(removed))
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.waitForTimeout(600)
  check('Next asks the server for page 2', lastListQuery && lastListQuery.get('page') === '2')
  check('page 2 renders its own rows', /Page 2 of 2/.test(await page.locator('main').innerText()))
  check(
    'the window stays removed while paging — a page step is not a new search',
    lastListQuery && !lastListQuery.has('fromDate'),
  )
  await page.getByRole('button', { name: /^Previous$/ }).click()
  await page.waitForTimeout(500)
  check('Previous walks back', lastListQuery && lastListQuery.get('page') === '1')

  // ---- Scenario 8: the filters narrow, including the one 212 cannot offer --
  const providerFilter = page.getByLabel('Provider', { exact: true })
  check(
    '🚩 the provider filter defaults to ALL providers — the opposite of a till',
    (await providerFilter.inputValue()) === '',
  )
  await providerFilter.selectOption('P002')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  check(
    'the provider filter narrows the list, and a new filter starts back at page 1',
    lastListQuery &&
      lastListQuery.get('providerCode') === 'P002' &&
      lastListQuery.get('page') === '1',
  )
  check('and only that provider’s rows remain', /PA-1003/.test(await page.locator('main').innerText()))

  await providerFilter.selectOption('')
  await page.getByLabel('Preauth reference', { exact: true }).fill('PA-1004')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  check(
    '🚩 the preauth-reference filter narrows the list — the one an eligibility check cannot have',
    lastListQuery &&
      lastListQuery.get('preAuthRef') === 'PA-1004' &&
      !lastListQuery.has('providerCode'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  check(
    'and only that reference remains',
    /1 authorization\b/.test(await page.locator('main').innerText()),
  )

  await page.getByLabel('Preauth reference', { exact: true }).fill('')
  await page.getByLabel('Patient ID', { exact: true }).fill('0000000009')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  check(
    'the patient id filter narrows the list, and the cleared reference is dropped',
    lastListQuery &&
      lastListQuery.get('patientId') === '0000000009' &&
      !lastListQuery.has('preAuthRef'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  check(
    '🚩 and the refused row is still reachable by filter — showAll survives every read',
    lastListQuery && lastListQuery.get('showAll') === 'true' &&
      /BV-00123/.test(await page.locator('main').innerText()),
  )

  await page.getByLabel('Patient ID', { exact: true }).fill('')
  await page.getByLabel('Payer code', { exact: true }).fill('PAY-7')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  check(
    'the payer filter narrows the list, and the blank patient id is dropped',
    lastListQuery && lastListQuery.get('payerCode') === 'PAY-7' && !lastListQuery.has('patientId'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  await page.getByLabel('Payer code', { exact: true }).fill('')

  // ---- Scenario 9: the two axes filter INDEPENDENTLY, over all four states -
  const requestFilter = page.getByLabel('Request', { exact: true })
  const requestOptions = await requestFilter.locator('option').allInnerTexts()
  check(
    '🚩 the Request filter offers all FOUR states here — every one is reachable on a stored row',
    ['Cancelled', 'Failed', 'Pending', 'Complete'].every((s) =>
      requestOptions.some((o) => o.trim() === s),
    ),
    requestOptions.join(' | '),
  )
  await requestFilter.selectOption('cancelled')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  check(
    'a Request filter narrows alone, with no verdict sent',
    lastListQuery && lastListQuery.get('request') === 'cancelled' && !lastListQuery.has('verdict'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  check(
    'and the cancelled authorization is what comes back',
    /1 authorization\b/.test(await page.locator('main').innerText()),
  )

  await requestFilter.selectOption('')
  const verdictFilter = page.getByLabel('Verdict', { exact: true })
  const verdictOptions = await verdictFilter.locator('option').allInnerTexts()
  check(
    'the Verdict filter offers the authorization value set, not the eligibility one',
    ['Approved', 'Partly approved', 'Rejected', 'No approval needed'].every((v) =>
      verdictOptions.some((o) => o.trim() === v),
    ) && !verdictOptions.some((o) => /Not in force|Not eligible/.test(o)),
    verdictOptions.join(' | '),
  )
  await verdictFilter.selectOption('rejected')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  check(
    '🚩 a Verdict filter with NO Request filter is a legal question',
    lastListQuery && lastListQuery.get('verdict') === 'rejected' && !lastListQuery.has('request'),
    lastListQuery ? lastListQuery.toString() : '',
  )
  const rejected = await page.locator('main').innerText()
  check('and only the rejected authorization comes back', /1 authorization\b/.test(rejected))
  const rejectedRow = await rowText('0000000006')
  check(
    '🚩 a payer REJECTION is DATA and renders — it never toasts and never reads as a failure',
    /Rejected/.test(rejectedRow) &&
      (await page.locator('[role="alert"]').count()) === 0 &&
      // The dual-meaning field's cell is EMPTY on a Complete row, however much
      // `ErrorMessageShort` holds — the payer's words are not a transport error.
      !/BV-|could not be reached/i.test(rejectedRow),
    rejectedRow,
  )

  // ---- Scenario 10: Reset returns the screen to the window it opened on ----
  await page.getByRole('button', { name: /^Reset$/ }).click()
  await page.waitForTimeout(600)
  check(
    'Reset puts the default window back, chip and all',
    lastListQuery &&
      lastListQuery.get('fromDate') === iso(weekAgo) &&
      !lastListQuery.has('verdict') &&
      /Last 7 days/.test(await page.locator('main').innerText()),
    lastListQuery ? lastListQuery.toString() : '',
  )

  // ---- Scenario 11: an empty result names the window it searched ----------
  await page.getByLabel('Patient ID', { exact: true }).fill('9999999999')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForTimeout(600)
  const empty = await page.locator('main').innerText()
  check(
    'an empty result names the window, so "nothing" and "nothing this week" differ',
    /No authorizations match/.test(empty) && /inside the date window above/.test(empty),
  )

  // ---- Scenario 12: a row offers ONLY the acts its state permits (215) -----
  await page.getByLabel('Patient ID', { exact: true }).fill('')
  await page.getByRole('button', { name: /^Reset$/ }).click()
  await page.waitForTimeout(700)

  /** One act button on the row carrying `patient`. The accessible name is the act's
   *  label followed by its own reason, which is how a withheld act states itself. */
  const actButton = (patient, act) =>
    page.locator('.ag-row', { hasText: patient }).first().getByRole('button', { name: act })
  const actState = async (patient, act) => {
    const button = actButton(patient, act)
    return {
      offered: (await button.getAttribute('aria-disabled')) !== 'true',
      reason: (await button.getAttribute('title')) || '',
    }
  }

  const pendingCheck = await actState('0000000008', /^Status check/)
  const pendingRetry = await actState('0000000008', /^Retry/)
  const pendingCancel = await actState('0000000008', /^Cancel/)
  check(
    'a PENDING row offers a status check and a retry',
    pendingCheck.offered && pendingRetry.offered,
    `check=${pendingCheck.offered} retry=${pendingRetry.offered}`,
  )
  check(
    'and withholds Cancel there, saying there is no approval to withdraw yet',
    !pendingCancel.offered && /no approval to withdraw/i.test(pendingCancel.reason),
    pendingCancel.reason,
  )

  const completeCancel = await actState('0000000003', /^Cancel/)
  const completeRetry = await actState('0000000003', /^Retry/)
  check('a COMPLETE, undispensed row offers Cancel', completeCancel.offered)
  check(
    'and withholds Retry there — the payer has already answered',
    !completeRetry.offered && /already answered/i.test(completeRetry.reason),
    completeRetry.reason,
  )

  const dispensedCancel = await actState('0000000005', /^Cancel/)
  const dispensedRetry = await actState('0000000005', /^Retry/)
  check(
    '🚩 a DISPENSED row offers nothing — both cancel and retry are withheld',
    !dispensedCancel.offered && !dispensedRetry.offered,
  )
  check(
    'and both say WHY: the till has dispensed it',
    /dispensed at a till/i.test(dispensedCancel.reason) &&
      /dispensed at a till/i.test(dispensedRetry.reason),
    dispensedCancel.reason,
  )

  const failedRetry = await actState('0000000009', /^Retry/)
  check(
    '🚩 THE CORRECTION OF RECORD: a FAILED row does NOT offer Retry',
    !failedRetry.offered,
    failedRetry.reason,
  )
  check(
    'and its reason names the payload, not the state — asking again would be refused the same way',
    /refused the same way/i.test(failedRetry.reason),
    failedRetry.reason,
  )
  const failedReopen = await actState('0000000009', /^Open the refusal/)
  check(
    '🚩 the refusal’s own act is RENDERED and inert, and it says it is not wired yet',
    !failedReopen.offered && /not available here yet/i.test(failedReopen.reason),
    failedReopen.reason,
  )
  const cancelledRetry = await actState('0000000010', /^Retry/)
  check(
    'a CANCELLED row offers nothing, and says it was already cancelled',
    !cancelledRetry.offered && /already been cancelled/i.test(cancelledRetry.reason),
    cancelledRetry.reason,
  )

  // 🚩 The blanket rule, over every act on every row on screen: no act is ever merely
  // absent and none is ever merely greyed.
  const allActs = await page.locator('.ag-row button[title]').all()
  let unexplained = 0
  let withheldSeen = 0
  for (const button of allActs) {
    if ((await button.getAttribute('aria-disabled')) !== 'true') continue
    withheldSeen += 1
    if (((await button.getAttribute('title')) || '').trim().length < 10) unexplained += 1
  }
  check(
    '🚩 EVERY withheld act on the page carries its own reason',
    withheldSeen > 0 && unexplained === 0,
    `${withheldSeen} withheld, ${unexplained} unexplained`,
  )
  check(
    'and every row names all four acts, whatever its state',
    (await page.locator('.ag-row', { hasText: '0000000010' }).first().locator('button').count()) === 4,
  )

  // ---- Scenario 13: the status check fires, and "still working" is DATA ----
  await actButton('0000000008', /^Status check/).click()
  await page.waitForTimeout(900)
  check(
    'the status check posts the AUTHORIZATION ID as `reference`',
    lastAct.statusCheck && lastAct.statusCheck.reference === 'AUTH-6',
    JSON.stringify(lastAct.statusCheck),
  )
  check(
    '🚩 and nothing else — law 7: SIS.Api stamps identity, the browser never sends it',
    lastAct.statusCheck && Object.keys(lastAct.statusCheck).join(',') === 'reference',
    JSON.stringify(lastAct.statusCheck),
  )
  const afterCheck = await page.locator('body').innerText()
  check(
    '🚩 a still-working answer (success:false) RENDERS as the exchange’s status, not as an error',
    /in-progress/.test(afterCheck) && (await page.locator('[role="alert"]').count()) === 0,
    (afterCheck.match(/in-progress[^\n]*/) || [''])[0],
  )
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName || '',
  )
  check(
    '🚩 firing an act does NOT throw keyboard focus off the button that fired it',
    // A busy flag inside the cell would travel through `columnDefs`, and AG Grid rebuilds
    // every cell when those change identity — focus lands on <body> and a keyboard user
    // loses their place mid-act. The in-flight state lives ABOVE the grid for exactly this
    // reason, and this assertion is what holds that decision in place.
    /Status check/.test(focused),
    focused,
  )

  // ---- Scenario 14: the retry sends the ONE field the browser owns ---------
  await actButton('0000000008', /^Retry/).click()
  await page.waitForTimeout(900)
  check(
    'the retry posts `referenceId`, and ONLY that',
    lastAct.retry && Object.keys(lastAct.retry).join(',') === 'referenceId' &&
      lastAct.retry.referenceId === 'AUTH-6',
    JSON.stringify(lastAct.retry),
  )
  check(
    '🚩 no referenceType, staffId or storeCode leaves the browser — all three are the server’s',
    lastAct.retry &&
      !('referenceType' in lastAct.retry) &&
      !('staffId' in lastAct.retry) &&
      !('storeCode' in lastAct.retry),
    JSON.stringify(lastAct.retry),
  )

  // ---- Scenario 15: the cancellation asks for its reason, then sends it ----
  await actButton('0000000003', /^Cancel/).click()
  await page.waitForTimeout(700)
  check('the cancel act opens a confirmation first — it is terminal', await page.locator('dialog').isVisible())
  const confirm = page.getByRole('button', { name: /^Cancel the authorization$/ })
  check(
    '🚩 the confirm is withheld until a reason is chosen — the code reaches the payer',
    (await confirm.getAttribute('aria-disabled')) === 'true',
  )
  const reasonOptions = await page.locator('dialog select option').allInnerTexts()
  check(
    '🚩 the reasons come from the CodeSystem lookup, not from a list typed into the client',
    reasonOptions.some((o) => /Wrong information/.test(o)) &&
      reasonOptions.some((o) => /Duplicate request/.test(o)),
    reasonOptions.join(' | '),
  )
  check(
    'and a blocked code is not offered — NPHIES no longer accepts it',
    !reasonOptions.some((o) => /Retired reason/.test(o)),
    reasonOptions.join(' | '),
  )
  await page.locator('dialog select').selectOption('WI')
  await confirm.click()
  await page.waitForTimeout(900)
  check(
    'the cancellation posts the reference, the chosen reason and the row’s provider',
    lastAct.cancel &&
      lastAct.cancel.reference === 'AUTH-1' &&
      lastAct.cancel.reasonCode === 'WI' &&
      lastAct.cancel.providerCode === 'P001',
    JSON.stringify(lastAct.cancel),
  )
  check(
    '🚩 nullify is sent FALSE, and neither claimType nor staffId is sent at all',
    lastAct.cancel &&
      lastAct.cancel.nullify === false &&
      !('claimType' in lastAct.cancel) &&
      !('staffId' in lastAct.cancel),
    JSON.stringify(lastAct.cancel),
  )
  check('and the dialog closes on the answer', (await page.locator('dialog').count()) === 0)

  // ---- Scenario 16: a REFUSED cancellation is readable where it happened --
  // 🚩 The one refusal a toast cannot deliver: the modal is a native `showModal()`
  // dialog, so it and its backdrop sit in the browser's TOP LAYER and a toast raised
  // behind it is painted under the scrim and unclickable. `AUTH_ALREADY_DISPENSED` is
  // precisely the code this act meets in the field.
  scenario.actRefused = true
  await actButton('0000000004', /^Cancel/).click()
  await page.waitForTimeout(600)
  await page.locator('dialog select').selectOption('DUPL')
  await page.getByRole('button', { name: /^Cancel the authorization$/ }).click()
  await page.waitForTimeout(1200)
  check(
    'a refused cancellation leaves the dialog OPEN rather than closing on a failure',
    (await page.locator('dialog').count()) === 1,
  )
  check(
    '🚩 and the server’s own message renders INSIDE the dialog, not behind it',
    /already been dispensed and can no longer be changed/.test(
      await page.locator('dialog').innerText(),
    ),
    (await page.locator('dialog').innerText()).replace(/\n/g, ' ').slice(0, 110),
  )
  check(
    'the reason picker is still there, so the agent can change it or keep the authorization',
    (await page.locator('dialog select').count()) === 1 &&
      (await page.getByRole('button', { name: /^Keep it$/ }).count()) === 1,
  )
  await page.getByRole('button', { name: /^Keep it$/ }).click()
  await page.waitForTimeout(500)
  check('and Keep it closes it without cancelling anything', (await page.locator('dialog').count()) === 0)

  // ---- Scenario 17: an act refusal is a BUSINESS OUTCOME, never a crash ---
  await actButton('0000000008', /^Status check/).click()
  await page.waitForTimeout(1200)
  const refusedAct = await page.locator('body').innerText()
  check(
    '🚩 a server refusal renders the server’s OWN message, never "unexpected"',
    /already been dispensed and can no longer be changed/.test(refusedAct) &&
      !/unexpected/i.test(refusedAct),
    (refusedAct.match(/already been dispensed[^\n]*/) || [''])[0],
  )
  check(
    'and the screen is still standing — the rows, the filters and the acts are all there',
    (await page.getByRole('button', { name: /^Search$/ }).count()) === 1 &&
      (await page.locator('.ag-row').count()) > 0,
  )
  scenario.actRefused = false

  // ---- Scenario 18: a refused read surfaces the server's own message -------
  scenario.listDown = true
  // A DIFFERENT id, deliberately: an identical query is an identical cache key,
  // so re-pressing Search over the same criteria would serve the cached answer
  // and this scenario would pass without the refusal ever being fetched.
  await page.getByLabel('Patient ID', { exact: true }).fill('9999999998')
  await page.getByRole('button', { name: /^Search$/ }).click()
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  const refused = await page.locator('[role="alert"]').first().innerText()
  check(
    'a business refusal surfaces the server’s own message, never "unexpected"',
    /wider than this report allows/i.test(refused) && !/unexpected/i.test(refused),
    refused.replace(/\n/g, ' ').slice(0, 90),
  )
  scenario.listDown = false

  // ---- Scenario 19: the list OPENS the detail, as a real link -------------
  // Ticket 216 is opened from the list, and the way in is an anchor rather than a row
  // handler: right-clickable, copyable, middle-clickable — none of which a handler is.
  await page.goto(LIST_URL)
  await page.getByRole('button', { name: /^Search$/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const openLink = page
    .locator('.ag-row', { hasText: 'PA-1001' })
    .first()
    .getByRole('link', { name: /^Open$/ })
  check(
    'the list offers a real LINK into the detail, carrying the authorization id',
    (await openLink.getAttribute('href')) === '/nphies/authorizations/AUTH-1',
    (await openLink.getAttribute('href')) || 'no href',
  )
  await openLink.click()
  await page.waitForTimeout(900)
  check('and it lands on the detail', page.url().endsWith('/nphies/authorizations/AUTH-1'), page.url())
  check('the detail asks the server for that one authorization', detailCalls === 1)

  // ---- Scenario 20: 🚩 A PARTIAL — approved header, refused lines ----------
  const partial = await page.locator('main').innerText()
  check(
    '🚩 the header says APPROVED while one of its lines was refused — both facts, one screen',
    /Approved/.test(partial) && /1 line was refused/.test(partial),
    (partial.match(/\d+ lines? (was|were) refused/) || [''])[0],
  )
  const refusedLine = page.locator('tbody tr', { hasText: 'AMOXICILLIN' }).first()
  const refusedText = (await refusedLine.innerText()).replace(/\n/g, ' | ')
  check(
    '🚩 the refused line carries the payer’s reason IN WORDS, already decoded',
    /Service not covered under the member benefit plan/.test(refusedText),
    refusedText,
  )
  check(
    'and its verdict, approved quantity and rejected amount, all four facts on one row',
    /Rejected/.test(refusedText) && /47\.50/.test(refusedText),
    refusedText,
  )
  const approvedLine = (await page.locator('tbody tr', { hasText: 'PANADOL' }).first().innerText())
    .replace(/\n/g, ' | ')
  check(
    'the approved line beside it says approved, and claims no reason it was not given',
    /Approved/.test(approvedLine) && !/not covered/.test(approvedLine),
    approvedLine,
  )
  check(
    'the payer’s own header words render — the disposition and the process note',
    /Approved with adjustments\./.test(partial) &&
      /Quantity on line 2 reduced per plan limits\./.test(partial),
  )
  check(
    '🚩 and the failure label is NOWHERE on a completed authorization',
    !/Could not reach the payer/.test(partial),
  )
  check(
    '🚩 no detail anywhere claims the authorization is ready to dispense',
    !/ready to dispense/i.test(partial) && !/Dispensed/.test(partial),
  )

  // ---- Scenario 21: the attachments, as submitted, for free ---------------
  check(
    'the attachments the payer was actually given render, from the same response',
    /2 attachments, as submitted/.test(partial) &&
      /Prescription/.test(partial) &&
      /Medical report/.test(partial),
    (partial.match(/\d+ attachments?, as submitted/) || [''])[0],
  )
  const imageSrc = (await page.locator('main img').first().getAttribute('src')) || ''
  check(
    '🚩 an image renders INLINE from the base64 — no upload endpoint, no second fetch',
    imageSrc.startsWith('data:image/jpeg;base64,') && imageSrc.includes(TINY_JPEG.slice(0, 24)),
    imageSrc.slice(0, 40),
  )
  const pdfHref =
    (await page.getByRole('link', { name: /Open the document/ }).first().getAttribute('href')) || ''
  check(
    'a PDF is a link into the browser’s own viewer, not something this screen rebuilds',
    pdfHref.startsWith('data:application/pdf;base64,'),
    pdfHref.slice(0, 40),
  )
  check(
    '🚩 the days-supply supporting info is NOT rendered as an attachment — it carries no bytes',
    (await page.locator('main img').count()) === 1 &&
      (await page.getByRole('link', { name: /Open the document/ }).count()) === 1,
  )
  check(
    'and no modal opened anywhere on this screen',
    (await page.locator('dialog').count()) === 0,
  )

  // ---- Scenario 22: 🚩 THE DUAL-MEANING FIELD, READ IN ONE BRANCH ONLY -----
  // The same field carries a transport error OR the decoded adjudication display,
  // depending on which kind of bad news occurred. The Request state picks both the label
  // and the source, so the ambiguity never reaches the screen.
  await page.goto(BASE + '/nphies/authorizations/AUTH-4')
  await page.waitForTimeout(900)
  const rejectedDetail = await page.locator('main').innerText()
  check(
    '🚩 a COMPLETE authorization NEVER renders the dual-meaning field, whatever it holds',
    !/ADJ-DISPLAY-DO-NOT-SHOW/.test(rejectedDetail) &&
      !/Could not reach the payer/.test(rejectedDetail),
    (rejectedDetail.match(/ADJ-DISPLAY[^\n]*/) || ['absent'])[0],
  )
  check(
    'a payer REJECTION is DATA and renders — the verdict, the reason, and no error banner',
    /Rejected/.test(rejectedDetail) &&
      /Prior authorization requirements not met/.test(rejectedDetail) &&
      (await page.locator('[role="alert"]').count()) === 0,
  )
  check(
    'the payer’s words come from the disposition instead, which means only one thing',
    /The request was not approved\./.test(rejectedDetail),
  )

  await page.goto(BASE + '/nphies/authorizations/AUTH-7')
  await page.waitForTimeout(900)
  const failedDetail = await page.locator('main').innerText()
  check(
    '🚩 a FAILED authorization renders it under the FAILURE label, never a neutral one',
    /Could not reach the payer/.test(failedDetail) && /BV-00123/.test(failedDetail),
    (failedDetail.match(/BV-00123[^\n]*/) || [''])[0],
  )
  check(
    'its verdict stays BLANK, though the row carries adjudicationOutcome:approved',
    !/\bApproved\b/.test(failedDetail),
    failedDetail.replace(/\n/g, ' | ').slice(0, 120),
  )
  check(
    '🚩 a header-only refusal says it has no lines rather than drawing an empty table',
    /No lines were recorded/.test(failedDetail) && (await page.locator('tbody tr').count()) === 0,
  )

  await page.goto(BASE + '/nphies/authorizations/AUTH-6')
  await page.waitForTimeout(900)
  const pendingDetail = await page.locator('main').innerText()
  check(
    '🚩 a PENDING authorization goes under the same failure label — §5 puts both there',
    /Pending/.test(pendingDetail) && /Could not reach the payer/.test(pendingDetail),
  )
  // 🚩 Read the ROW, not the page: the lines table's own column header is the word
  // "Approved" (the approved-quantity column), so a page-wide match would pass on the
  // furniture and prove nothing about the cell.
  const pendingLine = (await page.locator('tbody tr').first().innerText()).replace(/\n/g, ' | ')
  check(
    '🚩 and its LINE verdict is blank too, though the line carries adjudicationOutcome:approved',
    /—/.test(pendingLine) && !/Approved/.test(pendingLine),
    pendingLine,
  )

  // A mistyped id is a business outcome with the server's own sentence, not a blank page.
  await page.goto(BASE + '/nphies/authorizations/NOPE-1')
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    'an unknown authorization id states the server’s own refusal, never a blank detail',
    /No authorization with that reference exists\./.test(
      await page.locator('[role="alert"]').first().innerText(),
    ),
  )

  const detailCallsBefore = detailCalls
  await page.goto(BASE + '/nphies/authorizations/AUTH-1')
  await page.waitForTimeout(3500)
  check(
    '🚩 the detail does NOT poll either — it is the heaviest read on the door (§3.6)',
    detailCalls === detailCallsBefore + 1,
    `${detailCalls - detailCallsBefore} reads in 3.5 s`,
  )
  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForTimeout(800)
  check('and Back returns to the list', page.url().endsWith('/nphies/authorizations'))

  // ---- Scenario 23: no grant → leaf hidden, in-page backstop --------------
  scenario.access = { canOpenNphies: false }
  await page.goto(LIST_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  const denied = await page.locator('main').innerText()
  check('no grant → the in-page denied card', /No access to Nphies/.test(denied))
  check('no grant → the list is NOT rendered', (await page.getByRole('button', { name: /^Search$/ }).count()) === 0)
  check(
    'no grant → the nav leaf is HIDDEN',
    (await page.getByRole('link', { name: /^Authorizations$/ }).count()) === 0,
  )
  // The detail is behind the same one probe, and it fails closed the same way — a
  // linkable route is a route somebody can arrive at without passing the list.
  await page.goto(BASE + '/nphies/authorizations/AUTH-1')
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    'no grant → the DETAIL is shut too, and no authorization is fetched',
    /No access to Nphies/.test(await page.locator('main').innerText()) &&
      detailCalls === detailCallsBefore + 1,
  )

  // ---- Scenario 24: an errored probe FAILS CLOSED -------------------------
  // 🚩 The grant goes back to TRUE first. Without it scenario 19's
  // `canOpenNphies:false` is still in force and both assertions below would pass
  // with the 500 branch deleted — the path this scenario exists for, untested.
  scenario.access = { canOpenNphies: true }
  scenario.accessDown = true
  await page.goto(LIST_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  const probeDown = await page.locator('main').innerText()
  check(
    '🚩 an ERRORED probe fails closed — the screen stays shut',
    (await page.getByRole('button', { name: /^Search$/ }).count()) === 0,
  )
  check(
    'and it says UNAVAILABLE, not "you lack the grant" — a retry, not an administrator',
    /Nphies is unavailable/.test(probeDown) && !/does not hold the Nphies grant/.test(probeDown),
    probeDown.replace(/\n/g, ' ').slice(0, 90),
  )
  scenario.accessDown = false

  check('no uncaught page errors anywhere in the drive', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'))
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
