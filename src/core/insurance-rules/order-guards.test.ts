/** Ticket 616 — an order's guard state, and the two OMS grants the guard dialog reads (fail closed). */
import { describe, expect, it } from 'vitest'
import { canOverrideGuard, canReleaseGuardHold, guardHeld } from './order-guards'

describe('order guards', () => {
  it('an order is held while its guard check needs an action or is pending', () => {
    expect([guardHeld('actionNeeded'), guardHeld('pending'), guardHeld('unchecked'), guardHeld('none'), guardHeld(undefined)]).toEqual([
      true,
      true,
      false,
      false,
      false,
    ])
  })

  it('the override and release grants are denied: the one permissions answer cannot carry INS_GUARD (914, brief row 43)', () => {
    expect([canOverrideGuard(), canReleaseGuardHold()]).toEqual([false, false])
  })
})
