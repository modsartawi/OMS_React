/**
 * Oms 922 — how a time span and a distance read on the list and the route ("312 km · 1 h 40 min"). The words are the
 * locale's (`duration.*`, `units.*`); these pick which words and the figures they carry, in Latin digits.
 */
import { describe, expect, it } from 'vitest'
import { durationWords, kmFigure, speedFigure } from './units'

describe('a duration, in its largest two units', () => {
  it.each([
    [0, { key: 'minutes', m: 0 }],
    [45, { key: 'minutes', m: 45 }],
    [60, { key: 'hours', h: 1 }],
    [100, { key: 'hoursMinutes', h: 1, m: 40 }],
    [1439, { key: 'hoursMinutes', h: 23, m: 59 }],
    [1440, { key: 'days', d: 1 }],
    [1905, { key: 'daysHours', d: 1, h: 7 }],
    [2880, { key: 'days', d: 2 }],
    [3525, { key: 'daysHours', d: 2, h: 10 }],
  ] as const)('%i minutes', (minutes, words) => {
    expect(durationWords(minutes)).toEqual(words)
  })

  it('a part of a minute rounds; a negative or unreadable span is no time', () => {
    expect(durationWords(99.6)).toEqual({ key: 'hoursMinutes', h: 1, m: 40 })
    expect(durationWords(-5)).toEqual({ key: 'minutes', m: 0 })
    expect(durationWords(Number.NaN)).toEqual({ key: 'minutes', m: 0 })
  })
})

describe('a distance in km', () => {
  it('under 10 km keeps a tenth; from 10 km it is whole, grouped', () => {
    expect(kmFigure(4.62)).toBe('4.6')
    expect(kmFigure(0)).toBe('0.0')
    expect(kmFigure(9.96)).toBe('10')
    expect(kmFigure(312.4)).toBe('312')
    expect(kmFigure(1234.5)).toBe('1,235')
  })
})

describe('a speed in km/h', () => {
  it('is whole, grouped', () => {
    expect(speedFigure(187.44)).toBe('187')
    expect(speedFigure(1500.2)).toBe('1,500')
  })
})
