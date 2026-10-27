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

  it('the override and release grants are read only from an explicit true', () => {
    expect([canOverrideGuard({ canOverrideGuard: true }), canOverrideGuard({}), canOverrideGuard(null), canOverrideGuard({ canOverrideGuard: 'true' as never })]).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect([canReleaseGuardHold({ canReleaseGuardHold: true }), canReleaseGuardHold(undefined), canReleaseGuardHold({ canOverrideGuard: true })]).toEqual([
      true,
      false,
      false,
    ])
  })
})
