import { describe, expect, it } from 'vitest'
import { formatAs, percentTicks } from './format'

// Intl writes a no-break space between a currency code or unit and the figure.
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('number formats by unit (766 story 43)', () => {
  it('each format reads as its name says, in Latin digits under Arabic too', () => {
    expect(formatAs(1234.5, 'integer', 'count', 'en')).toBe('1,235')
    expect(formatAs(1234.5, 'decimal', 'count', 'en')).toBe('1,234.50')
    expect(formatAs(0.256, 'percent', 'share', 'en')).toBe('25.6%')
    expect(plain(formatAs(1234.5, 'SAR', 'count', 'en'))).toBe('SAR 1,234.50')
    expect(plain(formatAs(42, 'minutes', 'count', 'en'))).toBe('42 min')
    expect(formatAs(1234.5, 'integer', 'count', 'ar')).toMatch(/^1[,٬]235$/)
  })

  it('auto follows the measure unit, and no value is empty', () => {
    expect(plain(formatAs(10, 'auto', 'SAR', 'en'))).toBe('SAR 10.00')
    expect(formatAs(0.5, 'auto', 'share', 'en')).toBe('50.0%')
    expect(formatAs(7, undefined, 'count', 'en')).toBe('7')
    expect(formatAs(null, 'integer', 'count', 'en')).toBe('')
  })
})

// Local walk 2026-11-10: a percent axis read 0%, 9%, 17%, 26%, 34% (Recharts split 0..34 into quarters).
describe('percentTicks: a percent axis in round steps', () => {
  it('rounds the top up to a whole step, at most five steps', () => {
    expect(percentTicks(0, 34)).toEqual([0, 10, 20, 30, 40])
    expect(percentTicks(0, 6)).toEqual([0, 2, 4, 6])
    expect(percentTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100])
    expect(percentTicks(0, 0.4)).toEqual([0, 0.1, 0.2, 0.3, 0.4])
  })
  it('reaches below zero for a negative value, and keeps zero', () => {
    expect(percentTicks(-12, 30)).toEqual([-20, -10, 0, 10, 20, 30])
    expect(percentTicks(0, 0)).toEqual([0])
  })
})
