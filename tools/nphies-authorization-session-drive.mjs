// Nphies authorization SESSION drive (ticket 217, spec 209, contract v1.0) — drives the
// REAL app in Chromium against a MOCKED engine session.
//
// ⚠ SIS.Api is down and this slice's server dependency is the largest and riskiest term in
// the whole effort: six session verbs, a *parallel* build, being written in the other
// repository. So the network is stubbed at Playwright against the contract's own shapes —
// the same code-complete / runtime-blocked posture 211–216 shipped under. The stub is a
// small ENGINE rather than a fixture server: it holds a transaction, bumps `version` on
// every save, mints an `etag`, keeps voided lines and refuses a duplicate item, because
// every one of those is a contract assertion this drive exists to make.
//
// It verifies ticket 217's flow Proof bullet end to end:
//   open → add → refuse a duplicate → change quantity → void → leave with a warning
// plus the four things that fail silently:
//   🚩 identity renders as read-only VALUES, not disabled controls (story 24);
//   🚩 the duplicate refusal NAMES THE QUANTITY CONTROL and costs no round trip (§2.3);
//   🚩 a voided line is KEPT, not removed (law 2);
//   🚩 a stale state never replaces a newer one — `core/`s guard, in the browser (§2.1).
//
// Extended by 218 (the five money inputs), 219 (diagnoses and attachments) and
// 220 (submit as a GATED PATH — scenarios 31–37), whose four assertions are the
// ones that would cost a request at a national exchange:
//   🚩 every blocker NAMES ITSELF, client's and server's in one list;
//   🚩 the clinical-edit gate is ONE surface in TWO shapes — the fatal one is the
//      warning one with the confirm button REMOVED, not disabled;
//   🚩 a refused submit keeps the agent ON THE FORM, each reason on the row that
//      caused it, and the header-only case still explains itself;
//   🚩 A TIMEOUT IS IN FLIGHT, NEVER FAILED — the offered act is a status check
//      and Submit is gone, because a second authorization for a request that
//      already reached the payer is the worst thing this screen can produce.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/nphies-authorization-session-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ELIGIBILITY_ID = 'ELG-1'
const MEMBER_ID = 'MEM-4477'
const FORM_URL = `${BASE}/nphies/authorizations/new?from=${ELIGIBILITY_ID}&coverage=${MEMBER_ID}`

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

/** A guardrail refusal exactly as §6 kind 2 defines it: a non-2xx carrying the envelope,
 *  a human server-supplied message and a machine code. */
const refusal = (status, code, message) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, errorMessage: code }] })

// ---------------------------------------------------------------------------
// The catalogue the stubbed engine prices from. Not an endpoint — §1.2 keeps item search
// off this door — just what the door knows how to put on a request.
// `group` is `InsuranceItemCategory` — the same value the projection calls
// `deductibleGroupName` (§4) — and `bucket` is the G1/G2/G3 pool it resolves to
// server-side (`ResolveDeductibleGroupForLine`). They are deliberately different
// things: the category reads like the bucket and is not it.
const CATALOGUE = {
  100001: { description: 'PANADOL 500MG TAB', unitPrice: 25, group: 'Generic', bucket: 'g1' },
  100002: { description: 'AMOXICILLIN 500MG CAP', unitPrice: 12.5, group: 'Brand', bucket: 'g2' },
  100003: { description: 'VENTOLIN INHALER', unitPrice: 31, group: 'Brand-IR', bucket: 'g3' },
  // A NonMed sibling in G1, so a cap edit on one line can be seen re-bucketing
  // the other — per-group caps share a pool.
  100004: { description: 'ELASTIC BANDAGE 10CM', unitPrice: 40, group: 'NonMed', bucket: 'g1' },
}

/**
 * The diagnosis code lookup, as `GET Nphies/Diagnoses?query=` answers it (§1.1 #14) —
 * the service's own `DiagnosisModel`, including 🚩 **`IsNeedMorph`**, which is what the
 * service means by "this diagnosis is a neoplasm". The client derives it from nothing:
 * a code range spelled into the browser would disagree with this table silently.
 * The door searches `code StartsWith(query) || description Contains(query)`.
 */
const DIAGNOSES = [
  { diagnosisCode: 'C50.9', diagnosisDescription: 'Malignant neoplasm of breast, unspecified', isNeedMorph: true, isUnacceptedAsPrincipal: false },
  { diagnosisCode: 'C50.1', diagnosisDescription: 'Malignant neoplasm of central portion of breast', isNeedMorph: true, isUnacceptedAsPrincipal: false },
  { diagnosisCode: 'J45.9', diagnosisDescription: 'Asthma, unspecified', isNeedMorph: false, isUnacceptedAsPrincipal: false },
  { diagnosisCode: 'E11.9', diagnosisDescription: 'Type 2 diabetes mellitus without complications', isNeedMorph: false, isUnacceptedAsPrincipal: false },
].map((row) => ({
  genderRestriction: '',
  genderRestrictionType: '',
  ageLow: '',
  ageHigh: '',
  ageRestrictionType: '',
  rareRestrictionType: '',
  ...row,
}))

/** The morphology codes — `GET Nphies/Morphs?query=` (§1.1 #15). */
const MORPHS = [
  { morphCode: 'M8140/3', morphDescription: 'Adenocarcinoma, NOS' },
  { morphCode: 'M8500/3', morphDescription: 'Infiltrating duct carcinoma, NOS' },
]

/** The selection reasons, as `GET Nphies/CodeSystem?valueSet=SelectionReason`
 *  answers them (§3.8). The client spells none of these itself. */
const SELECTION_REASONS = [
  { code: 'innovative-noGeneric', display: 'No generic alternative', blocked: 'false', valueSetName: 'SelectionReason' },
  { code: 'patient-request', display: 'Patient request', blocked: 'false', valueSetName: 'SelectionReason' },
  { code: 'retired-reason', display: 'Retired reason', blocked: 'true', valueSetName: 'SelectionReason' },
]

// §2's `reference` — fetched from the eligibility at Open, read-only forever.
const REFERENCE = {
  eligibilityId: ELIGIBILITY_ID,
  memberId: MEMBER_ID,
  patientId: '0000000003',
  patientName: 'Ahmad Ali',
  patientGender: 'male',
  patientBirthDate: '1988-04-02',
  patientIdType: 'NI',
  payerCode: 'PAY-9',
  providerCode: 'P001',
  policyNumber: 'POL-77',
  policyStartDate: '2026-01-01',
  policyEndDate: '2026-12-31',
  policyHolder: 'ACME INSURANCE',
}

/**
 * 221 — 🚩 **the write-ahead journal row** (§3.9), which is the whole of what a
 * reopen is prefilled from. The shape is the Nphies service's own `AuthRequest`
 * (`Features/Auth/Dtos/AuthRequest.cs`), because that is literally what
 * `IntegrationAttemptLog.StartAsync` serialized into `PosIntegrationAttempt.RequestJson`
 * before the payer was called — not a friendlier reopen DTO.
 *
 * It is built to make the replay's three interesting cases observable at once:
 *   · 100001 comes back exactly as it went out;
 *   · 100002 was submitted at 20.00 and the plant now prices it at 12.50 — REPRICED;
 *   · 100009 is no longer an item at all — REFUSED at the scan.
 */
const JOURNAL_ITEM = (over) => ({
  sequence: 1,
  itemNumber: '100001',
  quantity: 2,
  unitPrice: 25,
  extendedPrice: 50,
  amount: 50,
  netAmount: 50,
  vat: 7.5,
  discountPercentage: 0,
  discountAmount: 0,
  actualPatientShare: 10,
  deductibleG: 10,
  deductibleGroupName: 'Generic',
  maxCoverage: 0,
  daysSupply: 30,
  selectionReason: '',
  serviceDate: '2026-07-30',
  diagnosis: 'principal|J45.9',
  ...over,
})

const JOURNAL_ITEMS = [
  JOURNAL_ITEM({}),
  JOURNAL_ITEM({
    sequence: 2,
    itemNumber: '100002',
    quantity: 1,
    // Submitted at 20.00; the plant prices it at 12.50 today.
    unitPrice: 20,
    extendedPrice: 20,
    deductibleGroupName: 'Brand',
    maxCoverage: 15,
    daysSupply: 60,
    selectionReason: 'patient-request',
  }),
  // An item that has since gone. The door answers `ITEM_NOT_FOUND`, and that
  // refusal is THE information the agent needs — not a failure of the replay.
  JOURNAL_ITEM({ sequence: 3, itemNumber: '100009', quantity: 1, deductibleGroupName: 'NonMed' }),
]

const FAILED_AUTH_ID = 'AUTH-REFUSED-1'

const journalRow = (items) => ({
  contractVersion: '1.0',
  // 🚩 The two ids `Open` takes. A reopen is raised against the SAME eligibility
  // and the same chosen coverage as the request it replays.
  eligibilityId: ELIGIBILITY_ID,
  memberId: MEMBER_ID,
  providerCode: REFERENCE.providerCode,
  payerCode: REFERENCE.payerCode,
  patientId: REFERENCE.patientId,
  patientIdType: 'NI',
  patientName: REFERENCE.patientName,
  patientGender: 'male',
  patientBirthDate: REFERENCE.patientBirthDate,
  serviceDate: '2026-07-30',
  prescriptionRef: '',
  // 🚩 `type|code` joined by `,` — `NphiesDiagnosis.GetDiagnosisList`'s own
  // encoding, which §3.4 makes the client's to parse back.
  diagnosis: 'principal|J45.9',
  exceptionPrescription: false,
  reasonForVisit: '',
  policyNumber: REFERENCE.policyNumber,
  policyHolder: REFERENCE.policyHolder,
  claimType: 0,
  // §4's nine header money fields, deliberately NOT the coverage's defaults — the
  // agent had corrected them, and a replay that lost the correction would be a
  // silent restore of something they did not send.
  deductibleG1: 25,
  deductibleG1Max: 400,
  deductibleG1Paid: 50,
  deductibleG2: 30,
  deductibleG2Max: 500,
  deductibleG2Paid: 200,
  deductibleG3: 100,
  deductibleG3Max: 0,
  deductibleG3Paid: 0,
  items,
  // §3.5's attachments really do ride inside the journal row — and are NOT
  // replayed, because the row records `image`/`pdf` rather than a MIME type.
  supportingInfos: [
    {
      sequence: 1,
      category: 'attachment',
      code: '',
      attachment: 'aGVsbG8=',
      valueString: '',
      attachmentType: 'image',
      attachmentTitle: 'Prescription',
      display: '',
    },
  ],
})

/** One refused row on the list, so the reopen affordance has something to be on.
 *  🚩 It is only visible because the list sends `showAll=true` (§3.3). */
const FAILED_ROW = {
  id: FAILED_AUTH_ID,
  eligibilityId: ELIGIBILITY_ID,
  providerCode: REFERENCE.providerCode,
  payerCode: REFERENCE.payerCode,
  patientId: REFERENCE.patientId,
  preAuthRef: '',
  claimProcessingCodes: 'Error',
  queued: false,
  error: true,
  cancelled: false,
  adjudicationOutcome: '',
  needComm: false,
  isDispensed: false,
  dispensedTime: '',
  dispensedStore: '',
  actionDateTime: '2026-07-30T11:02:00',
  responseDateTime: '',
  serviceDate: '2026-07-30',
  errorMessageShort: 'Item 100009 has no Nphies category.',
  disposition: '',
  statusCode: 400,
  claimType: 0,
}

