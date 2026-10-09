/**
 * Ticket 451 — the stock check's 50-material cap, said before the call (contract: MAT-00002 over
 * 50), and the link "check stock for selected" carries the ticked materials on.
 */
import { describe, expect, it } from 'vitest'
import { STOCK_MATERIAL_CAP, overStockCap, stockCheckHref } from './stock-cap'

const many = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i))

describe('the 50-material cap', () => {
  it('is 50: the 50th is allowed, the 51st refused', () => {
    expect(STOCK_MATERIAL_CAP).toBe(50)
    expect(overStockCap(50)).toBe(false)
    expect(overStockCap(51)).toBe(true)
  })
})

describe('stockCheckHref', () => {
  it('carries each material as a repeated `material` param, in order, leading zeros kept', () => {
    expect(stockCheckHref(['101234', '0100777'])).toBe('/materials/stock?material=101234&material=0100777')
  })

  it('carries a material once', () => {
    expect(stockCheckHref(['1', '1', ' 1 '])).toBe('/materials/stock?material=1')
  })

  it('exactly 50 is a link; 51 or none is not', () => {
    expect(stockCheckHref(many(50))).not.toBeNull()
    expect(stockCheckHref(many(51))).toBeNull()
    expect(stockCheckHref([])).toBeNull()
  })
})
