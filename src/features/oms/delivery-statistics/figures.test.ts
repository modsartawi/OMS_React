import { describe, expect, it } from 'vitest'
import { hasFigure, readAverage, readFigure } from './figures'

const DASH = '—'

describe('readFigure', () => {
  it('🚩 a figure the server did not send reads as the dash, never 0', () => {
    expect(readFigure(undefined, DASH)).toBe(DASH)
    expect(readFigure(null, DASH)).toBe(DASH)
  })

  it('a real 0 reads as 0', () => {
    expect(readFigure(0, DASH)).toBe('0')
  })

  it('a count reads with its thousands grouped, in Western digits', () => {
    expect(readFigure(7, DASH)).toBe('7')
    expect(readFigure(422318, DASH)).toBe('422,318')
  })

  it('a value that is not a finite number reads as the dash', () => {
    expect(readFigure(Number.NaN, DASH)).toBe(DASH)
    expect(readFigure('12' as unknown as number, DASH)).toBe(DASH)
  })
})

describe('readAverage', () => {
  it('🚩 a null average (nothing handed over) reads as the dash, never 0', () => {
    expect(readAverage(null, DASH)).toBe(DASH)
    expect(readAverage(undefined, DASH)).toBe(DASH)
  })

  it('a real 0 reads as 0', () => {
    expect(readAverage(0, DASH)).toBe('0')
  })

  it('keeps at most two decimals, as the till rounds it', () => {
    expect(readAverage(87.456, DASH)).toBe('87.46')
    expect(readAverage(87.5, DASH)).toBe('87.5')
    expect(readAverage(1234, DASH)).toBe('1,234')
  })
})

describe('hasFigure', () => {
  it('is true for a real number, 0 included, and false for anything the readers show as the dash', () => {
    expect(hasFigure(0)).toBe(true)
    expect(hasFigure(87.5)).toBe(true)
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '87.5']) expect(hasFigure(v)).toBe(false)
  })
})
