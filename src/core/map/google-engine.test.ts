/**
 * The Google adapter itself (ticket 908, BackOffice spec 3630 M28, M33, M34; review fixes G3, G4, G5, G9, G10), driven
 * through its own port (`googleEngine(loader).start`) with Google's script a stand-in `google.maps` and the page a few
 * stand-in elements: what it asks Google for, what it leaves behind, and where it says a store stands. No real script,
 * no real key, no pixels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { googleEngine } from './google-engine'
import { createGoogleLoader, type LoaderPage } from './google-loader'
import type { MapEngineEvents, MapEngineStart, MapFeature, MapLineFeature, MapPolygonFeature, MapTarget } from './map-panel'

const KEY = 'planted-test-key'

/** An element, as the adapter touches one. */
class El {
  readonly style: Record<string, string> = {}
  readonly attrs = new Map<string, string>()
  children: El[] = []
  parent: El | null = null
  readonly handlers = new Map<string, ((e: unknown) => void)[]>()
  textContent = ''
  dir = ''
  clientWidth = 688
  clientHeight = 320
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value)
  }
  appendChild(child: El) {
    child.remove()
    child.parent = this
    this.children.push(child)
    return child
  }
  replaceChildren() {
    for (const c of this.children) c.parent = null
    this.children = []
  }
  remove() {
    if (!this.parent) return
    this.parent.children = this.parent.children.filter((c) => c !== this)
    this.parent = null
  }
  addEventListener(type: string, h: (e: unknown) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), h])
  }
  fire(type: string, e: unknown = { stopPropagation() {}, clientX: 999, clientY: 999 }) {
    for (const h of this.handlers.get(type) ?? []) h(e)
  }
  getBoundingClientRect() {
    return { left: 0, top: 0 }
  }
}

/** Google's projection, staged: a place's pixel is its longitude and latitude times ten. */
const toPixel = ({ lat, lng }: { lat: number; lng: number }) => ({ x: lng * 10, y: lat * 10 })

function stageGoogle() {
  const maps: StagedMap[] = []
  const overlays: StagedOverlay[] = []
  const win: Record<string, unknown> = {}
  const scripts: string[] = []
  const pane = new El()
  let zoom = 12

  class StagedMap {
    readonly handlers = new Map<string, (() => void)[]>()
    readonly calls: unknown[][] = []
    constructor(
      readonly el: El,
      readonly options: Record<string, unknown>,
    ) {
      maps.push(this)
      // Google draws into the element it is given.
      el.appendChild(new El())
    }
    addListener(event: string, handler: () => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
      return { remove: () => this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== handler)) }
    }
    fire(event: string) {
      for (const h of this.handlers.get(event) ?? []) h()
    }
    fitBounds(...a: unknown[]) {
      this.calls.push(['fitBounds', ...a])
    }
    setOptions(o: unknown) {
      this.calls.push(['setOptions', o])
    }
    setCenter() {}
    setZoom(z: number) {
      this.calls.push(['setZoom', z])
    }
    panTo() {}
    getZoom() {
      return zoom
    }
    getBounds() {
      return undefined
    }
    getProjection() {
      return undefined
    }
  }
  class StagedOverlay {
    onAdd?: () => void
    draw?: () => void
    onRemove?: () => void
    constructor() {
      overlays.push(this)
    }
    setMap(map: unknown) {
      if (map) {
        this.onAdd?.()
        this.draw?.()
      } else this.onRemove?.()
    }
    getPanes() {
      return { overlayMouseTarget: pane }
    }
    getProjection() {
      return { fromLatLngToDivPixel: toPixel, fromLatLngToContainerPixel: toPixel }
    }
    static preventMapHitsAndGesturesFrom() {}
  }
  // 922: Google's polyline, as the adapter makes one for each line.
  class StagedPolyline {
    map: unknown
    constructor(readonly options: Record<string, unknown>) {
      this.map = options.map ?? null
      polylines.push(this)
    }
    setMap(map: unknown) {
      this.map = map
    }
  }
  const polylines: StagedPolyline[] = []
  // 947: Google's polygon, as the adapter makes one for each shape; a test plays its click.
  class StagedPolygon {
    map: unknown
    readonly handlers = new Map<string, (() => void)[]>()
    constructor(readonly options: Record<string, unknown>) {
      this.map = options.map ?? null
      polygons.push(this)
    }
    setMap(map: unknown) {
      this.map = map
    }
    addListener(event: string, handler: () => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
      return { remove: () => this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== handler)) }
    }
    fire(event: string) {
      for (const h of this.handlers.get(event) ?? []) h()
    }
  }
  const polygons: StagedPolygon[] = []
  const ns = {
    importLibrary: async () => ({ Map: StagedMap, RenderingType: { RASTER: 'RASTER' }, Polyline: StagedPolyline, Polygon: StagedPolygon }),
    ControlPosition: { TOP_LEFT: 'TOP_LEFT', TOP_RIGHT: 'TOP_RIGHT' },
    OverlayView: StagedOverlay,
    event: { addListenerOnce: (target: StagedMap, event: string, handler: () => void) => {
      const l = target.addListener(event, () => {
        l.remove()
        handler()
      })
      return l
    } },
  }
  const page: LoaderPage = {
    addScript: (src) => void scripts.push(src),
    setGlobal: (name, value) => void (win[name] = value),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    mapsReady: () => win.google !== undefined,
  }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { createElement: () => new El() })
  return {
    loader: createGoogleLoader(page),
    maps,
    overlays,
    polylines,
    polygons,
    scripts,
    pane,
    setZoom: (z: number) => void (zoom = z),
    answer: async () => {
      win.google = { maps: ns }
      ;(win.__omsGoogleMapsReady as () => void)()
      await vi.advanceTimersByTimeAsync(0)
    },
    refuse: () => (win.gm_authFailure as () => void)(),
  }
}

