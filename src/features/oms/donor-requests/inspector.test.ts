/**
 * The donor request inspector (ticket 432, spec 430 D9/D10): a list row turned into what the
 * pane beside the grid shows — the header facts, the transfer facts once transferred, the
 * request's donor moments newest first, and where "Open delivery" goes. From the row alone. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { DonorRequestModel } from '@/core/models/sd-document'
import { donorInspector } from './inspector'

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

describe('header facts', () => {
  it('an open request: its numbers, both stores, its state, the units, and its wait', () => {
    const v = donorInspector(request(), NOW)
    expect(v.requestNo).toBe('DR1')
    expect(v.deliveryNo).toBe('8000000500')
    expect(v.donorStore).toBe('D012')
    expect(v.orderStore).toBe('P019')
    expect(v.state).toBe('OPEN')
    expect(v.asked).toBe(3)
    expect(v.given).toBe(0)
    expect(v.row.outcome).toBeNull()
    expect(v.row.tone).toBeNull()
    expect(v.row.waiting).toEqual({ days: 0, hours: 1, minutes: 20 })
    expect(v.reason).toBe('')
  })

  it('a refused request carries its outcome, the attention tone and the reason', () => {
    const v = donorInspector(
      request({ state: 'CANCELLED', outcome: 'REFUSED', outcomeReason: ' No stock ', outcomeAt: `${T}09:30:00` }),
      NOW,
    )
    expect(v.state).toBe('CANCELLED')
    expect(v.row.outcome).toBe('refused')
    expect(v.row.tone).toBe('attention')
    expect(v.row.waiting).toBeNull()
    expect(v.reason).toBe('No stock')
  })

  it('an expired request is attention; a cancelled one is muted', () => {
    expect(donorInspector(request({ state: 'CANCELLED', outcome: 'EXPIRED', outcomeAt: `${T}10:00:00` }), NOW).row.tone).toBe(
      'attention',
    )
    expect(donorInspector(request({ state: 'CANCELLED', outcome: 'CANCELLED', outcomeAt: `${T}10:00:00` }), NOW).row.tone).toBe(
      'muted',
    )
  })

  it('a state this side does not know is kept as the server sent it, never dropped', () => {
    const v = donorInspector(request({ state: ' parked ' as DonorRequestModel['state'] }), NOW)
    expect(v.state).toBeNull()
    expect(v.stateRaw).toBe('parked')
  })

  it('the state is read case- and space-blind', () => {
    expect(donorInspector(request({ state: ' fulfilled ' as DonorRequestModel['state'] }), NOW).state).toBe('FULFILLED')
  })

  it('a blank delivery or store is blank, so the pane draws no line for it', () => {
    const v = donorInspector(request({ deliveryNo: ' ', donorStore: '', orderStore: '  ' }), NOW)
    expect([v.deliveryNo, v.donorStore, v.orderStore]).toEqual(['', '', ''])
  })

  it('a picked request gives its units and its minutes to pick', () => {
    const v = donorInspector(request({ state: 'FULFILLED', fulfilledAt: `${T}09:25:00`, picked: 2 }), NOW)
    expect(v.given).toBe(2)
    expect(v.row.minutesToPick).toBe(25)
  })
})

describe('transfer facts', () => {
  it('none before the request is transferred', () => {
    expect(donorInspector(request(), NOW).transfer).toBeNull()
    expect(donorInspector(request({ state: 'FULFILLED', fulfilledAt: `${T}09:25:00`, picked: 3 }), NOW).transfer).toBeNull()
  })

  it('the STO and the SAP document once transferred', () => {
    const v = donorInspector(
      request({
        state: 'TRANSFERRED',
        fulfilledAt: `${T}09:25:00`,
        transferStoNo: ' 4500001234 ',
        transferSapDocumentNo: '4900000077',
        transferredAt: `${T}09:40:00`,
      }),
      NOW,
    )
    expect(v.transfer).toEqual({ stoNo: '4500001234', sapDocumentNo: '4900000077' })
  })

  it('a TRANSFERRED state whose numbers are not in yet still shows the block, blank', () => {
    expect(donorInspector(request({ state: 'TRANSFERRED' }), NOW).transfer).toEqual({ stoNo: '', sapDocumentNo: '' })
  })

  it('a request cancelled after its transfer keeps its transfer facts', () => {
    const v = donorInspector(
      request({
        state: 'CANCELLED',
        outcome: 'CANCELLED',
        outcomeAt: `${T}10:00:00`,
        fulfilledAt: `${T}09:25:00`,
        transferStoNo: '4500001234',
        transferredAt: `${T}09:40:00`,
      }),
      NOW,
    )
    expect(v.transfer?.stoNo).toBe('4500001234')
    expect(v.row.cancelledAfterPicked).toBe(true)
  })
})

describe('moments', () => {
  it('newest first, each with who did it where the request records one', () => {
    const v = donorInspector(
      request({
        state: 'TRANSFERRED',
        changedBy: 'store.p019',
        changedAt: `${T}09:05:00`,
        fulfilledAt: `${T}09:25:00`,
        lockedBy: 'donor.d012',
        lockedAt: `${T}09:30:00`,
        transferredAt: `${T}09:40:00`,
      }),
      NOW,
    )
    expect(v.moments.map((m) => [m.kind, m.at, m.by])).toEqual([
      ['transferred', `${T}09:40:00`, ''],
      ['stamped', `${T}09:30:00`, 'donor.d012'],
      ['picked', `${T}09:25:00`, ''],
      ['edited', `${T}09:05:00`, 'store.p019'],
      ['raised', `${T}09:00:00`, 'store.p019'],
    ])
  })

  it('a moment whose time is unset is no moment', () => {
    expect(donorInspector(request(), NOW).moments.map((m) => m.kind)).toEqual(['raised'])
  })

  it('a request cancelled after its transfer shows both Transferred and Ended', () => {
    const v = donorInspector(
      request({
        state: 'CANCELLED',
        outcome: 'CANCELLED',
        outcomeBy: 'hq.lead',
        outcomeAt: `${T}10:00:00`,
        fulfilledAt: `${T}09:25:00`,
        transferredAt: `${T}09:40:00`,
      }),
      NOW,
    )
    expect(v.moments.map((m) => m.kind)).toEqual(['ended', 'transferred', 'picked', 'raised'])
    expect(v.moments[0].by).toBe('hq.lead')
  })

  it('at one time, the later moment comes first', () => {
    const v = donorInspector(request({ fulfilledAt: `${T}09:00:00` }), NOW)
    expect(v.moments.map((m) => m.kind)).toEqual(['picked', 'raised'])
  })
})

describe('open delivery', () => {
  it('goes to Document Details’ delivery route', () => {
    expect(donorInspector(request(), NOW).openTo).toBe('/oms/delivery/8000000500')
  })

  it('a request with no delivery number offers nowhere to go', () => {
    expect(donorInspector(request({ deliveryNo: '  ' }), NOW).openTo).toBeNull()
  })

  it('a delivery number is encoded into the path', () => {
    expect(donorInspector(request({ deliveryNo: 'A/1' }), NOW).openTo).toBe('/oms/delivery/A%2F1')
  })
})
