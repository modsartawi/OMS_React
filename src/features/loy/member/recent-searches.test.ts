import { describe, expect, it } from 'vitest'

import { forgetRemovedMobile, parseRecents, pushRecent, RECENT_LIMIT } from './recent-searches'

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

/**
 * Ticket 307's third pure bullet.
 *
 * 🚩 **The chips ARE customers' mobile numbers.** They hold the key the agent
 * typed, in `sessionStorage`, on a shared back-office workstation — so the number
 * an agent has just been asked to remove would otherwise sit in their session as
 * a chip that no longer resolves. Dropping it is the last half of honouring the
 * request.
 */
describe('forgetRemovedMobile', () => {
  it('🚩 drops the removed number from the bar', () => {
    expect(forgetRemovedMobile(['966555000111', '100004411'], '966555000111')).toEqual([
      '100004411',
    ])
  })

  it('🚩 drops it however the agent TYPED it — the chip is keystrokes, the number is a number', () => {
    // The bar stores what was typed, deliberately (239 decision 1), so the match
    // has to compact both sides — the same `compact` the lookup itself uses, not
    // a second spelling of it.
    expect(forgetRemovedMobile(['+966 555 000-111'], '966555000111')).toEqual([])
    expect(forgetRemovedMobile(['(966) 555000111'], '966555000111')).toEqual([])
  })

  it('leaves every other member alone', () => {
    expect(forgetRemovedMobile(['966555000222', '966555000111'], '966555000111')).toEqual([
      '966555000222',
    ])
  })

  it('🚩 a member found BY LOYALTY ID has no mobile chip, and the bar is untouched', () => {
    // Their loyalty-id chip still resolves after the removal — the member is
    // still there, and the id is now the only handle. Dropping it would take
    // away the one way back to them.
    expect(forgetRemovedMobile(['100001293'], '966555000111')).toEqual(['100001293'])
  })

  it('⚠️ does NOT catch a chip typed in another dialling form — a known limit, not an oversight', () => {
    // `0555000111` and `966555000111` are the same customer, and the browser
    // cannot know it: normalisation belongs to the door
    // (`LoyMobileNumbers.NormaliseTyped`), and a second spelling of that rule
    // here is how the bar starts disagreeing with the lookup about what a chip
    // means (decision 225 ruling 4, and `mobileChangeVerdict`'s same ruling).
    //
    // 🚩 This test exists so the gap is a STATED fact with a shape, rather than
    // something a later reader assumes is handled. The chips die with the tab
    // either way; closing it properly means the door telling us what it
    // normalised, which is a question for map 1396.
    expect(forgetRemovedMobile(['0555000111'], '966555000111')).toEqual(['0555000111'])
  })

  it('a member who had no number to remove changes nothing, and never throws', () => {
    expect(forgetRemovedMobile(['100001293'], null)).toEqual(['100001293'])
    expect(forgetRemovedMobile(['100001293'], '   ')).toEqual(['100001293'])
    expect(forgetRemovedMobile([], '966555000111')).toEqual([])
  })
})
