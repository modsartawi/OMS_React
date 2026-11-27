/**
 * Ticket 962 (BackOffice spec 4354 §19: the map panel gains "a click places the customer"). A click on the map beside
 * every point hands the caller the place clicked; a click on a store does not. Driven through the panel's own logic
 * (`openMapPanel`, a stand-in engine) and the Google adapter's hit routing (`markerHits`), never Google or pixels. The
 * adapter's own `click` → place is in `google-engine.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { markerHits, pinDrag } from './map-markers'
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

  it('a click beside the points while a card shows only closes the card: the customer stays where it was', () => {
    const placed: MapPlace[] = []
    const { e, cards } = open((p) => placed.push(p))
    e.events.tap({ id: '1090', x: 10, y: 10 }, 14)
    e.events.tap(null, 14, { lon: 46.7, lat: 24.69 })
    expect(cards.at(-1)).toBeNull()
    expect(placed).toEqual([])
  })

  it('a hover card closes on a click beside the points without placing; the next click places', () => {
    const placed: MapPlace[] = []
    const { e, cards } = open((p) => placed.push(p))
    e.events.pointer({ id: '1090', x: 10, y: 10 }, 14)
    e.events.tap(null, 14, { lon: 46.7, lat: 24.69 })
    expect(cards.at(-1)).toBeNull()
    expect(placed).toEqual([])
    e.events.tap(null, 14, { lon: 46.71, lat: 24.7 })
    expect(placed).toEqual([{ lon: 46.71, lat: 24.7 }])
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

// Ticket 964 (spec 4354 §12, §19: "the customer's pin can be moved — click places, drag moves; the run plans again on
// the drop"). The panel draws the caller's customer pin and hands the caller the place it was dropped at; the adapter's
// drag is `pinDrag`, pure: a press that does not move is no drag, and nothing is reported while dragging, only on the drop.
describe('the customer pin is drawn where the caller says, and a drag moves it', () => {
  const PIN = { lon: 46.7386, lat: 24.7741, ink: '--map-customer', label: 'The customer' }

  function withPin(onPinMoved?: (p: MapPlace) => void, over: Partial<Parameters<typeof openMapPanel>[0]> = {}) {
    let started: Parameters<MapEngine['start']>[0] | null = null
    let events: MapEngineEvents | null = null
    const engine: MapEngine = {
      start(s, ev) {
        started = s
        events = ev
        return { destroy() {}, zoomTo() {}, fit() {}, project: (x, y) => ({ x, y }) }
      },
    }
    const panel = openMapPanel({
      engine,
      container: null,
      points: [STORE],
      lang: 'en',
      dir: 'ltr',
      maps: MAPS,
      inkOf: (t) => `ink(${t})`,
      pin: PIN,
      onDrawn() {},
      onCannotDraw() {},
      ...(onPinMoved ? { onPinMoved } : {}),
      ...over,
    })
    if (!started || !events) throw new Error('the engine was not started')
    return { start: started as Parameters<MapEngine['start']>[0], events: events as MapEngineEvents, panel }
  }

  it('the engine is handed the pin at its place, its colour resolved, its words, and draggable when the caller moves it', () => {
    const { start } = withPin(() => {})
    expect(start.pin).toEqual({ lon: 46.7386, lat: 24.7741, fill: 'ink(--map-customer)', stroke: 'ink(--map-ring)', label: 'The customer', draggable: true })
  })

  it('a pin whose caller takes no move is drawn but cannot be dragged', () => {
    const { start } = withPin()
    expect(start.pin?.draggable).toBe(false)
  })

  it('no pin given: the engine is handed none (every map before 964)', () => {
    const { start } = withPin(undefined, { pin: null })
    expect(start.pin).toBeUndefined()
  })

  it('the view opens on the stores and the pin together', () => {
    const { start } = withPin(undefined, { points: [{ ...STORE, lon: 46.7611, lat: 24.7902 }] })
    expect(start.view).toEqual({ kind: 'bounds', west: 46.7386, south: 24.7741, east: 46.7611, north: 24.7902 })
  })

  it('a drop hands the caller the place the pin was dropped at', () => {
    const moved: MapPlace[] = []
    const { events } = withPin((p) => moved.push(p))
    events.pinMoved?.({ lon: 46.75, lat: 24.78 })
    expect(moved).toEqual([{ lon: 46.75, lat: 24.78 }])
  })

  it('nothing is moved once the panel is closed', () => {
    const moved: MapPlace[] = []
    const { events, panel } = withPin((p) => moved.push(p))
    panel.close()
    events.pinMoved?.({ lon: 46.75, lat: 24.78 })
    expect(moved).toEqual([])
  })
})

describe('the adapter’s drag of the pin (pinDrag)', () => {
  // The stand-in projection: a pixel is a thousandth of a degree from (46, 24).
  const toPlace = (x: number, y: number): MapPlace => ({ lon: 46 + x / 1000, lat: 24 + y / 1000 })

  it('press, move and release: the pin follows the pointer, and the drop is reported once, at the last place', () => {
    const drops: MapPlace[] = []
    const drag = pinDrag(toPlace, (p) => drops.push(p))
    drag.down(100, 100)
    expect(drag.move(120, 110)).toEqual({ x: 120, y: 110 })
    expect(drag.move(150, 130)).toEqual({ x: 150, y: 130 })
    expect(drops).toEqual([])
    expect(drag.up()).toBe(true)
    expect(drops).toEqual([{ lon: 46.15, lat: 24.13 }])
  })

  it('a press released where it was (or within a jitter of a few pixels) is no drag: nothing moves', () => {
    const drops: MapPlace[] = []
    const drag = pinDrag(toPlace, (p) => drops.push(p))
    drag.down(100, 100)
    expect(drag.move(101, 101)).toBeNull()
    expect(drag.up()).toBe(false)
    expect(drops).toEqual([])
  })

  it('a move with no press first moves nothing', () => {
    const drops: MapPlace[] = []
    const drag = pinDrag(toPlace, (p) => drops.push(p))
    expect(drag.move(150, 130)).toBeNull()
    expect(drag.up()).toBe(false)
    expect(drops).toEqual([])
  })

  it('a second drag starts afresh', () => {
    const drops: MapPlace[] = []
    const drag = pinDrag(toPlace, (p) => drops.push(p))
    drag.down(0, 0)
    drag.move(50, 0)
    drag.up()
    drag.down(50, 0)
    drag.up()
    expect(drops).toEqual([{ lon: 46.05, lat: 24 }])
  })
})
