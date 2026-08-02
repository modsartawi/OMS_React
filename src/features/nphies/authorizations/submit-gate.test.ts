/**
 * The four pure Proof bullets of ticket 220, at the seam that owns them.
 *
 * Submit is a **gated path, not a button**, and the three things this suite
 * pins are the three that fail silently and expensively:
 *
 * 1. every blocker **names itself**, so the agent reads what is missing instead
 *    of hunting for it;
 * 2. a **fatal** clinical-edit restriction is the same surface as a warning with
 *    one button removed — and no path re-admits the confirm;
 * 3. a **timeout is in flight, never failed**, and the only act offered after
 *    one is a status check. Raising a second authorization for a request that
 *    already reached the payer is the worst outcome this screen can produce.
 *
 * Plus the fourth, which is what makes a refusal fixable at all: each reason
 * lands on the row that caused it, **including** the header-only case where the
 * request failed before a single line was built.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type {
  NphiesAuthSessionLine,
  NphiesAuthSessionState,
  NphiesClinicalEditFinding,
  NphiesSubmitResult,
} from '@/core/models/nphies'
import type { PreparedAttachment } from './attachment-prepare'
import {
  blockerLabel,
  clinicalEditGate,
  clinicalEditRequestFrom,
  nextActs,
  placeRefusals,
  readSubmitFailure,
  readSubmitResult,
  submitBlockers,
  submitIsLocked,
} from './submit-gate'

// ---------------------------------------------------------------------------
// Fixtures — the contract's own shapes, never a convenience subset.

const LINE = (over: Partial<NphiesAuthSessionLine> = {}): NphiesAuthSessionLine => ({
  lineId: 'L1',
  sequence: 1,
  voided: false,
  itemNumber: '100001',
  itemDescription: 'PANADOL 500MG TAB',
  quantity: 1,
  unitPrice: 25,
  extendedPrice: 25,
  amount: 25,
  netAmount: 25,
  vat: 3.75,
  discountPercentage: 0,
  discountAmount: 0,
  actualPatientShare: 5,
  deductibleG: 5,
  deductibleGroupName: 'Generic',
  maxCoverage: 0,
  daysSupply: 30,
  selectionReason: '',
  selectionReasonEditable: false,
  pricing: 'settled',
  ...over,
})

const STATE = (over: Partial<NphiesAuthSessionState> = {}): NphiesAuthSessionState => ({
  contractVersion: '1.0',
  transactionId: '01JC8ABCDEFGHJKMNPQRSTVWXY',
  version: 4,
  etag: 'E4',
  status: 'open',
  plant: '1101',
  reference: {
    eligibilityId: 'ELG-1',
    memberId: 'MEM-4477',
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
  },
  header: {
    serviceDate: '2026-08-02',
    diagnoses: [{ code: 'J45.9', type: 'principal', description: 'Asthma', morphology: '' }],
    exceptionPrescription: false,
    daysSupplyDefault: 30,
    reasonForVisit: '',
  },
  insurance: {
    g1: { rate: 20, max: 500, paid: 0 },
    g2: { rate: 30, max: 500, paid: 200 },
    g3: { rate: 100, max: 0, paid: 0 },
  },
  lines: [LINE()],
  submitBlockers: [],
  replayed: false,
  ...over,
})

const ATTACHMENT: PreparedAttachment = {
  id: 'a1',
  title: 'Prescription',
  fileName: 'prescription.jpg',
  contentType: 'image/jpeg',
  attachment: 'AAAA',
  dataUrl: 'data:image/jpeg;base64,AAAA',
  originalBytes: 6_000_000,
  bytes: 250_000,
}

/** A request that is genuinely ready: a line, an attachment, a principal
 *  diagnosis that needs no morphology. */
const READY = {
  state: STATE(),
  attachments: [ATTACHMENT],
  needsMorph: false,
}

const codes = (input: Parameters<typeof submitBlockers>[0]) =>
  submitBlockers(input).map((blocker) => blocker.code)

// ---------------------------------------------------------------------------

