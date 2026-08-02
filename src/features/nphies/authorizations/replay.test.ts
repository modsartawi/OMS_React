/**
 * The three pure Proof bullets of ticket 221, at the seam that owns them.
 *
 * A reopen is the one act on this screen that can hand an agent a request that
 * *looks* like the one they meant to resend and is not. All three assertions
 * below are about that: what did not come back is named, the worst refusal still
 * prefills, and the replay is a genuinely new request.
 */
import { describe, expect, it } from 'vitest'
import type {
  AuthDetail,
  AuthRequestJournal,
  NphiesAuthSessionLine,
} from '@/core/models/nphies'
import {
  SESSION_VERBS,
  decodeDiagnoses,
  replayPlan,
  replayPlanFromDetail,
  replayReport,
  replayVerbs,
  type ReplayOutcome,
} from './replay'

/** One journalled line — `AuthItemRequest` as the service defines it (§4). */
const ITEM = (over: Partial<AuthRequestJournal['items'][number]> = {}) => ({
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
  serviceDate: '2026-08-02',
  diagnosis: 'principal|J45.9',
  ...over,
})

/** The write-ahead journal row — §3.9's source, whole. */
const JOURNAL = (over: Partial<AuthRequestJournal> = {}): AuthRequestJournal => ({
  eligibilityId: 'ELG-1',
  memberId: 'MEM-4477',
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '0000000003',
  patientIdType: 'NI',
  patientName: 'Ahmad Ali',
  patientGender: 'male',
  patientBirthDate: '1988-04-02',
  serviceDate: '2026-08-02',
  prescriptionRef: '',
  diagnosis: 'principal|J45.9',
  exceptionPrescription: false,
  reasonForVisit: '',
  policyNumber: 'POL-77',
  policyHolder: 'ACME INSURANCE',
  claimType: 0,
  deductibleG1: 20,
  deductibleG1Max: 500,
  deductibleG1Paid: 0,
  deductibleG2: 30,
  deductibleG2Max: 500,
  deductibleG2Paid: 200,
  deductibleG3: 100,
  deductibleG3Max: 0,
  deductibleG3Paid: 0,
  items: [ITEM()],
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
  ...over,
})

/** One line as the fresh session came back with it. */
const LINE = (over: Partial<NphiesAuthSessionLine> = {}): NphiesAuthSessionLine => ({
  lineId: 'L1',
  sequence: 1,
  voided: false,
  itemNumber: '100001',
  itemDescription: 'PANADOL 500MG TAB',
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
  selectionReasonEditable: false,
  pricing: 'settled',
  ...over,
})

const OUTCOME = (over: Partial<ReplayOutcome> = {}): ReplayOutcome => ({
  sequence: 1,
  itemNumber: '100001',
  addRefusal: null,
  capRefusal: null,
  metaRefusal: null,
  ...over,
})

const kinds = (findings: { kind: string }[]) => findings.map((f) => f.kind)

