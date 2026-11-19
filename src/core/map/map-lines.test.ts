import { describe, expect, it } from 'vitest'
import { openMapPanel, type MapEngine, type MapEngineStart, type MapLine, type MapPoint } from './map-panel'

// Ticket 922 (BackOffice spec 4050): the map panel draws LINES as well as points — a pattern case's route between
// pharmacies, each leg a line labelled with its km and time. Optional and backward compatible: a map given no lines
// hands the engine none. Driven through the panel with the engine a stand-in (seam 6 of spec 3630): the tests read
// what the panel hands the engine, never Google or pixels.

const MAPS = { key: 'planted-test-key' }

function standIn() {
  const started: MapEngineStart[] = []
  const engine: MapEngine = {
    start(start) {
      started.push(start)
      return { destroy: () => {}, zoomTo: () => {}, fit: () => {}, project: (x, y) => ({ x, y }) }
    },
  }
  return {
    engine,
    get start() {
      return started[0]
    },
  }
}

const RIYADH = { lon: 46.675, lat: 24.713 }
const QASSIM = { lon: 43.975, lat: 26.326 }
const DAMMAM = { lon: 50.103, lat: 26.434 }

const point = (id: string, at: { lon: number; lat: number }): MapPoint => ({ id, ...at })

function open(points: MapPoint[], lines?: MapLine[]) {
  const e = standIn()
  openMapPanel({
    engine: e.engine,
    container: null,
    points,
    lines,
    lang: 'en',
    dir: 'ltr',
    maps: MAPS,
    inkOf: (token) => `ink(${token})`,
    onDrawn: () => {},
    onCannotDraw: () => {},
  })
  return e
}

describe('the panel hands the engine each line, its colour resolved and its words as given', () => {
  it('a line arrives with its ends, its tone as a colour and its label', () => {
    const e = open(
      [point('R', RIYADH), point('Q', QASSIM)],
      [{ id: 'leg-1', from: RIYADH, to: QASSIM, tone: '--map-worse', label: '312 km · 1 h 40 min' }],
    )
    expect(e.start.lines).toEqual([{ id: 'leg-1', from: RIYADH, to: QASSIM, stroke: 'ink(--map-worse)', label: '312 km · 1 h 40 min', strong: false }])
  })

  it('in the order given — the caller orders a route by time', () => {
    const e = open(
      [point('R', RIYADH), point('Q', QASSIM), point('D', DAMMAM)],
      [
        { id: 'leg-1', from: RIYADH, to: QASSIM, tone: '--map-ring' },
        { id: 'leg-2', from: QASSIM, to: DAMMAM, tone: '--map-worse' },
      ],
    )
    expect(e.start.lines?.map((l) => [l.id, l.stroke])).toEqual([
      ['leg-1', 'ink(--map-ring)'],
      ['leg-2', 'ink(--map-worse)'],
    ])
  })

  it('a strong line (one that must read through the others: a warning) is handed on as strong; any other is not', () => {
    const e = open(
      [point('R', RIYADH), point('Q', QASSIM), point('D', DAMMAM)],
      [
        { id: 'leg-1', from: RIYADH, to: QASSIM, tone: '--map-worse', strong: true },
        { id: 'leg-2', from: QASSIM, to: DAMMAM, tone: '--map-ring' },
      ],
    )
    expect(e.start.lines?.map((l) => [l.id, l.strong])).toEqual([
      ['leg-1', true],
      ['leg-2', false],
    ])
  })

  it('a line with no label carries empty words', () => {
    const e = open([point('R', RIYADH), point('Q', QASSIM)], [{ id: 'leg-1', from: RIYADH, to: QASSIM, tone: '--map-ring' }])
    expect(e.start.lines?.[0].label).toBe('')
  })

  it('no lines given (every map before 922): the engine is handed none', () => {
    const e = open([point('R', RIYADH), point('Q', QASSIM)])
    expect(e.start.lines).toEqual([])
  })
})

describe('the view the map opens on holds every line as well as every point', () => {
  it('a line reaching past the points widens the box to its far end', () => {
    const e = open([point('R', RIYADH), point('Q', QASSIM)], [{ id: 'leg-1', from: QASSIM, to: DAMMAM, tone: '--map-ring' }])
    expect(e.start.view).toEqual({ kind: 'bounds', west: 43.975, south: 24.713, east: 50.103, north: 26.434 })
  })

  it('lines alone, with no point, are fitted too', () => {
    const e = open([], [{ id: 'leg-1', from: RIYADH, to: QASSIM, tone: '--map-ring' }])
    expect(e.start.view).toEqual({ kind: 'bounds', west: 43.975, south: 24.713, east: 46.675, north: 26.326 })
  })

  it('with no lines the view is the points’ own, as before', () => {
    const e = open([point('R', RIYADH), point('Q', QASSIM)])
    expect(e.start.view).toEqual({ kind: 'bounds', west: 43.975, south: 24.713, east: 46.675, north: 26.326 })
  })
})
