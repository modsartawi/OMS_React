/**
 * The three pure Proof bullets of ticket 217, at the seam that owns them.
 *
 * Each one states an external behaviour and would survive the form being rebuilt:
 * what reaches the screen when two verbs race, what the agent is told when they
 * add an item twice, and what the request still shows after a line is taken off
 * it. None of them asserts which hook fired or how state is shaped internally.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { CLIENT_CONTRACT_VERSION } from '@/core/engine-session/session-state'
import type { NphiesAuthSessionLine, NphiesAuthSessionState } from '@/core/models/nphies'
import {
  admitSessionState,
  leavingDiscardsWork,
  liveLineCount,
  lineHoldingItem,
  openBlockers,
  projectSessionLines,
  readAddRefusal,
  refuseAdd,
} from './auth-session'

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
  netAmount: 47.5,
  vat: 7.13,
  discountPercentage: 5,
  discountAmount: 2.5,
  actualPatientShare: 9.5,
  deductibleG: 9.5,
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
  etag: 'a3f1',
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
    diagnoses: [],
    exceptionPrescription: false,
    daysSupplyDefault: 30,
    reasonForVisit: '',
  },
  insurance: {
    g1: { rate: 20, max: 500, paid: 0 },
    g2: { rate: 30, max: 500, paid: 0 },
    g3: { rate: 100, max: 0, paid: 0 },
  },
  lines: [],
  submitBlockers: [],
  replayed: false,
  ...over,
})

/** A duplicate refusal exactly as the door sends it (§6 kind 2): a non-2xx
 *  carrying the envelope, a server-supplied human message and a machine code. */
const alreadyOnRequest = () =>
  new ApiError('business', 'That item is already on this request.', 409, [
    { errorCode: 'ITEM_ALREADY_ON_REQUEST', internalErrorCode: '', errorMessage: 'duplicate' },
  ])

describe('aStaleStateNeverReplacesANewerOne', () => {
  it('🚩 discards a state that arrives late carrying an OLDER version', () => {
    // The race the whole rule exists for: `changeQty` and `addItem` in flight
    // together, the slower one lands second, and the request goes backwards on
    // screen — an item the agent watched appear silently leaves again.
    const current = STATE({ version: 7, etag: 'new', lines: [LINE()] })
    const slow = STATE({ version: 5, etag: 'old', lines: [] })
    const admitted = admitSessionState(current, slow)
    expect(admitted.ok).toBe(true)
    expect(admitted.ok && admitted.state).toBe(current)
    expect(admitted.ok && admitted.state.lines).toHaveLength(1)
  })

  it('applies a NEWER version', () => {
    const current = STATE({ version: 5 })
    const next = STATE({ version: 6, etag: 'next', lines: [LINE()] })
    const admitted = admitSessionState(current, next)
    expect(admitted.ok && admitted.state).toBe(next)
  })

  it('applies the first state of a session, since there is nothing to order it against', () => {
    const first = STATE({ version: 1 })
    const admitted = admitSessionState(null, first)
    expect(admitted.ok && admitted.state).toBe(first)
  })

  it('🚩 the guard is genuinely `core/`s — an equal version with a different etag applies', () => {
    // The rule is `@/core/engine-session/session-state`'s, shared with the
    // call-centre console (ticket 210) and not re-implemented here. This case is
    // the one that distinguishes the real rule from a naive `version >`: version
    // ORDERS states, the etag IDENTIFIES one, and a door answering a verb the
    // agent just performed is the newer of two accounts of one save point.
    const current = STATE({ version: 9, etag: 'first' })
    const sameSavePoint = STATE({ version: 9, etag: 'second', lines: [LINE()] })
    const admitted = admitSessionState(current, sameSavePoint)
    expect(admitted.ok && admitted.state).toBe(sameSavePoint)
  })

  it('and a byte-identical replay costs no re-render — the current state is kept BY IDENTITY', () => {
    const current = STATE({ version: 9, etag: 'same' })
    const replay = STATE({ version: 9, etag: 'same' })
    const admitted = admitSessionState(current, replay)
    expect(admitted.ok && admitted.state).toBe(current)
  })

  it('🚩 refuses to admit ANY state whose contract major has moved', () => {
    // Law 10 / §8: the form refuses to run rather than mis-render money at a
    // national exchange, and it says both versions because "update the portal" is
    // an instruction someone has to be able to act on.
    const admitted = admitSessionState(null, STATE({ contractVersion: '9.0' }))
    expect(admitted.ok).toBe(false)
    expect(admitted).toMatchObject({ expected: CLIENT_CONTRACT_VERSION, received: '9.0' })
  })
})