describe('everyBlockerNamesItself', () => {
  it('holds nothing back on a request that is ready', () => {
    expect(submitBlockers(READY)).toEqual([])
  })

  it('🚩 names EVERY unmet condition, one entry each', () => {
    // The whole point of the module: five reasons, five sentences. WPF's
    // equivalent refused with one message box naming whichever it hit first.
    const held = codes({
      state: STATE({
        lines: [],
        header: { ...STATE().header, diagnoses: [] },
        reference: { ...STATE().reference, memberId: '', providerCode: '' },
      }),
      attachments: [],
      needsMorph: false,
    })
    expect(held).toContain('noItems')
    expect(held).toContain('noAttachment')
    expect(held).toContain('noPrincipal')
    expect(held).toContain('noCoverage')
    expect(held).toContain('noProvider')
  })

  it('holds on a morphology the principal diagnosis requires and nobody set', () => {
    expect(
      codes({
        state: STATE({
          header: {
            ...STATE().header,
            diagnoses: [
              { code: 'C50.9', type: 'principal', description: 'Neoplasm', morphology: '' },
            ],
          },
        }),
        attachments: [ATTACHMENT],
        needsMorph: true,
      }),
    ).toContain('morphologyMissing')
  })

  it('🚩 counts only LIVE lines — a request of nothing but voided lines is empty', () => {
    // A voided line is kept for the audit trail (law 2) and is not something the
    // payer is being asked for. "One line, all of it withdrawn" must read as no
    // items, or Submit goes green on a request with nothing in it.
    expect(
      codes({ ...READY, state: STATE({ lines: [LINE({ voided: true })] }) }),
    ).toContain('noItems')
  })

  it('🚩 carries the SERVER’s own blockers through, in its words', () => {
    // §2's `submitBlockers` is the projection's own list, and §6's
    // `SUBMIT_BLOCKED` refuses on it. The server's sentence is data (§6 kind 2)
    // and is passed through, never re-worded from its code.
    const held = submitBlockers({
      ...READY,
      state: STATE({
        submitBlockers: [{ code: 'PROVIDER_NOT_CONFIGURED', message: 'That provider is unknown.' }],
      }),
    })
    expect(held).toHaveLength(1)
    expect(held[0].source).toBe('server')
    expect(held[0].message).toBe('That provider is unknown.')
  })

  it('🚩 does not say the same thing twice when the server states one the client already does', () => {
    // The client owns the mandatory-attachment rule as a form state (§3.5), so a
    // server `NO_ATTACHMENTS` on the same projection is the same fact, not a
    // second one.
    const held = codes({
      ...READY,
      attachments: [],
      state: STATE({ submitBlockers: [{ code: 'NO_ATTACHMENTS', message: 'Attach something.' }] }),
    })
    expect(held.filter((code) => code === 'noAttachment' || code === 'NO_ATTACHMENTS')).toEqual([
      'noAttachment',
    ])
  })

  it('🚩 and it stays quiet once the agent HAS attached one — the server cannot see attachments at all', () => {
    // The failing case: suppress the server's `NO_ATTACHMENTS` only while the
    // client blocker holds, and the entry reappears the moment the agent fixes
    // it — disabling Submit for the rest of the session over a fact the engine
    // has no way to know (attachments exist only inside the submit body, §3.5).
    expect(
      codes({
        ...READY,
        state: STATE({
          submitBlockers: [{ code: 'NO_ATTACHMENTS', message: 'Attach something.' }],
        }),
      }),
    ).toEqual([])
  })

  it('🚩 an unnamed blocker is still named — a bare code never reaches the agent as a sentence', () => {
    // The failing case this test exists for: a server entry with no message. It
    // must not render its machine code as if it were English.
    const [held] = submitBlockers({
      ...READY,
      state: STATE({ submitBlockers: [{ code: 'SOMETHING_NEW', message: '' }] }),
    })
    const label = blockerLabel(held)
    expect(label.kind).toBe('key')
    expect(label.kind === 'key' && label.params?.code).toBe('SOMETHING_NEW')
  })

  it('every client blocker resolves to its OWN key — none shares a sentence', () => {
    const held = submitBlockers({
      state: STATE({
        lines: [],
        header: {
          ...STATE().header,
          diagnoses: [{ code: 'C50.9', type: 'secondary', description: 'N', morphology: '' }],
        },
        reference: { ...STATE().reference, memberId: '', providerCode: '' },
      }),
      attachments: [],
      needsMorph: true,
    })
    const keys = held.map((blocker) => {
      const label = blockerLabel(blocker)
      return label.kind === 'key' ? label.key : label.text
    })
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.every((key) => key.startsWith('form.submit.blockers.'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------

const FINDING = (restrictionType: string, message = 'Age is outside the allowed range.') =>
  ({ restrictionType, message }) as NphiesClinicalEditFinding

describe('aFatalRestrictionCannotBeOverriddenAndAWarningCan', () => {
  it('a clear check is not a surface at all — nothing is shown and submit proceeds', () => {
    const gate = clinicalEditGate([])
    expect(gate.shape).toBe('clear')
    expect(gate.overridable).toBe(true)
  })

  it('🚩 a W lists what it found and MAY be overridden', () => {
    const gate = clinicalEditGate([FINDING('W')])
    expect(gate.shape).toBe('warning')
    expect(gate.overridable).toBe(true)
    expect(gate.findings.map((f) => f.message)).toEqual(['Age is outside the allowed range.'])
  })

  it('🚩 an F is THE SAME SURFACE with the confirm button removed', () => {
    const fatal = clinicalEditGate([FINDING('F', 'Principal must be a valid diagnosis code.')])
    expect(fatal.shape).toBe('fatal')
    expect(fatal.overridable).toBe(false)
    // One dialog, two shapes: the findings are listed identically, and the only
    // difference in the whole answer is the one flag the confirm button reads.
    expect(fatal.findings).toHaveLength(1)
  })

  it('🚩 one F among warnings makes the whole gate fatal', () => {
    const gate = clinicalEditGate([FINDING('W'), FINDING('F'), FINDING('W')])
    expect(gate.shape).toBe('fatal')
    expect(gate.overridable).toBe(false)
    // and it still lists all three — the agent sees everything found, not only
    // the one that stopped them.
    expect(gate.findings).toHaveLength(3)
  })

  it('reads the type the way the SERVICE reads it — fatal is exactly "F"', () => {
    // `ValidateClinicalEditForAuth` throws only on `== Fatal`; every other value
    // passes. An unrecognised restriction type is therefore a warning here too —
    // reproduced, not improved, so the web and the till agree about what stops a
    // submission.
    expect(clinicalEditGate([FINDING('f')]).shape).toBe('fatal')
    expect(clinicalEditGate([FINDING(' F ')]).shape).toBe('fatal')
    expect(clinicalEditGate([FINDING('X')]).shape).toBe('warning')
  })

  it('builds its request from the session state, and it carries no money', () => {
    const request = clinicalEditRequestFrom(STATE())
    expect(request).toEqual({
      serviceDate: '2026-08-02',
      patientBirthDate: '1988-04-02',
      patientGender: 'male',
      diagnoses: [{ diagnosisCode: 'J45.9', diagnosisType: 'principal' }],
    })
  })
})

// ---------------------------------------------------------------------------

const SUBMITTED: NphiesSubmitResult = {
  outcome: 'submitted',
  authId: 'AUTH-1',
  preAuthRef: 'PA-99',
  state: STATE({ status: 'submitted' }),
}

describe('aTimeoutIsReportedAsInFlightNotFailed', () => {
  it('🚩 a transport failure on the submit leg is IN FLIGHT, not a failure', () => {
    // The request may well have reached the payer. Calling it failed is what
    // makes an agent raise a second authorization for it.
    const landing = readSubmitFailure(new ApiError('network', 'Network error', 0))
    expect(landing.kind).toBe('inFlight')
  })

  it('and a 5xx with no envelope is the same answer', () => {
    expect(readSubmitFailure(new ApiError('server', 'Server error', 502)).kind).toBe('inFlight')
  })

  it("🚩 the offered act is a STATUS CHECK, and there is no resubmit anywhere in the answer", () => {
    const landing = readSubmitFailure(new ApiError('network', 'Network error', 0))
    expect(nextActs(landing)).toEqual(['statusCheck'])
    expect(nextActs(landing)).not.toContain('submit')
  })

  it('🚩 and submit is LOCKED afterwards — the form may not offer it a second time', () => {
    expect(submitIsLocked(readSubmitFailure(new ApiError('network', 'x', 0)))).toBe(true)
    expect(submitIsLocked(readSubmitResult(SUBMITTED))).toBe(true)
  })

  it("the server's own inFlight outcome reads identically", () => {
    const landing = readSubmitResult({ outcome: 'inFlight', authId: null })
    expect(landing.kind).toBe('inFlight')
    expect(nextActs(landing)).toEqual(['statusCheck'])
  })

  it('🚩 a guardrail refusal is NOT in flight — it never left SIS.Api', () => {
    // §6 kind 2. `SUBMIT_BLOCKED`, `CLINICAL_EDIT_FATAL` and
    // `DUPLICATE_SUBMISSION` are refusals *before* the exchange, so the agent
    // stays on the form and may fix and send again — the exact opposite of the
    // timeout's rule, and the reason the two are not one branch.
    const landing = readSubmitFailure(
      new ApiError('business', 'A submit blocker still holds.', 409, [
        { errorCode: 'SUBMIT_BLOCKED', internalErrorCode: '', errorMessage: 'SUBMIT_BLOCKED' },
      ]),
    )
    expect(landing.kind).toBe('blocked')
    expect(landing.kind === 'blocked' && landing.code).toBe('SUBMIT_BLOCKED')
    expect(submitIsLocked(landing)).toBe(false)
    expect(nextActs(landing)).toEqual(['backToForm'])
  })

  it('an accepted submit lands on the authorization it created', () => {
    const landing = readSubmitResult(SUBMITTED)
    expect(landing).toEqual({ kind: 'submitted', authId: 'AUTH-1', preAuthRef: 'PA-99' })
    expect(nextActs(landing)).toEqual(['openDetail'])
  })
})

// ---------------------------------------------------------------------------

describe('refusalReasonsLandOnTheRowsThatCausedThem', () => {
  const LINES = [LINE({ lineId: 'L1', sequence: 1 }), LINE({ lineId: 'L2', sequence: 2 })]

  it('🚩 attaches each reason to the line that caused it', () => {
    const placed = placeRefusals(
      [
        { lineId: 'L2', message: 'Item is not covered by this plan.' },
        { lineId: 'L1', message: 'Quantity exceeds the plan maximum.' },
      ],
      LINES,
    )
    expect(placed.byLine['L1']).toEqual(['Quantity exceeds the plan maximum.'])
    expect(placed.byLine['L2']).toEqual(['Item is not covered by this plan.'])
    expect(placed.header).toEqual([])
  })

  it('keeps two reasons on one row, in the order the server sent them', () => {
    const placed = placeRefusals(
      [
        { lineId: 'L1', message: 'first' },
        { lineId: 'L1', message: 'second' },
      ],
      LINES,
    )
    expect(placed.byLine['L1']).toEqual(['first', 'second'])
  })

  it('🚩 THE HEADER-ONLY CASE — no lines were built, and every reason still shows', () => {
    // §3.9: the service's own guards (unknown item, no Nphies category,
    // unconfigured provider or payer, over-long prescription ref) throw BEFORE
    // the lines are built. A screen that only rendered per-row reasons would show
    // the agent an empty form and no explanation at all — on the refusals that
    // are hardest to recover from.
    const placed = placeRefusals(
      [
        { lineId: null, message: 'Provider is not configured.' },
        { lineId: null, message: 'Item 100009 has no Nphies category.' },
      ],
      [],
    )
    expect(placed.header).toEqual([
      'Provider is not configured.',
      'Item 100009 has no Nphies category.',
    ])
    expect(placed.byLine).toEqual({})
    expect(placed.total).toBe(2)
  })

  it('🚩 a reason naming a line this request does not hold falls back to the header', () => {
    // Never dropped. A reason nobody can see is a refusal the agent cannot fix.
    const placed = placeRefusals([{ lineId: 'L9', message: 'Line 9 is bad.' }], LINES)
    expect(placed.header).toEqual(['Line 9 is bad.'])
    expect(placed.total).toBe(1)
  })

  it('a refused submit keeps the agent on the form, with the reasons placed', () => {
    const landing = readSubmitResult({
      outcome: 'refused',
      authId: 'AUTH-2',
      reasons: [{ lineId: 'L1', message: 'Quantity exceeds the plan maximum.' }],
    })
    expect(landing.kind).toBe('refused')
    expect(landing.kind === 'refused' && landing.reasons).toHaveLength(1)
    // 🚩 Not a landing anywhere: `backToForm` is the only act, because `Failed`
    // means fixable-by-the-agent-here.
    expect(nextActs(landing)).toEqual(['backToForm'])
    expect(submitIsLocked(landing)).toBe(false)
  })
})
