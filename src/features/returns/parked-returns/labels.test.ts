/**
 * BackOffice ticket 4224 (spec 4212, stories 9-11, 29) — the words a parked return and each of its grains wear: the state
 * labels ("needs HQ", "waiting for the partner", "waiting for the store", "finished"), "store details not received" on a
 * ledger row the store never mirrored, "awaiting HQ" on a failure no person has checked, and each needs-HQ reason.
 */
import { describe, expect, it } from 'vitest'
import { ageDays, grainBadges, needsHqReasonLabel, parkReasonLabel, rowBadges, stateLabel } from './labels'

describe('each state has its label', () => {
  it.each([
    ['NEEDS_HQ', 'state.needsHq', 'warn'],
    ['WAITING_FOR_PARTNER', 'state.waitingForPartner', 'go'],
    ['WAITING_FOR_STORE', 'state.waitingForStore', 'go'],
    ['FINISHED', 'state.finished', 'mute'],
  ] as const)('%s → %s', (state, key, sev) => {
    expect(stateLabel(state)).toEqual({ key, sev })
  })

  it('a state the screen does not know reads "unknown", never a raw code', () => {
    expect(stateLabel('SOMETHING_NEW')).toEqual({ key: 'state.unknown', sev: 'mute' })
    expect(stateLabel('')).toEqual({ key: 'state.unknown', sev: 'mute' })
  })
})

describe('a row’s badges', () => {
  it('a mirrored return wears its state alone', () => {
    expect(rowBadges({ state: 'WAITING_FOR_STORE', storeDetailsReceived: true }).map((b) => b.key)).toEqual(['state.waitingForStore'])
  })

  it('a ledger row the store never mirrored also says "store details not received" (story 10)', () => {
    expect(rowBadges({ state: 'NEEDS_HQ', storeDetailsReceived: false }).map((b) => b.key)).toEqual([
      'state.needsHq',
      'badge.storeDetailsNotReceived',
    ])
  })
})

describe('a grain’s badges', () => {
  const grain = { status: 'PENDING', awaitingHq: false, cashRuled: false, escalated: false }

  it('its ledger status, in words', () => {
    expect(grainBadges(grain).map((b) => b.key)).toEqual(['ledger.pending'])
    expect(grainBadges({ ...grain, status: 'SUBMITTED' }).map((b) => b.key)).toEqual(['ledger.submitted'])
    expect(grainBadges({ ...grain, status: 'REFUNDED' }).map((b) => b.key)).toEqual(['ledger.refunded'])
    expect(grainBadges({ ...grain, status: 'mystery' }).map((b) => b.key)).toEqual(['ledger.unknown'])
  })

  it('a failure no person has checked is "awaiting HQ" (story 29)', () => {
    expect(grainBadges({ ...grain, status: 'FAILED', awaitingHq: true }).map((b) => b.key)).toEqual(['ledger.failed', 'badge.awaitingHq'])
  })

  it('escalated and cash-ruled are said beside the status', () => {
    expect(grainBadges({ ...grain, escalated: true }).map((b) => b.key)).toEqual(['ledger.pending', 'badge.escalated'])
    expect(grainBadges({ ...grain, status: 'FAILED', cashRuled: true }).map((b) => b.key)).toEqual(['ledger.failed', 'badge.cashRuled'])
  })
})

describe('reasons in words', () => {
  it.each([
    ['NO_STATUS_API', 'reason.noStatusApi'],
    ['ESCALATED', 'reason.escalated'],
    ['AGED', 'reason.aged'],
    ['UNCHECKED_FAILURE', 'reason.uncheckedFailure'],
    ['MIXED', 'reason.mixed'],
    ['ROWLESS', 'reason.rowless'],
    ['NEW_ONE', 'reason.unknown'],
  ])('needs HQ because %s → %s', (reason, key) => {
    expect(needsHqReasonLabel(reason)).toBe(key)
  })

  it.each([
    ['AMBIGUOUS_ANSWER', 'parkReason.ambiguousAnswer'],
    ['HELD_AT_COMPLETION', 'parkReason.heldAtCompletion'],
    ['', 'parkReason.unknown'],
  ])('parked because %s → %s', (reason, key) => {
    expect(parkReasonLabel(reason)).toBe(key)
  })
})

describe('a return’s age, in whole days since it parked (local wall clock)', () => {
  const now = new Date(2026, 10, 24, 9, 0)

  it('counts whole days', () => {
    expect(ageDays('2026-11-24T08:00:00', now)).toBe(0)
    expect(ageDays('2026-11-23T09:00:00', now)).toBe(1)
    expect(ageDays('2026-11-20T10:00:00', now)).toBe(3)
  })

  it('no park time (or the .NET default) has no age', () => {
    expect(ageDays('', now)).toBeNull()
    expect(ageDays('0001-01-01T00:00:00', now)).toBeNull()
  })

  it('a park time ahead of this clock is age 0, never negative', () => {
    expect(ageDays('2026-11-24T12:00:00', now)).toBe(0)
  })
})
