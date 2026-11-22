/**
 * oms 947 (BackOffice spec 4165 "The kingdom map"): what the map and the region table show under a filter — each
 * pharmacy's point in its stored colour, each region's shape in the server's shade step, each region's row with the
 * server's counts. The page picks no colour and computes no figure: it reads the filter's column of what was sent.
 */
import { describe, expect, it } from 'vitest'
import { mapHomeFixture } from './__fixtures__/map'
import { kingdomView, mapSelectionAction, NO_REGION, REGION_SHAPES, regionView, selectRegion } from './map-view'
import { mapViewKey } from '@/core/map/map-panel'

const inkOf = (view: ReturnType<typeof kingdomView>, id: string) => view.points.find((p) => p.id === id)
const fillOf = (view: ReturnType<typeof kingdomView>, id: string) => view.polygons.find((p) => p.id === id)?.fill
const rowOf = (view: ReturnType<typeof kingdomView>, region: string) => view.rows.find((r) => r.region === region)

describe('the filter changes the points, the shading and the table together', () => {
  const home = mapHomeFixture('en')

  it('all issues: each point in its map colour, each region in its share step, the table its all-issues counts', () => {
    const view = kingdomView(home, 'all')
    expect(['P166', 'P031', 'P402', 'B002'].map((id) => inkOf(view, id)?.ink)).toEqual(['--danger', '--attention', '--success', '--success'])
    expect(fillOf(view, 'Center')).toBe('--map-scale-4')
    expect(fillOf(view, 'North')).toBe('--map-scale-5')
    expect(fillOf(view, 'BH')).toBe('--map-none')
    expect(rowOf(view, 'Center')).toMatchObject({ name: 'Center', scored: 260, flagged: 100, share: '38%' })
  })

  it('stock: the same pharmacies in their stock colours, the regions in their stock steps, the table its stock counts', () => {
    const view = kingdomView(home, 'stock')
    expect(['P166', 'P031', 'P402', 'B002'].map((id) => inkOf(view, id)?.ink)).toEqual(['--success', '--danger', '--success', '--attention'])
    expect(fillOf(view, 'Center')).toBe('--map-scale-1')
    expect(fillOf(view, 'South')).toBe('--map-scale-4')
    expect(rowOf(view, 'Center')).toMatchObject({ scored: 258, flagged: 22, share: '9%' })
    expect(rowOf(view, 'South')).toMatchObject({ scored: 108, flagged: 41, share: '38%' })
  })

  it('delivery: a pharmacy not scored on delivery is drawn hollow and grey, not given a colour', () => {
    const view = kingdomView(home, 'delivery')
    expect(inkOf(view, 'P402')).toMatchObject({ hollow: true, ink: '--map-same' })
    expect(inkOf(view, 'P166')).toMatchObject({ ink: '--attention' })
    expect(inkOf(view, 'P166')?.hollow).toBeFalsy()
  })

  it('the rows keep the server’s order and every region and Bahrain has a shape to shade', () => {
    const view = kingdomView(home, 'all')
    expect(view.rows.map((r) => r.region)).toEqual(['Center', 'East', 'North', 'South', 'West', 'BH'])
    expect(REGION_SHAPES.map((s) => s.region).sort()).toEqual(['BH', 'Center', 'East', 'North', 'South', 'West'])
    for (const id of ['Center', 'East', 'North', 'South', 'West', 'BH']) expect(view.polygons.find((p) => p.id === id)?.rings.length).toBeGreaterThan(0)
  })
})

describe('selecting a region zooms to it', () => {
  it('Bahrain: the box round the island, holding its pharmacy, under a degree across', () => {
    const view = regionView('BH')
    if (view?.kind !== 'bounds') throw new Error('no box')
    expect(view.west < 50.58 && 50.58 < view.east && view.south < 26.22 && 26.22 < view.north).toBe(true)
    expect(view.east - view.west).toBeLessThan(1)
  })

  it('the Center region holds Riyadh and not Jeddah; a region with no shape has no view', () => {
    const view = regionView('Center')
    if (view?.kind !== 'bounds') throw new Error('no box')
    expect(view.west < 46.68 && 46.68 < view.east && view.south < 24.71 && 24.71 < view.north).toBe(true)
    expect(view.west).toBeGreaterThan(39.17)
    expect(regionView('Atlantis')).toBeNull()
  })
})

describe('choosing on the map (review A6, C4)', () => {
  it('a point opens its pharmacy; a shape chooses its region', () => {
    expect(mapSelectionAction({ kind: 'point', id: 'P166' })).toEqual({ kind: 'store', storeCode: 'P166' })
    expect(mapSelectionAction({ kind: 'shape', id: 'WEST' })).toEqual({ kind: 'region', region: 'WEST' })
  })

  it('choosing the same region again moves the map back to it: each choice is a new view key', () => {
    const once = selectRegion(NO_REGION, 'WEST')
    const twice = selectRegion(once, 'WEST')
    expect(once.region).toBe('WEST')
    expect(twice.region).toBe('WEST')
    const view = regionView(REGION_SHAPES[0].region)!
    expect(mapViewKey(view, twice.nonce)).not.toBe(mapViewKey(view, once.nonce))
    // The same view and the same choice: the same key, so a re-render alone never moves the map.
    expect(mapViewKey(view, once.nonce)).toBe(mapViewKey({ ...view }, once.nonce))
    expect(selectRegion(twice, null).region).toBeNull()
  })
})
