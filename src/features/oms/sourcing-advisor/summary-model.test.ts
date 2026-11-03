import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { SourcingSummaryReply } from '@/core/models/sourcing-advisor'
import { summaryModel, refusedScoredThrough } from './summary-model'

const reply = (over: Partial<SourcingSummaryReply> = {}): Partial<SourcingSummaryReply> => ({
  orders: 1240,
  ordersWithSaving: 312,
  totalSaving: 2808.456,
  avgSaving: 9.0015,
  byCity: [{ key: 'Riyadh', orders: 800, ordersWithSaving: 200, totalSaving: 1800, avgSaving: 9 }],
  byChannel: [{ key: 'HYBR', orders: 0, ordersWithSaving: 0, totalSaving: 0, avgSaving: null }],
  byDeliveryType: [],
  top: [
    { orderNo: '8000000253', actualStore: 'P007', actualStoreName: 'Malaz', bestStore: 'P002', saving: 41.5, reasons: ['NEARER_STORE_STOCKED', 'NEW_CODE'] },
  ],
  rateVersion: 'placeholder-2026-11',
  placeholderRates: true,
  scoredThrough: '2026-11-02',
  ...over,
})

describe('sourcingSummaryModel_passesFiguresThroughAndFlagsPlaceholders', () => {
  it('🚩 the headline is the door\'s figures as sent; SAR to the halala, never re-summed', () => {
    const m = summaryModel(reply(), '2026-11-02')
    expect(m.headline).toEqual({ orders: 1240, ordersWithSaving: 312, share: 25.2, totalSaving: '2808.46', avgSaving: '9.00' })
    expect(m.placeholderRates).toBe(true)
    expect(m.rateVersion).toBe('placeholder-2026-11')
  })

  it('🚩 the share is shown only when orders > 0', () => {
    expect(summaryModel(reply({ orders: 0, ordersWithSaving: 0 }), '2026-11-02').headline.share).toBeNull()
    expect(summaryModel(reply(), '2026-11-02').byChannel[0].share).toBeNull()
    expect(summaryModel(reply(), '2026-11-02').byCity[0]).toEqual({ key: 'Riyadh', orders: 800, ordersWithSaving: 200, share: 25, totalSaving: 1800, avgSaving: 9 })
  })

  it('🚩 an absent breakdown or top list reads as empty, and a bare reply draws an empty page', () => {
    const m = summaryModel(reply({ byCity: undefined, top: undefined }), '2026-11-02')
    expect(m.byCity).toEqual([])
    expect(m.top).toEqual([])
    const bare = summaryModel(null, '2026-11-02')
    expect(bare.headline).toEqual({ orders: null, ordersWithSaving: null, share: null, totalSaving: null, avgSaving: null })
    expect(bare.byDeliveryType).toEqual([])
    expect(bare.placeholderRates).toBe(false)
  })

  it('a top order: code · name pairs (the code alone without a name), its saving and its reason keys', () => {
    const [row] = summaryModel(reply(), '2026-11-02').top
    expect(row).toEqual({
      rowId: '0:8000000253',
      orderNo: '8000000253',
      actualStore: 'P007 · Malaz',
      bestStore: 'P002',
      saving: 41.5,
      reasons: [
        { code: 'NEARER_STORE_STOCKED', key: 'reasons.nearerStoreStocked' },
        { code: 'NEW_CODE', key: 'reasons.unknown' },
      ],
    })
  })

  it('every top row has its own id, even for a blank or repeated order number', () => {
    const top = [
      { orderNo: '8000000253', actualStore: 'P1', bestStore: 'P2', saving: 3, reasons: [] },
      { orderNo: '8000000253', actualStore: 'P1', bestStore: 'P2', saving: 2, reasons: [] },
      { orderNo: '', actualStore: 'P1', bestStore: 'P2', saving: 1, reasons: [] },
      { orderNo: '  ', actualStore: 'P1', bestStore: 'P2', saving: 1, reasons: [] },
    ]
    expect(summaryModel(reply({ top }), '2026-11-02').top.map((r) => r.rowId)).toEqual(['0:8000000253', '1:8000000253', '2:', '3:'])
  })

  it('at most 50 top orders, in the order sent', () => {
    const top = Array.from({ length: 60 }, (_, i) => ({ orderNo: String(i), actualStore: 'P1', bestStore: 'P2', saving: 60 - i, reasons: [] }))
    const m = summaryModel(reply({ top }), '2026-11-02')
    expect(m.top).toHaveLength(50)
    expect(m.top[49].orderNo).toBe('49')
  })

  it('"scored through" shows only when the range runs past what the nightly job has scored', () => {
    expect(summaryModel(reply({ scoredThrough: '2026-11-02' }), '2026-11-02').scoredThrough).toBeNull()
    expect(summaryModel(reply({ scoredThrough: '2026-10-30' }), '2026-11-02').scoredThrough).toBe('2026-10-30')
    expect(summaryModel(reply({ scoredThrough: null }), '2026-11-02').scoredThrough).toBeNull()
  })

  it('SOURCING-404 carries its scoredThrough in the refusal\'s data', () => {
    const refusal = (code: string, data: unknown) =>
      new ApiError('business', 'words', 409, [{ errorCode: code, internalErrorCode: '', errorMessage: 'words' }], data)
    expect(refusedScoredThrough(refusal('SOURCING-404', { scoredThrough: '2026-10-30' }))).toBe('2026-10-30')
    expect(refusedScoredThrough(refusal('SOURCING-404', null))).toBe('')
    expect(refusedScoredThrough(refusal('SOURCING-402', { scoredThrough: '2026-10-30' }))).toBeNull()
  })
})
