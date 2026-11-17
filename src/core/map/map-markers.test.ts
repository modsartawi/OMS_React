import { describe, expect, it } from 'vitest'
import { markerHits, markerLook } from './map-markers'
import { openMapPanel, type MapEngine, type MapEngineEvents, type MapEngineStart, type MapPoint } from './map-panel'
import { GROUP_INK, pointRadius, POINT_RADIUS, type MapCardState } from './map-drawing'

// Ticket 909 (BackOffice spec 3630 M15-M20, M23, seam 6; ADR 0139): what the Google adapter puts on the map for each
// feature the panel hands it, and how it reports the reader's pointer and taps. Google itself is not touched: the
// marker's look is read as the style the adapter sets, and the hits are played into the real panel through a stand-in.

const MAPS = { key: 'planted-test-key' }
const inkOf = (token: string) => `ink(${token})`

const OLAYA_1: MapPoint = { id: 'R001', lon: 46.6853, lat: 24.6943, size: 1, weight: 1200.5, ink: '--map-better' }
const OLAYA_2: MapPoint = { id: 'R002', lon: 46.6871, lat: 24.6961, size: 0.25, weight: 300.25, ink: '--map-worse' }
const OLAYA_3: MapPoint = { id: 'R003', lon: 46.6839, lat: 24.6922, size: 0, hollow: true, weight: -40, ink: '--map-same' }
const JEDDAH: MapPoint = { id: 'J001', lon: 39.172, lat: 21.543, size: 0.5, weight: 700, ink: '--map-same' }
const STORES = [OLAYA_1, OLAYA_2, OLAYA_3, JEDDAH]
const COUNTRY = 5
const STREET = 17

function opened(over: Partial<Parameters<typeof openMapPanel>[0]> = {}) {
  let start: MapEngineStart | null = null
  let events: MapEngineEvents | null = null
  const zooms: number[] = []
  const engine: MapEngine = {
    start(s, ev) {
      start = s
      events = ev
      return { destroy: () => {}, zoomTo: (_lon, _lat, zoom) => void zooms.push(zoom), fit: () => {}, project: (x, y) => ({ x, y }) }
    },
  }
  const cards: MapCardState[] = []
  openMapPanel({ engine, container: null, points: STORES, lang: 'en', dir: 'ltr', maps: MAPS, inkOf, onDrawn: () => {}, onCannotDraw: () => {}, onCard: (c) => cards.push(c), ...over })
  return { start: start!, events: events!, cards, zooms }
}

const featureAt = (start: MapEngineStart, zoom: number, id: string) => start.featuresAt(zoom).find((f) => f.id === id)!

describe('each point reaches the map at its radius, colour and hollow state (M15, M16)', () => {
  it('a filled point is a circle of its own radius, filled with its colour, ringed by the ring ink', () => {
    const { start } = opened()
    const look = markerLook(featureAt(start, STREET, 'R002'), 'ink(--map-group-ink)')
    expect(look.style.width).toBe(`${2 * pointRadius(0.25)}px`)
    expect(look.style.height).toBe(`${2 * pointRadius(0.25)}px`)
    expect(look.style.background).toBe('ink(--map-worse)')
    expect(look.style.border).toBe('1px solid ink(--map-ring)')
    expect(look.style.borderRadius).toBe('50%')
    expect(look.label).toBe('')
  })

  it('the largest share is the largest circle', () => {
    const { start } = opened()
    expect(markerLook(featureAt(start, STREET, 'R001'), '').style.width).toBe(`${2 * POINT_RADIUS.max}px`)
  })

  it('a hollow point is the smallest circle with no fill and its own colour as the ring', () => {
    const { start } = opened()
    const look = markerLook(featureAt(start, STREET, 'R003'), '')
    expect(look.style.width).toBe(`${2 * POINT_RADIUS.min}px`)
    expect(look.style.background).toBe('transparent')
    expect(look.style.border).toBe('2px solid ink(--map-same)')
  })

  it('a larger circle lies beneath a smaller one, so no point hides another', () => {
    const { start } = opened()
    const big = Number(markerLook(featureAt(start, STREET, 'R001'), '').style.zIndex)
    const small = Number(markerLook(featureAt(start, STREET, 'R003'), '').style.zIndex)
    expect(big).toBeLessThan(small)
  })
})

