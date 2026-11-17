import { describe, expect, it } from 'vitest'
import { isBasemapUnreadable, isPainted, openMapPanel, type MapEngine, type MapEngineEvents, type MapEngineStart, type MapView } from './map-panel'

// Ticket 879 (BackOffice spec 3630, seam 6): the map panel, with the map engine replaced by a stand-in. The tests read
// what the panel hands the engine and what it signals; they never touch MapLibre or pixels.

const ORIGIN = 'https://oms.example.test'

/** The stand-in engine: records what it was started with and lets the test play the engine's events. */
function standIn(opts: { throwOnStart?: Error } = {}) {
  const started: MapEngineStart[] = []
  let events: MapEngineEvents | null = null
  let destroyed = 0
  const fits: MapView[] = []
  const engine: MapEngine = {
    start(start, ev) {
      if (opts.throwOnStart) throw opts.throwOnStart
      started.push(start)
      events = ev
      return { destroy: () => void destroyed++, zoomTo: () => {}, fit: (view) => void fits.push(view), project: (x, y) => ({ x, y }) }
    },
  }
  return {
    engine,
    started,
    fits,
    get events() {
      if (!events) throw new Error('the engine was not started')
      return events
    },
    get destroyed() {
      return destroyed
    },
  }
}

const RIYADH = { id: 'R001', lon: 46.675, lat: 24.713 }
const JEDDAH = { id: 'J001', lon: 39.172, lat: 21.543 }
const DAMMAM = { id: 'D001', lon: 50.103, lat: 26.434 }

function open(engine: MapEngine, over: Partial<Parameters<typeof openMapPanel>[0]> = {}) {
  const signals: string[] = []
  const panel = openMapPanel({
    engine,
    container: null,
    points: [RIYADH, JEDDAH, DAMMAM],
    lang: 'en',
    dir: 'ltr',
    origin: ORIGIN,
    onDrawn: () => signals.push('drawn'),
    onCannotDraw: (reason) => signals.push(`cannot-draw:${reason}`),
    ...over,
  })
  return { panel, signals }
}

describe('the map panel hands the engine the points and a view fitted to them', () => {
  it('passes every given point, as given', () => {
    const e = standIn()
    open(e.engine)
    expect(e.started).toHaveLength(1)
    expect(e.started[0].points).toEqual([RIYADH, JEDDAH, DAMMAM])
  })

  it('opens on the box that holds every point: Jeddah is the west edge, Dammam the east and the north, Jeddah the south', () => {
    const e = standIn()
    open(e.engine)
    expect(e.started[0].view).toEqual({ kind: 'bounds', west: 39.172, south: 21.543, east: 50.103, north: 26.434 })
  })

  it('opens on one point at street-and-district zoom, not on a box of no size', () => {
    const e = standIn()
    open(e.engine, { points: [RIYADH] })
    expect(e.started[0].view).toEqual({ kind: 'centre', lon: 46.675, lat: 24.713, zoom: 13 })
  })

  it('with no points, opens on the whole of KSA and Bahrain (the base map’s box, spec M8)', () => {
    const e = standIn()
    open(e.engine, { points: [] })
    expect(e.started[0].view).toEqual({ kind: 'bounds', west: 34, south: 15, east: 56, north: 33 })
  })
})

/** Every `["get", "<field>"]` the style's labels read, as one string to search. */
const labelFieldsOf = (start: MapEngineStart) =>
  JSON.stringify(start.style.layers.filter((l) => l.type === 'symbol').map((l) => (l.layout as Record<string, unknown> | undefined)?.['text-field']))