describe('everyLineThatDidNotComeBackIsReported', () => {
  /**
   * Three lines went out; a blocked one, a repriced one and one that simply never
   * appeared come back. Not one of them may be silently dropped — an agent who
   * resubmits believing they resent the same request is the whole failure mode
   * this ticket exists to prevent (story 84).
   */
  const plan = replayPlan(
    'AUTH-78',
    JOURNAL({
      items: [
        ITEM({ sequence: 1, itemNumber: '100001' }),
        ITEM({ sequence: 2, itemNumber: '100002', unitPrice: 12.5, extendedPrice: 25 }),
        ITEM({ sequence: 3, itemNumber: '100003', unitPrice: 31, extendedPrice: 62 }),
      ],
    }),
  )
  const outcomes = [
    // 🚩 The blocked one: the door refused the scan, in the service's own words.
    OUTCOME({ sequence: 1, itemNumber: '100001', addRefusal: 'Item 100001 has no Nphies category.' }),
    OUTCOME({ sequence: 2, itemNumber: '100002' }),
    OUTCOME({ sequence: 3, itemNumber: '100003' }),
  ]
  // The repriced one landed at a new extended price; the third never appeared.
  const lines = [
    LINE({ lineId: 'L1', itemNumber: '100002', unitPrice: 15, extendedPrice: 30 }),
  ]
  const report = replayReport(plan, lines, outcomes)

  it('🚩 names the item the door REFUSED, with the servers own sentence', () => {
    const refused = report.find((f) => f.kind === 'refused')
    expect(refused?.itemNumber).toBe('100001')
    // §6 kind 2: a guardrail refusal is a business outcome carrying human words,
    // and those words are the whole of what tells the agent what changed.
    expect(refused?.message).toBe('Item 100001 has no Nphies category.')
  })

  it('🚩 names the item that REPRICED, stating both figures', () => {
    const repriced = report.find((f) => f.kind === 'repriced')
    expect(repriced?.itemNumber).toBe('100002')
    expect(repriced?.was).toBe('25.00')
    expect(repriced?.now).toBe('30.00')
  })

  it('🚩 names the item that simply did not come back', () => {
    const missing = report.find((f) => f.kind === 'missing')
    expect(missing?.itemNumber).toBe('100003')
  })

  it('🚩 reports every one of the three — a silent drop is the defect', () => {
    // The assertion that fails if any single case is quietly swallowed: all three
    // items are accounted for, by item number, in the order they were submitted.
    expect(report.filter((f) => f.itemNumber !== null).map((f) => f.itemNumber)).toEqual([
      '100001',
      '100002',
      '100003',
    ])
  })

  it('says nothing about a line that came back exactly as it went out', () => {
    const clean = replayPlan('AUTH-78', JOURNAL({ supportingInfos: [] }))
    expect(replayReport(clean, [LINE()], [OUTCOME()])).toEqual([])
  })

  it('reports an item that LOST its Nphies category rather than reading it as unchanged', () => {
    const clean = replayPlan('AUTH-78', JOURNAL({ supportingInfos: [] }))
    const report2 = replayReport(clean, [LINE({ deductibleGroupName: '' })], [OUTCOME()])
    expect(kinds(report2)).toContain('recategorised')
    expect(report2[0].was).toBe('Generic')
    expect(report2[0].now).toBe('')
  })

  it('🚩 refuses to call an UNPRICED line unchanged', () => {
    // A line still being priced says nothing about its money either way, and
    // reading that silence as "the same" is a silent restore by another route.
    const clean = replayPlan('AUTH-78', JOURNAL({ supportingInfos: [] }))
    const report2 = replayReport(clean, [LINE({ pricing: 'pending' })], [OUTCOME()])
    expect(kinds(report2)).toEqual(['notPricedYet'])
  })

  it('🚩 says the attachments did not come across — Submit is refused without one', () => {
    // They ride inside the journal row, but the row records `image` | `pdf` and
    // not a MIME type, so the submit body's `contentType` cannot be rebuilt. The
    // agent re-attaches, and is told to rather than meeting a blocker with no
    // explanation.
    expect(kinds(replayReport(plan, lines, outcomes))).toContain('attachmentsNotReplayed')
  })

  it('🚩 attributes a duplicate refusal to the LINE that caused it, not to its twin', () => {
    // A *refused* request can legitimately hold the same item twice: WPF refused
    // duplicates at submit, so a request that never got that far can carry two —
    // and this contract moves the refusal forward to the scan (§2.3), so the
    // second add is refused. Matching outcomes by item number would pin the
    // refusal on line 1 and report line 2 as a quantity that changed.
    const twins = replayPlan(
      'AUTH-78',
      JOURNAL({
        items: [ITEM({ sequence: 1 }), ITEM({ sequence: 2, quantity: 3 })],
        supportingInfos: [],
      }),
    )
    const report = replayReport(
      twins,
      [LINE()],
      [
        OUTCOME({ sequence: 1 }),
        OUTCOME({ sequence: 2, addRefusal: 'That item is already on this request.' }),
      ],
    )
    expect(report).toHaveLength(1)
    expect(report[0]).toMatchObject({ kind: 'refused', sequence: 2 })
  })

  it('names an override that could not be re-applied', () => {
    const capped = replayPlan(
      'AUTH-78',
      JOURNAL({ items: [ITEM({ maxCoverage: 40 })], supportingInfos: [] }),
    )
    const report2 = replayReport(
      capped,
      [LINE()],
      [OUTCOME({ capRefusal: 'That line is gone.', metaRefusal: 'Days supply must be 1–100.' })],
    )
    expect(kinds(report2)).toEqual(['capNotApplied', 'metaNotApplied'])
    expect(report2[0].was).toBe('40.00')
  })
})

