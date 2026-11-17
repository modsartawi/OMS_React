import { describe, expect, it } from 'vitest'
import { openMapPanel, type MapEngine, type MapEngineEvents, type MapEngineStart, type MapPoint, type MapTarget } from './map-panel'
import { cardAfter, GROUP_INK, pointRadius, POINT_RADIUS, type MapCardState } from './map-drawing'

// Ticket 881 (BackOffice spec 3630 M15-M20, M23): what the panel would draw — each point's size, colour and hollow,
// nearby stores joined into one group, and the card a point shows. The engine is a stand-in: the tests read the
// features the panel hands it at a zoom, and play the pointer and the tap as the engine would report them.

const ORIGIN = 'https://oms.example.test'

function standIn() {
  const started: MapEngineStart[] = []
  let events: MapEngineEvents | null = null
  const zooms: { lon: number; lat: number; zoom: number }[] = []
  const engine: MapEngine = {
    start(start, ev) {
      started.push(start)
      events = ev
      return { destroy: () => {}, zoomTo: (lon, lat, zoom) => void zooms.push({ lon, lat, zoom }) }
    },
  }
  return {
    engine,
    zooms,
    get start() {
      return started[0]
    },
    get events() {
      if (!events) throw new Error('the engine was not started')
      return events
    },
  }
}

/** The ink resolver the stand-in uses: a token reads as its own name, so a test sees which token was chosen. */
const inkOf = (token: string) => `ink(${token})`

function open(points: readonly MapPoint[], over: Partial<Parameters<typeof openMapPanel>[0]> = {}) {
  const e = standIn()
  const cards: (MapCardState | null)[] = []
  openMapPanel({
    engine: e.engine,
    container: null,
    points,
    lang: 'en',
    dir: 'ltr',
    origin: ORIGIN,
    inkOf,
    onDrawn: () => {},
    onCannotDraw: () => {},
    onCard: (c) => cards.push(c),
    ...over,
  })
  return { e, cards }
}

// Three Olaya stores a few hundred metres apart, and one in Jeddah: at a country zoom the three are one group.
const OLAYA_1: MapPoint = { id: 'R001', lon: 46.6853, lat: 24.6943, size: 1, weight: 1200.5, ink: '--map-better' }
const OLAYA_2: MapPoint = { id: 'R002', lon: 46.6871, lat: 24.6961, size: 0.25, weight: 300.25, ink: '--map-worse' }
const OLAYA_3: MapPoint = { id: 'R003', lon: 46.6839, lat: 24.6922, size: 0, hollow: true, weight: -40, ink: '--map-same' }
const JEDDAH: MapPoint = { id: 'J001', lon: 39.172, lat: 21.543, size: 0.5, weight: 700, ink: '--map-same' }
const STORES = [OLAYA_1, OLAYA_2, OLAYA_3, JEDDAH]

const COUNTRY = 5
const STREET = 17

const featureOf = (start: MapEngineStart, zoom: number, id: string) => start.featuresAt(zoom).find((f) => f.id === id)
const groupsOf = (start: MapEngineStart, zoom: number) => start.featuresAt(zoom).filter((f) => f.kind === 'group')

describe("each point's area follows its value between the legend's smallest and largest (M15)", () => {
  it('the smallest share is the smallest point, the largest share the largest', () => {
    expect(pointRadius(0)).toBe(POINT_RADIUS.min)
    expect(pointRadius(1)).toBe(POINT_RADIUS.max)
  })

  it('by area, not by radius: half the share is half-way between the two areas', () => {
    const area = (r: number) => Math.PI * r * r
    expect(area(pointRadius(0.5))).toBeCloseTo((area(POINT_RADIUS.min) + area(POINT_RADIUS.max)) / 2, 6)
    expect(area(pointRadius(0.25))).toBeCloseTo(area(POINT_RADIUS.min) + 0.25 * (area(POINT_RADIUS.max) - area(POINT_RADIUS.min)), 6)
  })

  it('the panel hands the engine each point at its own size', () => {
    const { e } = open(STORES)
    expect(featureOf(e.start, STREET, 'R001')?.radius).toBe(POINT_RADIUS.max)
    expect(featureOf(e.start, STREET, 'R002')?.radius).toBeCloseTo(pointRadius(0.25), 9)
    expect(featureOf(e.start, STREET, 'J001')?.radius).toBeCloseTo(pointRadius(0.5), 9)
  })
})