let scenario = {
  access: { canOpenNphies: true },
  accessDown: false,
  contractVersion: '1.0',
  actingStore: '1101',
  /** Serve the State read a DELIBERATELY OLDER projection — the slow-response race §2.1
   *  exists for, reproduced on demand. */
  staleRead: false,
  /** Refuse every session verb with §6's `SESSION_CLOSED`, reason `swept`. */
  sessionClosed: false,
  // ---- 220 -----------------------------------------------------------------
  /**
   * §2's own `submitBlockers`. 🚩 **Empty by default, and that is the honest
   * stub**: the mandatory attachment is a CLIENT form state (§3.5) because
   * attachments only exist inside the submit body, so the engine genuinely cannot
   * know whether one is held. A server that listed `NO_ATTACHMENTS` on every
   * projection would be asserting something it has no way to see.
   */
  serverBlockers: [],
  /** What `ClinicalEditValidate` finds — `clear` · `warning` · `fatal` (§3.7). */
  clinicalEdit: 'clear',
  /** What `Submit` answers — §7.3's three outcomes, plus the two that are not
   *  outcomes at all: a guardrail refusal and a dead wire. */
  submit: 'accepted',
  // ---- 221 -----------------------------------------------------------------
  /** What the journal read answers — `full` · `headerOnly` (the refusal that
   *  threw before its lines were built) · `missing` (no journal row at all). */
  journal: 'full',
  /** Serve the list a refused row, so the reopen affordance has one to sit on. */
  listHasFailedRow: true,
}

const calls = {
  open: [],
  addItem: [],
  changeQty: [],
  voidLine: [],
  abandon: [],
  setInsurance: [],
  setHeader: [],
  updateLineInsurance: [],
  updateLineMeta: [],
  state: 0,
  diagnoses: [],
  morphs: [],
  clinicalEdit: [],
  submit: [],
  journal: [],
  /** 🚩 Every `Nphies/Session/*` path the browser asks for, whatever it is. The
   *  reopen's structural rule — **no new session verb** — is only checkable
   *  against the whole set, not against the verbs the stub happens to know. */
  sessionPaths: [],
}

/** §1.2's table, verbatim. A path outside it is a verb this contract does not have. */
const SESSION_VERB_PATHS = [
  'Nphies/Session/Open',
  'Nphies/Session/State',
  'Nphies/Session/AddItem',
  'Nphies/Session/ChangeQty',
  'Nphies/Session/VoidLine',
  'Nphies/Session/SetHeader',
  'Nphies/Session/SetInsurance',
  'Nphies/Session/UpdateLineInsurance',
  'Nphies/Session/UpdateLineMeta',
  'Nphies/Session/Submit',
  'Nphies/Session/Abandon',
]

/** The stubbed engine's one transaction. */
let tx = null

const save = () => {
  tx.version += 1
  tx.etag = `E${tx.version}`
}

const projection = () => ({
  contractVersion: scenario.contractVersion,
  transactionId: tx.transactionId,
  version: tx.version,
  etag: tx.etag,
  status: tx.status,
  // 🚩 The acting store, bound at Open and never accepted from a body (law 8 / law 7).
  plant: tx.plant,
  reference: REFERENCE,
  // 🚩 The header the diagnoses and the exception-prescription flag live on —
  // the engine's, answered whole like everything else (law 3).
  header: tx.header,
  // 🚩 The agent's header inputs, inherited from the coverage and then
  // correctable — including `paid`, which only persists because §4's new column
  // makes it possible to tell a 300 cap from a 500 cap with 200 already spent.
  insurance: tx.insurance,
  lines: tx.lines,
  submitBlockers: scenario.serverBlockers,
  replayed: false,
})

/** A line as the engine lands it: **pending**, with no money yet — which is what lets the
 *  row price IN PLACE and say so while it waits (story 27). */
function landLine(itemNumber, qty) {
  const item = CATALOGUE[itemNumber]
  tx.sequence += 1
  tx.lines.push({
    lineId: `L${tx.sequence}`,
    sequence: tx.sequence,
    voided: false,
    itemNumber,
    itemDescription: item.description,
    quantity: qty,
    unitPrice: 0,
    extendedPrice: 0,
    amount: 0,
    netAmount: 0,
    vat: 0,
    discountPercentage: 0,
    discountAmount: 0,
    actualPatientShare: 0,
    deductibleG: 0,
    deductibleGroupName: item.group,
    maxCoverage: 0,
    // The header default, stamped onto the line as it lands (story 35).
    daysSupply: tx.daysSupplyDefault,
    selectionReason: '',
    // 🚩 `false` on Generic lines ONLY (§2) — NonMed and Brand-IR both offer it.
    selectionReasonEditable: item.group !== 'Generic',
    pricing: 'pending',
  })
}

const money = (n) => Number(n.toFixed(2))

/**
 * The engine finishing its pricing run. Every amount below is the SERVER's; the browser
 * computes none of them and the drive asserts the rendered figures against these.
 *
 * 🚩 It re-prices **every** line from the header terms, because that is what
 * `UpdateDeductible` does — it never touches `request.Items`, so one rate edit
 * moves every amount on the request (story 39). And the per-group cap is a
 * **pool** the lines of that bucket share, so a cap on one line changes what is
 * left for its siblings — which is the second thing this stub exists to make
 * observable.
 */
