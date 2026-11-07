import { describe, expect, it } from 'vitest'
import { COURIERS, courierTableTracks, courierTrack, courierTracks, hidesPickUp, isOfferedCourier } from './courier-scope'

const lanes = [
  { track: 'delivery' as const, n: 1 },
  { track: 'pickUp' as const, n: 2 },
]

describe('a chosen courier hides what a pick-up owns', () => {
  it('offers the four live couriers, never the retired DAWA', () => {
    expect(COURIERS).toEqual(['FREY', 'OTOX', 'SMSA', 'SLNK'])
  })

  it('isOfferedCourier: one of the four, never all couriers, the retired DAWA nor a stray code', () => {
    for (const code of COURIERS) expect(isOfferedCourier(code)).toBe(true)
    for (const code of ['', 'DAWA', 'frey', 'XXXX']) expect(isOfferedCourier(code)).toBe(false)
  })

  it('under a courier the lanes and misses rows drop Pick-up, and the table offers no Pick-up view', () => {
    expect(hidesPickUp('FREY')).toBe(true)
    expect(courierTracks(lanes, 'FREY')).toEqual([{ track: 'delivery', n: 1 }])
    expect(courierTableTracks('FREY')).toEqual(['all', 'delivery'])
    // An unknown code still scopes: it is asked of the server for a courier.
    expect(courierTracks(lanes, 'NOPE')).toEqual([{ track: 'delivery', n: 1 }])
  })

  it('the pickUp table view reads as Delivery under a courier, and every other view as itself', () => {
    expect(courierTrack('pickUp', 'FREY')).toBe('delivery')
    expect(courierTrack('all', 'FREY')).toBe('all')
    expect(courierTrack('delivery', 'FREY')).toBe('delivery')
    expect(courierTrack('pickUp', '')).toBe('pickUp')
  })

  it('with all couriers nothing is hidden', () => {
    expect(hidesPickUp('')).toBe(false)
    expect(courierTracks(lanes, '')).toEqual(lanes)
    expect(courierTableTracks('')).toEqual(['all', 'delivery', 'pickUp'])
  })
})
