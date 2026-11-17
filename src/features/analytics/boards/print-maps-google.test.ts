/**
 * The print page's maps on Google (oms-react 910, BackOffice spec 3630 M37, M38 as amended; ADR 0139). 883's rule is
 * unchanged: the page is ready only once every map has drawn or fallen back to its table, after 20 seconds at most.
 * Here the map under it is Google's, so the whole chain the print page runs is put together as `MapBody` puts it:
 * Google's loader (`createGoogleLoader`, the page a stand-in), the Google adapter (`googleEngine`, Google's script a
 * stand-in `google.maps`), the panel (`openMapPanel`) and the page's maps (`createPrintMaps`, `printReady`), on a fake
 * clock. The stand-ins play what Google does: the script answers or not, Google refuses the key, the tiles never come.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { googleEngine } from '@/core/map/google-engine'
import { createGoogleLoader, GOOGLE_LOAD_TIMEOUT_MS, type LoaderPage } from '@/core/map/google-loader'
import { openMapPanel, type MapsAccess } from '@/core/map/map-panel'
import { createPrintMaps, MAP_PRINT_TIMEOUT_MS, printReady, type PrintMaps } from './print-maps'

const KEY = 'planted-test-key'
const RIYADH = [
  { id: 'P001', lon: 46.6853, lat: 24.6943 },
  { id: 'P002', lon: 46.7311, lat: 24.6612 },
]

/** One Google map as the adapter made it: the test fires Google's events on it. */
class StagedMap {
  readonly handlers = new Map<string, (() => void)[]>()
  constructor(
    readonly el: unknown,
    readonly options: Record<string, unknown>,
    made: StagedMap[],
  ) {
    made.push(this)
  }
  addListener(event: string, handler: () => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    return { remove: () => this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== handler)) }
  }
  fire(event: string) {
    for (const h of this.handlers.get(event) ?? []) h()
  }
  fitBounds() {}
  setOptions() {}
  setCenter() {}
  setZoom() {}
  panTo() {}
  getZoom() {
    return 12
  }
  getBounds() {
    return undefined
  }
  getProjection() {
    return undefined
  }
}

/** The browser page and Google's script, staged: the test decides whether and how Google answers. */
function stageGoogle() {
  const made: StagedMap[] = []
  const scripts: { src: string; fail: () => void }[] = []
  const win: Record<string, unknown> = {}
  class OverlayView {
    setMap() {}
    getPanes() {
      return null
    }
    getProjection() {
      return undefined
    }
    static preventMapHitsAndGesturesFrom() {}
  }
  const ns = {
    importLibrary: async () => ({
      Map: class extends StagedMap {
        constructor(el: unknown, options: Record<string, unknown>) {
          super(el, options, made)
        }
      },
      RenderingType: { RASTER: 'RASTER' },
    }),
    ControlPosition: { TOP_LEFT: 'TOP_LEFT', TOP_RIGHT: 'TOP_RIGHT' },
    OverlayView,
    event: { addListenerOnce: (target: StagedMap, event: string, handler: () => void) => target.addListener(event, handler) },
  }
  const page: LoaderPage = {
    addScript: (src, onError) => void scripts.push({ src, fail: onError }),
    setGlobal: (name, value) => void (win[name] = value),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    mapsReady: () => win.google !== undefined,
  }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { createElement: () => ({ style: {}, setAttribute() {}, replaceChildren() {}, appendChild() {}, remove() {} }) })
  const loader = createGoogleLoader(page)
  return {
    loader,
    scripts,
    made,
    /** Google's script arrived: `google.maps` is defined and the callback is called. */
    answer: async () => {
      win.google = { maps: ns }
      const callback = new URL(scripts[0].src).searchParams.get('callback')!
      ;(win[callback] as () => void)()
      await vi.advanceTimersByTimeAsync(0)
    },
    /** The script tag failed (the host blocked, the network down). */
    blocked: async () => {
      scripts[0].fail()
      await vi.advanceTimersByTimeAsync(0)
    },
    /** Google refused the key or the page (`gm_authFailure`). */
    refuse: async () => {
      ;(win.gm_authFailure as () => void)()
      await vi.advanceTimersByTimeAsync(0)
    },
  }
}

