/**
 * The Google adapter itself (ticket 908, BackOffice spec 3630 M28, M33, M34; review fixes G3, G4, G5, G9, G10), driven
 * through its own port (`googleEngine(loader).start`) with Google's script a stand-in `google.maps` and the page a few
 * stand-in elements: what it asks Google for, what it leaves behind, and where it says a store stands. No real script,
 * no real key, no pixels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { googleEngine } from './google-engine'
import { RING_LINE_WIDTH } from './map-drawing'
import { createGoogleLoader, type LoaderPage } from './google-loader'
import type { MapEngineEvents, MapEngineStart, MapFeature, MapLineFeature, MapPinFeature, MapRingFeature, MapTarget } from './map-panel'

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
    readonly handlers = new Map<string, ((e?: unknown) => void)[]>()
    readonly calls: unknown[][] = []
    constructor(
      readonly el: El,
      readonly options: Record<string, unknown>,
    ) {
      maps.push(this)
      // Google draws into the element it is given.
      el.appendChild(new El())
    }
    addListener(event: string, handler: (e?: unknown) => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
      return { remove: () => this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== handler)) }
    }
    fire(event: string, e?: unknown) {
      for (const h of this.handlers.get(event) ?? []) h(e)
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
      return {
        fromLatLngToDivPixel: toPixel,
        fromLatLngToContainerPixel: toPixel,
        // 964: the pin's drop, read back from a pixel to a place.
        fromDivPixelToLatLng: ({ x, y }: { x: number; y: number }) => ({ lat: () => y / 10, lng: () => x / 10 }),
      }
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
  const ns = {
    importLibrary: async () => ({ Map: StagedMap, RenderingType: { RASTER: 'RASTER' }, Polyline: StagedPolyline }),
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

describe('a click on the map carries the place under it (ticket 962: a click places the customer)', () => {
  const startWith = (google: ReturnType<typeof stageGoogle>, taps: unknown[][]) =>
    googleEngine(google.loader).start(
      { container: new El(), view: { kind: 'centre', lon: 46.7, lat: 24.7, zoom: 14 }, key: KEY, controlsCorner: 'top-right', featuresAt: () => [], labelInk: '', lang: 'en' },
      { tilesLoaded() {}, idle() {}, failed() {}, pointer() {}, tap: (...a) => void taps.push(a), moved() {}, sized() {} },
    )

  it('Google’s click hands its latLng on as the place, longitude and latitude', async () => {
    const google = stageGoogle()
    const taps: unknown[][] = []
    startWith(google, taps)
    await google.answer()
    google.maps[0].fire('click', { latLng: { lat: () => 24.6911, lng: () => 46.7012 } })
    expect(taps).toEqual([[null, 12, { lon: 46.7012, lat: 24.6911 }]])
  })

  it('a click with no latLng is a tap beside, with no place', async () => {
    const google = stageGoogle()
    const taps: unknown[][] = []
    startWith(google, taps)
    await google.answer()
    google.maps[0].fire('click', {})
    expect(taps).toEqual([[null, 12]])
  })
})

describe('964: a dashed line, the rings and the customer pin on Google’s map', () => {
  const FROM = { lon: 46.6, lat: 24.6 }
  const TO = { lon: 46.7, lat: 24.7 }
  const LEG: MapLineFeature = { id: 'leg', from: FROM, to: TO, stroke: 'ink(--map-mode-pick-up)', label: '', strong: false }
  const RING: MapRingFeature = {
    id: 'ring-5',
    path: [
      { lon: 46.7, lat: 24.75 },
      { lon: 46.75, lat: 24.7 },
      { lon: 46.7, lat: 24.65 },
      { lon: 46.7, lat: 24.75 },
    ],
    stroke: 'ink(--map-ring)',
    label: '5 km',
    labelAt: { lon: 46.7, lat: 24.75 },
  }
  const PIN: MapPinFeature = { lon: 46.7, lat: 24.7, fill: 'ink(--map-customer)', stroke: 'ink(--map-ring)', label: 'The customer', draggable: true }

  function startWith(google: ReturnType<typeof stageGoogle>, over: Partial<MapEngineStart>, moved: unknown[] = [], taps: unknown[][] = []) {
    return googleEngine(google.loader).start(
      { container: new El(), view: { kind: 'centre', lon: 46.7, lat: 24.7, zoom: 13 }, key: KEY, controlsCorner: 'top-right', featuresAt: () => [], labelInk: '', lang: 'en', ...over },
      { tilesLoaded() {}, idle() {}, failed() {}, pointer() {}, tap: (...a) => void taps.push(a), moved() {}, sized() {}, pinMoved: (p) => void moved.push(p) },
    )
  }
  const pinEl = (google: ReturnType<typeof stageGoogle>) => google.pane.children.find((c) => c.attrs.has('data-map-pin'))

  it('a dashed line is a polyline with its own stroke hidden and a short stroke of its colour repeated along it', async () => {
    const google = stageGoogle()
    startWith(google, { lines: [{ ...LEG, dash: 'dashed' }] })
    await google.answer()
    const p = google.polylines[0]
    expect(p.options.strokeOpacity).toBe(0)
    expect(p.options.icons).toEqual([expect.objectContaining({ icon: expect.objectContaining({ strokeColor: 'ink(--map-mode-pick-up)' }), offset: '0' })])
  })

  it('a solid line is drawn as before, with no strokes repeated', async () => {
    const google = stageGoogle()
    startWith(google, { lines: [LEG] })
    await google.answer()
    expect(google.polylines[0].options.strokeOpacity).toBe(0.9)
    expect(google.polylines[0].options.icons).toBeUndefined()
  })

  it('a ring is a closed dashed polyline round its path, beneath the legs, taking no tap; its words stand at its top', async () => {
    const google = stageGoogle()
    startWith(google, { rings: [RING], lines: [LEG] })
    await google.answer()
    const ring = google.polylines.find((p) => (p.options.path as unknown[]).length === 4)
    expect(ring?.options.path).toEqual(RING.path.map((q) => ({ lat: q.lat, lng: q.lon })))
    expect(ring?.options.strokeOpacity).toBe(0)
    expect(ring?.options.icons).toHaveLength(1)
    // The visible stroke of a dashed line is the repeated icon's: it carries the ring's own, thinner width.
    expect((ring?.options.icons as { icon: { strokeWeight: number } }[])[0].icon.strokeWeight).toBe(RING_LINE_WIDTH)
    expect(ring?.options.clickable).toBe(false)
    const leg = google.polylines.find((p) => p !== ring)
    expect(Number(ring?.options.zIndex)).toBeLessThan(Number(leg?.options.zIndex))
    const words = google.pane.children.find((c) => c.attrs.has('data-map-lines'))?.children.find((c) => c.attrs.get('data-map-ring') === 'ring-5')
    expect(words?.textContent).toBe('5 km')
    expect(parseFloat(words?.style.left ?? '')).toBeCloseTo(467)
    expect(parseFloat(words?.style.top ?? '')).toBeCloseTo(247.5)
  })

  it('closing the map takes the rings away', async () => {
    const google = stageGoogle()
    const running = startWith(google, { rings: [RING] })
    await google.answer()
    running.destroy()
    expect(google.polylines.every((p) => p.map === null)).toBe(true)
  })

  it('the pin is drawn at its place, named by its words, above the stores', async () => {
    const google = stageGoogle()
    startWith(google, { pin: PIN })
    await google.answer()
    const el = pinEl(google)
    expect(el?.attrs.get('aria-label')).toBe('The customer')
    expect(el?.attrs.get('title')).toBe('The customer')
    expect(el?.style.left).toBe('467px')
    expect(el?.style.top).toBe('247px')
    expect(Number(el?.style.zIndex)).toBeGreaterThan(1000)
  })

  it('a drag moves the pin with the pointer and reports the place it was dropped at, once, on the drop', async () => {
    const google = stageGoogle()
    const moved: unknown[] = []
    startWith(google, { pin: PIN }, moved)
    await google.answer()
    const el = pinEl(google)!
    el.fire('pointerdown', { clientX: 467, clientY: 247, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    el.fire('pointermove', { clientX: 480, clientY: 250, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    expect(el.style.left).toBe('480px')
    expect(moved).toEqual([])
    el.fire('pointerup', { clientX: 480, clientY: 250, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    expect(moved).toEqual([{ lon: 48, lat: 25 }])
  })

  it('a press on the pin that does not move places nothing and moves nothing', async () => {
    const google = stageGoogle()
    const moved: unknown[] = []
    const taps: unknown[][] = []
    startWith(google, { pin: PIN }, moved, taps)
    await google.answer()
    const el = pinEl(google)!
    el.fire('pointerdown', { clientX: 467, clientY: 247, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    el.fire('pointerup', { clientX: 467, clientY: 247, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    expect(moved).toEqual([])
    expect(taps).toEqual([])
  })

  it('a pin that is not draggable takes no drag', async () => {
    const google = stageGoogle()
    const moved: unknown[] = []
    startWith(google, { pin: { ...PIN, draggable: false } }, moved)
    await google.answer()
    const el = pinEl(google)!
    el.fire('pointerdown', { clientX: 467, clientY: 247, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    el.fire('pointermove', { clientX: 480, clientY: 250, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    el.fire('pointerup', { clientX: 480, clientY: 250, pointerId: 1, stopPropagation() {}, preventDefault() {} })
    expect(moved).toEqual([])
    expect(el.style.left).toBe('467px')
  })

  it('a map with no pin draws none (every map before 964)', async () => {
    const google = stageGoogle()
    startWith(google, {})
    await google.answer()
    expect(pinEl(google)).toBeUndefined()
  })
})
