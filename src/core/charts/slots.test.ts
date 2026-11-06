import { describe, expect, it } from 'vitest'
import { seriesOpacity, seriesRowFill } from './slots'

describe('seriesRowFill (ticket 820): a row carries its own fill only when there is one series', () => {
  it('one series coloured by member: each row carries its member slot colour, Other in ink grey', () => {
    expect(seriesRowFill(1, 'member', 2)).toBe('var(--chart-3)')
    expect(seriesRowFill(1, 'member', 0)).toBe('var(--chart-1)')
    expect(seriesRowFill(1, 'member', null)).toBe('var(--ink-3)')
  })

  it('one series coloured singly: every row carries slot 0', () => {
    expect(seriesRowFill(1, 'single', 3)).toBe('var(--chart-1)')
    expect(seriesRowFill(1, 'single', null)).toBe('var(--chart-1)')
  })

  it('two or more series: no row fill, so each series colour applies', () => {
    expect(seriesRowFill(2, 'single', 0)).toBeUndefined()
    expect(seriesRowFill(2, 'member', 1)).toBeUndefined()
    expect(seriesRowFill(5, 'member', null)).toBeUndefined()
  })
})

describe('seriesOpacity (ticket 825): a legend click highlights by dimming the others, never recolouring', () => {
  it('is full for every series when nothing is highlighted, and for the highlighted one', () => {
    expect([seriesOpacity(null, 's0'), seriesOpacity(null, 's1')]).toEqual([1, 1])
    expect(seriesOpacity('s1', 's1')).toBe(1)
  })
  it('dims the series that are not highlighted', () => {
    expect(seriesOpacity('s1', 's0')).toBe(0.25)
  })
})
