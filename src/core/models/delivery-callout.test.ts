import { describe, expect, it } from 'vitest'
import { CALLOUT_CLOSE_EVENT_KINDS, CALLOUT_EVENT_KINDS } from './delivery-callout'

describe('callout event kinds (spec 3326)', () => {
  it('the four closes after a take are callout event kinds, listed once', () => {
    expect(CALLOUT_CLOSE_EVENT_KINDS).toEqual(['StoreClosedAfterTake', 'CourierCancelledAfterTake', 'OtherClosedAfterTake', 'CloseRefused'])
    for (const kind of CALLOUT_CLOSE_EVENT_KINDS) expect(CALLOUT_EVENT_KINDS.filter((k) => k === kind)).toHaveLength(1)
  })
})
