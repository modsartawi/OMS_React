/**
 * The two pure Proof bullets of ticket 216, at the seam that owns them.
 *
 * Both are about the same thing from two directions: **the detail must never
 * publish a payer's word the payer did not say.** One trap is a single field that
 * carries two different kinds of news depending on branch; the other is a header
 * verdict that hides which lines were actually refused underneath it.
 */
import { describe, expect, it } from 'vitest'
import type { AuthDetail, AuthDetailLine, AuthSupportingInfo } from '@/core/models/nphies'
import {
  failureMessage,
  projectAuthLines,
  refusedLines,
  submittedAttachments,
} from './detail-view'

const LINE = (over: Partial<AuthDetailLine> = {}): AuthDetailLine => ({
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
  serviceDate: '2026-08-01',
  daysSupply: 30,
  selectionReason: '',
  deductibleG: 9.5,
  deductibleGroupName: 'Generic',
  diagnosis: 'C50.9',
  ...over,
})

/** A `Complete` detail. The five axis fields are the same ones a list row
 *  carries, which is the whole reason `deriveAuthAxes` reads both. */
const DETAIL = (over: Partial<AuthDetail> = {}): AuthDetail => ({
  contractVersion: '1.0',
  // §4's nine header money fields. Nothing in 216 renders one — they are here
  // because 221's fallback prefill reads them off this same response.
  deductibleG1: 0,
  deductibleG1Max: 0,
  deductibleG1Paid: 0,
  deductibleG2: 0,
  deductibleG2Max: 0,
  deductibleG2Paid: 0,
  deductibleG3: 0,
  deductibleG3Max: 0,
  deductibleG3Paid: 0,
  id: 'AUTH-1',
  eligibilityId: 'ELG-1',
  memberId: 'M-1',
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '0000000003',
  patientIdType: 'NI',
  patientName: 'Ahmad Ali',
  patientGender: 'male',
  patientBirthDate: '1988-04-02',
  preAuthRef: 'PA-1001',
  claimProcessingCodes: 'Complete',
  queued: false,
  error: false,
  cancelled: false,
  adjudicationOutcome: 'approved',
  needComm: false,
  actionDateTime: '2026-08-01T09:15:00',
  responseDateTime: '2026-08-01T09:15:40',
  serviceDate: '2026-08-01',
  errorMessageShort: '',
  disposition: '',
  processNote: '',
  statusCode: 200,
  claimType: 0,
  diagnosis: 'C50.9',
  policyNumber: 'POL-77',
  policyHolder: 'ACME',
  prescriptionRef: 'RX-1',
  exceptionPrescription: false,
  authLines: [LINE()],
  authSupportingInfos: [],
  ...over,
})

// ---------------------------------------------------------------------------