describe('addingAnItemAlreadyOnTheRequestIsRefusedWithTheRemedy', () => {
  const lines = [LINE({ lineId: 'L1', sequence: 1, itemNumber: '100001' })]

  it('🚩 refuses the second add of an item already on the request', () => {
    expect(refuseAdd(lines, '100001', 1)).toMatchObject({ kind: 'duplicate' })
  })

  it('🚩 and NAMES THE QUANTITY CONTROL as the remedy', () => {
    // §2.3, and the whole reason the rule moved forward from WPF's submit-time
    // `ValidateDuplicateItems`: the agent fixes it while looking at it, and what
    // they actually want is more of what is already there.
    expect(refuseAdd(lines, '100001', 1)?.remedy).toBe('quantity')
  })

  it('and points at the line that already holds it, so the screen can indicate the row', () => {
    expect(refuseAdd(lines, '100001', 1)).toMatchObject({ lineId: 'L1', sequence: 1 })
  })

  it('matches the item by its code, not by how it was typed', () => {
    // An item number is a machine code. A trailing space is not a second product,
    // and a refusal that missed it would let the duplicate reach the door — the
    // one place §2.3 says it must not have to be caught.
    expect(refuseAdd(lines, ' 100001 ', 1)?.kind).toBe('duplicate')
    expect(refuseAdd(lines, '100002', 1)).toBeNull()
  })

  it('🚩 a VOIDED line does not block its own item', () => {
    // Voiding is how an item comes off the request. If a voided line still blocked
    // it, the remedy the refusal names — change the quantity — would point at a
    // line that is no longer on the request, and the item could never be re-added.
    const voided = [LINE({ lineId: 'L1', itemNumber: '100001', voided: true })]
    expect(lineHoldingItem(voided, '100001')).toBeNull()
    expect(refuseAdd(voided, '100001', 1)).toBeNull()
  })

  it('refuses a quantity the door would refuse anyway, and names the quantity control too', () => {
    expect(refuseAdd([], '100001', 0)).toMatchObject({ kind: 'qty', remedy: 'quantity' })
    expect(refuseAdd([], '100001', 1.5)).toMatchObject({ kind: 'qty' })
  })

  it('refuses an empty add-row against its own field, not against the quantity', () => {
    expect(refuseAdd([], '   ', 1)).toMatchObject({ kind: 'blank', remedy: 'itemNumber' })
  })

  it("🚩 reads the DOOR's own refusal into the same shape, so a stale screen reads the same sentence", () => {
    // The client's forward check is not a second opinion: `ITEM_ALREADY_ON_REQUEST`
    // is still the authority, and branching on the code rather than the message is
    // what stops this breaking when somebody rewords the server's sentence.
    expect(readAddRefusal(alreadyOnRequest(), lines, '100001')).toMatchObject({
      kind: 'duplicate',
      remedy: 'quantity',
      lineId: 'L1',
    })
  })

  it('and leaves every other refusal alone, with its own words', () => {
    const noCategory = new ApiError('business', 'This item has no insurance category.', 409, [
      { errorCode: 'ITEM_NO_NPHIES_CATEGORY', internalErrorCode: '', errorMessage: 'no category' },
    ])
    expect(readAddRefusal(noCategory, lines, '100003')).toBeNull()
  })
})

