import { describe, expect, it } from 'vitest'
import { seriesColour, seriesDash } from './slots'

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
