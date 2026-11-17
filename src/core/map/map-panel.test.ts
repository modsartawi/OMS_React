import { describe, expect, it } from 'vitest'
import { openMapPanel, type MapEngine, type MapEngineEvents, type MapEngineStart, type MapView } from './map-panel'

// Tickets 879 and 908 (BackOffice spec 3630, seam 6; ADR 0139): the map panel, with the map engine replaced by a
// stand-in. The tests read what the panel hands the engine and what it signals; they never touch Google or pixels.

const MAPS = { key: 'planted-test-key' }

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
    maps: MAPS,
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

  it('with no points, opens on the whole of KSA and Bahrain (spec M8)', () => {
    const e = standIn()
    open(e.engine, { points: [] })
    expect(e.started[0].view).toEqual({ kind: 'bounds', west: 34, south: 15, east: 56, north: 33 })
  })
})

describe('the panel hands the engine what Google needs: the key from the model, region SA, the screen language (908)', () => {
  it('the key and the map ID are the model’s `maps` part, as given', () => {
    const e = standIn()
    open(e.engine, { maps: { key: 'planted-test-key', mapId: 'planted-map-id' } })
    expect(e.started[0].key).toBe('planted-test-key')
    expect(e.started[0].mapId).toBe('planted-map-id')
  })

  it('no map ID served: none handed on', () => {
    const e = standIn()
    open(e.engine, { maps: { key: 'planted-test-key' } })
    expect(e.started[0].mapId).toBeUndefined()
  })

  it('the region is Saudi Arabia, whatever the screen language (KSA borders, "Arabian Gulf")', () => {
    for (const lang of ['en', 'ar'] as const) {
      const e = standIn()
      open(e.engine, { lang, dir: lang === 'ar' ? 'rtl' : 'ltr' })
      expect(e.started[0].region).toBe('SA')
    }
  })

  it('the language is the screen’s', () => {
    const ar = standIn()
    open(ar.engine, { lang: 'ar', dir: 'rtl' })
    expect(ar.started[0].lang).toBe('ar')
    const en = standIn()
    open(en.engine, { lang: 'en' })
    expect(en.started[0].lang).toBe('en')
  })
})

describe('with no key the panel cannot draw, and Google is never asked (908)', () => {
  it('no `maps` part: "cannot draw: no key", and the engine is not started', () => {
    const e = standIn()
    const { signals } = open(e.engine, { maps: undefined })
    expect(signals).toEqual(['cannot-draw:no-key'])
    expect(e.started).toHaveLength(0)
  })

  it('an empty key, or one of spaces: the same', () => {
    for (const key of ['', '   ']) {
      const e = standIn()
      const { signals } = open(e.engine, { maps: { key } })
      expect(signals).toEqual(['cannot-draw:no-key'])
      expect(e.started).toHaveLength(0)
    }
  })

  it('closing a panel that had no key is harmless', () => {
    const e = standIn()
    const { panel } = open(e.engine, { maps: null })
    expect(() => panel.close()).not.toThrow()
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

describe('the panel says when it is drawn: Google reports its tiles loaded and the map idle, the points on it (908)', () => {
  it('signals nothing until the engine reports anything', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    expect(signals).toEqual([])
  })

  it('tiles loaded alone is not drawn; idle alone is not drawn', () => {
    const tilesOnly = standIn()
    const a = open(tilesOnly.engine)
    tilesOnly.events.tilesLoaded()
    expect(a.signals).toEqual([])
    const idleOnly = standIn()
    const b = open(idleOnly.engine)
    idleOnly.events.idle()
    idleOnly.events.idle()
    expect(b.signals).toEqual([])
  })

  it('both: "drawn", in either order', () => {
    const first = standIn()
    const a = open(first.engine)
    first.events.tilesLoaded()
    first.events.idle()
    expect(a.signals).toEqual(['drawn'])
    const second = standIn()
    const b = open(second.engine)
    second.events.idle()
    second.events.tilesLoaded()
    expect(b.signals).toEqual(['drawn'])
  })

  it('signals "drawn" once only, however often Google reports them again (a pan, a zoom)', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    for (let i = 0; i < 3; i++) {
      e.events.tilesLoaded()
      e.events.idle()
    }
    expect(signals).toEqual(['drawn'])
  })

  it('signals nothing after it is closed', () => {
    const e = standIn()
    const { panel, signals } = open(e.engine)
    panel.close()
    e.events.tilesLoaded()
    e.events.idle()
    expect(signals).toEqual([])
    expect(e.destroyed).toBe(1)
  })
})

describe('the panel says when it cannot draw, with the reason, so the caller can show the table (908)', () => {
  it('"no graphics" when the engine fails to start', () => {
    const e = standIn({ throwOnStart: new Error('cannot start') })
    const { signals } = open(e.engine)
    expect(signals).toEqual(['cannot-draw:no-graphics'])
  })

  it('closing a panel that never started is harmless', () => {
    const e = standIn({ throwOnStart: new Error('cannot start') })
    const { panel } = open(e.engine)
    expect(() => panel.close()).not.toThrow()
  })

  it('"refused" when Google refuses the key or the page (gm_authFailure)', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.failed('refused')
    expect(signals).toEqual(['cannot-draw:refused'])
  })

  it('"unreachable" when Google’s script failed or did not arrive in time', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.failed('unreachable')
    expect(signals).toEqual(['cannot-draw:unreachable'])
  })

  it('one ending only: no second "cannot draw", and no "drawn" after it', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.failed('refused')
    e.events.failed('refused')
    e.events.failed('unreachable')
    e.events.tilesLoaded()
    e.events.idle()
    expect(signals).toEqual(['cannot-draw:refused'])
  })

  it('a refusal after the map is drawn ends it as "cannot draw": Google greys a refused map out', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.tilesLoaded()
    e.events.idle()
    e.events.failed('refused')
    e.events.failed('refused')
    expect(signals).toEqual(['drawn', 'cannot-draw:refused'])
  })

  it('nothing is signalled once the panel is closed', () => {
    const e = standIn()
    const { panel, signals } = open(e.engine)
    panel.close()
    e.events.failed('refused')
    e.events.failed('unreachable')
    expect(signals).toEqual([])
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
  it('losing the graphics after the map is drawn signals "cannot draw": the blank map is not left as drawn', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.tilesLoaded()
    e.events.idle()
    e.events.graphicsLost()
    expect(signals).toEqual(['drawn', 'cannot-draw:no-graphics'])
  })

  it('losing them while drawing signals it once, and nothing after', () => {
    const e = standIn()
    const { signals } = open(e.engine)
    e.events.graphicsLost()
    e.events.graphicsLost()
    e.events.tilesLoaded()
    e.events.idle()
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