describe('a row marked hollow is the smallest point, hollow (M15)', () => {
  it('drawn at the smallest size, with no fill and its own colour as the ring', () => {
    const { e } = open(STORES)
    const f = featureOf(e.start, STREET, 'R003')!
    expect(f.radius).toBe(POINT_RADIUS.min)
    expect(f.fillOpacity).toBe(0)
    expect(f.stroke).toBe('ink(--map-same)')
  })

  it('a filled point is filled with its colour', () => {
    const { e } = open(STORES)
    const f = featureOf(e.start, STREET, 'R001')!
    expect(f.fillOpacity).toBe(1)
    expect(f.fill).toBe('ink(--map-better)')
  })
})

describe('each point takes the colour it is given (M16)', () => {
  it('every point keeps its own step colour, resolved from its token', () => {
    const { e } = open(STORES)
    expect(featureOf(e.start, STREET, 'R001')?.fill).toBe('ink(--map-better)')
    expect(featureOf(e.start, STREET, 'R002')?.fill).toBe('ink(--map-worse)')
    expect(featureOf(e.start, STREET, 'J001')?.fill).toBe('ink(--map-same)')
  })

  it('a point given no colour and no size is the plain point of one colour (879, and the one-measure map)', () => {
    const { e } = open([{ id: 'R001', lon: 46.6853, lat: 24.6943 }])
    const f = featureOf(e.start, STREET, 'R001')!
    expect(f.fill).toBe('ink(--chart-1)')
    expect(f.fillOpacity).toBe(1)
  })
})

describe('stores close together on screen join into one point until the reader zooms in (M19)', () => {
  it('at a country zoom the three Olaya stores are one group of 3; Jeddah stays a point', () => {
    const { e } = open(STORES)
    const groups = groupsOf(e.start, COUNTRY)
    expect(groups).toHaveLength(1)
    expect(groups[0].members).toEqual(['R001', 'R002', 'R003'])
    expect(featureOf(e.start, COUNTRY, 'J001')?.kind).toBe('point')
    expect(e.start.featuresAt(COUNTRY)).toHaveLength(2)
  })

  it('at street zoom every store is its own point', () => {
    const { e } = open(STORES)
    expect(groupsOf(e.start, STREET)).toEqual([])
    expect(e.start.featuresAt(STREET).map((f) => f.id).sort()).toEqual(['J001', 'R001', 'R002', 'R003'])
  })

  it('a group stands at the middle of its stores', () => {
    const { e } = open(STORES)
    const g = groupsOf(e.start, COUNTRY)[0]
    expect(g.lon).toBeCloseTo((46.6853 + 46.6871 + 46.6839) / 3, 9)
    expect(g.lat).toBeCloseTo((24.6943 + 24.6961 + 24.6922) / 3, 9)
  })

  it('a click on a group zooms in, centred on it, to the first zoom where it opens', () => {
    const { e } = open(STORES)
    const g = groupsOf(e.start, COUNTRY)[0]
    e.events.tap({ id: g.id, x: 10, y: 10 }, COUNTRY)
    expect(e.zooms).toHaveLength(1)
    const to = e.zooms[0]
    expect(to.lon).toBeCloseTo(g.lon, 9)
    expect(to.lat).toBeCloseTo(g.lat, 9)
    expect(to.zoom).toBeGreaterThan(COUNTRY)
    // At the zoom it opens to, those three are no longer one group; one zoom less, they still are.
    const together = (zoom: number) => groupsOf(e.start, zoom).some((x) => x.members?.length === 3)
    expect(together(to.zoom)).toBe(false)
    expect(together(to.zoom - 1)).toBe(true)
  })
})

