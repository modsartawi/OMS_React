/**
 * Ticket 453 — the `POST MaterialWeb/Stock` body the stock check (and 452's Stock tab) send,
 * exactly as the contract has it, and the MAT-00004 reading both screens branch on.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { isStockUnavailable, stockRequest } from './stock'

describe('stockRequest', () => {
  it('builds the exact contract body', () => {
    expect(stockRequest({ materials: ['101234', '100777'], stores: ['1001', '1002'], includeZero: false, includeClosed: false })).toEqual({
      materials: ['101234', '100777'],
      stores: ['1001', '1002'],
      includeZero: false,
      includeClosed: false,
    })
  })

  it('"All stores" is stores: null — never an empty list', () => {
    const body = stockRequest({ materials: ['101234'], stores: null, includeZero: false, includeClosed: false })
    expect(body.stores).toBeNull()
    expect(JSON.stringify(body)).toBe('{"materials":["101234"],"stores":null,"includeZero":false,"includeClosed":false}')
  })

  it('both toggles reach the body when on', () => {
    expect(stockRequest({ materials: ['101234'], stores: null, includeZero: true, includeClosed: true })).toMatchObject({
      includeZero: true,
      includeClosed: true,
    })
  })

  it('keeps numbers as strings with their leading zeros, trimmed and sent once, in order', () => {
    expect(stockRequest({ materials: [' 0100777', '101234', '0100777 ', ''], stores: ['0101', ' 1001', '0101'], includeZero: false, includeClosed: false })).toEqual({
      materials: ['0100777', '101234'],
      stores: ['0101', '1001'],
      includeZero: false,
      includeClosed: false,
    })
  })
})

describe('isStockUnavailable', () => {
  const refusal = (code: string) => new ApiError('server', 'x', 502, [{ errorCode: code, errorMessage: 'x', internalErrorCode: '' }])

  it('reads MAT-00004 only', () => {
    expect(isStockUnavailable(refusal('MAT-00004'))).toBe(true)
    expect(isStockUnavailable(refusal('MAT-00002'))).toBe(false)
    expect(isStockUnavailable(new Error('boom'))).toBe(false)
    expect(isStockUnavailable(null)).toBe(false)
  })
})
