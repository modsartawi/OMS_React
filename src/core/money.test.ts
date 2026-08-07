import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/core/util/number-format'
import { CURRENCY_DECIMALS, currencyDecimals, formatMoneyIn } from './money'

/**
 * Ticket 237's first pure Proof bullet: **SAR renders 2dp, BHD renders 3dp, a
 * null currency degrades without throwing, and `formatMoney`'s existing 2dp
 * callers are untouched.**
 *
 * The last clause is why this suite reaches across to `@/core/util/number-format`
 * at the bottom: the decision this module encodes is as much "do not widen the
 * app's money formatter" as it is "format per currency", and a test that only
 * looked at the new module would let a later change satisfy it by editing the
 * old one.
 */
describe('currencyDecimals', () => {
  it('gives the riyal two decimals', () => {
    expect(currencyDecimals('SAR')).toBe(2)
  })

  it('🚩 gives the dinar THREE — Bahrain stores are live and BHD is the footprint’s only 3-decimal currency', () => {
    expect(currencyDecimals('BHD')).toBe(3)
  })

  it('reads a lowercase or padded code as the same currency', () => {
    expect(currencyDecimals('bhd')).toBe(3)
    expect(currencyDecimals(' Bhd ')).toBe(3)
  })

  it('falls back to two decimals for a currency the footprint does not know', () => {
    expect(currencyDecimals('USD')).toBe(2)
    expect(currencyDecimals('KWD')).toBe(2)
  })

  it('🚩 falls back to two decimals for the nullable column being empty — old rows carry no currency', () => {
    expect(currencyDecimals(null)).toBe(2)
    expect(currencyDecimals(undefined)).toBe(2)
    expect(currencyDecimals('')).toBe(2)
    expect(currencyDecimals('   ')).toBe(2)
  })

  it('states the footprint as a table rather than deriving it', () => {
    expect(CURRENCY_DECIMALS).toEqual({ BHD: 3 })
  })
})

describe('formatMoneyIn', () => {
  it('renders a riyal amount at two decimals', () => {
    expect(formatMoneyIn(12, 'SAR')).toBe('12.00')
    expect(formatMoneyIn(12.5, 'SAR')).toBe('12.50')
  })

  it('🚩 renders a dinar amount at three — a BHD line is not a SAR line with a different label', () => {
    expect(formatMoneyIn(12, 'BHD')).toBe('12.000')
    expect(formatMoneyIn(4.275, 'BHD')).toBe('4.275')
  })

  it('🚩 keeps a return line’s sign — the receipt is what is being matched, not tidied', () => {
    expect(formatMoneyIn(-12, 'SAR')).toBe('-12.00')
    expect(formatMoneyIn(-4.275, 'BHD')).toBe('-4.275')
  })

  it('🚩 never volunteers a sign on a positive figure — a sale is not `+12.00`', () => {
    expect(formatMoneyIn(12, 'SAR')).not.toContain('+')
    expect(formatMoneyIn(0, 'SAR')).toBe('0.00')
  })

  it('groups thousands so a four-figure line is readable', () => {
    expect(formatMoneyIn(1234.5, 'SAR')).toBe('1,234.50')
    expect(formatMoneyIn(1234.5, 'BHD')).toBe('1,234.500')
  })

  it('🚩 degrades on a null currency instead of throwing — the column is nullable in source', () => {
    expect(() => formatMoneyIn(12, null)).not.toThrow()
    expect(formatMoneyIn(12, null)).toBe('12.00')
    expect(formatMoneyIn(12, undefined)).toBe('12.00')
    expect(formatMoneyIn(12, '')).toBe('12.00')
  })

  it('renders a missing amount as blank rather than as a zero that reads like a fact', () => {
    expect(formatMoneyIn(null, 'SAR')).toBe('')
    expect(formatMoneyIn(undefined, 'SAR')).toBe('')
    expect(formatMoneyIn(Number.NaN, 'SAR')).toBe('')
    expect(formatMoneyIn(Number.POSITIVE_INFINITY, 'SAR')).toBe('')
  })
})

describe('the app-wide formatMoney is untouched', () => {
  it('🚩 stays fixed at two decimals — every existing caller means 2dp', () => {
    expect(formatMoney(12)).toBe('12.00')
    expect(formatMoney(4.5)).toBe('4.50')
    expect(formatMoney(null)).toBe('')
  })

  it('takes no currency argument at all, so no caller can widen it by accident', () => {
    expect(formatMoney.length).toBe(1)
  })
})
