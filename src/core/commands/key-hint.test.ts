/**
 * A keyed button's hint (ticket 393, spec 380 K15): letter hints hide when the
 * single-key switch is off; a chord's never does.
 */
import { describe, expect, it } from 'vitest'
import { hintedKeys } from './key-hint'

describe('hintedKeys', () => {
  it('hints the key while the switch is on', () => {
    expect(hintedKeys('KeyR', true)).toBe('KeyR')
    expect(hintedKeys('Ctrl+Enter', true)).toBe('Ctrl+Enter')
  })

  it('🚩 hides a letter, `/` or `?` when the switch is off — that key does nothing then', () => {
    expect(hintedKeys('KeyR', false)).toBeNull()
    expect(hintedKeys('Slash', false)).toBeNull()
    expect(hintedKeys('Shift+Slash', false)).toBeNull()
  })

  it('keeps a chord’s and Esc’s hint when the switch is off', () => {
    expect(hintedKeys('Ctrl+Enter', false)).toBe('Ctrl+Enter')
    expect(hintedKeys('Escape', false)).toBe('Escape')
  })

  it('hints nothing for a command with no key', () => {
    expect(hintedKeys(undefined, true)).toBeNull()
    expect(hintedKeys(null, true)).toBeNull()
  })
})