describe('aHeaderOnlyRefusalStillPrefills', () => {
  /**
   * 🚩 The case nothing else can cover. The service's own guards — unknown item,
   * item with no Nphies category, unconfigured provider or payer, an over-long
   * prescription reference — throw **before the lines are built**, so the ordinary
   * response-by-id has nothing to prefill from. The journal was committed before
   * the payer was called, so it still has everything but the lines (story 83).
   */
  const plan = replayPlan('AUTH-79', JOURNAL({ items: [] }))

  it('🚩 still carries the two ids the fresh session opens on', () => {
    expect(plan.eligibilityId).toBe('ELG-1')
    expect(plan.memberId).toBe('MEM-4477')
  })

  it('🚩 still carries the deductible terms, paid-outside and all', () => {
    // The nine header money fields of §4, read back into §2's three groups. They
    // are the agent's own inputs and are precisely what a header-only refusal
    // would otherwise cost them.
    expect(plan.insurance).toEqual({
      g1: { rate: 20, max: 500, paid: 0 },
      g2: { rate: 30, max: 500, paid: 200 },
      g3: { rate: 100, max: 0, paid: 0 },
    })
  })

  it('🚩 still carries the diagnoses, decoded from the string they round-trip in', () => {
    expect(plan.diagnoses).toEqual([
      { code: 'J45.9', type: 'principal', description: '', morphology: '' },
    ])
  })

  it('and SAYS that no lines were recorded rather than showing an empty basket', () => {
    expect(plan.items).toEqual([])
    expect(plan.gaps).toContain('noLinesRecorded')
    expect(kinds(replayReport(plan, [], []))).toContain('noLinesRecorded')
  })

  it('decodes `type|code` the way the service itself parses it', () => {
    // `NphiesDiagnosis.GetDiagnosisList` splits on `,` then `|`, taking column 0
    // as the TYPE and column 1 as the CODE. Reading them the other way round would
    // put a code in the type field and mark nothing principal.
    expect(decodeDiagnoses('principal|C50.9,secondary|E11.9', 'M8140/3')).toEqual([
      { code: 'C50.9', type: 'principal', description: '', morphology: 'M8140/3' },
      { code: 'E11.9', type: 'secondary', description: '', morphology: '' },
    ])
  })

  it('drops a row it cannot read and says it did', () => {
    const plan2 = replayPlan('AUTH-79', JOURNAL({ diagnosis: 'J45.9', supportingInfos: [] }))
    expect(plan2.diagnoses).toEqual([])
    expect(plan2.gaps).toContain('diagnosisUnreadable')
  })

  it('does NOT call a legitimately repeated diagnosis unreadable', () => {
    // The service `.Distinct()`s its own rows, so the same diagnosis twice is one
    // diagnosis — not a row nobody could parse. Inferring the gap by subtracting
    // the decoded count from the row count would mislabel exactly this.
    const plan2 = replayPlan(
      'AUTH-79',
      JOURNAL({ diagnosis: 'principal|J45.9,principal|J45.9', supportingInfos: [] }),
    )
    expect(plan2.diagnoses).toHaveLength(1)
    expect(plan2.gaps).not.toContain('diagnosisUnreadable')
  })

  it('names a reason for visit it cannot carry across', () => {
    // §1.2 has it on `setHeader` and no screen in this wave edits one, so the form
    // has no control that could show it back. Named rather than dropped.
    const plan2 = replayPlan(
      'AUTH-79',
      JOURNAL({ reasonForVisit: 'Follow-up', supportingInfos: [] }),
    )
    expect(plan2.gaps).toContain('reasonForVisitNotReplayed')
  })
})

