/**
 * BackOffice ticket 3872 — the daily list's filters, URL, totals, store matrix and ages. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { HoldDailyListRow } from '@/core/models/hold-daily-list'
import { DEFAULT_FILTERS, filtersFromParams, filtersToParams, listQuery, rowsShown, kindTotals, storeMatrix, ageParts, isStale, causesOf, withKind } from './list'

const params = (qs: string) => new URLSearchParams(qs)

describe('the URL', () => {
  it('a bare URL is every kind of the fleet, on the held units', () => {
    expect(filtersFromParams(params(''))).toEqual(DEFAULT_FILTERS)
    expect(DEFAULT_FILTERS).toEqual({ tab: 'rows', kind: '', cause: '', stores: '', store: '' })
  })

  it('reads a kind, a cause, the stores and a drilled store, normalized', () => {
    expect(
      filtersFromParams(params('tab=stores&kind=donor_waits_gi&cause=transfer_failed&stores=p002, p001;p002&store=p001')),
    ).toEqual({ tab: 'stores', kind: 'DONOR_WAITS_GI', cause: 'TRANSFER_FAILED', stores: 'P002,P001', store: 'P001' })
  })

  it('an unknown tab, kind or cause reads as its default', () => {
    expect(filtersFromParams(params('tab=x&kind=SOLD&cause=NOPE'))).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips, writing only what is not the default', () => {
    const f = { tab: 'stores', kind: 'DELIVERED_NO_SALE', cause: 'STANDING', stores: 'P001,P002', store: 'P002' } as const
    expect(filtersToParams(f).toString()).toBe('tab=stores&kind=DELIVERED_NO_SALE&cause=STANDING&stores=P001%2CP002&store=P002')
    expect(filtersFromParams(filtersToParams(f))).toEqual(f)
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('')
  })

  it('the read sends the stores only: the kind narrows on the screen, so every tile keeps its count', () => {
    expect(listQuery({ ...DEFAULT_FILTERS, kind: 'OUT_OVER_3D', stores: 'P001' })).toEqual({ stores: 'P001' })
    expect(listQuery(DEFAULT_FILTERS)).toEqual({})
  })
})

export function row(over: Partial<HoldDailyListRow>): HoldDailyListRow {
  return {
    kind: 'SOLD_OVER_24H', cause: '', storeCode: 'P001', documentNo: 'D1', sourceType: 'OMS', sourceKey: '', documentState: '',
    lineNumber: 1, pickIndex: 0, itemNumber: 'M1', batch: 'B1', heldQuantity: 1, takeId: '', serialNumber: '', soldStore: '',
    soldTrx: '', requestNo: '', orderStore: '', donorStore: '', reference: '', since: '2026-11-13T08:00:00',
    firstListedAt: '2026-11-14T06:00:00', ...over,
  }
}

describe('the held units shown', () => {
  const rows = [
    row({ documentNo: 'A', kind: 'DONOR_WAITS_GI', cause: 'TRANSFER_FAILED', storeCode: 'P001' }),
    row({ documentNo: 'B', kind: 'DONOR_WAITS_GI', cause: 'SOLD_NOT_TRANSFERRED', storeCode: 'P002' }),
    row({ documentNo: 'C', kind: 'OUT_OVER_3D', storeCode: 'P001' }),
  ]
  const docs = (f: Partial<typeof DEFAULT_FILTERS>) => rowsShown(rows, { ...DEFAULT_FILTERS, ...f }).map((r) => r.documentNo)

  it("every row, in the door's order, when nothing narrows", () => {
    expect(docs({})).toEqual(['A', 'B', 'C'])
  })

  it('narrows by kind, by cause and by the drilled store, together', () => {
    expect(docs({ kind: 'DONOR_WAITS_GI' })).toEqual(['A', 'B'])
    expect(docs({ kind: 'DONOR_WAITS_GI', cause: 'TRANSFER_FAILED' })).toEqual(['A'])
    expect(docs({ store: 'P001' })).toEqual(['A', 'C'])
    expect(docs({ kind: 'OUT_OVER_3D', store: 'P002' })).toEqual([])
  })
})

describe('the tiles and the stores', () => {
  const counts = [
    { kind: 'RETURN_PO_OVER_30D', storeCode: 'P002', rows: 3, heldQuantity: 30 },
    { kind: 'SOLD_OVER_24H', storeCode: 'P001', rows: 2, heldQuantity: 2.5 },
    { kind: 'SOLD_OVER_24H', storeCode: 'P002', rows: 1, heldQuantity: 1 },
  ]

  it('each of the six kinds has its tile, zero when the door sent none', () => {
    expect(kindTotals(counts)).toEqual({
      SOLD_OVER_24H: { rows: 3, heldQuantity: 3.5 },
      DONOR_WAITS_GI: { rows: 0, heldQuantity: 0 },
      WAITING_OVER_1H: { rows: 0, heldQuantity: 0 },
      RETURN_PO_OVER_30D: { rows: 3, heldQuantity: 30 },
      OUT_OVER_3D: { rows: 0, heldQuantity: 0 },
      DELIVERED_NO_SALE: { rows: 0, heldQuantity: 0 },
    })
  })

  it('one line per store, a column per kind, ordered by store code', () => {
    expect(storeMatrix(counts)).toEqual([
      { storeCode: 'P001', rows: 2, heldQuantity: 2.5, SOLD_OVER_24H: 2, DONOR_WAITS_GI: 0, WAITING_OVER_1H: 0, RETURN_PO_OVER_30D: 0, OUT_OVER_3D: 0, DELIVERED_NO_SALE: 0 },
      { storeCode: 'P002', rows: 4, heldQuantity: 31, SOLD_OVER_24H: 1, DONOR_WAITS_GI: 0, WAITING_OVER_1H: 0, RETURN_PO_OVER_30D: 3, OUT_OVER_3D: 0, DELIVERED_NO_SALE: 0 },
    ])
  })
})

describe('ages', () => {
  it('how long a hold has stood, against the as-of, both local', () => {
    expect(ageParts('2026-11-10T08:00:00', '2026-11-14T10:30:00')).toEqual({ days: 4, hours: 2, minutes: 30 })
    expect(ageParts('2026-11-14T09:15:00', '2026-11-14T10:30:59')).toEqual({ days: 0, hours: 1, minutes: 15 })
  })

  it('no age for a blank or unreadable time, or one after the as-of', () => {
    expect(ageParts('', '2026-11-14T10:30:00')).toBeNull()
    expect(ageParts('0001-01-01T00:00:00', '2026-11-14T10:30:00')).toBeNull()
    expect(ageParts('2026-11-14T11:00:00', '2026-11-14T10:30:00')).toBeNull()
  })

  it('the list is stale once its fill is more than a day and two hours old, or was never filled', () => {
    expect(isStale('2026-11-14T06:00:00', '2026-11-15T08:00:00')).toBe(false)
    expect(isStale('2026-11-14T06:00:00', '2026-11-15T08:00:01')).toBe(true)
    expect(isStale(null, '2026-11-15T08:00:00')).toBe(true)
  })
})

describe('causes', () => {
  it('the kinds whose rows name a cause offer theirs, the rest none', () => {
    expect(causesOf('DONOR_WAITS_GI')).toEqual(['SOLD_NOT_TRANSFERRED', 'TRANSFER_FAILED'])
    expect(causesOf('DELIVERED_NO_SALE')).toEqual(['STANDING', 'ENDED_BY_SWEEP'])
    expect(causesOf('WAITING_OVER_1H')).toEqual(['UNTRACED'])
    expect(causesOf('SOLD_OVER_24H')).toEqual([])
    expect(causesOf('')).toEqual([])
  })

  it('a cause the new kind does not have is dropped when the kind changes, and the held units open', () => {
    const f = { ...DEFAULT_FILTERS, tab: 'stores', kind: 'DONOR_WAITS_GI', cause: 'TRANSFER_FAILED' } as const
    expect(withKind(f, 'DELIVERED_NO_SALE')).toEqual({ ...f, tab: 'rows', kind: 'DELIVERED_NO_SALE', cause: '' })
    expect(withKind(f, 'DONOR_WAITS_GI')).toEqual({ ...f, tab: 'rows' })
  })

  it("a URL cause that is not its kind's reads as none", () => {
    expect(filtersFromParams(new URLSearchParams('kind=SOLD_OVER_24H&cause=STANDING')).cause).toBe('')
    expect(filtersFromParams(new URLSearchParams('cause=STANDING')).cause).toBe('')
  })
})
