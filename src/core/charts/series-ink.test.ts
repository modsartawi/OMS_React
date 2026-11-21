import { describe, expect, it } from 'vitest'
import { FAINT_OPACITY, seriesColour, seriesDash, seriesInkOpacity } from './slots'

describe('seriesColour and seriesDash (ticket 877): the two comparisons read apart, in ink, never in a palette slot', () => {
  it('a series takes its slot colour; "Other" and the previous period stay ink grey', () => {
    expect(seriesColour({ slot: 1 })).toBe('var(--chart-2)')
    expect(seriesColour({ slot: null })).toBe('var(--ink-3)')
    expect(seriesColour({ slot: null, previous: true })).toBe('var(--ink-3)')
  })

  it('last year is the darker ink, so it is not the previous period’s grey', () => {
    expect(seriesColour({ slot: null, lastYear: true })).toBe('var(--muted-foreground)')
    expect(seriesColour({ slot: null, lastYear: true })).not.toBe(seriesColour({ slot: null, previous: true }))
  })

  it('on a line each comparison has its own dash, and a plain series none', () => {
    expect(seriesDash({ previous: true })).toBe('5 4')
    expect(seriesDash({ lastYear: true })).toBe('2 3')
    expect(seriesDash({})).toBeUndefined()
  })
})

describe('a faint or dashed series (oms 936): the other price source reads faint, a shelf price dashed, both in their own colour', () => {
  it('a faint series keeps its colour and draws at the faint opacity; a plain one at full', () => {
    expect(FAINT_OPACITY).toBe(0.4)
    expect(seriesColour({ slot: 2, faint: true })).toBe('var(--chart-3)')
    expect(seriesInkOpacity(null, { key: 'a', faint: true })).toBe(0.4)
    expect(seriesInkOpacity(null, { key: 'a' })).toBe(1)
    // under another series' highlight a faint series dims further, never brighter
    expect(seriesInkOpacity('b', { key: 'a', faint: true })).toBeCloseTo(0.1)
  })

  it('a dashed series has its own dash, apart from the two comparisons', () => {
    expect(seriesDash({ dashed: true })).toBe('6 3')
    expect(seriesDash({ dashed: true })).not.toBe(seriesDash({ previous: true }))
    expect(seriesDash({ faint: true })).toBeUndefined()
  })
})
