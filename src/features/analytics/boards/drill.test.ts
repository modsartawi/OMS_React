import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { crumbsOf, drillTargets, pointOf, toggleCrossFilter } from './drill'

const label = (en: string) => ({ en, ar: `${en}-ar` })
const MODEL: AnalyticsModel = {
  areas: [],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders'), description: label(''), dimensions: ['store', 'city', 'region', 'channel_group', 'day'] },
    { key: 'till_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Till'), description: label(''), dimensions: ['store', 'city', 'region', 'day'] },
  ],
  dimensions: [
    { key: 'store', kind: 'category', label: label('Store'), values: [] },
    { key: 'city', kind: 'category', label: label('City'), values: [] },
    { key: 'region', kind: 'category', label: label('Region'), values: [] },
    { key: 'channel_group', kind: 'category', label: label('Channel'), values: [{ key: 'app', label: label('App') }] },
    { key: 'day', kind: 'time', label: label('Day'), values: [] },
  ],
}
const def = (measures: string[], dimensions: string[]): AnalyticsViewDefinition => ({
  chart: { type: 'bar' },
  query: { measures, dimensions, filters: [], period: 'last-30-days' },
})

describe('cross-filter toggle', () => {
  const p = { source: 'a', dimension: 'store', member: 'P001' }
  it('a click sets it, the same click again clears it, another member replaces it', () => {
    expect(toggleCrossFilter(null, p)).toEqual(p)
    expect(toggleCrossFilter(p, { ...p })).toBeNull()
    expect(toggleCrossFilter(p, { ...p, member: 'P002' })).toEqual({ ...p, member: 'P002' })
    expect(toggleCrossFilter(p, { ...p, source: 'b' })).toEqual({ ...p, source: 'b' })
  })
})

describe('a mark is a point only on a category dimension', () => {
  it('a store bar is a point; a day is not; an unknown dimension is not', () => {
    expect(pointOf('store', 'P001', MODEL)).toEqual({ dimension: 'store', member: 'P001' })
    expect(pointOf('day', '2026-11-01', MODEL)).toBeNull()
    expect(pointOf('weekday', 'Sun', MODEL)).toBeNull()
    expect(pointOf('store', '', MODEL)).toBeNull()
  })
})

describe('drill by: the dimensions offered', () => {
  it('every category dimension all the measures break down by, but the ones in use', () => {
    expect(drillTargets(def(['orders'], ['store']), MODEL, [])).toEqual(['city', 'region', 'channel_group'])
    // Till sales have no channel breakdown, so a view over both never offers it.
    expect(drillTargets(def(['orders', 'till_value'], ['store']), MODEL, [])).toEqual(['city', 'region'])
  })

  it('a dimension already drilled through is not offered again', () => {
    expect(drillTargets(def(['orders'], ['store']), MODEL, [{ dimension: 'store', member: 'P001', into: 'city' }])).toEqual(['region', 'channel_group'])
  })
})

describe('the breadcrumb', () => {
  it('the view, then each step: its point and the breakdown it went into', () => {
    expect(crumbsOf(def(['orders'], ['store']), [{ dimension: 'store', member: 'P001', into: 'city' }, { dimension: 'city', member: 'riyadh', into: 'region' }])).toEqual([
      { depth: 0, dimension: 'store', member: null },
      { depth: 1, dimension: 'city', member: { dimension: 'store', member: 'P001' } },
      { depth: 2, dimension: 'region', member: { dimension: 'city', member: 'riyadh' } },
    ])
  })
})