/** A map block on the print page, wired as `MapBody` wires it: the panel's endings go to the page's maps. */
function mapBlock(google: ReturnType<typeof stageGoogle>, maps: PrintMaps, id: string, access: MapsAccess | null = { key: KEY }) {
  maps.join(id)
  return openMapPanel({
    engine: googleEngine(google.loader),
    container: { clientWidth: 688, clientHeight: 320, appendChild() {} },
    points: RIYADH,
    lang: 'en',
    dir: 'ltr',
    maps: access,
    onDrawn: () => maps.drawn(id),
    onCannotDraw: () => maps.cannotDraw(id),
  })
}

const ready = (maps: PrintMaps) => printReady({ idle: true, settledAt: maps.revision(), maps })

describe("the print page waits for Google's map and falls back to the table when Google cannot be reached", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('a map whose tiles have loaded and that is idle is drawn, and only then is the page ready', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    await google.answer()
    expect(google.made).toHaveLength(1)
    google.made[0].fire('tilesloaded')
    expect(ready(maps)).toBe(false)
    google.made[0].fire('idle')
    expect(maps.state('m1')).toBe('drawn')
    expect(ready(maps)).toBe(true)
  })

  it('a map Google refuses (gm_authFailure: the key or the referrer refused, the quota spent) falls back at once, and the page is ready', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    await google.answer()
    await google.refuse()
    expect(maps.state('m1')).toBe('fell-back')
    expect(ready(maps)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a map whose loader never answers falls back when the loader gives up (15 s), inside the page’s 20 s, and the page is ready', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    expect(google.scripts).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(GOOGLE_LOAD_TIMEOUT_MS - 1)
    expect(maps.state('m1')).toBe('drawing')
    expect(ready(maps)).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(maps.state('m1')).toBe('fell-back')
    expect(ready(maps)).toBe(true)
    expect(GOOGLE_LOAD_TIMEOUT_MS).toBeLessThan(MAP_PRINT_TIMEOUT_MS)
  })

  it('a map whose script is blocked falls back at once', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    await google.blocked()
    expect(maps.state('m1')).toBe('fell-back')
    expect(ready(maps)).toBe(true)
  })

  it('a Google map that loaded its script but no tiles in 20 seconds falls back, and tiles arriving later change nothing', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    await google.answer()
    google.made[0].fire('idle')
    await vi.advanceTimersByTimeAsync(MAP_PRINT_TIMEOUT_MS - 1)
    expect(maps.state('m1')).toBe('drawing')
    expect(ready(maps)).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(maps.state('m1')).toBe('fell-back')
    expect(ready(maps)).toBe(true)
    google.made[0].fire('tilesloaded')
    expect(maps.state('m1')).toBe('fell-back')
  })

  it('a map Google refuses after its tiles were drawn (Google greys it out) prints as its table', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    await google.answer()
    google.made[0].fire('tilesloaded')
    google.made[0].fire('idle')
    expect(maps.state('m1')).toBe('drawn')
    await google.refuse()
    expect(maps.state('m1')).toBe('fell-back')
    expect(ready(maps)).toBe(true)
  })

  it('a map with no key falls back at once and Google is never asked', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1', null)
    expect(maps.state('m1')).toBe('fell-back')
    expect(google.scripts).toHaveLength(0)
    expect(ready(maps)).toBe(true)
  })

  it('two maps on one page share one script, and one refusal falls both back', async () => {
    const google = stageGoogle()
    const maps = createPrintMaps()
    mapBlock(google, maps, 'm1')
    mapBlock(google, maps, 'm2')
    expect(google.scripts).toHaveLength(1)
    await google.answer()
    google.made[0].fire('tilesloaded')
    google.made[0].fire('idle')
    expect(ready(maps)).toBe(false)
    await google.refuse()
    expect(maps.state('m1')).toBe('fell-back')
    expect(maps.state('m2')).toBe('fell-back')
    expect(ready(maps)).toBe(true)
  })
})
