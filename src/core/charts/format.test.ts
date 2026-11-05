import { describe, expect, it } from 'vitest'
import { formatAs } from './format'

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
