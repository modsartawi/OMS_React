/**
 * The single-key switch's stored value (ticket 393, spec 380 K6): on by default, and
 * off only on the exact string the switch writes.
 */
import { describe, expect, it } from 'vitest'
import { parseSingleKeys } from './single-key-switch'

describe('parseSingleKeys', () => {
  it('defaults to on: nothing stored, or a value this store never writes', () => {
    expect(parseSingleKeys(null)).toBe(true)
    expect(parseSingleKeys('')).toBe(true)
    expect(parseSingleKeys('0')).toBe(true)
    expect(parseSingleKeys('true')).toBe(true)
  })

  it('is off only on the "false" the switch writes', () => {
    expect(parseSingleKeys('false')).toBe(false)
  })
})
