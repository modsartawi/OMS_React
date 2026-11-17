/**
 * The print page's maps (oms-react 883, BackOffice spec 3630 M37, M38): the report print page says it is ready for the
 * renderer only once every map on it has drawn, or has fallen back to its table (it cannot draw, or has not drawn in
 * 20 seconds). A report with no map is ready exactly as before.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { createPrintMaps, MAP_PRINT_TIMEOUT_MS, printReady } from './print-maps'

describe('the print page waits for its maps', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('says ready only after both of its two maps have drawn', () => {
    const maps = createPrintMaps()
    maps.join('m1')
    maps.join('m2')
    const ready = () => printReady({ idle: true, settledAt: maps.revision(), maps })
    expect(ready()).toBe(false)
    maps.drawn('m1')
    expect(ready()).toBe(false)
    maps.drawn('m2')
    expect(ready()).toBe(true)
    expect(maps.state('m1')).toBe('drawn')
    expect(maps.state('m2')).toBe('drawn')
  })

  it('a map that cannot draw falls back to its table, and the page becomes ready', () => {
    const maps = createPrintMaps()
    maps.join('m1')
    maps.join('m2')
    maps.drawn('m1')
    maps.cannotDraw('m2')
    expect(maps.state('m2')).toBe('fell-back')
    expect(printReady({ idle: true, settledAt: maps.revision(), maps })).toBe(true)
  })

  it('a map that has not drawn after 20 seconds falls back the same way', () => {
    const maps = createPrintMaps()
    const told: string[] = []
    maps.subscribe(() => told.push(maps.state('m1')))
    maps.join('m1')
    vi.advanceTimersByTime(19_999)
    expect(maps.state('m1')).toBe('drawing')
    expect(printReady({ idle: true, settledAt: maps.revision(), maps })).toBe(false)
    vi.advanceTimersByTime(1)
    expect(maps.state('m1')).toBe('fell-back')
    expect(told.at(-1)).toBe('fell-back')
    expect(printReady({ idle: true, settledAt: maps.revision(), maps })).toBe(true)
    // A late "drawn" does not bring the map back: the table is what prints.
    maps.drawn('m1')
    expect(maps.state('m1')).toBe('fell-back')
    expect(MAP_PRINT_TIMEOUT_MS).toBe(20_000)
  })

  it('a map that falls back after it drew takes the ready marker down until the page has had its moment again (review G2)', () => {
    const maps = createPrintMaps()
    maps.join('m1')
    maps.drawn('m1')
    const latched = maps.revision()
    expect(printReady({ idle: true, settledAt: latched, maps })).toBe(true)
    // Google refuses the key after the tiles came: the map is swapped for its table, which must draw before the print.
    maps.cannotDraw('m1')
    expect(maps.settled()).toBe(true)
    expect(printReady({ idle: true, settledAt: latched, maps })).toBe(false)
    expect(printReady({ idle: true, settledAt: maps.revision(), maps })).toBe(true)
  })

  it('a map that drew in time is not changed by its 20 seconds running out', () => {
    const maps = createPrintMaps()
    maps.join('m1')
    maps.drawn('m1')
    vi.advanceTimersByTime(30_000)
    expect(maps.state('m1')).toBe('drawn')
  })

  it('a report with no map is ready exactly when it was before: no request in flight and the draw moment passed', () => {
    const maps = createPrintMaps()
    expect(printReady({ idle: false, settledAt: null, maps })).toBe(false)
    expect(printReady({ idle: true, settledAt: null, maps })).toBe(false)
    expect(printReady({ idle: false, settledAt: maps.revision(), maps })).toBe(false)
    expect(printReady({ idle: true, settledAt: maps.revision(), maps })).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a map block that left the page is no longer waited for, and closing stops every timer', () => {
    const maps = createPrintMaps()
    const leave = maps.join('m1')
    maps.join('m2')
    maps.drawn('m2')
    expect(maps.settled()).toBe(false)
    leave()
    expect(maps.settled()).toBe(true)
    maps.join('m3')
    expect(vi.getTimerCount()).toBe(1)
    maps.close()
    expect(vi.getTimerCount()).toBe(0)
  })

  // Review W3: React runs a child's effects before its parent's, so a map that cannot draw at all (no graphics) says so
  // before its block has joined. That ending is the map's ending, not a signal to drop.
  it('a "cannot draw" that arrives before the map joins is its ending: no 20-second wait', () => {
    const maps = createPrintMaps()
    maps.cannotDraw('m1')
    maps.join('m1')
    expect(maps.state('m1')).toBe('fell-back')
    expect(maps.settled()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a "drawn" that arrives first is kept the same way', () => {
    const maps = createPrintMaps()
    maps.drawn('m1')
    maps.join('m1')
    expect(maps.state('m1')).toBe('drawn')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('an early ending is used once: the block that leaves and joins again waits afresh', () => {
    const maps = createPrintMaps()
    maps.cannotDraw('m1')
    const leave = maps.join('m1')
    leave()
    maps.join('m1')
    expect(maps.state('m1')).toBe('drawing')
  })
})
