/**
 * Ticket 545 — an HQ list row as the Open grid draws it, and the flag chips' counts. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { PrescriptionSessionHqList, PrescriptionSessionHqRow } from '@/core/models/prescription-session'
import { flagChips, openRow } from './open-row'

const row = (over: Partial<PrescriptionSessionHqRow> = {}): PrescriptionSessionHqRow => ({
  sessionId: '41',
  displayId: 'PS-41',
  sourceKind: 'NPHS',
  sourceKey: 'NP-778',
  beneficiaryId: '1012345678',
  beneficiaryName: 'Sara Ali',
  holdingStore: 'P001',
  otherStore: null,
  otherStoreReason: null,
  state: 'AWAITING_APPROVAL',
  route: 'DELIVERY',
  orderNo: '2000000601',
  step: { code: 'AWAIT_APPROVAL', label: 'Waiting on payer approval', owner: 'PAYER', waitingOn: null, isParked: false, parkNote: null, badges: [] },
  createdAt: '2026-10-10T09:00:00',
  ageDays: 14,
  idleSince: '2026-10-20T10:00:00',
  idleDays: 4,
  isStalled: false,
  isAboutToLapse: false,
  isOwed: false,
  lapsesAtEndOf: null,
  dispensedAt: null,
  invoiceOwedAt: null,
  openItems: [],
  hasOpenItem: false,
  ...over,
})

describe('openRow', () => {
  it('no other store reads as none', () => {
    expect(openRow(row()).otherStore).toBeNull()
  })

  it('the other store comes with its reason as a word', () => {
    expect(openRow(row({ otherStore: 'P002', otherStoreReason: 'DONOR' })).otherStore).toEqual({
      store: 'P002',
      reason: { key: 'otherStoreReason.DONOR', raw: 'DONOR' },
    })
    expect(openRow(row({ otherStore: 'P009', otherStoreReason: 'TRANSFER' })).otherStore?.reason.key).toBe('otherStoreReason.TRANSFER')
  })

  it('an other store with a reason this client does not know keeps the code', () => {
    expect(openRow(row({ otherStore: 'P002', otherStoreReason: 'LOAN' })).otherStore?.reason).toEqual({ key: null, raw: 'LOAN' })
  })

  it('a parked step is parked, with its note, and its owner is the customer', () => {
    const v = openRow(
      row({ step: { code: 'COLLECT', label: 'Customer collects', owner: 'CUSTOMER', waitingOn: null, isParked: true, parkNote: 'collects tomorrow', badges: [] } }),
    )
    expect(v.step).toMatchObject({ parked: true, parkNote: 'collects tomorrow', owner: { key: 'owner.CUSTOMER', raw: 'CUSTOMER' } })
  })

  it('a row with no step has none', () => {
    expect(openRow(row({ step: null })).step).toBeNull()
  })

  it('the lapse day is shown only while about to lapse', () => {
    expect(openRow(row({ isAboutToLapse: true, lapsesAtEndOf: '2026-10-26T00:00:00' })).lapseDay).toBe('2026-10-26T00:00:00')
    expect(openRow(row({ isAboutToLapse: false, lapsesAtEndOf: '2026-10-26T00:00:00' })).lapseDay).toBeNull()
  })

  it('open items are words, in server order; none is an empty list', () => {
    expect(openRow(row({ openItems: ['STALLED', 'INVOICE_OWED'], hasOpenItem: true })).openItems).toEqual([
      { key: 'openItem.STALLED', raw: 'STALLED' },
      { key: 'openItem.INVOICE_OWED', raw: 'INVOICE_OWED' },
    ])
    expect(openRow(row({ openItems: null as unknown as string[] })).openItems).toEqual([])
  })

  it('names the flags the row carries', () => {
    expect(openRow(row()).flags).toEqual([])
    expect(openRow(row({ isStalled: true, isOwed: true })).flags).toEqual(['STALLED', 'OWED'])
    expect(openRow(row({ isAboutToLapse: true })).flags).toEqual(['ABOUT_TO_LAPSE'])
  })

  it('state, source and route are words; a dispensed row is owed (warn)', () => {
    const v = openRow(row({ state: 'DISPENSED', sourceKind: 'WSFT', route: null }))
    expect(v.state).toEqual({ key: 'state.DISPENSED', raw: 'DISPENSED' })
    expect(v.stateSev).toBe('warn')
    expect(v.source.key).toBe('source.WSFT')
    expect(v.route.key).toBe('route.notChosen')
  })

  it('only a DISPENSED row offers the row-action slot (548’s write-off)', () => {
    expect(openRow(row({ state: 'DISPENSED' })).rowAction).toBe(true)
    expect(openRow(row({ state: 'PICKING' })).rowAction).toBe(false)
  })
})

describe('flagChips', () => {
  const list = (over: Partial<PrescriptionSessionHqList> = {}): PrescriptionSessionHqList => ({
    rows: [row({ isStalled: true })],
    total: 2400,
    stalled: 310,
    aboutToLapse: 12,
    owed: 87,
    isTruncated: true,
    ...over,
  })

  it('reads each count from the answer, never counted from the rows', () => {
    expect(flagChips(list(), '')).toEqual([
      { flag: 'STALLED', count: 310, pressed: false },
      { flag: 'ABOUT_TO_LAPSE', count: 12, pressed: false },
      { flag: 'OWED', count: 87, pressed: false },
    ])
  })

  it('marks the chip the filter holds', () => {
    expect(flagChips(list(), 'OWED').map((c) => c.pressed)).toEqual([false, false, true])
  })

  it('with no answer yet the counts are unknown (null)', () => {
    expect(flagChips(undefined, '').map((c) => c.count)).toEqual([null, null, null])
  })
})
