import { describe, expect, it } from 'vitest'
import type { FleetSummary } from '@/core/models/sap-export'
import { DOUBLE_SEND_FLAGS, FLEET_TILE_KEYS, STALE_AFTER_MINUTES, doubleSendsHref, fleetErrorKey, fleetTiles, isStale } from './fleet-helpers'
import en from '@/locales/en/sap-export-console.json'

const summary = (over: Partial<FleetSummary> = {}): FleetSummary => ({
  windowDays: 30,
  computedAt: '2026-10-11T08:00:00',
  stores: 212,
  tiles: {
    storesBehind: 4,
    storesStuck: 2,
    storesHeldForInventory: 1,
    doubleSent: 7,
    doubleSendPending: 3,
    accountingBreaks: 5,
    legacyStalled: 0,
  },
  ...over,
})

/** Local wall-clock, as the contract's times are. */
const at = (s: string) => new Date(s)

describe('fleetTiles', () => {
  it('draws the seven tiles in the ticket order, each reading its own field', () => {
    const { tiles } = fleetTiles(summary(), at('2026-10-11T08:10:00'))
    expect(tiles.map((t) => [t.key, t.count])).toEqual([
      ['storesBehind', 4],
      ['storesStuck', 2],
      ['storesHeldForInventory', 1],
      ['doubleSent', 7],
      ['doubleSendPending', 3],
      ['accountingBreaks', 5],
      ['legacyStalled', 0],
    ])
  })

  it('has a sentence in the bundle for every tile', () => {
    for (const tile of fleetTiles(summary(), at('2026-10-11T08:10:00')).tiles) {
      expect(tile.labelKey).toBe(`fleet.tiles.${tile.key}`)
      expect((en.fleet.tiles as Record<string, string>)[tile.key]).toBeTruthy()
    }
  })

  it('makes the three store tiles drive the label filter', () => {
    const byKey = Object.fromEntries(fleetTiles(summary(), at('2026-10-11T08:10:00')).tiles.map((t) => [t.key, t]))
    expect(byKey.storesBehind.action).toEqual({ kind: 'label', label: 'behind' })
    expect(byKey.storesStuck.action).toEqual({ kind: 'label', label: 'stuck' })
    expect(byKey.storesHeldForInventory.action).toEqual({ kind: 'label', label: 'heldForInventory' })
  })

  it('links the double-send tiles to the double-send list with the matching flag', () => {
    const byKey = Object.fromEntries(fleetTiles(summary(), at('2026-10-11T08:10:00')).tiles.map((t) => [t.key, t]))
    expect(byKey.doubleSent.action).toEqual({ kind: 'link', href: '/reports/sap-export/double-sends?flag=X1' })
    expect(byKey.doubleSendPending.action).toEqual({ kind: 'link', href: '/reports/sap-export/double-sends?flag=X1p' })
  })

  it('leaves the tiles the fleet door cannot filter on as plain counts', () => {
    const byKey = Object.fromEntries(fleetTiles(summary(), at('2026-10-11T08:10:00')).tiles.map((t) => [t.key, t]))
    expect(byKey.accountingBreaks.action).toEqual({ kind: 'none' })
    expect(byKey.legacyStalled.action).toEqual({ kind: 'none' })
  })

  it('colours the tiles by the label ruling: held for inventory is info, never danger', () => {
    const byKey = Object.fromEntries(fleetTiles(summary(), at('2026-10-11T08:10:00')).tiles.map((t) => [t.key, t]))
    expect(byKey.storesStuck.token).toBe('danger')
    expect(byKey.storesBehind.token).toBe('warningStrong')
    expect(byKey.storesHeldForInventory.token).toBe('info')
    expect(byKey.doubleSendPending.token).toBe('danger')
  })

  it('reads a zero tile as quiet', () => {
    const byKey = Object.fromEntries(fleetTiles(summary(), at('2026-10-11T08:10:00')).tiles.map((t) => [t.key, t]))
    expect(byKey.legacyStalled.quiet).toBe(true)
    expect(byKey.storesBehind.quiet).toBe(false)
  })

  it('carries the rollup stamp and flips the stale warning past 30 minutes', () => {
    expect(STALE_AFTER_MINUTES).toBe(30)
    const s = summary({ computedAt: '2026-10-11T08:00:00' })
    expect(fleetTiles(s, at('2026-10-11T08:29:59'))).toMatchObject({ computedAt: '2026-10-11T08:00:00', stale: false })
    expect(fleetTiles(s, at('2026-10-11T08:30:00')).stale).toBe(false)
    expect(fleetTiles(s, at('2026-10-11T08:30:01')).stale).toBe(true)
  })
})

describe('isStale', () => {
  it('reads an unreadable stamp as stale', () => {
    expect(isStale('not a time', at('2026-10-11T08:00:00'))).toBe(true)
  })

  it('does not call a rollup that never computed stale: it has no numbers, and the page says so', () => {
    expect(isStale(null, at('2026-10-11T08:00:00'))).toBe(false)
    expect(fleetTiles(summary({ computedAt: null }), at('2026-10-11T08:00:00'))).toMatchObject({ computedAt: null, stale: false })
  })

  it('reads the stamp as local wall-clock, never UTC', () => {
    // A stamp read as UTC would be hours off in Riyadh; local, it is ten minutes old.
    expect(isStale('2026-10-11T08:00:00', at('2026-10-11T08:10:00'))).toBe(false)
  })
})

describe('doubleSendsHref', () => {
  it('names the two double-send flags and every tile field once', () => {
    expect(DOUBLE_SEND_FLAGS).toEqual(['X1', 'X1p'])
    expect(FLEET_TILE_KEYS).toEqual(['storesBehind', 'storesStuck', 'storesHeldForInventory', 'doubleSent', 'doubleSendPending', 'accountingBreaks', 'legacyStalled'])
  })

  it('is the double-send list with its flag', () => {
    expect(doubleSendsHref('X1')).toBe('/reports/sap-export/double-sends?flag=X1')
    expect(doubleSendsHref('X1p')).toBe('/reports/sap-export/double-sends?flag=X1p')
  })
})

describe('fleetErrorKey', () => {
  it('names the fleet refusals, each with a sentence in the bundle', () => {
    for (const code of ['BAD_FILTER', 'BAD_PAGING']) {
      expect(fleetErrorKey(code)).toBe(`fleet.errors.${code}`)
      expect((en.fleet.errors as Record<string, string>)[code]).toBeTruthy()
    }
  })

  it('leaves any other code to the envelope message', () => {
    expect(fleetErrorKey('NO_STORE')).toBeNull()
    expect(fleetErrorKey(null)).toBeNull()
  })
})
