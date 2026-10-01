import { describe, expect, it } from 'vitest'

import { hasChangeWaiting } from './entry-cells'
import { SETTLEMENT_OPEN_LANE } from './open-lane-fixture'

/**
 * Ticket 351 — the **change waiting** mark (spec 342 W10, BackOffice 2191's ledger field).
 *
 * 🔑 The whole rule is the wire's: `openChangeRequestId` is the waiting request's id, or
 * `''` when none. The mark reads that field and nothing else — never a status, never a
 * History read, never a guess from the figures.
 */
describe('hasChangeWaiting', () => {
  it('🔑 a row naming a waiting request is marked', () => {
    expect(hasChangeWaiting({ openChangeRequestId: '01K6G8Z3N4QH5V2C7M9R1T0XYB' })).toBe(true)
  })

  it("'' — the contract's own *none* — is not marked", () => {
    expect(hasChangeWaiting({ openChangeRequestId: '' })).toBe(false)
  })

  it('🚩 an SIS.Api older than the wave sends no field at all — absent reads as none, never a crash', () => {
    expect(hasChangeWaiting({})).toBe(false)
    expect(hasChangeWaiting({ openChangeRequestId: undefined })).toBe(false)
  })

  it('a grid cell with no row yet (AG Grid’s loading row) is not marked', () => {
    expect(hasChangeWaiting(undefined)).toBe(false)
    expect(hasChangeWaiting(null)).toBe(false)
  })

  it('the lane fixture holds both — so the drive can prove the mark is drawn only where set', () => {
    const marked = SETTLEMENT_OPEN_LANE.filter(hasChangeWaiting)
    expect(marked.length).toBeGreaterThan(0)
    expect(marked.length).toBeLessThan(SETTLEMENT_OPEN_LANE.length)
    // Every row carries the field, as 2191's door does — the absent case is the drive's.
    expect(SETTLEMENT_OPEN_LANE.every((r) => typeof r.openChangeRequestId === 'string')).toBe(true)
  })
})
