import { describe, expect, it } from 'vitest'

import { parseRecents, pushRecent, RECENT_LIMIT } from './recent-searches'

/**
 * Ticket 239's pure Proof: **a push moves an existing key to the front instead of
 * duplicating it, the cap holds at five, and a store that cannot be read is an
 * empty bar rather than a throw.**
 *
 * The second half is the half that matters. `parseRecents` reads a store a human
 * can edit in devtools and an older build may have written in another shape, and
 * it runs while the lookup screen renders — so every malformed input below is a
 * screen that would otherwise go white over a row of chips.
 */

describe('pushRecent', () => {
  it('puts the newest search at the front', () => {
    expect(pushRecent(['b'], 'a')).toEqual(['a', 'b'])
  })

  it('🚩 moves a repeat search to the front rather than storing it twice — the bar is members, not keystrokes', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
  })

  it('caps at five, dropping the oldest', () => {
    const full = ['1', '2', '3', '4', '5']
    expect(pushRecent(full, '6')).toEqual(['6', '1', '2', '3', '4'])
    expect(pushRecent(full, '6')).toHaveLength(RECENT_LIMIT)
  })

  it('stores the key as typed, trimmed of the whitespace a paste carries', () => {
    expect(pushRecent([], '  966501076360  ')).toEqual(['966501076360'])
  })

  it('never stores a blank — an unclickable chip is worse than no chip', () => {
    expect(pushRecent(['a'], '')).toEqual(['a'])
    expect(pushRecent(['a'], '   ')).toEqual(['a'])
  })

  it('does not mutate the list it was given', () => {
    const before = ['a', 'b']
    pushRecent(before, 'c')
    expect(before).toEqual(['a', 'b'])
  })
})

describe('parseRecents', () => {
  it('reads back what was written', () => {
    expect(parseRecents(JSON.stringify(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('is empty on an empty store', () => {
    expect(parseRecents(null)).toEqual([])
    expect(parseRecents('')).toEqual([])
  })

  it('🚩 is empty on text that is not JSON — never a throw, or the lookup screen goes with it', () => {
    expect(parseRecents('{ not json')).toEqual([])
  })

  it('🚩 is empty on JSON that is not an array — an older shape must not be read as one', () => {
    expect(parseRecents('{"keys":["a"]}')).toEqual([])
    expect(parseRecents('"a"')).toEqual([])
    expect(parseRecents('null')).toEqual([])
  })

  it('drops non-string and blank entries rather than rendering them as chips', () => {
    expect(parseRecents('["a", 7, null, "  ", "b"]')).toEqual(['a', 'b'])
  })

  it('caps a store that somehow holds more than five', () => {
    expect(parseRecents(JSON.stringify(['1', '2', '3', '4', '5', '6', '7']))).toHaveLength(
      RECENT_LIMIT,
    )
  })
})
