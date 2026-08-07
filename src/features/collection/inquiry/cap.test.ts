import { describe, expect, it } from 'vitest'
import { isCapReached } from './cap'
import { COLLECTIONS_LIMIT } from './collections-criteria'

// Ticket 254's cap Proof: the banner fires when the result REACHED the cap and
// stays silent when it is merely large. The distinction is the whole point — a
// warning that cries wolf at "nearly 2,000" is a warning nobody reads on the day
// rows really are missing.
describe('isCapReached', () => {
  it('fires at exactly the cap', () => {
    expect(isCapReached(COLLECTIONS_LIMIT, COLLECTIONS_LIMIT)).toBe(true)
  })

  it('stays silent one row below it', () => {
    expect(isCapReached(COLLECTIONS_LIMIT - 1, COLLECTIONS_LIMIT)).toBe(false)
  })

  it('stays silent on a merely large result', () => {
    expect(isCapReached(1_900, COLLECTIONS_LIMIT)).toBe(false)
    expect(isCapReached(1_500, COLLECTIONS_LIMIT)).toBe(false)
  })

  it('stays silent on an ordinary day, and on an empty one', () => {
    expect(isCapReached(347, COLLECTIONS_LIMIT)).toBe(false)
    expect(isCapReached(0, COLLECTIONS_LIMIT)).toBe(false)
  })

  it('still fires if the door over-served — something was truncated either way', () => {
    expect(isCapReached(COLLECTIONS_LIMIT + 1, COLLECTIONS_LIMIT)).toBe(true)
  })

  it('never fires on a nonsense cap rather than banner-ing every result', () => {
    expect(isCapReached(10, 0)).toBe(false)
    expect(isCapReached(10, Number.NaN)).toBe(false)
    expect(isCapReached(Number.NaN, COLLECTIONS_LIMIT)).toBe(false)
  })
})