describe('theDualMeaningFieldIsReadInOneBranchOnly', () => {
  // 🚩 §5's trap. `ErrorMessageShort` carries a transport error *or* the decoded
  // adjudication display, depending on which branch of `ProcessAuthResponse`
  // filled it (`:53-65` from transport codings; only if that left it empty does
  // `:120` fill it from `GetAdjudicationOutcomeDisplay`). The Request state picks
  // both the label and the source, so the ambiguity never reaches the screen.
  const MESSAGE = 'BV-00123: invalid member id'

  it('renders it on a FAILED request — the payer was never reached', () => {
    expect(
      failureMessage(
        DETAIL({ error: true, claimProcessingCodes: 'Error', errorMessageShort: MESSAGE }),
      ),
    ).toBe(MESSAGE)
  })

  it('renders it on a PENDING request too — §5 puts both under the failure label', () => {
    expect(
      failureMessage(
        DETAIL({ queued: true, claimProcessingCodes: 'Queued', errorMessageShort: MESSAGE }),
      ),
    ).toBe(MESSAGE)
  })

  it('🚩 does NOT render it on a COMPLETE request, whatever it contains', () => {
    // The field is very likely to hold the *adjudication display* here — words
    // that read like the payer's. Rendering them under any label would state a
    // payer verdict twice, once from a field that sometimes means a transport
    // failure. The payer's words come from the disposition, the process note and
    // the per-line reasons, which are unambiguous.
    expect(failureMessage(DETAIL({ errorMessageShort: 'Approved' }))).toBeNull()
    expect(failureMessage(DETAIL({ errorMessageShort: MESSAGE }))).toBeNull()
  })

  it('🚩 does not render it on a CANCELLED request either — that is not a failure', () => {
    // A cancel happens AFTER an answer, so a cancelled authorization still stores
    // `Complete` + an outcome. `showsFailureMessage` admits only `failed` and
    // `pending`, and this asserts the fourth state does not slip through.
    expect(
      failureMessage(DETAIL({ cancelled: true, errorMessageShort: 'Approved by the payer.' })),
    ).toBeNull()
  })

  it('an empty field is nothing to render, not an empty label', () => {
    expect(failureMessage(DETAIL({ error: true, errorMessageShort: '   ' }))).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('aPartialApprovalShowsWhichLinesWereRefused', () => {
  // The case the brief forgets: the HEADER says approved and individual lines
  // were refused. Because the columns are always populated there is no separate
  // rejection view to build — the ordinary detail is it.
  const PARTIAL = DETAIL({
    adjudicationOutcome: 'partial',
    authLines: [
      LINE({ id: 'L1', sequence: 1, adjudicationOutcome: 'approved' }),
      LINE({
        id: 'L2',
        sequence: 2,
        itemNumber: '100002',
        itemDescription: 'AMOXICILLIN 500MG CAP',
        adjudicationOutcome: 'rejected',
        approvedQuantity: 0,
        rejected: 47.5,
        benefit: 0,
        benefitReason: 'Service not covered under the member benefit plan',
      }),
    ],
  })

  it('states both facts: an approved header and the line that was refused', () => {
    const lines = projectAuthLines(PARTIAL)
    expect(lines.map((l) => l.verdict)).toEqual(['approved', 'rejected'])
    expect(refusedLines(lines).map((l) => l.itemNumber)).toEqual(['100002'])
  })

  it('🚩 carries the payer’s reason IN WORDS on the refused line', () => {
    // Already decoded server-side against the NPHIES `AdjudicationReason` code
    // system. No client lookup table exists and none may be added — a raw code
    // arriving here is a server-side mapping gap.
    const refused = refusedLines(projectAuthLines(PARTIAL))[0]
    expect(refused.benefitReason).toBe('Service not covered under the member benefit plan')
    expect(refused.approvedQuantity).toBe(0)
    expect(refused.rejected).toBe(47.5)
  })

  it('a fully approved authorization has no refused lines at all', () => {
    expect(refusedLines(projectAuthLines(DETAIL()))).toEqual([])
  })

  it('a line whose outcome says approved but whose rejected amount is not zero still counts as refused', () => {
    // Partly refused money with an `approved` line outcome is a shape the service
    // can produce, and the agent reading a rejected amount needs it flagged. The
    // *outcome* is reported as it arrived; only the "look at this line" flag is
    // widened.
    const lines = projectAuthLines(
      DETAIL({ authLines: [LINE({ rejected: 12.25, benefitReason: 'Quantity reduced' })] }),
    )
    expect(lines[0].verdict).toBe('approved')
    expect(refusedLines(lines)).toHaveLength(1)
  })

  it('🚩 blanks every line verdict when the request never reached the payer', () => {
    // The same blank-until-Complete rule as the header, applied one altitude
    // down. A `Failed` header whose lines still carry `approved` would otherwise
    // publish a payer verdict for a request the payer never saw — and the lines
    // DO carry it, because `ProcessAuthResponse` writes header and lines from the
    // same response.
    const lines = projectAuthLines(
      DETAIL({ error: true, claimProcessingCodes: 'Error', adjudicationOutcome: 'approved' }),
    )
    expect(lines[0].verdict).toBeNull()
    // …and a blank verdict is not a refusal either. Nothing is claimed.
    expect(refusedLines(lines)).toEqual([])
  })

  it('an unknown outcome code reads blank rather than being coerced to a nearby value', () => {
    const lines = projectAuthLines(DETAIL({ authLines: [LINE({ adjudicationOutcome: 'maybe' })] }))
    expect(lines[0].verdict).toBeNull()
  })

  it('keeps the server’s line order and never re-sorts it', () => {
    const lines = projectAuthLines(
      DETAIL({
        authLines: [LINE({ id: 'L1', sequence: 3 }), LINE({ id: 'L2', sequence: 1 })],
      }),
    )
    expect(lines.map((l) => l.id)).toEqual(['L1', 'L2'])
  })

  it('an authorization with no lines projects none rather than throwing', () => {
    // The header-only refusal (§3.9): the service's own guards throw before the
    // lines are built, so a `Failed` detail really can arrive with none.
    expect(projectAuthLines(DETAIL({ authLines: undefined as never }))).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('submittedAttachments', () => {
  const INFO = (over: Partial<AuthSupportingInfo> = {}): AuthSupportingInfo => ({
    id: 'S1',
    sequence: 1,
    category: 'attachment',
    code: '',
    attachment: 'QUJD',
    valueString: '',
    valueBoolean: null,
    valueDecimal: null,
    attachmentType: 'image',
    attachmentTitle: 'Prescription',
    display: '',
    ...over,
  })

  it('keeps only the supporting infos that actually carry base64', () => {
    // The collection is not "the attachments" — `days-supply` rides in it too.
    const kept = submittedAttachments([
      INFO(),
      INFO({ id: 'S2', category: 'days-supply', attachment: '', valueDecimal: 30 }),
      INFO({ id: 'S3', category: 'reason-for-visit', attachment: '', code: 'new' }),
    ])
    expect(kept.map((a) => a.id)).toEqual(['S1'])
  })

  it('🚩 renders an image as the service’s own content type, not as the flag it stores', () => {
    // `attachmentType` is a two-valued flag (`image` | `pdf`), NOT a MIME type —
    // `Extensions.cs:725` is where the service maps it, and this mirrors that map
    // exactly rather than inventing one.
    const [image] = submittedAttachments([INFO({ attachmentType: 'image' })])
    expect(image.contentType).toBe('image/jpeg')
    expect(image.isImage).toBe(true)
    expect(image.dataUrl).toBe('data:image/jpeg;base64,QUJD')
  })

  it('renders anything else as a PDF, which is the only other thing the service stores', () => {
    const [pdf] = submittedAttachments([INFO({ attachmentType: 'pdf' })])
    expect(pdf.contentType).toBe('application/pdf')
    expect(pdf.isImage).toBe(false)
  })

  it('passes a real MIME through verbatim, for the day §3.5’s `contentType` reaches this field', () => {
    const [png] = submittedAttachments([INFO({ attachmentType: 'image/png' })])
    expect(png.contentType).toBe('image/png')
    expect(png.isImage).toBe(true)
  })

  it('keeps duplicates — two prescriptions are two prescriptions (§3.5)', () => {
    const kept = submittedAttachments([INFO(), INFO({ id: 'S2', sequence: 2 })])
    expect(kept).toHaveLength(2)
  })

  it('a detail with no supporting infos answers none rather than throwing', () => {
    expect(submittedAttachments(undefined)).toEqual([])
  })
})
