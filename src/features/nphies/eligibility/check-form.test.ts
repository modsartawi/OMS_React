/**
 * `submitIsBlockedUntilAProviderIsChosen` (ticket 211) — the check form's gate,
 * and what Fill is allowed to touch.
 *
 * Draft in, blockers (or a request body) out. Nothing here renders anything: the
 * form is a thin controlled shell over this module, exactly as spec 209's testing
 * ruling asks (the pure modules carry the logic a component test would otherwise
 * have to reach).
 */
import { describe, expect, it } from 'vitest'
import type { LastEligibility } from '@/core/models/nphies'
import {
  EMPTY_CHECK_DRAFT,
  checkBlockers,
  fillFromLastEligibility,
  toCheckRequest,
  type CheckDraft,
} from './check-form'

/** A draft that is complete apart from whatever the case under test removes. */
const READY: CheckDraft = {
  ...EMPTY_CHECK_DRAFT,
  providerCode: 'P001',
  payerCode: 'PAY-9',
  patientId: '0000000003',
  patientIdType: 'PRC',
  patientName: 'Muhammad Ali Abbas',
  patientGender: 'male',
  patientBirthDate: '2010-08-21',
}

const LAST: LastEligibility = {
  id: 'ELG-1',
  providerCode: 'P999',
  patientId: '0000000003',
  patientIdType: 'PRC',
  patientGender: 'male',
  patientName: 'Muhammad Ali Abbas',
  patientBirthDate: '2010-08-21T00:00:00',
  payerCode: 'PAY-9',
  transfer: true,
  newborn: false,
  occupation: 'student',
  maritalStatus: 'U',
  memberId: 'M-4417',
}

describe('submitIsBlockedUntilAProviderIsChosen', () => {
  it('starts with NO provider — there is no default and no memory of the last pick', () => {
    expect(EMPTY_CHECK_DRAFT.providerCode).toBe('')
  })

  it('blocks while no provider is chosen', () => {
    expect(checkBlockers({ ...READY, providerCode: '' })).toContain('provider')
  })

  it('stops blocking once one is chosen, and nothing else is left blocking', () => {
    expect(checkBlockers(READY)).toEqual([])
  })

  it('treats whitespace as unchosen', () => {
    expect(checkBlockers({ ...READY, providerCode: '   ' })).toContain('provider')
  })

  it('also blocks on every field the request cannot be built without', () => {
    // Not design, arithmetic: `EligibilityRequest` has no patient and no payer to
    // ask about, and the service throws "Payer doesn't configured!" on an empty
    // one. Blocking on the form is this spec's posture — the block is visible
    // where the agent is, rather than arriving as a refusal from the exchange.
    expect(checkBlockers({ ...READY, patientId: '' })).toContain('patientId')
    expect(checkBlockers({ ...READY, payerCode: '' })).toContain('payer')
    expect(checkBlockers({ ...READY, patientName: '' })).toContain('patientName')
    expect(checkBlockers({ ...READY, patientBirthDate: '' })).toContain('patientBirthDate')
  })

  it('🚩 invents no identity: an untouched gender or ID type blocks rather than defaulting', () => {
    // Both reach a national exchange inside the FHIR Patient. A form that
    // shipped `male` because it sorted first would be wrong silently, on the one
    // screen whose whole point is that nothing is a mode nobody chose.
    expect(EMPTY_CHECK_DRAFT.patientGender).toBe('')
    expect(EMPTY_CHECK_DRAFT.patientIdType).toBe('')
    expect(checkBlockers(EMPTY_CHECK_DRAFT)).toContain('patientGender')
    expect(checkBlockers(EMPTY_CHECK_DRAFT)).toContain('patientIdType')
  })
})

