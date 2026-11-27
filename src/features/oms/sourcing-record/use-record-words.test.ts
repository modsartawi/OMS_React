/**
 * The store record's rates (ticket 969; review 2 #7): the model reads them to two decimals, so the screen shows them to
 * two as well — close rates that cost differently never look equal.
 */
import { describe, expect, it } from 'vitest'
import { percent } from './use-record-words'

describe('a rate on the store record', () => {
  it('shows as a percent to two decimals', () => {
    expect(percent(0.0314)).toBe('3.14%')
    expect(percent(0.0318)).toBe('3.18%')
    expect(percent(0.5)).toBe('50.00%')
  })

  it('shows nothing when the door sent none', () => {
    expect(percent(null)).toBe('')
    expect(percent(undefined)).toBe('')
  })
})
