/**
 * A donor request as the list draws it (ticket 431, spec 430 D3/D9): its tone, its waiting time,
 * whether it was cancelled after its units were picked, and how long the pick took. Derived on
 * this side from the row's own times, over the `@/core/oms` donor-moments helpers. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { DonorRequestModel } from '@/core/models/sd-document'
import { donorRow } from './donor-row'

const UNSET = '0001-01-01T00:00:00'
const T = '2026-10-07T'
const NOW = Date.parse(`${T}10:20:00`)

const request = (over: Partial<DonorRequestModel> = {}): DonorRequestModel => ({
  requestNo: 'DR1',
  deliveryNo: '8000000500',
  orderStore: 'P019',
  donorStore: 'D012',
  state: 'OPEN',
  outcome: '',
  outcomeReason: '',
  outcomeBy: '',
  outcomeAt: UNSET,
  raisedBy: 'store.p019',
  raisedAt: `${T}09:00:00`,
  changedBy: '',
  changedAt: UNSET,
  fulfilledAt: UNSET,
  lockedBy: '',
  lockedAt: UNSET,
  transferStoNo: '',
  transferSapDocumentNo: '',
  transferredAt: UNSET,
  picked: 0,
  required: 3,
  ...over,
})

describe('waiting', () => {
  it('an OPEN, unpicked request waits since it was raised', () => {
    expect(donorRow(request(), NOW).waiting).toEqual({ days: 0, hours: 1, minutes: 20 })
  })

  it('a picked request no longer waits', () => {
    expect(donorRow(request({ fulfilledAt: `${T}09:30:00`, picked: 3 }), NOW).waiting).toBeNull()
  })

  it('an ended or non-OPEN request does not wait', () => {
    expect(donorRow(request({ state: 'CANCELLED', outcome: 'EXPIRED', outcomeAt: `${T}10:00:00` }), NOW).waiting).toBeNull()
    expect(donorRow(request({ state: 'TRANSFERRED' }), NOW).waiting).toBeNull()
  })
})

describe('tone', () => {
  it.each([
    ['REFUSED', 'refused', 'attention'],
    ['EXPIRED', 'expired', 'attention'],
    ['CANCELLED', 'cancelled', 'muted'],
  ] as const)('a %s request is %s, %s', (wire, outcome, tone) => {
    const row = donorRow(request({ state: 'CANCELLED', outcome: wire, outcomeAt: `${T}10:00:00` }), NOW)
    expect([row.outcome, row.tone]).toEqual([outcome, tone])
  })

  it('a cancelled state with no outcome sent is still muted', () => {
    expect(donorRow(request({ state: 'CANCELLED' }), NOW).tone).toBe('muted')
  })

  it('an open or transferred request has no tone', () => {
    expect(donorRow(request(), NOW).tone).toBeNull()
    expect(donorRow(request({ state: 'TRANSFERRED', fulfilledAt: `${T}09:30:00` }), NOW).tone).toBeNull()
  })
})

describe('cancelled after picked', () => {
  it('is marked when the units were picked before the cancel', () => {
    const row = donorRow(
      request({ state: 'CANCELLED', outcome: 'CANCELLED', fulfilledAt: `${T}09:30:00`, picked: 3, outcomeAt: `${T}10:00:00` }),
      NOW,
    )
    expect(row.cancelledAfterPicked).toBe(true)
  })

  it('a clean cancel, before any pick, is not', () => {
    expect(
      donorRow(request({ state: 'CANCELLED', outcome: 'CANCELLED', outcomeAt: `${T}10:00:00` }), NOW).cancelledAfterPicked,
    ).toBe(false)
  })

  it('a refusal is not a cancel, picked or not', () => {
    expect(
      donorRow(request({ state: 'CANCELLED', outcome: 'REFUSED', fulfilledAt: `${T}09:30:00`, outcomeAt: `${T}10:00:00` }), NOW)
        .cancelledAfterPicked,
    ).toBe(false)
  })
})

describe('minutes to pick', () => {
  it('is the whole minutes from raised to picked', () => {
    expect(donorRow(request({ fulfilledAt: `${T}09:25:40`, picked: 3 }), NOW).minutesToPick).toBe(25)
  })

  it('is null until the request is picked', () => {
    expect(donorRow(request(), NOW).minutesToPick).toBeNull()
  })

  it('is null when the raise time is unset, and never negative', () => {
    expect(donorRow(request({ raisedAt: UNSET, fulfilledAt: `${T}09:25:00` }), NOW).minutesToPick).toBeNull()
    expect(donorRow(request({ fulfilledAt: `${T}08:00:00` }), NOW).minutesToPick).toBe(0)
  })
})