describe('theResponseByIdIsTheFreeFallback', () => {
  /**
   * 🚩 §3.9: "The response-by-id remains the free fallback for rows the web did
   * not raise." An authorization raised at a till never went through the
   * orchestration that writes the journal, so there is no row — and the detail
   * 216 already reads is what prefills instead, at no new endpoint.
   */
  const DETAIL = (over: Partial<AuthDetail> = {}): AuthDetail => ({
    id: 'AUTH-TILL-1',
    eligibilityId: 'ELG-9',
    memberId: 'MEM-9',
    providerCode: 'P001',
    payerCode: 'PAY-9',
    patientId: '0000000003',
    patientIdType: 'NI',
    patientName: 'Ahmad Ali',
    patientGender: 'male',
    patientBirthDate: '1988-04-02',
    preAuthRef: '',
    claimProcessingCodes: 'Error',
    queued: false,
    error: true,
    cancelled: false,
    adjudicationOutcome: '',
    needComm: false,
    actionDateTime: '2026-07-30T11:02:00',
    responseDateTime: '',
    serviceDate: '2026-07-30',
    errorMessageShort: '',
    disposition: '',
    processNote: '',
    statusCode: 400,
    claimType: 0,
    diagnosis: 'principal|J45.9',
    policyNumber: 'POL-77',
    policyHolder: 'ACME INSURANCE',
    prescriptionRef: '',
    exceptionPrescription: false,
    deductibleG1: 25,
    deductibleG1Max: 400,
    deductibleG1Paid: 50,
    deductibleG2: 30,
    deductibleG2Max: 500,
    deductibleG2Paid: 200,
    deductibleG3: 100,
    deductibleG3Max: 0,
    deductibleG3Paid: 0,
    authLines: [
      {
        id: 'AL1',
        sequence: 1,
        itemNumber: '100001',
        itemDescription: 'PANADOL 500MG TAB',
        quantity: 2,
        unitPrice: 25,
        extendedPrice: 50,
        amount: 50,
        netAmount: 50,
        vat: 7.5,
        discountPercentage: 0,
        discountAmount: 0,
        actualPatientShare: 10,
        adjudicationOutcome: '',
        approvedQuantity: 0,
        rejected: 0,
        eligible: 0,
        copay: 0,
        benefit: 0,
        benefitReason: '',
        serviceDate: '2026-07-30',
        daysSupply: 30,
        selectionReason: '',
        deductibleG: 10,
        deductibleGroupName: 'Generic',
        diagnosis: 'principal|J45.9',
      },
    ],
    authSupportingInfos: [],
    ...over,
  })

  it('prefills the identity, the terms and the lines from the response', () => {
    const plan = replayPlanFromDetail('AUTH-TILL-1', DETAIL())
    expect(plan.source).toBe('response')
    expect(plan.eligibilityId).toBe('ELG-9')
    expect(plan.memberId).toBe('MEM-9')
    expect(plan.insurance.g1).toEqual({ rate: 25, max: 400, paid: 50 })
    expect(plan.items.map((i) => i.itemNumber)).toEqual(['100001'])
  })

  it('🚩 REPORTS the per-line cap the response cannot carry, and invents none', () => {
    // §3.4's known gap: `MaxCoverage` is on `NAuthLine` and absent from
    // `AuthLineDto`. The ticket's instruction is exact — report it if it happens,
    // do not work around it — so the cap is 0, no `updateLineInsurance` is sent,
    // and the agent is told rather than left believing an override survived.
    const plan = replayPlanFromDetail('AUTH-TILL-1', DETAIL())
    expect(plan.items[0].maxCoverage).toBe(0)
    expect(plan.gaps).toContain('capNotRecorded')
    expect(replayVerbs(plan)).not.toContain('updateLineInsurance')
    expect(kinds(replayReport(plan, [], []))).toContain('capNotRecorded')
  })

  it('is the same plan shape, so the replay and the report do not branch on it', () => {
    // One `ReplayPlan`, two sources. A second plan type would mean a second
    // replay path, and the report would have to be written twice.
    expect(replayVerbs(replayPlanFromDetail('AUTH-TILL-1', DETAIL()))[0]).toBe('open')
  })
})

describe('theReplayIsANewRequestNotAResumedOne', () => {
  const plan = replayPlan('AUTH-78', JOURNAL({ items: [ITEM({ maxCoverage: 40 })] }))

  it('🚩 begins with a fresh Open — nothing resumes the terminal transaction', () => {
    // Drafts are not resumable and a refused request is terminal (law 9). The
    // plan's first act is `Open`, which raises a SECOND transaction rather than
    // reaching for the one the exchange refused.
    expect(replayVerbs(plan)[0]).toBe('open')
  })

  it('🚩 uses only verbs that ALREADY EXIST — no new session verb', () => {
    // §1.2's table is eleven verbs and this ticket adds none. A future edit that
    // reached for a `restore` or a `replay` verb would fail here first.
    for (const verb of replayVerbs(plan)) expect(SESSION_VERBS).toContain(verb)
  })

  it('replays through the setters the form already drives, then settles', () => {
    expect(replayVerbs(plan)).toEqual([
      'open',
      'setInsurance',
      'setHeader',
      'addItem',
      'updateLineInsurance',
      'updateLineMeta',
      // The settling read: lines land pending and the engine prices them after,
      // so the report is taken from a state that has finished.
      'state',
    ])
  })

  it('🚩 carries no identifier of the request being replayed except its provenance', () => {
    // A transaction id, a line id or a preauth reference in this plan would be an
    // invitation to write a code path that resumes one. The source authorization
    // is named so the screen can say which refusal is being replayed, and for
    // nothing else.
    const serialized = JSON.stringify(plan)
    expect(plan.sourceAuthId).toBe('AUTH-78')
    expect(serialized).not.toContain('transactionId')
    expect(serialized).not.toContain('lineId')
    expect(serialized).not.toContain('preAuthRef')
  })

  it('🚩 never sends a cap of zero — the engine ignores `<= 0` (§4)', () => {
    const uncapped = replayPlan('AUTH-78', JOURNAL())
    expect(replayVerbs(uncapped)).not.toContain('updateLineInsurance')
  })
})
