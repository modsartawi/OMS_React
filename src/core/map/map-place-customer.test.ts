/**
 * Ticket 962 (BackOffice spec 4354 §19: the map panel gains "a click places the customer"). A click on the map beside
 * every point hands the caller the place clicked; a click on a store does not. Driven through the panel's own logic
 * (`openMapPanel`, a stand-in engine) and the Google adapter's hit routing (`markerHits`), never Google or pixels. The
 * adapter's own `click` → place is in `google-engine.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { markerHits } from './map-markers'
import { openMapPanel, type MapEngine, type MapEngineEvents, type MapPlace } from './map-panel'

const MAPS = { key: 'planted-test-key' }
const STORE = { id: '1090', lon: 46.7386, lat: 24.7741, card: { title: 'Store 1090', subtitle: '', figures: [] } }

function standIn() {
  let events: MapEngineEvents | null = null
  const engine: MapEngine = {
    start(_start, ev) {
      events = ev
      return { destroy() {}, zoomTo() {}, fit() {}, project: (x, y) => ({ x, y }) }
    },
  }
  return {
    engine,
    get events() {
      if (!events) throw new Error('the engine was not started')
      return events
    },
  }
}

function open(onPlace?: (p: MapPlace) => void) {
  const e = standIn()
  const cards: unknown[] = []
  const panel = openMapPanel({
    engine: e.engine,
    container: null,
    points: [STORE],
    lang: 'en',
    dir: 'ltr',
    maps: MAPS,
    groupNearby: false,
    onDrawn() {},
    onCannotDraw() {},
    onCard: (c) => cards.push(c),
    ...(onPlace ? { onPlace } : {}),
  })
  return { e, panel, cards }
}

describe('a click on the map places the customer', () => {
  it('a click beside every point hands the caller the place clicked', () => {
    const placed: MapPlace[] = []
    const { e } = open((p) => placed.push(p))
    e.events.tap(null, 14, { lon: 46.7012, lat: 24.6911 })
    expect(placed).toEqual([{ lon: 46.7012, lat: 24.6911 }])
  })

  it('each click places it again, at the new place', () => {
    const placed: MapPlace[] = []
    const { e } = open((p) => placed.push(p))
    e.events.tap(null, 14, { lon: 46.7, lat: 24.69 })
    e.events.tap(null, 14, { lon: 46.71, lat: 24.7 })
    expect(placed).toEqual([
      { lon: 46.7, lat: 24.69 },
      { lon: 46.71, lat: 24.7 },
    ])
  })

  it('a click on a store opens its card and places nothing', () => {
    const placed: MapPlace[] = []
    const { e, cards } = open((p) => placed.push(p))
    e.events.tap({ id: '1090', x: 10, y: 10 }, 14, { lon: 46.7386, lat: 24.7741 })
    expect(placed).toEqual([])
    expect(cards.at(-1)).toMatchObject({ id: '1090', pinned: true })
  })

  it('a click beside the points still closes a pinned card, as before, and places the customer too', () => {
    const placed: MapPlace[] = []
    const { e, cards } = open((p) => placed.push(p))
    e.events.tap({ id: '1090', x: 10, y: 10 }, 14)
    e.events.tap(null, 14, { lon: 46.7, lat: 24.69 })
    expect(cards.at(-1)).toBeNull()
    expect(placed).toEqual([{ lon: 46.7, lat: 24.69 }])
  })

  it('a map whose caller places nothing behaves as before: a click beside closes the card and nothing throws', () => {
    const { e, cards } = open()
    e.events.tap({ id: '1090', x: 10, y: 10 }, 14)
    expect(() => e.events.tap(null, 14, { lon: 46.7, lat: 24.69 })).not.toThrow()
    expect(cards.at(-1)).toBeNull()
  })

  it('a click that reports no place (an engine that cannot tell one) places nothing', () => {
    const placed: MapPlace[] = []
    const { e } = open((p) => placed.push(p))
    e.events.tap(null, 14)
    expect(placed).toEqual([])
  })

  it('nothing is placed once the panel is closed', () => {
    const placed: MapPlace[] = []
    const { e, panel } = open((p) => placed.push(p))
    panel.close()
    e.events.tap(null, 14, { lon: 46.7, lat: 24.69 })
    expect(placed).toEqual([])
  })
})

describe('the Google adapter’s hits carry the place of a click on the map', () => {
  const recorder = () => {
    const taps: { target: unknown; place: MapPlace | undefined }[] = []
    const events: Pick<MapEngineEvents, 'pointer' | 'tap'> = { pointer() {}, tap: (target, _zoom, place) => void taps.push({ target, place }) }
    return { taps, events }
  }

  it('a click on the map reports the place under it', () => {
    const { taps, events } = recorder()
    markerHits(events, () => 14, () => 1000).mapClick({ lon: 46.7, lat: 24.69 })
    expect(taps).toEqual([{ target: null, place: { lon: 46.7, lat: 24.69 } }])
  })

  it('the map’s own click for the same tap as a store is that store’s tap: it places nothing', () => {
    const { taps, events } = recorder()
    let now = 1000
    const hits = markerHits(events, () => 14, () => now)
    hits.click('1090', 14, { x: 1, y: 1 })
    now += 50
    hits.mapClick({ lon: 46.7386, lat: 24.7741 })
    expect(taps).toHaveLength(1)
    expect(taps[0].place).toBeUndefined()
  })
})