const RIYADH: MapFeature = { kind: 'point', id: 'P001', lon: 46.6853, lat: 24.6943, radius: 6, fill: 'ink(--map-same)', fillOpacity: 1, stroke: 'ink(--map-ring)', strokeWidth: 1, label: '' } as MapFeature

function started(google: ReturnType<typeof stageGoogle>, view: MapEngineStart['view'] = { kind: 'bounds', west: 46.6, south: 24.6, east: 46.8, north: 24.8 }) {
  const container = new El()
  const failed: string[] = []
  const pointers: (MapTarget | null)[] = []
  const events: MapEngineEvents = {
    tilesLoaded() {},
    idle() {},
    failed: (r) => void failed.push(r),
    pointer: (t) => void pointers.push(t),
    tap() {},
    moved() {},
    sized() {},
  }
  const running = googleEngine(google.loader).start(
    { container, view, key: KEY, controlsCorner: 'top-right', featuresAt: () => [RIYADH], labelInk: 'ink(--map-group-ink)', lang: 'en' },
    events,
  )
  return { container, running, failed, pointers }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('a map that is closed leaves nothing of Google’s in its box, and a new one draws in a fresh element (review G3)', () => {
  it('Google draws into an element of the adapter’s own, inside the box', async () => {
    const google = stageGoogle()
    const { container } = started(google)
    await google.answer()
    expect(google.maps).toHaveLength(1)
    expect(google.maps[0].el).not.toBe(container)
    expect(container.children).toEqual([google.maps[0].el])
  })

  it('closing the map takes Google’s element out of the box', async () => {
    const google = stageGoogle()
    const { container, running } = started(google)
    await google.answer()
    running.destroy()
    expect(container.children).toEqual([])
  })

  it('a map started again in the same box (a new answer, StrictMode’s second mount) draws in a new element; the old one is gone', async () => {
    const google = stageGoogle()
    const container = new El()
    const start = (): MapEngineStart => ({
      container,
      view: { kind: 'centre', lon: 46.7, lat: 24.7, zoom: 14 },
      key: KEY,
      controlsCorner: 'top-right',
      featuresAt: () => [],
      labelInk: '',
      lang: 'en',
    })
    const noop = { tilesLoaded() {}, idle() {}, failed() {}, pointer() {}, tap() {}, moved() {}, sized() {} }
    const first = googleEngine(google.loader).start(start(), noop)
    await google.answer()
    first.destroy()
    googleEngine(google.loader).start(start(), noop)
    await vi.advanceTimersByTimeAsync(0)
    expect(google.maps).toHaveLength(2)
    expect(google.maps[1].el).not.toBe(google.maps[0].el)
    expect(container.children).toEqual([google.maps[1].el])
  })
})

describe('a page Google has refused starts no map: no Google map, no billed load (review G10)', () => {
  it('a map started after the refusal is refused at once, and Google is asked for no map', async () => {
    const google = stageGoogle()
    started(google)
    await google.answer()
    google.refuse()
    const second = started(google)
    await vi.advanceTimersByTimeAsync(0)
    expect(second.failed).toEqual(['refused'])
    expect(google.maps).toHaveLength(1)
    expect(second.container.children).toEqual([])
  })

  it('a refusal before the script called back: no map is made', async () => {
    const google = stageGoogle()
    const { failed } = started(google)
    google.refuse()
    await google.answer()
    expect(failed).toEqual(['refused'])
    expect(google.maps).toHaveLength(0)
  })
})

describe('a fit opens no closer than zoom 15, and leaves the reader’s own zoom alone (review G4)', () => {
  it('the zoom is held at 15 while Google fits the box, and let go once the map is idle', async () => {
    const google = stageGoogle()
    started(google)
    await google.answer()
    const m = google.maps[0]
    const fit = m.calls.findIndex((c) => c[0] === 'fitBounds')
    expect(m.calls.slice(0, fit)).toContainEqual(['setOptions', { maxZoom: 15 }])
    expect(m.calls.slice(fit)).not.toContainEqual(['setOptions', { maxZoom: null }])
    m.fire('idle')
    expect(m.calls.slice(fit)).toContainEqual(['setOptions', { maxZoom: null }])
  })

  it('no zoom is set from a moved event: a later zoom of the reader’s is never snapped back', async () => {
    const google = stageGoogle()
    started(google)
    await google.answer()
    const m = google.maps[0]
    google.setZoom(17)
    m.fire('bounds_changed')
    m.fire('idle')
    m.fire('bounds_changed')
    expect(m.calls.filter((c) => c[0] === 'setZoom')).toEqual([])
  })
})

describe('a store’s card stands at the store, from the first pointer (review G9)', () => {
  it('pointing at a marker reports the store’s own place in the box, not where the pointer happened to be', async () => {
    const google = stageGoogle()
    const { pointers } = started(google)
    await google.answer()
    const marker = google.pane.children[0].children[0]
    marker.fire('pointerenter')
    expect(pointers).toEqual([{ id: 'P001', x: expect.closeTo(466.853), y: expect.closeTo(246.943), zoom: 12 }])
  })

  it('where a store stands is Google’s container pixel for its place', async () => {
    const google = stageGoogle()
    const { running } = started(google)
    await google.answer()
    expect(running.project(46.6853, 24.6943)).toEqual({ x: expect.closeTo(466.853), y: expect.closeTo(246.943) })
  })
})

describe('a marker taken away under the pointer lets its card go (review G5)', () => {
  it('a zoom that redraws the markers while one is pointed at reports the pointer off it', async () => {
    const google = stageGoogle()
    const { pointers } = started(google)
    await google.answer()
    google.pane.children[0].children[0].fire('pointerenter')
    google.setZoom(13)
    google.overlays[0].draw?.()
    expect(pointers.at(-1)).toBeNull()
  })
})

describe('lines (922): each a Google polyline in its colour, its words at its middle', () => {
  const FROM = { lon: 46.6, lat: 24.6 }
  const TO = { lon: 43.9, lat: 26.3 }
  const LEG: MapLineFeature = { id: 'leg-1', from: FROM, to: TO, stroke: 'ink(--map-worse)', label: '312 km · 1 h 40 min', strong: false }
  const noop = { tilesLoaded() {}, idle() {}, failed() {}, pointer() {}, tap() {}, moved() {}, sized() {} }

  function withLines(google: ReturnType<typeof stageGoogle>, lines: MapLineFeature[] | undefined) {
    return googleEngine(google.loader).start(
      { container: new El(), view: { kind: 'bounds', west: 43, south: 24, east: 47, north: 27 }, key: KEY, controlsCorner: 'top-right', featuresAt: () => [RIYADH], labelInk: '', lang: 'en', lines },
      noop,
    )
  }
  const wordsLayer = (google: ReturnType<typeof stageGoogle>) => google.pane.children.find((c) => c.attrs.has('data-map-lines'))

  it('draws one polyline per line, from its start to its end, in its colour, on the map, never catching a tap', async () => {
    const google = stageGoogle()
    withLines(google, [LEG])
    await google.answer()
    expect(google.polylines).toHaveLength(1)
    const p = google.polylines[0]
    expect(p.options.path).toEqual([
      { lat: 24.6, lng: 46.6 },
      { lat: 26.3, lng: 43.9 },
    ])
    expect(p.options.strokeColor).toBe('ink(--map-worse)')
    expect(p.options.clickable).toBe(false)
    expect(p.map).toBe(google.maps[0])
  })

  it('puts its words at the middle of the line as drawn, in their own direction, passing the pointer through', async () => {
    const google = stageGoogle()
    withLines(google, [LEG])
    await google.answer()
    const words = wordsLayer(google)?.children[0]
    expect(words?.textContent).toBe('312 km · 1 h 40 min')
    expect(words?.dir).toBe('auto')
    expect(words?.style.pointerEvents).toBe('none')
    // The staged projection is ten pixels a degree: the middle of (466, 246) and (439, 263).
    expect(parseFloat(words?.style.left ?? '')).toBeCloseTo(452.5)
    expect(parseFloat(words?.style.top ?? '')).toBeCloseTo(254.5)
  })

  it('a line with no words draws its polyline and no label', async () => {
    const google = stageGoogle()
    withLines(google, [{ ...LEG, label: '' }])
    await google.answer()
    expect(google.polylines).toHaveLength(1)
    expect(wordsLayer(google)?.children ?? []).toEqual([])
  })

  it('the points are still drawn, as before', async () => {
    const google = stageGoogle()
    withLines(google, [LEG])
    await google.answer()
    expect(google.pane.children[0].children.map((m) => m.attrs.get('data-feature'))).toEqual(['point'])
  })

  it('closing the map takes its lines and their words away', async () => {
    const google = stageGoogle()
    const running = withLines(google, [LEG])
    await google.answer()
    running.destroy()
    expect(google.polylines[0].map).toBeNull()
    expect(wordsLayer(google)).toBeUndefined()
  })

  it('a strong line is drawn above every plain one, wider, and its words above theirs — whatever the order given', async () => {
    const google = stageGoogle()
    withLines(google, [
      { ...LEG, id: 'strong', strong: true },
      { ...LEG, id: 'plain', stroke: 'ink(--map-ring)', label: 'later, plain' },
    ])
    await google.answer()
    const [strong, plain] = google.polylines
    expect(Number(strong.options.zIndex)).toBeGreaterThan(Number(plain.options.zIndex))
    expect(Number(strong.options.strokeWeight)).toBeGreaterThan(Number(plain.options.strokeWeight))
    const [strongWords, plainWords] = wordsLayer(google)?.children ?? []
    expect(Number(strongWords.style.zIndex)).toBeGreaterThan(Number(plainWords.style.zIndex))
  })

  it('a map with no lines (every map before 922) makes no polyline', async () => {
    for (const lines of [undefined, []]) {
      const google = stageGoogle()
      withLines(google, lines)
      await google.answer()
      expect(google.polylines).toEqual([])
    }
  })
})

describe('shapes (947): each a Google polygon in its fill, beneath the points, its tap reported by id', () => {
  const CENTER: MapPolygonFeature = {
    id: 'Center',
    rings: [
      [[44, 24], [47, 24], [47, 27], [44, 24]],
      [[45, 20], [46, 20], [46, 21], [45, 20]],
    ],
    fill: 'ink(--map-scale-4)',
    fillOpacity: 0.55,
    stroke: 'ink(--card)',
  }

  function withShapes(google: ReturnType<typeof stageGoogle>, polygons: MapPolygonFeature[] | undefined, shapeTaps: string[] = []) {
    return googleEngine(google.loader).start(
      { container: new El(), view: { kind: 'bounds', west: 43, south: 19, east: 48, north: 28 }, key: KEY, controlsCorner: 'top-right', featuresAt: () => [RIYADH], labelInk: '', lang: 'en', polygons },
      { tilesLoaded() {}, idle() {}, failed() {}, pointer() {}, tap() {}, moved() {}, sized() {}, shapeTap: (id) => void shapeTaps.push(id) },
    )
  }

  it('draws one polygon per shape, every ring a path, in its fill and edge, on the map, beneath the lines', async () => {
    const google = stageGoogle()
    withShapes(google, [CENTER])
    await google.answer()
    expect(google.polygons).toHaveLength(1)
    const p = google.polygons[0]
    expect(p.options.paths).toEqual([
      [{ lat: 24, lng: 44 }, { lat: 24, lng: 47 }, { lat: 27, lng: 47 }, { lat: 24, lng: 44 }],
      [{ lat: 20, lng: 45 }, { lat: 20, lng: 46 }, { lat: 21, lng: 46 }, { lat: 20, lng: 45 }],
    ])
    expect(p.options).toMatchObject({ fillColor: 'ink(--map-scale-4)', fillOpacity: 0.55, strokeColor: 'ink(--card)', clickable: true, zIndex: 0 })
    expect(p.map).toBe(google.maps[0])
  })

  it('a click on a shape is reported as its id', async () => {
    const google = stageGoogle()
    const taps: string[] = []
    withShapes(google, [CENTER], taps)
    await google.answer()
    google.polygons[0].fire('click')
    expect(taps).toEqual(['Center'])
  })

  it('a click on a shape is also a tap on the map beside the stores: a pinned card closes (review A5)', async () => {
    const google = stageGoogle()
    const taps: (string | null)[] = []
    googleEngine(google.loader).start(
      { container: new El(), view: { kind: 'bounds', west: 43, south: 19, east: 48, north: 28 }, key: KEY, controlsCorner: 'top-right', featuresAt: () => [RIYADH], labelInk: '', lang: 'en', polygons: [CENTER] },
      { tilesLoaded() {}, idle() {}, failed() {}, pointer() {}, tap: (hit) => void taps.push(hit === null ? null : 'hit'), moved() {}, sized() {}, shapeTap() {} },
    )
    await google.answer()
    google.polygons[0].fire('click')
    expect(taps).toEqual([null])
  })

  it('closing the map takes its shapes away and reports no more taps', async () => {
    const google = stageGoogle()
    const taps: string[] = []
    const running = withShapes(google, [CENTER], taps)
    await google.answer()
    running.destroy()
    expect(google.polygons[0].map).toBeNull()
    google.polygons[0].fire('click')
    expect(taps).toEqual([])
  })

  it('a map with no shapes (every map before 947) makes no polygon', async () => {
    for (const polygons of [undefined, []]) {
      const google = stageGoogle()
      withShapes(google, polygons)
      await google.answer()
      expect(google.polygons).toEqual([])
    }
  })

  it('a view shown before Google has drawn the map is the view it opens on', async () => {
    const google = stageGoogle()
    const running = withShapes(google, [])
    running.fit({ kind: 'centre', lon: 50.58, lat: 26.22, zoom: 9 })
    await google.answer()
    expect(google.maps[0].options).toMatchObject({ center: { lat: 26.22, lng: 50.58 }, zoom: 9 })
    expect(google.maps[0].calls.filter((c) => c[0] === 'fitBounds')).toEqual([])
  })
})
