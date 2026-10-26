import { describe, expect, it } from 'vitest'
import { formatFigure, formatMoney, formatMoney3 } from './number-format'

describe('formatMoney3', () => {
  it('shows exactly 3 decimals', () => {
    expect(formatMoney3(12.5)).toBe('12.500')
    expect(formatMoney3(0)).toBe('0.000')
    expect(formatMoney3(-2.25)).toBe('-2.250')
  })

  it('renders a missing or non-finite value as blank', () => {
    expect(formatMoney3(null)).toBe('')
    expect(formatMoney3(undefined)).toBe('')
    expect(formatMoney3(Number.NaN)).toBe('')
  })

  it('leaves formatMoney at its 2 decimals', () => {
    expect(formatMoney(12.5)).toBe('12.50')
  })
})

describe('formatFigure', () => {
  it('groups a count as figures are drawn across the app, in Latin digits', () => {
    expect(formatFigure(0)).toBe('0')
    expect(formatFigure(250)).toBe('250')
    expect(formatFigure(1234567)).toBe('1,234,567')
  })
})
