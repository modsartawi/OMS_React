/**
 * Ticket 666 — a Send refused for its checks (DHS-00018) names each refused row by our material
 * number, so the editor marks it on its row.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { rowRefusals } from './row-refusals'

const refusal = (data: unknown, code = 'DHS-00018') =>
  new ApiError('business', 'A check refuses. / فحص يرفض.', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'A check refuses.' }], data)

describe('rowRefusals', () => {
  it('reads each refused row of the check answer the refusal carries', () => {
    const err = refusal({
      sendable: false,
      header: [],
      rows: [
        { materialNumber: '101002', refusals: [{ code: 'NO_SKU', message: 'No HungerStation SKU for this material.' }], priceWarning: null },
        { materialNumber: '101003', refusals: [], priceWarning: { storeCodes: ['1001'] } },
      ],
      parts: [],
      skuCount: 2,
    })
    expect([...rowRefusals(err)]).toEqual([['101002', [{ code: 'NO_SKU', message: 'No HungerStation SKU for this material.' }]]])
  })

  it('nothing for another refusal, or a body it cannot read', () => {
    expect(rowRefusals(refusal({ rows: [{ materialNumber: '1', refusals: [{ code: 'X', message: 'm' }] }] }, 'DHS-00017')).size).toBe(0)
    expect(rowRefusals(refusal(null)).size).toBe(0)
    expect(rowRefusals(refusal({ rows: 'no' })).size).toBe(0)
    expect(rowRefusals(new Error('x')).size).toBe(0)
  })
})
