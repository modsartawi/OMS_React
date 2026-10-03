import { describe, expect, it } from 'vitest'
import { backRefusal, canPost, composerState } from './composer'

/**
 * The note composer at the spine's Now line (spec 380 D8, D10; ticket 405; ruling 371 "Notes"):
 * what it holds decides whether it can post and whether Esc may leave the page.
 */
describe('composer can post only when non-empty, and Esc-back is refused while it holds unsent text', () => {
  it('reads empty, unsent or posting off the text and the post in flight', () => {
    expect(composerState('', false)).toBe('empty')
    expect(composerState('   \n\t', false)).toBe('empty')
    expect(composerState('Customer called', false)).toBe('unsent')
    expect(composerState('Customer called', true)).toBe('posting')
  })

  it('an empty composer cannot post — whitespace is not a note (083 D-11 kept)', () => {
    expect(canPost(composerState('', false))).toBe(false)
    expect(canPost(composerState('  ', false))).toBe(false)
    expect(canPost(composerState('Customer called', false))).toBe(true)
  })

  it('a note already posting cannot post a second time', () => {
    expect(canPost(composerState('Customer called', true))).toBe(false)
  })

  it('Esc goes back from an empty composer', () => {
    expect(backRefusal(composerState('', false))).toBeNull()
    expect(backRefusal(composerState(' ', false))).toBeNull()
  })

  it('Esc is refused while the composer holds unsent text, with the toast that says so', () => {
    expect(backRefusal(composerState('Customer called', false))).toBe('document:composer.unsentRefusal')
  })

  it('and while that text is still posting: it is not sent until the server says so', () => {
    expect(backRefusal(composerState('Customer called', true))).toBe('document:composer.unsentRefusal')
  })
})
