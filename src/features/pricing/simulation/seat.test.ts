import { describe, expect, it } from 'vitest'
import { seatOrigin } from './seat'

/**
 * The seat is the origin, and nothing else (BackOffice spec 4190, ticket 957). The engine's
 * bonus-buy pass filters by origin prefix and falls back to the plant when the origin is blank,
 * so the seat-to-origin mapping is the whole of the seat.
 */
describe('seat → origin', () => {
  it('Store till → null, Call center → C000, Mini POS → <plant>M, Custom → trimmed text', () => {
    expect(seatOrigin({ seat: 'store', plant: 'P001', customOrigin: 'X' })).toBeNull()
    expect(seatOrigin({ seat: 'callCenter', plant: 'P001', customOrigin: '' })).toBe('C000')
    expect(seatOrigin({ seat: 'miniPos', plant: 'P001', customOrigin: '' })).toBe('P001M')
    expect(seatOrigin({ seat: 'custom', plant: 'P001', customOrigin: '  W123 ' })).toBe('W123')
  })

  it('a blank Custom seat sends no origin, so the plant stays the origin', () => {
    expect(seatOrigin({ seat: 'custom', plant: 'P001', customOrigin: '   ' })).toBeNull()
  })

  it('the Mini POS origin follows a plant change', () => {
    expect(seatOrigin({ seat: 'miniPos', plant: 'P001', customOrigin: '' })).toBe('P001M')
    expect(seatOrigin({ seat: 'miniPos', plant: ' P245 ', customOrigin: '' })).toBe('P245M')
    // No plant, no Mini POS seat to name: the origin stays blank rather than a bare `M`.
    expect(seatOrigin({ seat: 'miniPos', plant: '  ', customOrigin: '' })).toBeNull()
  })
})
