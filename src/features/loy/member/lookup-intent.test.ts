/**
 * The palette's member lookup (ticket 427) — which typed text is a member key at all,
 * and the one-shot router state that carries it to the lookup page.
 *
 * 🚩 The negatives are the point: words never become a member row, and anything in the
 * router state that is not a non-blank string is no lookup.
 */
import { describe, expect, it } from 'vitest'
import { memberLookupKeyOf, memberLookupOf, memberLookupState, withoutMemberLookup } from './lookup-intent'

describe('memberLookupKeyOf', () => {
  it.each([
    ['8801234567', '8801234567'],
    ['  0555000111 ', '0555000111'],
    // The field's own compaction decides, but the key travels as typed.
    ['+966 55 500 0111', '+966 55 500 0111'],
    ['055-500-0111', '055-500-0111'],
    ['(055) 500 0111', '(055) 500 0111'],
    // An Arabic layout's digits are folded to ASCII on the way, and only those.
    ['٠٥٥٥٠٠٠١١١', '0555000111'],
    ['+٩٦٦ ٥٥ ٥٠٠', '+966 55 500'],
  ])('%s is a member key, carried as %s', (query, key) => {
    expect(memberLookupKeyOf(query)).toBe(key)
  })

  it.each([[''], ['   '], ['deliv'], ['8000 deliv'], ['C-1000000034'], ['+'], ['--'], ['12.5']])(
    '🚩 %j is not a member key',
    (query) => {
      expect(memberLookupKeyOf(query)).toBeNull()
    },
  )
})

describe('the lookup router state', () => {
  it('round-trips the typed key', () => {
    expect(memberLookupOf(memberLookupState('+966 55 500 0111'))).toBe('+966 55 500 0111')
  })

  it.each([
    ['null', null],
    ['a string', '0555'],
    ['an array', ['0555']],
    ['no lookup', { typed: '0555' }],
    ['a number', { lookup: 555 }],
    ['a blank', { lookup: '   ' }],
  ])('🚩 %s is no lookup', (_, state) => {
    expect(memberLookupOf(state)).toBeNull()
  })

  it('withoutMemberLookup keeps the rest of the state, and is null when nothing is left', () => {
    expect(withoutMemberLookup({ lookup: '0555', from: 'x' })).toEqual({ from: 'x' })
    expect(withoutMemberLookup(memberLookupState('0555'))).toBeNull()
    const other = { typed: '0555' }
    expect(withoutMemberLookup(other)).toBe(other)
    expect(withoutMemberLookup(null)).toBeNull()
  })
})