describe('place names follow the screen language', () => {
  it('on an Arabic screen the style asks for Arabic names', () => {
    const e = standIn()
    open(e.engine, { lang: 'ar', dir: 'rtl' })
    expect(labelFieldsOf(e.started[0])).toContain('["get","name:ar"]')
    expect(labelFieldsOf(e.started[0])).not.toContain('["get","name:en"],["get","name:en"]')
  })

  it('on an English screen it asks for English names, and none in Arabic first', () => {
    const e = standIn()
    open(e.engine, { lang: 'en' })
    expect(labelFieldsOf(e.started[0])).toContain('["get","name:en"]')
    expect(labelFieldsOf(e.started[0])).not.toContain('name:ar')
  })

  it('on an Arabic screen the text-shaping add-on is loaded from our own site, before the map draws', () => {
    const e = standIn()
    open(e.engine, { lang: 'ar', dir: 'rtl' })
    expect(e.started[0].rtlTextPlugin).toEqual({ url: `${ORIGIN}/map/rtl-text/mapbox-gl-rtl-text-0.3.0.js`, deferred: false })
    expect(e.started[0].lang).toBe('ar')
  })

  it('on an English screen the add-on still comes from our own site, deferred until a label needs it', () => {
    const e = standIn()
    open(e.engine, { lang: 'en' })
    expect(e.started[0].rtlTextPlugin).toEqual({ url: `${ORIGIN}/map/rtl-text/mapbox-gl-rtl-text-0.3.0.js`, deferred: true })
  })

  it('on an Arabic screen no label asks for the italic font, which has no Arabic letters (BackOffice 3634)', () => {
    const e = standIn()
    open(e.engine, { lang: 'ar', dir: 'rtl' })
    expect(JSON.stringify(e.started[0].style.layers)).not.toContain('Noto Sans Italic')
    expect(JSON.stringify(e.started[0].style.layers)).toContain('Noto Sans Regular')
  })
})

describe('the style reads every file from our own site', () => {
  it('the base map is the one file at the fixed path, read by byte range', () => {
    const e = standIn()
    open(e.engine)
    expect(e.started[0].style.sources.protomaps).toEqual({ type: 'vector', url: `pmtiles://${ORIGIN}/basemap/ksa-bh.pmtiles` })
  })

  it('the fonts and the icons are under our origin', () => {
    const e = standIn()
    open(e.engine)
    expect(e.started[0].style.glyphs).toBe(`${ORIGIN}/map/fonts/{fontstack}/{range}.pbf`)
    expect(e.started[0].style.sprite).toBe(`${ORIGIN}/map/sprites/grayscale`)
  })
})

describe("the panel's own controls follow the screen's direction", () => {
  it('stand at the top right on an English screen', () => {
    const e = standIn()
    open(e.engine, { dir: 'ltr' })
    expect(e.started[0].controlsCorner).toBe('top-right')
  })

  it('stand at the top left on an Arabic screen, the reading end', () => {
    const e = standIn()
    open(e.engine, { lang: 'ar', dir: 'rtl' })
    expect(e.started[0].controlsCorner).toBe('top-left')
  })
})

describe('the panel says when it is drawn', () => {
  it('signals nothing until the engine reports its tiles and points painted', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    expect(signals).toEqual([])
  })

  it('signals "drawn" once the engine reports them painted', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.painted()
    expect(signals).toEqual(['drawn'])
  })

  it('signals "drawn" once only, however often the engine repaints (a pan, a zoom)', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.painted()
    e.events.painted()
    e.events.painted()
    expect(signals).toEqual(['drawn'])
  })

  it('signals nothing after it is closed', () => {
    const e = standIn()
    const { panel, signals } = open(e.engine)
    panel.close()
    e.events.painted()
    expect(signals).toEqual([])
    expect(e.destroyed).toBe(1)
  })
})

describe('the panel says when it cannot draw, so the caller can show the table', () => {
  it('signals "cannot draw: no graphics" when the engine fails to start', () => {
    const e = standIn({ throwOnStart: new Error('Failed to initialize WebGL') })
    const { signals } = open(e.engine)
    expect(signals).toEqual(['cannot-draw:no-graphics'])
  })

  it('closing a panel that never started is harmless', () => {
    const e = standIn({ throwOnStart: new Error('Failed to initialize WebGL') })
    const { panel } = open(e.engine)
    expect(() => panel.close()).not.toThrow()
  })

  it('signals "cannot draw: base map unreadable" when the engine cannot read the base-map file', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.basemapUnreadable()
    expect(signals).toEqual(['cannot-draw:basemap-unreadable'])
  })

  it('signals one ending only: no "drawn" after "cannot draw", and no second "cannot draw"', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.basemapUnreadable()
    e.events.basemapUnreadable()
    e.events.painted()
    expect(signals).toEqual(['cannot-draw:basemap-unreadable'])
  })

  it('a file error after the map is drawn changes nothing already signalled', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.painted()
    e.events.basemapUnreadable()
    expect(signals).toEqual(['drawn'])
  })
})