describe('Fill, from a patient id alone', () => {
  it('completes the identity block on a COLD form', () => {
    const filled = fillFromLastEligibility(EMPTY_CHECK_DRAFT, LAST)
    expect(filled.patientName).toBe('Muhammad Ali Abbas')
    expect(filled.patientIdType).toBe('PRC')
    expect(filled.patientGender).toBe('male')
    expect(filled.memberId).toBe('M-4417')
    expect(filled.payerCode).toBe('PAY-9')
    expect(filled.transfer).toBe(true)
    expect(filled.occupation).toBe('student')
  })

  it('trims the service’s DateTime down to the date the input speaks', () => {
    expect(fillFromLastEligibility(EMPTY_CHECK_DRAFT, LAST).patientBirthDate).toBe('2010-08-21')
  })

  it('🚩 leaves the date BLANK rather than half-parsed when it is not ISO', () => {
    // A native date input renders an unparseable value as empty. A blind slice
    // would leave the agent looking at a blank field while the draft held a
    // non-blank string — which clears the blocker and posts a malformed date.
    const filled = fillFromLastEligibility(EMPTY_CHECK_DRAFT, {
      ...LAST,
      patientBirthDate: '21/08/2010 00:00:00',
    })
    expect(filled.patientBirthDate).toBe('')
    expect(checkBlockers(filled)).toContain('patientBirthDate')
  })

  it('🚩 does NOT choose a provider, even though the last check names one', () => {
    // The provider is a free per-act pick with no memory (ticket 211 / contract
    // §3.1). Filling it from the last check IS memory of the last pick, and it
    // would mean an agent could submit under a provider they never chose.
    const filled = fillFromLastEligibility({ ...EMPTY_CHECK_DRAFT, patientId: '0000000003' }, LAST)
    expect(filled.providerCode).toBe('')
    expect(checkBlockers(filled)).toContain('provider')
  })

  it('keeps a provider the agent had already chosen', () => {
    expect(fillFromLastEligibility(READY, LAST).providerCode).toBe('P001')
  })

  it('🚩 fills, and never clears what the agent already typed', () => {
    // The stored record is patchy — `Occupation` and `MaritalStatus` are
    // nullable and usually empty — so a Fill that copied the blanks over would
    // punish the case it exists to serve: press Fill, find little there, keep
    // going by hand.
    const typed: CheckDraft = {
      ...READY,
      occupation: 'engineer',
      maritalStatus: 'M',
      memberId: 'M-TYPED',
    }
    const sparse: LastEligibility = {
      ...LAST,
      occupation: '',
      maritalStatus: '',
      memberId: '',
      patientName: '',
    }
    const filled = fillFromLastEligibility(typed, sparse)
    expect(filled.occupation).toBe('engineer')
    expect(filled.maritalStatus).toBe('M')
    expect(filled.memberId).toBe('M-TYPED')
    expect(filled.patientName).toBe('Muhammad Ali Abbas')
  })
})

describe('the request body', () => {
  it('is EligibilityRequest verbatim, with the purpose pinned', () => {
    expect(toCheckRequest(READY)).toEqual({
      eligibilityPurpose: 'benefits',
      providerCode: 'P001',
      payerCode: 'PAY-9',
      patientId: '0000000003',
      patientIdType: 'PRC',
      patientGender: 'male',
      patientName: 'Muhammad Ali Abbas',
      patientBirthDate: '2010-08-21',
      memberId: '',
      transfer: false,
      newborn: false,
      occupation: '',
      maritalStatus: '',
    })
  })

  it('carries no identity the server stamps and no claim/request type', () => {
    // Law 7: distribution channel, user id, staff id and source code are
    // server-stamped and the browser never sends them. v1 has one claim type and
    // one request type, both pinned server-side — so neither is a field here.
    const body: Record<string, unknown> = { ...toCheckRequest(READY) }
    for (const absent of [
      'distributionChannel',
      'userId',
      'staffId',
      'sourceCode',
      'claimType',
      'claimRequestType',
      'hidpReference',
    ])
      expect(body).not.toHaveProperty(absent)
  })

  it('trims what the agent typed', () => {
    expect(toCheckRequest({ ...READY, patientId: ' 0000000003 ' }).patientId).toBe('0000000003')
  })
})