describe("a group is drawn in one neutral colour with its count, and its sum only for an additive size (M19, M20)", () => {
  const groupOf = (start: MapEngineStart) => start.featuresAt(COUNTRY).find((f) => f.kind === 'group')!

  it('the count alone for a rate, on the neutral colour whatever its members’ colours', () => {
    const { start } = opened({ grouping: { sums: false, formatSum: (n) => `sum ${n}` } })
    const look = markerLook(groupOf(start), 'ink(--map-group-ink)')
    expect(look.label).toBe('3')
    expect(look.style.background).toBe(`ink(${GROUP_INK})`)
    expect(look.style.color).toBe('ink(--map-group-ink)')
  })

  it('the count and the sum on a second line for an additive size', () => {
    const { start } = opened({ grouping: { sums: true, formatSum: (n) => `sum ${n}` } })
    const look = markerLook(groupOf(start), 'ink(--map-group-ink)')
    expect(look.label).toBe('3\nsum 1460.75')
    expect(look.style.whiteSpace).toBe('pre')
  })

  it('a group’s words are set in the app’s face, the one their room is measured for, not Google’s Roboto (review G8)', () => {
    const { start } = opened()
    expect(markerLook(groupOf(start), '').style.fontFamily).toBe('var(--font-sans)')
  })

  it('a group is drawn above the points, so a point never covers its words', () => {
    const { start } = opened()
    const group = Number(markerLook(groupOf(start), '').style.zIndex)
    const point = Number(markerLook(featureAt(start, COUNTRY, 'J001'), '').style.zIndex)
    expect(group).toBeGreaterThan(point)
  })
})

describe("the card rules of 881 hold through the Google adapter's pointer and tap events (M23)", () => {
  it('pointing shows, pointing away hides, a tap pins, a tap on the map beside closes', () => {
    const { events, cards } = opened()
    let ms = 0
    const hits = markerHits(events, () => STREET, () => ms)
    hits.enter('R001', STREET, { x: 120, y: 80 })
    hits.leave(STREET)
    hits.click('R001', STREET, { x: 120, y: 80 })
    hits.leave(STREET)
    // A second, later tap on the map beside the store.
    ms += 2000
    hits.mapClick()
    expect(cards).toEqual([{ id: 'R001', x: 120, y: 80, pinned: false }, null, { id: 'R001', x: 120, y: 80, pinned: true }, null])
  })

  it('a tap on another store pins that one', () => {
    const { events, cards } = opened()
    const hits = markerHits(events, () => STREET)
    hits.click('R001', STREET, { x: 1, y: 2 })
    hits.click('J001', STREET, { x: 3, y: 4 })
    expect(cards.at(-1)).toEqual({ id: 'J001', x: 3, y: 4, pinned: true })
  })

  it('the map’s own click for the same tap as a store does not close the card it pinned', () => {
    const { events, cards } = opened()
    const ms = 5000
    const hits = markerHits(events, () => STREET, () => ms)
    hits.click('R001', STREET, { x: 1, y: 2 })
    hits.mapClick()
    expect(cards).toEqual([{ id: 'R001', x: 1, y: 2, pinned: true }])
  })

  it('a click on a group eases to the zoom where it opens, and shows no card', () => {
    const { start, events, cards, zooms } = opened()
    const g = start.featuresAt(COUNTRY).find((f) => f.kind === 'group')!
    const hits = markerHits(events, () => COUNTRY)
    hits.enter(g.id, COUNTRY, { x: 5, y: 5 })
    hits.click(g.id, COUNTRY, { x: 5, y: 5 })
    expect(cards).toEqual([])
    expect(zooms).toHaveLength(1)
    expect(zooms[0]).toBeGreaterThan(COUNTRY)
  })

  it('markers redrawn while one is pointed at take its card away: the element under the pointer is gone (review G5)', () => {
    const { events, cards } = opened()
    const hits = markerHits(events, () => STREET)
    hits.enter('R001', STREET, { x: 7, y: 9 })
    hits.redrawn()
    expect(cards).toEqual([{ id: 'R001', x: 7, y: 9, pinned: false }, null])
  })

  it('markers redrawn with none pointed at, or after the pointer left, change nothing; a pinned card stays (review G5)', () => {
    const { events, cards } = opened()
    const hits = markerHits(events, () => STREET)
    hits.redrawn()
    hits.enter('R001', STREET, { x: 7, y: 9 })
    hits.leave(STREET)
    hits.redrawn()
    hits.click('J001', STREET, { x: 3, y: 4 })
    hits.redrawn()
    expect(cards).toEqual([{ id: 'R001', x: 7, y: 9, pinned: false }, null, { id: 'J001', x: 3, y: 4, pinned: true }])
  })

  it('a hit is read against the zoom its marker was drawn at, not the zoom the map has reached since (review W8)', () => {
    const { events, cards } = opened()
    // R001 drawn as a point at street zoom; the map has meanwhile zoomed out to where it is inside a group.
    const hits = markerHits(events, () => COUNTRY)
    hits.enter('R001', STREET, { x: 7, y: 9 })
    expect(cards).toEqual([{ id: 'R001', x: 7, y: 9, pinned: false }])
  })
})