describe('a map opened in a box with no size yet is fitted once the box has one (review W2)', () => {
  it('a box sized only after the map started (a dialog still opening) is fitted to the points then', () => {
    const e = standIn()
    open(e.engine)
    e.events.sized(0, 0)
    expect(e.fits).toEqual([])
    e.events.sized(1100, 640)
    expect(e.fits).toEqual([{ kind: 'bounds', west: 39.172, south: 21.543, east: 50.103, north: 26.434 }])
    // Later resizes leave the reader's own pan and zoom alone.
    e.events.sized(900, 500)
    expect(e.fits).toHaveLength(1)
  })

  it('a box that had its size from the start is not fitted again', () => {
    const e = standIn()
    open(e.engine)
    e.events.sized(800, 320)
    e.events.sized(700, 320)
    expect(e.fits).toEqual([])
  })
})

describe('a map whose graphics are lost shows the table (review W9)', () => {
  it('losing the graphics after the map is drawn signals "cannot draw": the blank canvas is not left as drawn', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.painted()
    e.events.graphicsLost()
    expect(signals).toEqual(['drawn', 'cannot-draw:no-graphics'])
  })

  it('losing them while drawing signals it once, and nothing after', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.graphicsLost()
    e.events.graphicsLost()
    e.events.painted()
    expect(signals).toEqual(['cannot-draw:no-graphics'])
  })

  it('nothing is signalled once the panel is closed', () => {
    const e = standIn()
    const { panel, signals } = open(e.engine)
    panel.close()
    e.events.graphicsLost()
    expect(signals).toEqual([])
  })
})

describe('only the base-map file itself unread is "base map unreadable" (review W5)', () => {
  it('the file or its header not read: unreadable', () => {
    expect(isBasemapUnreadable({ sourceId: 'protomaps', error: new Error('404') })).toBe(true)
  })

  it('one tile failing is not: the rest of the map is drawn', () => {
    expect(isBasemapUnreadable({ sourceId: 'protomaps', tile: {}, error: new Error('timeout') })).toBe(false)
  })

  it('an error on another source is not', () => {
    expect(isBasemapUnreadable({ sourceId: 'points', error: new Error('x') })).toBe(false)
    expect(isBasemapUnreadable({ error: new Error('x') })).toBe(false)
  })
})

describe('an Arabic map is drawn only once its letters are shaped (review W6)', () => {
  const loaded = { tilesLoaded: true, basemapLoaded: true, pointsLoaded: true }

  it('on an Arabic screen, not before the text-shaping add-on has loaded', () => {
    for (const rtl of ['unavailable', 'deferred', 'requested', 'loading'] as const) expect(isPainted({ ...loaded, lang: 'ar', rtl })).toBe(false)
    expect(isPainted({ ...loaded, lang: 'ar', rtl: 'loaded' })).toBe(true)
  })

  it('an add-on that failed to load leaves the labels unshaped, not the map undrawn', () => {
    expect(isPainted({ ...loaded, lang: 'ar', rtl: 'error' })).toBe(true)
  })

  it('on an English screen the add-on is not waited for', () => {
    expect(isPainted({ ...loaded, lang: 'en', rtl: 'deferred' })).toBe(true)
  })

  it('never before the tiles and both sources are in', () => {
    expect(isPainted({ ...loaded, tilesLoaded: false, lang: 'en', rtl: 'loaded' })).toBe(false)
    expect(isPainted({ ...loaded, basemapLoaded: false, lang: 'en', rtl: 'loaded' })).toBe(false)
    expect(isPainted({ ...loaded, pointsLoaded: false, lang: 'ar', rtl: 'loaded' })).toBe(false)
  })
})