describe("a group shows its count, and its size measure's sum only when the size adds up (M19, M20)", () => {
  const formatSum = (n: number) => `sum ${n}`

  it('with an additive size, the group reads its count and the sum of its rows as the server sent them', () => {
    const { e } = open(STORES, { grouping: { sums: true, formatSum } })
    // 1200.5 + 300.25 + (-40): the rows as sent, the hollow one's negative figure included.
    expect(groupsOf(e.start, COUNTRY)[0].label).toBe('3\nsum 1460.75')
  })

  it('with a rate, the group reads its count only', () => {
    const { e } = open(STORES, { grouping: { sums: false, formatSum } })
    expect(groupsOf(e.start, COUNTRY)[0].label).toBe('3')
  })

  it('a member with no figure adds nothing to the sum', () => {
    const { e } = open([OLAYA_1, { ...OLAYA_2, weight: null }], { grouping: { sums: true, formatSum } })
    expect(groupsOf(e.start, COUNTRY)[0].label).toBe('2\nsum 1200.5')
  })

  it('a point that is not a group carries no words', () => {
    const { e } = open(STORES, { grouping: { sums: true, formatSum } })
    expect(featureOf(e.start, COUNTRY, 'J001')?.label).toBe('')
  })
})

describe("a group has one neutral colour whatever its members' steps (M19)", () => {
  it('better, worse and hollow members make a group of the neutral colour', () => {
    const { e } = open(STORES)
    const g = groupsOf(e.start, COUNTRY)[0]
    expect(g.fill).toBe(`ink(${GROUP_INK})`)
    expect(g.fillOpacity).toBe(1)
  })
})

describe('pointing at a store shows its card; a tap pins it; a tap elsewhere closes it (M23)', () => {
  const at = (id: string): MapTarget => ({ id, x: 120, y: 80 })

  it('pointing shows the card of that store, where it is pointed at', () => {
    expect(cardAfter(null, { kind: 'point', target: at('R001') })).toEqual({ id: 'R001', x: 120, y: 80, pinned: false })
  })

  it('pointing away hides an unpinned card', () => {
    expect(cardAfter({ id: 'R001', x: 1, y: 1, pinned: false }, { kind: 'point', target: null })).toBeNull()
  })

  it('a tap pins the card, and pointing elsewhere then leaves it', () => {
    const pinned = cardAfter(null, { kind: 'tap', target: at('R001') })
    expect(pinned).toEqual({ id: 'R001', x: 120, y: 80, pinned: true })
    expect(cardAfter(pinned, { kind: 'point', target: null })).toBe(pinned)
    expect(cardAfter(pinned, { kind: 'point', target: at('R002') })).toBe(pinned)
  })

  it('a second tap elsewhere closes the pinned card', () => {
    expect(cardAfter({ id: 'R001', x: 1, y: 1, pinned: true }, { kind: 'tap', target: null })).toBeNull()
  })

  it('a tap on another store pins that store instead', () => {
    expect(cardAfter({ id: 'R001', x: 1, y: 1, pinned: true }, { kind: 'tap', target: at('R002') })).toEqual({ id: 'R002', x: 120, y: 80, pinned: true })
  })

  it('the panel turns the engine’s pointer and taps into the card the caller draws', () => {
    const { e, cards } = open(STORES)
    e.events.pointer(at('R001'), STREET)
    e.events.tap(at('R001'), STREET)
    e.events.pointer(null, STREET)
    e.events.tap(null, STREET)
    expect(cards).toEqual([
      { id: 'R001', x: 120, y: 80, pinned: false },
      { id: 'R001', x: 120, y: 80, pinned: true },
      null,
    ])
  })

  it('pointing at a group shows no card; a tap on it opens it instead', () => {
    const { e, cards } = open(STORES)
    const g = groupsOf(e.start, COUNTRY)[0]
    e.events.pointer({ id: g.id, x: 5, y: 5 }, COUNTRY)
    expect(cards).toEqual([])
  })
})