function priceLines() {
  const pool = {}
  for (const key of ['g1', 'g2', 'g3']) {
    const group = tx.insurance[key]
    // A group cap of 0 is "no cap" on the header — unlike a LINE cap of 0, which
    // the engine ignores and the client refuses to send (§4).
    pool[key] = group.max > 0 ? Math.max(0, group.max - group.paid) : Infinity
  }
  for (const line of tx.lines) {
    const item = CATALOGUE[line.itemNumber]
    const extended = money(item.unitPrice * line.quantity)
    line.unitPrice = item.unitPrice
    line.extendedPrice = extended
    line.amount = extended
    line.discountPercentage = 0
    line.discountAmount = 0
    line.netAmount = extended
    line.vat = money(extended * 0.15)
    line.pricing = 'settled'
    if (line.voided) {
      line.actualPatientShare = 0
      line.deductibleG = 0
      continue
    }
    const rate = tx.insurance[item.bucket].rate
    // What the payer would carry, then what the line's own cap allows, then what
    // is left in the group's pool. Whatever the payer does not carry is the
    // patient's — the only per-line money the payer adjudicates.
    let payer = money(extended * (1 - rate / 100))
    if (line.maxCoverage > 0) payer = Math.min(payer, line.maxCoverage)
    payer = Math.min(payer, pool[item.bucket])
    pool[item.bucket] = pool[item.bucket] === Infinity ? Infinity : money(pool[item.bucket] - payer)
    line.actualPatientShare = money(extended - payer)
    line.deductibleG = line.actualPatientShare
  }
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // ⚠ `Failed to load resource: … 409/404` is Chromium narrating the refusals this drive
  // DELIBERATELY serves. Counting them as defects would make the taxonomy's own happy
  // path look like a crash.
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    const query = new URLSearchParams(url.split('?')[1] || '')
    const body = () => JSON.parse(route.request().postData() || '{}')
    if (path.startsWith('Nphies/Session/')) calls.sessionPaths.push(path)

    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'msartawi',
          currentStoreCode: scenario.actingStore,
        }),
      )
    if (path === 'Nphies/Access') {
      if (scenario.accessDown)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'down' }))
      return route.fulfill(envelope(scenario.access))
    }

    // The eligibility 217 is raised FROM — 213's seam, so the drive can prove the two
    // features meet at a URL rather than at an object.
    if (path === `Nphies/EligibilityResponse/${ELIGIBILITY_ID}`)
      return route.fulfill(
        envelope({
          id: ELIGIBILITY_ID,
          eligibilityPurpose: 'benefits',
          providerCode: REFERENCE.providerCode,
          payerCode: REFERENCE.payerCode,
          patientId: REFERENCE.patientId,
          patientIdType: 'NI',
          patientGender: 'male',
          patientName: REFERENCE.patientName,
          patientBirthDate: REFERENCE.patientBirthDate,
          actionDateTime: '2026-08-02T09:15:00',
          errorMessage: '',
          inforce: true,
          outcome: 'complete',
          disposition: 'Eligible',
          notInForceReason: '',
          success: true,
          coverage: true,
          coverageId: 'COV-1',
          network: 'GOLD',
          class: 'A',
          statusCode: 200,
          isEligible: true,
          siteEligibility: 'eligible',
          transfer: false,
          newborn: false,
          occupation: '',
          maritalStatus: '',
          coverages: [
            {
              id: 'COV-1',
              sequence: 1,
              coverageId: 'COV-1',
              memberId: MEMBER_ID,
              subscriberId: 'SUB-1',
              network: 'GOLD',
              coveragePlan: 'PLAN-A',
              coverageClass: 'A',
              coverageGroup: 'G1',
              policyHolderName: REFERENCE.policyHolder,
              inForce: true,
              benefitStart: '2026-01-01',
              benefitEnd: '2026-12-31',
              periodStart: '2026-01-01',
              periodEnd: '2026-12-31',
            },
          ],
        }),
      )

    // ---- The session verbs (§1.2) ----------------------------------------
    if (path === 'Nphies/Session/Open') {
      calls.open.push(body())
      tx = {
        transactionId: '01JC8ABCDEFGHJKMNPQRSTVWXY',
        version: 1,
        etag: 'E1',
        status: 'open',
        // Bound from the agent's own session server-side — never from the body.
        plant: scenario.actingStore,
        lines: [],
        sequence: 0,
        daysSupplyDefault: 30,
        header: {
          serviceDate: '2026-08-02',
          diagnoses: [],
          exceptionPrescription: false,
          daysSupplyDefault: 30,
          reasonForVisit: '',
        },
        // Inherited from the coverage at Open, then the agent's to correct.
        insurance: {
          g1: { rate: 20, max: 500, paid: 0 },
          g2: { rate: 30, max: 500, paid: 200 },
          g3: { rate: 100, max: 0, paid: 0 },
        },
      }
      return route.fulfill(envelope({ outcome: 'opened', state: projection() }))
    }
    if (path === 'Nphies/Session/State') {
      calls.state += 1
      if (!tx || query.get('transactionId') !== tx.transactionId)
        return route.fulfill(refusal(409, 'SESSION_CLOSED', 'This request is no longer open.'))
      // 🚩 The race: a read that arrives carrying an OLDER version than what is on
      // screen. `core/`s guard must discard it, or the request goes backwards.
      if (scenario.staleRead) {
        const stale = projection()
        return route.fulfill(
          envelope({ ...stale, version: 1, etag: 'E1', lines: [], submitBlockers: [] }),
        )
      }
      // The engine has finished pricing whatever landed since the last read.
      priceLines()
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/AddItem') {
      const sent = body()
      calls.addItem.push(sent)
      if (!CATALOGUE[sent.itemNumber])
        return route.fulfill(refusal(404, 'ITEM_NOT_FOUND', 'No item with that number exists.'))
      // §2.3 — the door's own duplicate refusal, over LIVE lines only.
      if (tx.lines.some((l) => !l.voided && l.itemNumber === sent.itemNumber))
        return route.fulfill(
          refusal(
            409,
            'ITEM_ALREADY_ON_REQUEST',
            'That item is already on this request. Change its quantity instead.',
          ),
        )
      landLine(sent.itemNumber, sent.qty)
      save()
      return route.fulfill(envelope(projection()))
    }
    // §6: the transaction was submitted, abandoned or swept. The refusal carries
    // its `reason` in the envelope's own `data`, which is where `readSessionFault`
    // looks for it.
    if (scenario.sessionClosed && path.startsWith('Nphies/Session/')) {
      return route.fulfill(
        envelope(
          { reason: 'swept' },
          {
            status: 409,
            success: false,
            message: 'This request was swept by the service after being left open.',
            errors: [{ errorCode: 'SESSION_CLOSED', errorMessage: 'swept' }],
          },
        ),
      )
    }
    if (path === 'Nphies/Session/ChangeQty') {
      const sent = body()
      calls.changeQty.push(sent)
      const line = tx.lines.find((l) => l.lineId === sent.lineId)
      if (!line) return route.fulfill(refusal(404, 'LINE_NOT_FOUND', 'That line is gone.'))
      line.quantity = sent.newQty
      line.pricing = 'pending'
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/VoidLine') {
      const sent = body()
      calls.voidLine.push(sent)
      const line = tx.lines.find((l) => l.lineId === sent.lineId)
      if (!line) return route.fulfill(refusal(404, 'LINE_NOT_FOUND', 'That line is gone.'))
      // 🚩 KEPT, not removed. The whole reason the form drives a transaction.
      line.voided = true
      save()
      return route.fulfill(envelope(projection()))
    }
    // ---- 218's three insurance verbs -------------------------------------
    if (path === 'Nphies/Session/SetInsurance') {
      const sent = body()
      calls.setInsurance.push(sent)
      tx.insurance = { g1: sent.g1, g2: sent.g2, g3: sent.g3 }
      // 🚩 One rate edit re-prices the WHOLE request through the engine.
      priceLines()
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/UpdateLineInsurance') {
      const sent = body()
      calls.updateLineInsurance.push(sent)
      const line = tx.lines.find((l) => l.lineId === sent.lineId)
      if (!line) return route.fulfill(refusal(404, 'LINE_NOT_FOUND', 'That line is gone.'))
      line.maxCoverage = sent.maxPayerShare
      // The cap is a pool the group's lines share, so this re-prices siblings too.
      priceLines()
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/UpdateLineMeta') {
      const sent = body()
      calls.updateLineMeta.push(sent)
      const line = tx.lines.find((l) => l.lineId === sent.lineId)
      if (!line) return route.fulfill(refusal(404, 'LINE_NOT_FOUND', 'That line is gone.'))
      if (sent.daysSupply !== undefined) {
        // The door's own backstop (§2.3). The cell is the rule; this is what
        // stops a screen that got past it. The drive proves nothing ever asks.
        if (!Number.isInteger(sent.daysSupply) || sent.daysSupply < 1 || sent.daysSupply > 100)
          return route.fulfill(
            refusal(400, 'DAYS_SUPPLY_INVALID', 'Days supply must be between 1 and 100.'),
          )
        line.daysSupply = sent.daysSupply
      }
      if (sent.selectionReason !== undefined) line.selectionReason = sent.selectionReason
      save()
      return route.fulfill(envelope(projection()))
    }
    // ---- 219's header verb ------------------------------------------------
    // 🚩 §1.2's five optional fields: a caller sends only what it changed, and the
    // engine answers the whole state like every other verb.
    if (path === 'Nphies/Session/SetHeader') {
      const sent = body()
      calls.setHeader.push(sent)
      if (sent.diagnoses !== undefined) tx.header.diagnoses = sent.diagnoses
      if (sent.exceptionPrescription !== undefined)
        tx.header.exceptionPrescription = sent.exceptionPrescription
      save()
      return route.fulfill(envelope(projection()))
    }
    // ---- 220's gate and the act itself ------------------------------------
    // 🚩 The clinical-edit check is a PASSTHROUGH (§1.1 #10), so the body and the
    // answer are the service's own `ClinicalEditRequest` / `ClinicalEditResult`
    // (`ClinicalEditValidator.cs:285,299`) — and the answer is a list of findings
    // each typed `F` or `W`, never a boolean.
    if (path === 'Nphies/ClinicalEditValidate') {
      const sent = body()
      calls.clinicalEdit.push(sent)
      const findings =
        scenario.clinicalEdit === 'warning'
          ? [
              {
                restrictionType: 'W',
                message:
                  'Patient age code (238) does not fall within the allowed code range (201-217) for diagnosis J45.9 : Asthma, unspecified.',
              },
            ]
          : scenario.clinicalEdit === 'fatal'
            ? [
                {
                  restrictionType: 'F',
                  message:
                    'The diagnosis J45.9 : Asthma, unspecified is not accepted as a Principal diagnosis.',
                },
                {
                  restrictionType: 'W',
                  message: 'Diagnosis J45.9 is subject to rare disease restrictions.',
                },
              ]
            : []
      return route.fulfill(envelope({ contractVersion: '1.0', findings }))
    }
    if (path === 'Nphies/Session/Submit') {
      const sent = body()
      calls.submit.push(sent)
      // 🚩 A dead wire on THIS leg. Not an envelope, not a code — the case law 6
      // exists for, where nobody can say whether the payer saw the request.
      if (scenario.submit === 'transportFail')
        return route.fulfill({ status: 502, contentType: 'text/plain', body: 'Bad gateway' })
      if (scenario.submit === 'duplicate')
        return route.fulfill(
          refusal(
            409,
            'DUPLICATE_SUBMISSION',
            'A submission for this patient is already being processed. Wait for it to finish.',
          ),
        )
      if (scenario.submit === 'inFlight')
        return route.fulfill(envelope({ outcome: 'inFlight', authId: null }))
      if (scenario.submit === 'refusedLines')
        return route.fulfill(
          envelope({
            outcome: 'refused',
            authId: 'AUTH-78',
            reasons: [
              {
                lineId: tx.lines[0] ? tx.lines[0].lineId : null,
                message: 'Quantity 2 exceeds the plan maximum of 1 for this item.',
              },
              {
                lineId: tx.lines[2] ? tx.lines[2].lineId : null,
                message: 'This item is not covered under the member’s plan.',
              },
            ],
          }),
        )
      // 🚩 The header-only refusal — the service's own guards throw BEFORE the
      // lines are built (§3.9), so not one reason has a row to attach to.
      if (scenario.submit === 'refusedHeader')
        return route.fulfill(
          envelope({
            outcome: 'refused',
            authId: 'AUTH-79',
            reasons: [
              { lineId: null, message: 'Provider P001 is not configured at the exchange.' },
              { lineId: null, message: 'Item 100009 has no Nphies category.' },
            ],
          }),
        )
      tx.status = 'submitted'
      save()
      return route.fulfill(
        envelope({
          outcome: 'submitted',
          authId: 'AUTH-77',
          preAuthRef: 'PA-2026-77',
          state: projection(),
        }),
      )
    }
    if (path === 'Nphies/Session/Abandon') {
      calls.abandon.push(body())
      if (tx) tx.status = 'abandoned'
      return route.fulfill(
        envelope({ outcome: 'abandoned', transactionId: tx ? tx.transactionId : '' }),
      )
    }

    if (path === 'Nphies/AuthResponses') {
      const rows = scenario.listHasFailedRow ? [FAILED_ROW] : []
      return route.fulfill(envelope({ rows, total: rows.length, page: 1, pageSize: 50 }))
    }
    // ---- 221's one server dependency: the write-ahead journal row (§3.9) -----
    // SIS.Api-internal, no upstream call. It is the ONLY source that covers a
    // header-only refusal, because the service's own guards throw before the
    // lines are built.
    if (path.startsWith('Nphies/AuthRequestJournal/')) {
      calls.journal.push(decodeURIComponent(path.split('/')[2]))
      if (scenario.journal === 'missing')
        return route.fulfill(
          refusal(404, 'AUTH_NOT_FOUND', 'No submission was recorded for that authorization.'),
        )
      return route.fulfill(
        envelope(journalRow(scenario.journal === 'headerOnly' ? [] : JOURNAL_ITEMS)),
      )
    }
    // 220's accepted submit LANDS on the authorization it created, so the detail
    // has to answer — the thinnest `AuthHeaderDto` that renders (216's own drive
    // is where the detail itself is asserted).
    if (path.startsWith('Nphies/AuthResponse/'))
      return route.fulfill(
        envelope({
          contractVersion: '1.0',
          id: path.split('/')[2],
          eligibilityId: ELIGIBILITY_ID,
          memberId: MEMBER_ID,
          providerCode: REFERENCE.providerCode,
          payerCode: REFERENCE.payerCode,
          patientId: REFERENCE.patientId,
          patientIdType: 'NI',
          patientName: REFERENCE.patientName,
          patientGender: 'male',
          patientBirthDate: REFERENCE.patientBirthDate,
          preAuthRef: 'PA-2026-77',
          claimProcessingCodes: 'Queued',
          queued: true,
          error: false,
          cancelled: false,
          adjudicationOutcome: '',
          needComm: false,
          actionDateTime: '2026-08-02T09:20:00',
          responseDateTime: '',
          serviceDate: '2026-08-02',
          errorMessageShort: '',
          disposition: '',
          processNote: '',
          statusCode: 200,
          claimType: 0,
          diagnosis: 'J45.9',
          policyNumber: REFERENCE.policyNumber,
          policyHolder: REFERENCE.policyHolder,
          prescriptionRef: '',
          exceptionPrescription: false,
          authLines: [],
          authSupportingInfos: [],
        }),
      )
    if (path === 'Nphies/Providers') return route.fulfill(envelope({ contractVersion: '1.0', items: [] }))
    // 🚩 The two lookups are SEARCHES, not catalogues: an empty query answers
    // nothing at all, exactly as `CoreService.GetDiagnosesAsync` does.
    if (path === 'Nphies/Diagnoses') {
      const q = (query.get('query') || '').trim()
      calls.diagnoses.push(q)
      return route.fulfill(
        envelope({
          contractVersion: '1.0',
          items: q
            ? DIAGNOSES.filter(
                (d) =>
                  d.diagnosisCode.toUpperCase().startsWith(q.toUpperCase()) ||
                  d.diagnosisDescription.toLowerCase().includes(q.toLowerCase()),
              )
            : [],
        }),
      )
    }
    if (path === 'Nphies/Morphs') {
      const q = (query.get('query') || '').trim()
      calls.morphs.push(q)
      return route.fulfill(
        envelope({
          contractVersion: '1.0',
          items: q
            ? MORPHS.filter(
                (m) =>
                  m.morphCode.toUpperCase().startsWith(q.toUpperCase()) ||
                  m.morphDescription.toLowerCase().includes(q.toLowerCase()),
              )
            : [],
        }),
      )
    }
    if (path === 'Nphies/CodeSystem')
      return route.fulfill(
        envelope({
          contractVersion: '1.0',
          items: query.get('valueSet') === 'SelectionReason' ? SELECTION_REASONS : [],
        }),
      )
    // Any other probe → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const main = () => page.locator('main')
  const text = () => main().innerText()
  // The item add-row, addressed by the field only it has — the form now shares the
  // page with the diagnosis row, and "the first form in main" would be that one.
  const addForm = () => page.locator('main form').filter({ has: page.getByLabel('Item number') })
  const itemBox = () => addForm().locator('input').first()
  const addQtyBox = () => addForm().locator('input[type="number"]').first()
  // The form holds two tables now — the lines and the header deductible block —
  // so the rows are addressed by the grid's own accessible name rather than by
  // "the table in main", which would sweep three insurance rows in with them.
  const linesTable = () => page.getByRole('table', { name: 'Request lines' })
  const rows = () => linesTable().locator('tbody tr')
  const termsTable = () => page.getByRole('table', { name: 'Deductible terms' })
  const term = (group, field) => termsTable().getByLabel(`${group} ${field}`)
  /** The quantity cell of a row — the FIRST number input on it, now that a row
   *  also carries a max coverage and a days supply. */
  const qtyOf = (index) => rows().nth(index).locator('input[type="number"]').first()
  const capOf = (index) => rows().nth(index).locator('input[type="number"]').nth(1)
  const daysOf = (index) => rows().nth(index).locator('input[type="number"]').nth(2)
  /** The patient share cell — column 9 of the grid, and the only per-line money
   *  the payer adjudicates. Read by column so an assertion about re-pricing is
   *  about that figure and not about any number that happens to be on the row. */
  const patientShareOf = async (index) =>
    (await rows().nth(index).locator('td').nth(8).innerText()).trim()

  // ---- Scenario 1: the seam — an agent reaches the form FROM an eligibility --
  await page.goto(`${BASE}/nphies/eligibility/${ELIGIBILITY_ID}`)
  await page.getByRole('link', { name: /Raise authorization/ }).waitFor({ timeout: 20000 })
  await page.getByRole('link', { name: /Raise authorization/ }).click()
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  check(
    'an agent reaches the form FROM an eligibility, and the URL carries both ids',
    page.url().includes('from=' + ELIGIBILITY_ID) && page.url().includes('coverage=' + MEMBER_ID),
    page.url().replace(BASE, ''),
  )

  // ---- Scenario 2: the form OPENS a real transaction ------------------------
  await page.waitForTimeout(400)
  check('the form opens a transaction — exactly one Open', calls.open.length === 1, JSON.stringify(calls.open))
  const openBody = calls.open[0] || {}
  check(
    'Open carries the eligibility id and the chosen member id — 213s seam, verbatim',
    openBody.eligibilityId === ELIGIBILITY_ID && openBody.memberId === MEMBER_ID,
    JSON.stringify(openBody),
  )
  check(
    'and a requestId, so a retried open is absorbed rather than doubled (law 3)',
    typeof openBody.requestId === 'string' && openBody.requestId.length === 26,
    String(openBody.requestId),
  )
  check(
    '🚩 the browser sends NO plant, store, provider or channel — the server stamps identity (law 7 / law 8)',
    !('plant' in openBody) &&
      !('storeCode' in openBody) &&
      !('providerCode' in openBody) &&
      !('distributionChannel' in openBody) &&
      !('staffId' in openBody) &&
      !('shift' in openBody),
    JSON.stringify(openBody),
  )

  // ---- Scenario 3: identity is read-only VALUES, not disabled controls ------
  const opened = await text()
  check(
    'the patient, payer, policy and provider come across filled',
    /Ahmad Ali/.test(opened) &&
      /PAY-9/.test(opened) &&
      /P001/.test(opened) &&
      new RegExp(MEMBER_ID).test(opened) &&
      /POL-77/.test(opened),
  )
  const controls = await page.locator('main input, main select, main textarea').count()
  check(
    '🚩 identity renders as VALUES, not disabled controls — on an empty request the only inputs are the add-row s two, the deductible block s nine, the diagnosis row s four and the attachment row s two',
    controls === 17,
    `${controls} controls`,
  )
  check(
    'and the identity block itself holds not one control',
    (await page.locator('main dl input, main dl select').count()) === 0,
  )
  check(
    '🚩 the provider is INHERITED, not re-pickable — there is no provider control at all',
    (await page.getByLabel(/provider/i).count()) === 0,
  )
  check(
    '🚩 the header deductible block is EDITABLE — three groups of rate, cap and paid-outside (stories 38 · 40)',
    (await termsTable().locator('input').count()) === 9 &&
      (await term('Group 2', 'rate').inputValue()) === '30' &&
      (await term('Group 2', 'cap').inputValue()) === '500' &&
      (await term('Group 2', 'paid outside').inputValue()) === '200',
    `${await termsTable().locator('input').count()} boxes`,
  )
  check(
    'the acting store is stated as the pricing plant, bound for the life of the request',
    /Priced at store 1101/.test(opened),
    (opened.match(/Priced at store[^\n]*/) || [''])[0],
  )
  check('🚩 no modal opens anywhere in this flow', (await page.locator('dialog').count()) === 0)

  // ---- Scenario 4: add an item — it prices IN PLACE -------------------------
  await itemBox().fill('100001')
  await addQtyBox().fill('2')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await rows().first().waitFor({ timeout: 15000 })
  check('adding an item appends a line', (await rows().count()) === 1)
  check(
    '🚩 ONE press is ONE add — a doubled submit would race a duplicate onto the wire',
    calls.addItem.length === 1,
    `${calls.addItem.length} calls`,
  )
  const addBody = calls.addItem[0] || {}
  check(
    '🚩 the add sends an item number and a quantity and NEVER a price (law 1)',
    addBody.itemNumber === '100001' &&
      addBody.qty === 2 &&
      !('unitPrice' in addBody) &&
      !('price' in addBody) &&
      !('amount' in addBody) &&
      !('extendedPrice' in addBody),
    JSON.stringify(addBody),
  )
  check(
    'and carries the transaction and its own request id',
    addBody.transactionId === '01JC8ABCDEFGHJKMNPQRSTVWXY' &&
      typeof addBody.requestId === 'string' &&
      addBody.requestId !== openBody.requestId,
  )
  check(
    '🚩 the line PRICES IN PLACE and says so while it waits (story 27)',
    /Pricing…/.test(await rows().first().innerText()),
    (await rows().first().innerText()).replace(/\n/g, ' | '),
  )
  // The engine finishes; the agent asks for the request as it now stands.
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(400)
  const priced = await rows().first().innerText()
  check(
    'and the money that arrives is the ENGINEs, rendered as sent',
    /25\.00/.test(priced) && /50\.00/.test(priced) && /7\.50/.test(priced) && /10\.00/.test(priced),
    priced.replace(/\n/g, ' | '),
  )
  check('the add-row clears itself on its own success', (await itemBox().inputValue()) === '')

  // ---- Scenario 5: 🚩 the duplicate, refused AT THE MOMENT OF ADDING --------
  const addsBefore = calls.addItem.length
  await itemBox().fill('100001')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(300)
  const refused = await text()
  check(
    '🚩 a second add of an item already on the request is REFUSED',
    /already on this request/.test(refused),
    (refused.match(/Item 100001[^\n]*/) || [''])[0],
  )
  check(
    '🚩 and the refusal NAMES THE QUANTITY CONTROL as the remedy (§2.3)',
    /quantity/i.test((refused.match(/Item 100001[^\n]*/) || [''])[0]),
  )
  check(
    'and points at the line that already holds it',
    /line 1/.test((refused.match(/Item 100001[^\n]*/) || [''])[0]),
  )
  check(
    '🚩 it costs no round trip — the refusal is stated before the door is asked',
    calls.addItem.length === addsBefore,
    `${calls.addItem.length - addsBefore} calls`,
  )
  check(
    '🚩 the refusal moves the caret to the control it names',
    await addQtyBox().evaluate((el) => el === document.activeElement),
  )
  check(
    'and the row keeps what was typed, so the number need not be read off the prescription again',
    (await itemBox().inputValue()) === '100001',
  )
  check('no line was added by the refused add', (await rows().count()) === 1)

  // ---- Scenario 6: the DOOR's own refusal reads the same way ----------------
  // A screen that has fallen behind sends an add the door refuses. The client's forward
  // check is not a second opinion: the same sentence, the same named remedy.
  tx.lines.push({
    ...tx.lines[0],
    lineId: 'L99',
    sequence: 99,
    itemNumber: '100002',
    itemDescription: CATALOGUE['100002'].description,
  })
  await itemBox().fill('100002')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  const serverRefused = await text()
  check(
    '🚩 the DOORs `ITEM_ALREADY_ON_REQUEST` renders as the same refusal, with the same remedy',
    /already on this request/.test(serverRefused) &&
      /quantity/i.test((serverRefused.match(/Item 100002[^\n]*/) || [''])[0]),
    (serverRefused.match(/Item 100002[^\n]*/) || [''])[0],
  )
  check(
    'and it carries the servers own sentence beside it, passed through as data (§6 kind 2)',
    /Change its quantity instead/.test(serverRefused),
  )
  // Put the request back as the agent sees it.
  tx.lines = tx.lines.filter((l) => l.lineId !== 'L99')
  save()
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(300)

  // ---- Scenario 7: an unknown item is a refusal the row states -------------
  await itemBox().fill('NOPE')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  check(
    'an unknown item number is a business outcome in words, not a crash',
    /No item with that number exists/.test(await text()),
  )

  // ---- Scenario 8: change a quantity --------------------------------------
  await itemBox().fill('100002')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  check('a second, different item is an ordinary add', (await rows().count()) === 2)

  const qtyCell = qtyOf(0)
  await qtyCell.fill('5')
  await qtyCell.press('Enter')
  await page.waitForTimeout(400)
  const qtyBody = calls.changeQty[0] || {}
  check(
    'changing a quantity sends a NEW quantity, never a delta',
    qtyBody.newQty === 5 && qtyBody.lineId === 'L1' && !('delta' in qtyBody),
    JSON.stringify(qtyBody),
  )
  check('and the grid shows what the engine came back with', (await qtyCell.inputValue()) === '5')
  check(
    'a quantity that did not change sends nothing at all',
    await (async () => {
      const before = calls.changeQty.length
      await qtyCell.fill('5')
      await qtyCell.press('Enter')
      await page.waitForTimeout(250)
      return calls.changeQty.length === before
    })(),
  )

  // ---- Scenario 9: 🚩 a voided line is KEPT, not removed -------------------
  const rowsBefore = await rows().count()
  await rows().nth(1).getByRole('button', { name: /^Void$/ }).click()
  await page.waitForTimeout(400)
  check('voiding sends the line id and nothing else the engine owns', calls.voidLine.length === 1)
  check(
    '🚩 THE VOIDED LINE IS STILL THERE — the audit trail is the whole point (law 2)',
    (await rows().count()) === rowsBefore,
    `${await rows().count()} rows`,
  )
  const voidedRow = await rows().nth(1).innerText()
  check('and it says what it is', /Voided/.test(voidedRow), voidedRow.replace(/\n/g, ' | '))
  check(
    'a voided line offers no further acts — there is no un-void verb',
    (await rows().nth(1).getByRole('button', { name: /^Void$/ }).count()) === 0,
  )
  check(
    'the heading counts what the payer is being asked for, not what is on the screen',
    /1 item on the request/.test(await text()),
    (await text()).match(/\d+ items? on the request/)?.[0] || '',
  )
  check(
    '🚩 and the voided line does not block its own item — it can be added again',
    await (async () => {
      await itemBox().fill('100002')
      await addQtyBox().fill('1')
      await page.getByRole('button', { name: /^Add$/ }).click()
      await page.waitForTimeout(400)
      return (await rows().count()) === rowsBefore + 1 && !/already on this request/.test(await text())
    })(),
  )

  // ---- Scenario 10: 🚩 a stale state never replaces a newer one ------------
  scenario.staleRead = true
  const linesBefore = await rows().count()
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(400)
  check(
    '🚩 a state arriving with an OLDER version is DISCARDED — the request never goes backwards',
    (await rows().count()) === linesBefore,
    `${await rows().count()} rows, was ${linesBefore}`,
  )
  scenario.staleRead = false

  // ---- Scenario 10b: 🚩 the transaction is no longer this tab's to write to --
  // §6's `SESSION_CLOSED`. `core/`s session-fault reader is what makes the answer
  // the same for every verb — ticket 210 moved it precisely because this contract
  // names the same two codes with the same three reasons.
  scenario.sessionClosed = true
  await qtyOf(0).fill('9')
  await qtyOf(0).press('Enter')
  await page.waitForTimeout(500)
  const closed = await text()
  check(
    '🚩 a closed transaction stops the form and says so in the servers own words',
    /no longer open/.test(closed) && /swept by the service/.test(closed),
    (closed.match(/This request is no longer open[^\n]*/) || [''])[0],
  )
  check(
    '🚩 and nothing is left pointing at it — no add-row over a request that is gone',
    (await addForm().count()) === 0 && (await rows().count()) === 0,
  )
  check(
    'the way back is the list, not a retry there is nothing to retry against',
    (await page.getByRole('link', { name: /Back to authorizations/ }).count()) >= 1,
  )
  scenario.sessionClosed = false

  // Back to a live request for the leave scenarios.
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  await itemBox().fill('100001')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await rows().first().waitFor({ timeout: 15000 })
  const linesAfterReopen = await rows().count()

  // ---- Scenario 11: leaving warns, and the warning is honest ---------------
  const abandonsBefore = calls.abandon.length
  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForTimeout(300)
  // Scoped to the banner itself, not to the page: the page's own subtitle also says
  // that leaving discards the request, and an assertion that matched it would pass
  // with the warning deleted.
  const warnBanner = page.getByRole('alert').filter({ hasText: 'Leave and discard' })
  const warned = (await warnBanner.count()) ? await warnBanner.first().innerText() : ''
  check(
    '🚩 leaving a part-built request WARNS first (story 64)',
    /Leaving discards this request/.test(warned),
    warned.replace(/\n/g, ' | '),
  )
  check(
    'and it says what is actually true — discarded, not merely unsaved',
    /no draft to come back to/.test(warned),
  )
  check('🚩 the warning is INLINE — still no modal in this flow', (await page.locator('dialog').count()) === 0)
  check('nothing was abandoned while the agent decides', calls.abandon.length === abandonsBefore)
  check(
    'and the request is still on screen behind the warning',
    (await rows().count()) === linesAfterReopen,
  )

  await page.getByRole('button', { name: /Stay on the request/ }).click()
  await page.waitForTimeout(300)
  check(
    'Stay keeps the agent on the request, with everything on it',
    page.url().includes('/nphies/authorizations/new') &&
      (await rows().count()) === linesAfterReopen,
  )

  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /Leave and discard/ }).click()
  // Wait for the landing rather than for a clock: the abandon is a round trip, and a
  // fixed timeout would make this assertion a race rather than a check.
  await page.waitForURL(/\/nphies\/authorizations$/, { timeout: 15000 }).catch(() => {})
  check(
    '🚩 leaving ABANDONS the transaction — nothing lingers half-built (story 65)',
    calls.abandon.length === abandonsBefore + 1,
    JSON.stringify(calls.abandon[calls.abandon.length - 1] || {}),
  )
  const abandonBody = calls.abandon[calls.abandon.length - 1] || {}
  check(
    'the abandon carries the transaction and its OWN request id',
    abandonBody.transactionId === '01JC8ABCDEFGHJKMNPQRSTVWXY' &&
      typeof abandonBody.requestId === 'string' &&
      abandonBody.requestId !== openBody.requestId,
  )
  check(
    'and the agent lands somewhere — an abandon with no follow-on leaves them holding nothing',
    /\/nphies\/authorizations$/.test(page.url()),
    page.url().replace(BASE, ''),
  )

  // ---- Scenario 12: an EMPTY session leaves silently, and still abandons ---
  const abandons2 = calls.abandon.length
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForURL(/\/nphies\/authorizations$/, { timeout: 15000 }).catch(() => {})
  check(
    'an EMPTY request leaves with no warning — the warning is kept for what it is worth',
    /\/nphies\/authorizations$/.test(page.url()),
    page.url().replace(BASE, ''),
  )
  check(
    '🚩 and it is STILL abandoned — an OPEN transaction is never left for the sweeper',
    calls.abandon.length === abandons2 + 1,
  )

  // ---- Scenario 13: no polling anywhere -----------------------------------
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  const readsBefore = calls.state
  const opensBefore = calls.open.length
  await page.waitForTimeout(3500)
  check(
    '🚩 nothing polls — the state is read when the agent asks and never on a timer',
    calls.state === readsBefore && calls.open.length === opensBefore,
    `${calls.state - readsBefore} reads, ${calls.open.length - opensBefore} opens`,
  )

  // ---- Scenario 14: a half-addressed URL cannot open a transaction ---------
  const opens14 = calls.open.length
  await page.goto(`${BASE}/nphies/authorizations/new?from=${ELIGIBILITY_ID}`)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    'a URL with no coverage says which half is missing, in the agents words',
    /No policy was chosen/.test(await text()),
  )
  check(
    '🚩 and NO transaction is opened — an engine document is not raised to report a bad link',
    calls.open.length === opens14,
  )

  // ---- Scenario 15: no acting store, no session ---------------------------
  scenario.actingStore = ''
  const opens15 = calls.open.length
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    '🚩 the session will not open until the PLANT is resolved — it is bound at Open and never moves',
    /acting store is not resolved/.test(await text()) && calls.open.length === opens15,
    (await text()).match(/Your acting store[^\n]*/)?.[0] || '',
  )
  scenario.actingStore = '1101'

  // ---- Scenario 16: a contract major this client cannot speak -------------
  scenario.contractVersion = '9.0'
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  const stopped = await text()
  check(
    '🚩 a MAJOR contract mismatch is a hard stop, before any state is rendered (law 10)',
    /out of date/.test(stopped) && (await rows().count()) === 0,
  )
  check(
    'and it states both versions, because "update the portal" has to be actionable',
    /9\.0/.test(stopped) && /1\.1/.test(stopped),
    (stopped.match(/The server answered[^\n]*/) || [''])[0],
  )
  scenario.contractVersion = '1.0'

  // ---- Scenario 17: the area's one grant, failing closed ------------------
  scenario.access = { canOpenNphies: false }
  const opens17 = calls.open.length
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    'no grant → the form is shut, and no transaction is opened',
    /No access to Nphies/.test(await text()) && calls.open.length === opens17,
  )
  scenario.access = { canOpenNphies: true }

  scenario.accessDown = true
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    '🚩 an ERRORED probe fails closed — the form stays shut and says UNAVAILABLE, not "you lack the grant"',
    /Nphies is unavailable/.test(await text()) && !/does not hold the Nphies grant/.test(await text()),
  )
  scenario.accessDown = false

  // =========================================================================
  // Ticket 218 — the agent's FIVE money inputs, and nothing else editable.
  // A fresh request with four lines, one per insurance category, so every rule
  // below is asserted against the category it actually applies to.
  // =========================================================================
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  for (const [itemNumber, qty] of [
    ['100001', '2'], // Generic, G1
    ['100004', '1'], // NonMed, G1 — the sibling that shares G1's pool
    ['100002', '2'], // Brand, G2
    ['100003', '1'], // Brand-IR, G3 — the one the service overwrites at submit
  ]) {
    await itemBox().fill(itemNumber)
    await addQtyBox().fill(qty)
    await page.getByRole('button', { name: /^Add$/ }).click()
    await page.waitForTimeout(350)
  }
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(400)
  check('four lines, one per insurance category', (await rows().count()) === 4, `${await rows().count()} rows`)

  // ---- Scenario 18: exactly five inputs, and every other money read-only ---
  check(
    '🚩 a line offers THREE inputs — quantity, max coverage, days supply — and no more',
    (await rows().first().locator('input').count()) === 3,
    `${await rows().first().locator('input').count()} inputs on line 1`,
  )
  check(
    '🚩 unit price, extended, discount, net, VAT, patient share, deductible and group are VALUES, not controls (story 32)',
    await (async () => {
      const cells = rows().first().locator('td')
      // Columns 4–11: everything the engine owns, between the quantity and the
      // agent's three cells. Not one of them may hold an input.
      for (let column = 3; column <= 10; column += 1) {
        if ((await cells.nth(column).locator('input, select, textarea').count()) > 0) return false
      }
      return true
    })(),
  )
  check(
    'and there is no item swap, price override or discount override anywhere on the page',
    (await page.locator('main button').filter({ hasText: /price|discount|replace|swap/i }).count()) === 0,
  )

  // ---- Scenario 19: 🚩 a rate edit re-prices the request through the ENGINE
  const beforeRate = [await patientShareOf(0), await patientShareOf(1), await patientShareOf(2)]
  await term('Group 1', 'rate').fill('40')
  await term('Group 1', 'rate').press('Enter')
  await page.waitForTimeout(500)
  const afterRate = [await patientShareOf(0), await patientShareOf(1), await patientShareOf(2)]
  check(
    '🚩 ONE rate edit re-prices EVERY line that rate touches (story 39)',
    afterRate[0] !== beforeRate[0] && afterRate[1] !== beforeRate[1],
    `${beforeRate.join(' / ')} → ${afterRate.join(' / ')}`,
  )
  check(
    'and the lines it does not touch are left exactly as the engine had them',
    afterRate[2] === beforeRate[2],
    `G2 line: ${beforeRate[2]} → ${afterRate[2]}`,
  )
  check(
    'one edit is ONE verb — not one per box, and not one per line',
    calls.setInsurance.length === 1,
    `${calls.setInsurance.length} calls`,
  )
  const insuranceBody = calls.setInsurance[0] || {}
  check(
    '🚩 setInsurance carries all three groups, each with rate, cap and PAID-OUTSIDE (§1.2)',
    insuranceBody.g1?.rate === 40 &&
      insuranceBody.g1?.max === 500 &&
      insuranceBody.g2?.paid === 200 &&
      insuranceBody.g3?.rate === 100,
    JSON.stringify(insuranceBody),
  )
  check(
    '🚩 and NO amount, line or total — the browser computes none of the money (law 1)',
    !('lines' in insuranceBody) &&
      !('total' in insuranceBody) &&
      !('actualPatientShare' in insuranceBody) &&
      Object.keys(insuranceBody).sort().join(',') === 'g1,g2,g3,requestId,transactionId',
    Object.keys(insuranceBody).join(','),
  )

  // ---- Scenario 20: paid-outside is an input, and it is PERSISTED ---------
  await term('Group 2', 'paid outside').fill('250')
  await term('Group 2', 'paid outside').press('Enter')
  await page.waitForTimeout(500)
  check(
    '🚩 paid-outside reaches the request, so a 500 cap with 250 spent is not stored as a 250 cap (story 41)',
    (calls.setInsurance[1] || {}).g2?.paid === 250 && (calls.setInsurance[1] || {}).g2?.max === 500,
    JSON.stringify((calls.setInsurance[1] || {}).g2 || {}),
  )
  check(
    'and it comes back from the engine, not from what was typed',
    (await term('Group 2', 'paid outside').inputValue()) === '250',
  )
  const idleCalls = calls.setInsurance.length
  await term('Group 3', 'rate').click()
  await term('Group 1', 'cap').click()
  await page.waitForTimeout(300)
  check(
    'a blur that changed nothing sends no verb — an idle tab-through is not an edit',
    calls.setInsurance.length === idleCalls,
  )
  await term('Group 1', 'rate').fill('130')
  await term('Group 1', 'rate').press('Enter')
  await page.waitForTimeout(300)
  check(
    'a rate outside 0–100 is refused at the box and never sent',
    /percentage between 0 and 100/.test(await text()) && calls.setInsurance.length === idleCalls,
  )
  await term('Group 1', 'rate').fill('40')
  // Narrow G1's cap so the pool actually binds — which is what makes a per-line
  // cap visibly re-bucket its sibling.
  await term('Group 1', 'cap').fill('40')
  await term('Group 1', 'cap').press('Enter')
  await page.waitForTimeout(500)

  // ---- Scenario 21: 🚩 a cap of ZERO warns rather than silently doing nothing
  const capCallsBefore = calls.updateLineInsurance.length
  // Cleared and typed, the way an agent enters a number over one — `fill` alone
  // on an identical value is not a keystroke and would not be one for a person
  // either.
  await capOf(0).fill('')
  await capOf(0).type('0')
  await capOf(0).press('Enter')
  await page.waitForTimeout(350)
  check(
    '🚩 a MAX COVERAGE of zero WARNS — the engine ignores `<= 0`, so accepting it would quietly do nothing',
    /cap of zero will not apply/.test(await text()),
    (await text()).match(/A cap of zero[^\n]*/)?.[0] || '',
  )
  check(
    'and nothing is sent — a value that would not apply never reaches the door',
    calls.updateLineInsurance.length === capCallsBefore,
  )
  const siblingBefore = await patientShareOf(1)
  await capOf(0).fill('5')
  await capOf(0).press('Enter')
  await page.waitForTimeout(500)
  check(
    'a real cap is sent as the payer-share cap, on the line it was typed on',
    (calls.updateLineInsurance[0] || {}).maxPayerShare === 5 &&
      (calls.updateLineInsurance[0] || {}).lineId === 'L1',
    JSON.stringify(calls.updateLineInsurance[0] || {}),
  )
  check(
    '🚩 and it RE-BUCKETS THE SIBLING — per-group caps share a pool, so the other G1 line re-prices too',
    (await patientShareOf(1)) !== siblingBefore,
    `line 2 patient share ${siblingBefore} → ${await patientShareOf(1)}`,
  )

  // ---- Scenario 22: 🚩 days supply, validated 1–100 AT THE CELL -----------
  check(
    'the header default is stamped onto each line as it lands (story 35)',
    (await daysOf(0).inputValue()) === '30' && (await daysOf(2).inputValue()) === '30',
  )
  const metaBefore = calls.updateLineMeta.length
  await daysOf(0).fill('120')
  await daysOf(0).press('Enter')
  await page.waitForTimeout(350)
  check(
    '🚩 a days supply outside 1–100 is REFUSED AT THE CELL, so an out-of-range value can never exist',
    /between 1 and 100/.test(await text()),
    (await text()).match(/Days supply must[^\n]*/)?.[0] || '',
  )
  check(
    '🚩 and nothing is sent — there is no submit-time sweep to reset it later (story 36)',
    calls.updateLineMeta.length === metaBefore,
  )
  await daysOf(0).fill('0')
  await daysOf(0).press('Enter')
  await page.waitForTimeout(300)
  check(
    'zero is out of range too — the range is 1–100, not 0–100',
    /between 1 and 100/.test(await text()) && calls.updateLineMeta.length === metaBefore,
  )
  await daysOf(0).fill('60')
  await daysOf(0).press('Enter')
  await page.waitForTimeout(450)
  check(
    'a value inside the range is sent, alone, on updateLineMeta',
    (calls.updateLineMeta[0] || {}).daysSupply === 60 &&
      !('selectionReason' in (calls.updateLineMeta[0] || {})),
    JSON.stringify(calls.updateLineMeta[0] || {}),
  )
  check('and the cell keeps what the engine came back with', (await daysOf(0).inputValue()) === '60')

  // ---- Scenario 23: 🚩 Selection Reason — disabled on GENERIC lines only --
  check(
    '🚩 a Generic line offers NO selection reason picker, and says why',
    (await rows().first().locator('select').count()) === 0 &&
      /Not on a generic item/.test(await rows().first().innerText()),
    (await rows().first().innerText()).replace(/\n/g, ' | ').slice(0, 120),
  )
  check(
    '🚩 every other category DOES offer it — including NonMed, which looks like it should be excluded',
    (await rows().nth(1).locator('select').count()) === 1 &&
      (await rows().nth(2).locator('select').count()) === 1 &&
      (await rows().nth(3).locator('select').count()) === 1,
  )
  check(
    'and Brand-IR keeps its picker even though the service overwrites the value at submit — the quirk is reproduced, not fixed',
    (await rows().nth(3).locator('select').isDisabled()) === false,
  )
  const reasonOptions = await rows().nth(1).locator('select option').allInnerTexts()
  check(
    'the reasons are FETCHED from the code system, not spelled into the client (§3.8)',
    reasonOptions.includes('No generic alternative') && reasonOptions.includes('Patient request'),
    reasonOptions.join(' / '),
  )
  check(
    'and a blocked code is not offered — NPHIES no longer accepts it',
    !reasonOptions.includes('Retired reason'),
    reasonOptions.join(' / '),
  )
  await rows().nth(1).locator('select').selectOption('patient-request')
  await page.waitForTimeout(450)
  const reasonCall = calls.updateLineMeta[calls.updateLineMeta.length - 1] || {}
  check(
    'picking one sends the CODE alone, on the line it was picked for',
    reasonCall.selectionReason === 'patient-request' &&
      reasonCall.lineId === 'L2' &&
      !('daysSupply' in reasonCall),
    JSON.stringify(reasonCall),
  )
  check(
    'and no modal opened anywhere in any of this',
    (await page.locator('dialog').count()) === 0,
  )

  // =========================================================================
  // Ticket 219 — the supporting material: the diagnoses that justify the request
  // and the files that evidence it. Both replace a validation with a control.
  // =========================================================================
  const dxTable = () => page.getByRole('table', { name: 'Diagnoses' })
  const dxRows = () => dxTable().locator('tbody tr')
  const dxSearch = () => page.getByLabel('Search', { exact: true })
  const dxMatch = () => page.getByLabel('Diagnosis', { exact: true })
  const addDiagnosis = () => page.getByRole('button', { name: /Add diagnosis/ })
  const lastHeader = () => calls.setHeader[calls.setHeader.length - 1] || {}

  // ---- Scenario 24: a diagnosis is added from a compact row, against a lookup
  await dxSearch().fill('C50')
  await page.waitForTimeout(600)
  const dxOptions = await dxMatch().locator('option').allInnerTexts()
  check(
    '🚩 the diagnosis picker SEARCHES the code lookup — the client holds no catalogue',
    dxOptions.some((o) => /C50\.9/.test(o)) && calls.diagnoses.includes('C50'),
    dxOptions.join(' / '),
  )
  await dxMatch().selectOption('C50.9')
  await addDiagnosis().click()
  await page.waitForTimeout(450)
  check('adding a diagnosis puts a row on the request', (await dxRows().count()) === 1)
  const firstHeader = lastHeader()
  check(
    '🚩 it goes on setHeader as the DIAGNOSES LIST WHOLE — there is no add-one verb (§1.2)',
    Array.isArray(firstHeader.diagnoses) &&
      firstHeader.diagnoses.length === 1 &&
      firstHeader.diagnoses[0].code === 'C50.9' &&
      firstHeader.diagnoses[0].description.length > 0 &&
      !('serviceDate' in firstHeader) &&
      !('daysSupplyDefault' in firstHeader),
    JSON.stringify(firstHeader),
  )
  check(
    'the first diagnosis is the principal by construction — a request needs exactly one',
    firstHeader.diagnoses[0].type === 'principal' &&
      (await dxRows().first().locator('input[type=radio]').isChecked()),
  )

  // ---- Scenario 25: 🚩 choosing a principal DESELECTS the other -------------
  await dxSearch().fill('J45')
  await page.waitForTimeout(600)
  await dxMatch().selectOption('J45.9')
  await addDiagnosis().click()
  await page.waitForTimeout(450)
  check('a second diagnosis is an ordinary row', (await dxRows().count()) === 2)
  check(
    'and it is NOT principal — the radio is how the principal moves',
    lastHeader().diagnoses[1].type === 'secondary',
    JSON.stringify(lastHeader().diagnoses),
  )
  check(
    '🚩 exactly one radio is checked — uniqueness is STRUCTURAL, not validated at submit',
    (await dxTable().locator('input[type=radio]:checked').count()) === 1,
  )

  // ---- Scenario 26: 🚩 morphology appears WITH ITS CAUSE, and leaves with it
  check(
    '🚩 a neoplasm principal makes the morphology field EXIST, and it says why',
    /A morphology is required because C50\.9/.test(await text()),
    ((await text()).match(/A morphology is required[^\n]*/) || [''])[0],
  )
  check(
    'and the requirement is a named blocker on Submit rather than a refusal after it',
    /needs a morphology code/.test(await text()),
  )
  await page.getByLabel('Search morphologies').fill('M81')
  await page.waitForTimeout(600)
  await page.getByLabel('Morphology', { exact: true }).selectOption('M8140/3')
  await page.waitForTimeout(450)
  check(
    'the morphology rides ON the principal diagnosis (§2s shape), not as a fourth field',
    lastHeader().diagnoses[0].morphology === 'M8140/3' &&
      lastHeader().diagnoses[1].morphology === '',
    JSON.stringify(lastHeader().diagnoses),
  )
  // Move the radio to a diagnosis the service does not ask a morphology for.
  await dxRows().nth(1).locator('input[type=radio]').click()
  await page.waitForTimeout(500)
  check(
    '🚩 moving the principal to a plain diagnosis makes the morphology field DISAPPEAR',
    !/A morphology is required/.test(await text()) &&
      (await page.getByLabel('Morphology', { exact: true }).count()) === 0,
  )
  check(
    'and the morphology goes with it — nothing rides along on a row with no reason to carry one',
    lastHeader().diagnoses.every((d) => d.morphology === ''),
    JSON.stringify(lastHeader().diagnoses),
  )
  check(
    'exactly one principal, still — the row that lost it is kept as a secondary',
    lastHeader().diagnoses.filter((d) => d.type === 'principal').length === 1 &&
      lastHeader().diagnoses[0].type === 'secondary',
    JSON.stringify(lastHeader().diagnoses.map((d) => [d.code, d.type])),
  )

  // ---- Scenario 27: the exception prescription is one checkbox -------------
  // `.click()`, not `.check()`. The box is CONTROLLED by the engine's state, so it
  // does not flip until `setHeader` answers — and Playwright's `check()` asserts
  // the new state before the round trip lands and gives up. What is being verified
  // is the verb, which is what the assertion below reads.
  await page.getByRole('checkbox').first().click()
  await page.waitForTimeout(700)
  check(
    '🚩 exception prescription is a CHECKBOX, sent alone on setHeader',
    lastHeader().exceptionPrescription === true && !('diagnoses' in lastHeader()),
    JSON.stringify(lastHeader()),
  )

  // ---- Scenario 28: 🚩 at least one attachment is a FORM STATE -------------
  const submitButton = () => page.getByRole('button', { name: /^Submit$/ })
  check(
    '🚩 Submit is DISABLED while nothing is attached, and a banner says so',
    (await submitButton().isDisabled()) && /At least one attachment is required/.test(await text()),
  )
  check(
    'and the blocker names itself rather than leaving the agent to hunt',
    /Nothing is attached/.test(await text()),
    ((await text()).match(/Nothing is attached[^\n]*/) || [''])[0],
  )

  const fileInput = () => page.locator('main input[type=file]')
  // A PDF over the 5 MB cap — refused AT THE PICKER, before the request is built.
  await fileInput().setInputFiles({
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(6 * 1024 * 1024, 0x20),
  })
  await page.waitForTimeout(600)
  check(
    '🚩 a PDF over 5 MB is REFUSED AT THE PICKER, with a re-scan message',
    /Re-scan it at a lower resolution/.test(await text()) &&
      (await page.locator('main ul li img, main ul li').filter({ hasText: /sent/ }).count()) === 0,
    ((await text()).match(/That PDF is[^\n]*/) || [''])[0],
  )
  check('and Submit is still unavailable', await submitButton().isDisabled())

  // A 4000×3000 photograph, made in the page so the bytes are a real JPEG.
  const bigPhoto = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4000
    canvas.height = 3000
    const context = canvas.getContext('2d')
    const gradient = context.createLinearGradient(0, 0, 4000, 3000)
    gradient.addColorStop(0, '#ff0000')
    gradient.addColorStop(1, '#0000ff')
    context.fillStyle = gradient
    context.fillRect(0, 0, 4000, 3000)
    for (let x = 0; x < 4000; x += 6) {
      context.fillStyle = x % 12 === 0 ? '#00ff00' : '#ffffff'
      context.fillRect(x, 0, 3, 3000)
    }
    return canvas.toDataURL('image/jpeg', 0.98).split(',')[1]
  })
  const photoBytes = Buffer.from(bigPhoto, 'base64')
  await fileInput().setInputFiles({
    name: 'prescription.jpg',
    mimeType: 'image/jpeg',
    buffer: photoBytes,
  })
  await page.waitForTimeout(1200)
  const attachmentRow = () => page.locator('main ul li').filter({ hasText: /sent/ })
  check('the photo is attached as one row', (await attachmentRow().count()) === 1)
  const sizes = ((await attachmentRow().first().innerText()).match(
    /([\d.]+) (KB|MB) → ([\d.]+) (KB|MB) sent/,
  ) || [])
  const asBytes = (value, unit) => Number(value) * (unit === 'MB' ? 1024 * 1024 : 1024)
  check(
    '🚩 a large photograph is DOWNSCALED in the browser before it is attached',
    sizes.length === 5 && asBytes(sizes[3], sizes[4]) < asBytes(sizes[1], sizes[2]) / 4,
    sizes[0] || (await attachmentRow().first().innerText()).replace(/\n/g, ' | '),
  )
  check(
    'and Submit becomes available the moment one attachment exists',
    !(await submitButton().isDisabled()) && !/At least one attachment is required/.test(await text()),
  )
  check(
    '🚩 there is NO type dropdown — the file s own MIME derives it, and only the document is picked',
    (await page.getByLabel('Document').locator('option').count()) === 7 &&
      (await page.getByLabel('Document').inputValue()) === 'Prescription',
  )

  // ---- Scenario 29: the lightbox shows exactly what will be sent -----------
  const thumbSrc = await attachmentRow().first().locator('img').getAttribute('src')
  await attachmentRow().first().getByRole('button', { name: /^View$/ }).click()
  await page.waitForTimeout(300)
  const lightbox = page.getByRole('group', { name: /Preview of prescription\.jpg/ })
  const lightboxSrc = await lightbox.locator('img').getAttribute('src')
  check(
    '🚩 the preview reads the SAME data URL that will be sent — not a re-render of the original file',
    lightboxSrc === thumbSrc && String(lightboxSrc).startsWith('data:image/jpeg;base64,'),
    String(lightboxSrc).slice(0, 32),
  )
  check(
    '🚩 and the downscale made it a JPEG, whatever it arrived as — the services hardcoded content type stops lying',
    String(lightboxSrc).startsWith('data:image/jpeg;base64,'),
  )
  check(
    'the lightbox is INLINE — still no modal anywhere in this flow',
    (await page.locator('dialog').count()) === 0,
  )
  await lightbox.getByRole('button', { name: /^Close$/ }).click()
  await page.waitForTimeout(200)

  // ---- Scenario 30: 🚩 the same title twice is ALLOWED ---------------------
  await fileInput().setInputFiles({
    name: 'prescription-2.jpg',
    mimeType: 'image/jpeg',
    buffer: photoBytes,
  })
  await page.waitForTimeout(1200)
  const titles = await page.locator('main ul li').filter({ hasText: /sent/ }).allInnerTexts()
  check(
    '🚩 TWO PRESCRIPTIONS ARE TWO PRESCRIPTIONS — a duplicate title is not refused the way a duplicate item is',
    titles.length === 2 && titles.every((row) => /Prescription/.test(row)),
    titles.map((row) => row.split('\n')[0]).join(' / '),
  )
  check(
    'and nothing was sent by attaching one — attachments ride on submit, they are not a verb',
    calls.setHeader.filter((call) => 'attachments' in call).length === 0 &&
      (await page.evaluate(() => true)),
  )

  // Removal is per row, and the mandatory state comes back with the last one.
  await page.locator('main ul li').filter({ hasText: /sent/ }).first().getByRole('button', { name: /^Remove$/ }).click()
  await page.waitForTimeout(300)
  check('an attachment is removed per row', (await attachmentRow().count()) === 1)
  await page.locator('main ul li').filter({ hasText: /sent/ }).first().getByRole('button', { name: /^Remove$/ }).click()
  await page.waitForTimeout(300)
  check(
    '🚩 and with the last one gone the form is blocked again — it is a STATE, not a one-time check',
    (await submitButton().isDisabled()) && /At least one attachment is required/.test(await text()),
  )

  // =========================================================================
  // Ticket 220 — submit as a GATED PATH, and the three outcomes of pressing it.
  // The session from 218/219 is still live: four lines, two diagnoses, a plain
  // principal, and nothing attached (scenario 30 removed the last row).
  // =========================================================================

  // ---- Scenario 31: 🚩 every blocker names ITSELF -------------------------
  const blockerList = () => page.locator('main [role=status] ul li')
  check(
    '🚩 the blockers are a LIST, counted — not one message box naming whichever condition was hit first',
    /1 thing is holding this request/.test(await text()) && (await blockerList().count()) >= 1,
    ((await text()).match(/\d+ things? (is|are) holding[^\n]*/) || [''])[0],
  )
  check(
    'and the one that holds names itself in words',
    /Nothing is attached/.test(await text()),
  )
  // A server-stated blocker renders in the SERVER's words (§6 kind 2), beside
  // the client's — one list, whoever the rule belongs to.
  scenario.serverBlockers = [
    { code: 'PROVIDER_NOT_CONFIGURED', message: 'Provider P001 is not configured at the exchange.' },
  ]
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(500)
  check(
    '🚩 the SERVER’s own submitBlockers join the same list, in its words',
    /Provider P001 is not configured at the exchange\./.test(await text()) &&
      /2 things are holding this request/.test(await text()),
    ((await text()).match(/\d+ things? (is|are) holding[^\n]*/) || [''])[0],
  )
  check('and Submit is unavailable while any of them holds', await submitButton().isDisabled())
  scenario.serverBlockers = []

  await fileInput().setInputFiles({
    name: 'prescription.jpg',
    mimeType: 'image/jpeg',
    buffer: photoBytes,
  })
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(1200)
  check(
    'with every blocker cleared the act is offered, and it says what pressing it will do',
    !(await submitButton().isDisabled()) &&
      /clinical-edit check first/.test(await text()),
  )

  // ---- Scenario 32: 🚩 the clinical-edit gate — the WARNING shape ----------
  scenario.clinicalEdit = 'warning'
  const submitsBefore = calls.submit.length
  await submitButton().click()
  await page.waitForTimeout(700)
  const gatePanel = () => page.getByRole('group', { name: /clinical-edit check/i })
  check(
    '🚩 the check runs BEFORE the request goes — and it is asked with the diagnoses, not the basket',
    calls.clinicalEdit.length === 1 &&
      Array.isArray(calls.clinicalEdit[0].diagnoses) &&
      calls.clinicalEdit[0].diagnoses.length === 2 &&
      calls.clinicalEdit[0].patientGender === 'male' &&
      !('lines' in calls.clinicalEdit[0]) &&
      !('attachments' in calls.clinicalEdit[0]),
    JSON.stringify(calls.clinicalEdit[0]),
  )
  check('the warning shape lists what it found', /does not fall within the allowed code range/.test(await text()))
  check(
    '🚩 and it offers BOTH acts — Back to the form, and Submit anyway',
    (await gatePanel().getByRole('button', { name: /Back to the form/ }).count()) === 1 &&
      (await gatePanel().getByRole('button', { name: /Submit anyway/ }).count()) === 1,
  )
  check(
    '🚩 nothing has been submitted yet — the gate is a gate, not a notification',
    calls.submit.length === submitsBefore,
  )
  check('the gate is INLINE — still no modal anywhere in this flow', (await page.locator('dialog').count()) === 0)
  await gatePanel().getByRole('button', { name: /Back to the form/ }).click()
  await page.waitForTimeout(300)
  check(
    'Back to the form dismisses it and sends nothing',
    (await gatePanel().count()) === 0 && calls.submit.length === submitsBefore,
  )

  // ---- Scenario 33: 🚩 the FATAL shape — the same surface, one button less --
  scenario.clinicalEdit = 'fatal'
  await submitButton().click()
  await page.waitForTimeout(700)
  check(
    'the fatal shape lists what it found, exactly as the warning does',
    /is not accepted as a Principal diagnosis/.test(await text()) &&
      /subject to rare disease restrictions/.test(await text()),
  )
  check(
    '🚩 ONE F among warnings makes the whole gate fatal — and every finding is still listed',
    (await gatePanel().locator('li').count()) === 2,
    `${await gatePanel().locator('li').count()} findings`,
  )
  check(
    '🚩 THE CONFIRM BUTTON IS REMOVED — a fatal restriction is not overridable, and is not merely disabled',
    (await gatePanel().getByRole('button', { name: /Submit anyway/ }).count()) === 0 &&
      (await gatePanel().getByRole('button', { name: /Back to the form/ }).count()) === 1,
  )
  check(
    'and nothing reached the exchange',
    calls.submit.length === submitsBefore,
  )
  await gatePanel().getByRole('button', { name: /Back to the form/ }).click()
  await page.waitForTimeout(300)

  // ---- Scenario 34: 🚩 a REFUSED submit keeps the agent ON THE FORM --------
  scenario.clinicalEdit = 'clear'
  scenario.submit = 'refusedLines'
  await submitButton().click()
  await page.waitForTimeout(1200)
  check(
    'a clear check falls straight through to the submission — the ordinary case costs no click',
    calls.submit.length === submitsBefore + 1,
    JSON.stringify(Object.keys(calls.submit[calls.submit.length - 1] || {})),
  )
  const submitted = calls.submit[calls.submit.length - 1] || {}
  check(
    '🚩 the submit body carries the transaction, a requestId and the ATTACHMENTS — no lines, no amounts (law 2)',
    typeof submitted.transactionId === 'string' &&
      typeof submitted.requestId === 'string' &&
      Array.isArray(submitted.attachments) &&
      submitted.attachments.length === 1 &&
      !('lines' in submitted) &&
      !('items' in submitted) &&
      !('total' in submitted),
    JSON.stringify(Object.keys(submitted)),
  )
  check(
    'and the attachment rides as §3.5 defines it — sequence, title, contentType, base64',
    submitted.attachments[0].sequence === 1 &&
      submitted.attachments[0].title === 'Prescription' &&
      submitted.attachments[0].contentType === 'image/jpeg' &&
      typeof submitted.attachments[0].attachment === 'string' &&
      !submitted.attachments[0].attachment.startsWith('data:'),
    JSON.stringify({ ...submitted.attachments[0], attachment: '…' }),
  )
  check(
    '🚩 THE AGENT STAYS ON THE FORM — a Failed is a form state, not an error page',
    (await page.getByRole('heading', { name: /New authorization/ }).count()) === 1 &&
      (await rows().count()) === 4 &&
      /refused before the payer saw it/.test(await text()),
  )
  check(
    '🚩 and each reason is on the ROW that caused it',
    /Quantity 2 exceeds the plan maximum/.test(await rows().nth(0).innerText()) &&
      /not covered under the member/.test(await rows().nth(2).innerText()) &&
      !/exceeds the plan maximum/.test(await rows().nth(1).innerText()),
    (await rows().nth(0).innerText()).replace(/\n/g, ' | '),
  )
  check(
    'Submit is still there — the refusal is fixable HERE and sending again is the point',
    (await submitButton().count()) === 1 && !(await submitButton().isDisabled()),
  )

  // ---- Scenario 35: 🚩 the HEADER-ONLY refusal ----------------------------
  scenario.submit = 'refusedHeader'
  await submitButton().click()
  await page.waitForTimeout(1200)
  check(
    '🚩 a request that failed BEFORE any line was built still explains itself',
    /Provider P001 is not configured at the exchange\./.test(await text()) &&
      /Item 100009 has no Nphies category\./.test(await text()),
  )
  check(
    'and no row is annotated, because no row caused it',
    !/is not configured/.test(await linesTable().innerText()),
  )

  // ---- Scenario 36: a guardrail refusal is NOT a transport failure --------
  // §6 kind 2, and the third leg of the taxonomy: the upstream holds a lock on
  // `Auth_{ClaimType}{PatientId}`, so a second submission for the same patient
  // collides BEFORE the exchange. The request never went, so the agent may fix
  // and send again — the exact opposite of the timeout's rule below.
  scenario.submit = 'duplicate'
  await submitButton().click()
  await page.waitForTimeout(1200)
  check(
    '🚩 a business refusal explains itself IN THE SERVICE’S WORDS, and is not reported as in flight',
    /A submission for this patient is already being processed/.test(await text()) &&
      !/still in flight/.test(await text()),
    ((await text()).match(/The request was not sent[\s\S]{0,120}/) || [''])[0].replace(/\n/g, ' | '),
  )
  check(
    'and Submit stays available — nothing reached the payer, so sending again is legitimate',
    (await submitButton().count()) === 1 && !(await submitButton().isDisabled()),
  )

  // ---- Scenario 37: 🚩 A TIMEOUT IS IN FLIGHT, NEVER FAILED ---------------
  scenario.submit = 'transportFail'
  const submitsBeforeTimeout = calls.submit.length
  await submitButton().click()
  await page.waitForTimeout(1400)
  check(
    '🚩 a dead wire on the submit leg reads as IN FLIGHT — never as a failure',
    /still in flight/.test(await text()) && !/could not/i.test(await text()),
    ((await text()).match(/.*still in flight.*/) || [''])[0],
  )
  check(
    '🚩 it says NOT to raise it again, in words',
    /Do not raise this authorization again/.test(await text()),
  )
  check(
    '🚩 THE OFFERED ACT IS A STATUS CHECK, and Submit is GONE — not disabled, gone',
    (await page.getByRole('link', { name: /Open the authorizations list/ }).count()) === 1 &&
      (await submitButton().count()) === 0,
  )
  check(
    'and it names the patient in words rather than promising a filter the list does not apply',
    /most recent request for patient 0000000003/.test(await text()),
    ((await text()).match(/It will be the most recent[^\n]*/) || [''])[0],
  )
  check(
    'and no second submission was sent, by any path',
    calls.submit.length === submitsBeforeTimeout + 1,
  )
  check(
    'the whole form is frozen behind it — no verb may change a request that may be at the payer',
    (await itemBox().isDisabled()) && (await qtyOf(0).isDisabled()),
  )

  // 🚩 THE ONE THAT WOULD HAVE COST A REQUEST: following the offered act must not
  // raise a leave warning, and must ABANDON NOTHING. A transaction that may
  // already be with the exchange is the one thing this form must never void.
  const abandonsBeforeInFlightExit = calls.abandon.length
  await page.getByRole('link', { name: /Open the authorizations list/ }).click()
  await page.waitForTimeout(900)
  check(
    '🚩 leaving an IN-FLIGHT request neither warns nor ABANDONS — it may already be at the payer',
    calls.abandon.length === abandonsBeforeInFlightExit &&
      !/Leaving discards this request/.test(await text()) &&
      page.url().endsWith('/nphies/authorizations'),
    page.url().replace(BASE, ''),
  )

  // ---- Scenario 38: an ACCEPTED submit lands on the authorization ----------
  // A fresh session, because the in-flight lock is permanent by design.
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  await itemBox().fill('100001')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  await dxSearch().fill('J45')
  await page.waitForTimeout(600)
  await dxMatch().selectOption('J45.9')
  await addDiagnosis().click()
  await page.waitForTimeout(500)
  await fileInput().setInputFiles({
    name: 'prescription.jpg',
    mimeType: 'image/jpeg',
    buffer: photoBytes,
  })
  await page.waitForTimeout(1200)
  check(
    'a fresh request is not carrying the last one’s refusal',
    !/refused before the payer saw it/.test(await text()) && !/still in flight/.test(await text()),
  )
  scenario.submit = 'accepted'
  const abandonsBeforeLodging = calls.abandon.length
  await submitButton().click()
  await page.waitForTimeout(1800)
  check(
    '🚩 an accepted submit LODGES — the transaction is closed by the state it answered with',
    calls.submit.length > 0 && /PA-2026-77/.test(await text()),
    ((await text()).match(/PA-2026-77[^\n]*/) || [''])[0],
  )
  check(
    '🚩 and THE AGENT LANDS ON THE AUTHORIZATION IT CREATED — not on a form with a link on it',
    page.url().endsWith('/nphies/authorizations/AUTH-77'),
    page.url().replace(BASE, ''),
  )
  check(
    'the detail is what is on screen — the form is behind them',
    (await page.getByRole('heading', { name: /^Authorization$/ }).count()) === 1 &&
      (await submitButton().count()) === 0,
  )
  check(
    '🚩 and landing on it abandoned NOTHING — a lodged request is not litter to sweep',
    calls.abandon.length === abandonsBeforeLodging,
    `${calls.abandon.length} abandons in the whole drive`,
  )

  // =========================================================================
  // Ticket 221 — a refused request REOPENS, REPLAYS, and REPORTS what did not
  // come back. The whole value of the feature is the third of those: a silent
  // restore would be worse than no reopen at all, because the agent would press
  // Submit believing they were resending the same request.
  // =========================================================================

  // ---- Scenario 39: the affordance is on the refused row, and only there ----
  await page.goto(`${BASE}/nphies/authorizations`)
  await page.getByRole('button', { name: /Open the refusal/ }).first().waitFor({ timeout: 20000 })
  const reopenButton = page.getByRole('button', { name: /Open the refusal/ }).first()
  check(
    '🚩 a FAILED row offers Open the refusal — live, not withheld with a reason',
    (await reopenButton.getAttribute('aria-disabled')) !== 'true',
    String(await reopenButton.getAttribute('aria-disabled')),
  )
  check(
    'and the row it sits on is only visible because the list asks for refused rows (§3.3)',
    /Failed/.test(await main().innerText()),
  )

  const opensBeforeReopen = calls.open.length
  await reopenButton.click()
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  check(
    '🚩 it reaches the EXISTING form route with the source authorization named in the URL',
    page.url().includes(`copyOf=${FAILED_AUTH_ID}`) &&
      !page.url().includes('from=') &&
      !page.url().includes('coverage='),
    page.url().replace(BASE, ''),
  )

  // ---- Scenario 40: 🚩 a REPLAY, not a restore -----------------------------
  await page.waitForTimeout(2500)
  check(
    'the prefill source is the write-ahead journal row, read once by authorization id',
    calls.journal.length === 1 && calls.journal[0] === FAILED_AUTH_ID,
    JSON.stringify(calls.journal),
  )
  check(
    '🚩 A FRESH SESSION IS OPENED — nothing resumes the terminal transaction (law 9)',
    calls.open.length === opensBeforeReopen + 1,
    `${calls.open.length - opensBeforeReopen} opens`,
  )
  const reopenOpen = calls.open[calls.open.length - 1] || {}
  check(
    '🚩 and it opens on the JOURNALs two ids, not on anything the URL carried',
    reopenOpen.eligibilityId === ELIGIBILITY_ID && reopenOpen.memberId === MEMBER_ID,
    JSON.stringify(reopenOpen),
  )
  check(
    '🚩 NO NEW SESSION VERB — every path the reopen asked for is one §1.2 already had',
    calls.sessionPaths.every((p) => SESSION_VERB_PATHS.includes(p)),
    [...new Set(calls.sessionPaths.filter((p) => !SESSION_VERB_PATHS.includes(p)))].join(' | '),
  )
  const replayedInsurance = calls.setInsurance[calls.setInsurance.length - 1] || {}
  check(
    '🚩 the agents corrected deductible terms come back — including paid-outside (§4)',
    replayedInsurance.g1 &&
      replayedInsurance.g1.rate === 25 &&
      replayedInsurance.g1.max === 400 &&
      replayedInsurance.g1.paid === 50,
    JSON.stringify(replayedInsurance.g1 || {}),
  )
  const replayedHeader = calls.setHeader[calls.setHeader.length - 1] || {}
  check(
    '🚩 and the diagnoses, decoded from the `type|code` string they round-trip in (§3.4)',
    Array.isArray(replayedHeader.diagnoses) &&
      replayedHeader.diagnoses.length === 1 &&
      replayedHeader.diagnoses[0].code === 'J45.9' &&
      replayedHeader.diagnoses[0].type === 'principal',
    JSON.stringify(replayedHeader.diagnoses || []),
  )
  check(
    'every journalled line is asked for again — including the one that will be refused',
    calls.addItem.slice(-3).map((a) => a.itemNumber).join(',') === '100001,100002,100009',
    JSON.stringify(calls.addItem.slice(-3).map((a) => a.itemNumber)),
  )
  check(
    'the per-line cap the response DTO cannot carry is re-applied from the journal',
    (calls.updateLineInsurance[calls.updateLineInsurance.length - 1] || {}).maxPayerShare === 15,
    JSON.stringify(calls.updateLineInsurance[calls.updateLineInsurance.length - 1] || {}),
  )
  const replayedMeta = calls.updateLineMeta[calls.updateLineMeta.length - 1] || {}
  check(
    'and so are the days supply and the selection reason',
    replayedMeta.daysSupply === 60 && replayedMeta.selectionReason === 'patient-request',
    JSON.stringify(replayedMeta),
  )
  check(
    'the request that came back holds the two items that survived',
    (await rows().count()) === 2,
    `${await rows().count()} rows`,
  )

  // ---- Scenario 41: 🚩 IT DOES NOT PRETEND TO BE SILENT --------------------
  const report = await text()
  check(
    '🚩 the screen SAYS this is not the request that was refused',
    /did not come back the way/.test(report) &&
      /not identical to the one that was refused/.test(report),
    (report.match(/\d+ things? did not come back[^\n]*/) || [''])[0],
  )
  check(
    '🚩 the item the door REFUSED is named, in the servers own words (§6 kind 2)',
    /Item 100009 was refused when it was added back/.test(report) &&
      /No item with that number exists/.test(report),
    (report.match(/Item 100009[^\n]*/) || [''])[0],
  )
  check(
    '🚩 the item that REPRICED is named, with BOTH figures',
    /Item 100002 priced at 12\.50 now and was submitted at 20\.00/.test(report),
    (report.match(/Item 100002[^\n]*/) || [''])[0],
  )
  check(
    '🚩 and the attachments are reported as NOT carried across — Submit is refused without one',
    /attachments were not carried across/.test(report),
  )
  check(
    'the line that came back exactly as it went out is not reported at all',
    !/Item 100001/.test(report),
  )
  check('🚩 the report is INLINE — still no modal anywhere in this flow', (await page.locator('dialog').count()) === 0)

  // ---- Scenario 42: 🚩 a HEADER-ONLY refusal still prefills ----------------
  // The service's own guards throw BEFORE the lines are built, so the ordinary
  // response-by-id has nothing to prefill from. The journal was committed before
  // the payer was called, so it still has everything but the lines.
  scenario.journal = 'headerOnly'
  const addsBeforeHeaderOnly = calls.addItem.length
  await page.goto(`${BASE}/nphies/authorizations/new?copyOf=${FAILED_AUTH_ID}`)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(2000)
  const headerOnly = await text()
  check(
    '🚩 a refusal that recorded NO LINES still opens a request, and says why it is empty',
    /no lines recorded/.test(headerOnly) && (await rows().count()) === 0,
    (headerOnly.match(/The refused request had no lines[^\n]*/) || [''])[0],
  )
  check(
    'and nothing was scanned, because there was nothing to scan',
    calls.addItem.length === addsBeforeHeaderOnly,
  )
  check(
    '🚩 but the terms, the policy and the diagnoses DID come across',
    (await term('Group 1', 'rate').inputValue()) === '25' &&
      (await term('Group 1', 'paid outside').inputValue()) === '50' &&
      /J45\.9/.test(headerOnly) &&
      new RegExp(MEMBER_ID).test(headerOnly),
    (await term('Group 1', 'rate').inputValue()) + ' / ' + (await term('Group 1', 'paid outside').inputValue()),
  )

  // ---- Scenario 43: a journal that cannot be read says so ------------------
  scenario.journal = 'missing'
  const opensBeforeMissing = calls.open.length
  await page.goto(`${BASE}/nphies/authorizations/new?copyOf=${FAILED_AUTH_ID}`)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  await page.waitForTimeout(400)
  const unreadable = await text()
  check(
    '🚩 a journal that cannot be read is a refusal in words, and NO transaction is opened',
    /cannot be reopened/.test(unreadable) &&
      /No submission was recorded/.test(unreadable) &&
      calls.open.length === opensBeforeMissing,
    (unreadable.match(/No submission was recorded[^\n]*/) || [''])[0],
  )
  check(
    'and it does not also claim the link was half-addressed — that would be a second, wrong story',
    !/not opened from an eligibility check/.test(unreadable),
  )
  scenario.journal = 'full'

  // ---- Scenario 44: 🚩 the replayed request CAN BE CORRECTED AND SUBMITTED --
  await page.goto(`${BASE}/nphies/authorizations/new?copyOf=${FAILED_AUTH_ID}`)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(2500)
  // The one thing the replay deliberately did not carry across.
  await fileInput().setInputFiles({
    name: 'prescription.jpg',
    mimeType: 'image/jpeg',
    buffer: photoBytes,
  })
  await page.waitForTimeout(1200)
  check(
    'the form is live again once the replay has finished — the agent may correct it',
    !(await itemBox().isDisabled()) && (await submitButton().count()) === 1,
  )
  scenario.submit = 'accepted'
  scenario.clinicalEdit = 'clear'
  const submitsBeforeReplaySubmit = calls.submit.length
  await submitButton().click()
  await page.waitForTimeout(2000)
  check(
    '🚩 and the REPLAYED request submits — a reopen ends in a new authorization, not a dead end',
    calls.submit.length === submitsBeforeReplaySubmit + 1 &&
      page.url().endsWith('/nphies/authorizations/AUTH-77'),
    page.url().replace(BASE, ''),
  )
  check(
    '🚩 the payer is answering a NEW authorization — the refused one was never touched',
    !calls.sessionPaths.some((p) => p.includes(FAILED_AUTH_ID)) &&
      JSON.stringify(calls.submit[calls.submit.length - 1] || {}).indexOf(FAILED_AUTH_ID) === -1,
  )

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
