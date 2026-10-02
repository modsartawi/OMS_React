import { describe, expect, it } from 'vitest'
import { parseRailExpanded } from './rail-preference'

describe('parseRailExpanded', () => {
  it('rail expand preference reads collapsed when missing or malformed', () => {
    // Missing: a first visit, a cleared store, a browser that refuses storage.
    expect(parseRailExpanded(null)).toBe(false)
    expect(parseRailExpanded('')).toBe(false)
    // Malformed: anything this app did not write itself.
    for (const raw of ['yes', '1', 'TRUE', ' true', '"true"', '{"expanded":true}', 'null', 'expanded'])
      expect(parseRailExpanded(raw), raw).toBe(false)
  })

  it('reads the two values the store writes', () => {
    expect(parseRailExpanded('true')).toBe(true)
    expect(parseRailExpanded('false')).toBe(false)
  })
})