describe('aVoidedLineIsKeptNotRemoved', () => {
  const state = STATE({
    lines: [
      LINE({ lineId: 'L1', sequence: 1, itemNumber: '100001' }),
      LINE({ lineId: 'L2', sequence: 2, itemNumber: '100002', voided: true }),
      LINE({ lineId: 'L3', sequence: 3, itemNumber: '100003' }),
    ],
  })

  it('🚩 keeps a voided line in the projection — the audit trail is the whole point', () => {
    // A payload assembled client-side carries only the survivors, which is exactly
    // what "added then voided" cannot be reconstructed from. The session shape
    // exists to record it, so the screen has to show it.
    const lines = projectSessionLines(state)
    expect(lines.map((l) => l.lineId)).toEqual(['L1', 'L2', 'L3'])
    expect(lines[1].voided).toBe(true)
  })

  it('keeps it in the engine`s own order, so a void never re-orders what is above it', () => {
    const shuffled = STATE({ lines: [...state.lines].reverse() })
    expect(projectSessionLines(shuffled).map((l) => l.sequence)).toEqual([1, 2, 3])
  })

  it('marks it inert: there is no un-void verb, and re-adding the item is the way back', () => {
    const voided = projectSessionLines(state)[1]
    expect(voided.editable).toBe(false)
    expect(projectSessionLines(state)[0].editable).toBe(true)
  })

  it('and does not count it as something the payer is being asked for', () => {
    expect(liveLineCount(projectSessionLines(state))).toBe(2)
  })

  it('says a line is still being priced only when the ENGINE says so', () => {
    // `pricing` is the server's field (§2). The browser never guesses that a price
    // is on its way, and never computes one.
    const pending = STATE({ lines: [LINE({ pricing: 'pending' })] })
    expect(projectSessionLines(pending)[0].pricingPending).toBe(true)
    expect(projectSessionLines(state)[0].pricingPending).toBe(false)
  })
})

describe('leavingAPartBuiltRequestDiscardsIt', () => {
  it('warns once the request has a line on it', () => {
    expect(leavingDiscardsWork(STATE({ lines: [LINE()] }))).toBe(true)
  })

  it('🚩 warns about a request whose only line was voided', () => {
    // A voided line is a decision the agent made and the trail recorded. "You have
    // nothing to lose" is not true of a request they have been building.
    expect(leavingDiscardsWork(STATE({ lines: [LINE({ voided: true })] }))).toBe(true)
  })

  it('does not warn about an empty session — that would train the agent to click through', () => {
    expect(leavingDiscardsWork(STATE())).toBe(false)
  })

  it('does not warn once the transaction is no longer open', () => {
    expect(leavingDiscardsWork(STATE({ status: 'submitted', lines: [LINE()] }))).toBe(false)
    expect(leavingDiscardsWork(null)).toBe(false)
  })
})

describe('theSessionWillNotOpenUntilThePlantIsResolved', () => {
  it('🚩 refuses to open without an acting store', () => {
    // The acting store IS the pricing plant, bound at `Open` and immutable for the
    // life of the transaction (law 8). Opening before it is resolved binds
    // whatever the server finds, and the agent discovers it in the money.
    expect(openBlockers('ELG-1', 'MEM-1', null)).toEqual(['noActingStore'])
    expect(openBlockers('ELG-1', 'MEM-1', '  ')).toEqual(['noActingStore'])
  })

  it('names each half of the seam that is missing, rather than failing at the door', () => {
    expect(openBlockers('', 'MEM-1', '1101')).toEqual(['noEligibility'])
    expect(openBlockers('ELG-1', '', '1101')).toEqual(['noCoverage'])
    expect(openBlockers('', '', null)).toEqual(['noEligibility', 'noCoverage', 'noActingStore'])
  })

  it('opens when both ids and the plant are resolved', () => {
    expect(openBlockers('ELG-1', 'MEM-1', '1101')).toEqual([])
  })
})
