import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import { allowedDimensions, colourDimension, newViewLink, pickableMeasures, readEditorSeed, withMemberSlot } from './editor'

const label = (en: string) => ({ en, ar: '' })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }, { key: 'callouts', available: false, unavailableReason: 'Later.' }],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders'), description: label(''), dimensions: ['channel_group', 'store', 'day'] },
    { key: 'p90', area: 'sales', shape: 'percentile', unit: 'minutes', label: label('P90'), description: label(''), dimensions: ['channel_group', 'day'] },
    { key: 'take_rate', area: 'callouts', shape: 'rate', unit: 'share', label: label('Take rate'), description: label(''), dimensions: ['store'] },
  ],
  dimensions: [
    { key: 'channel_group', kind: 'category', label: label('Channel'), values: [] },
    { key: 'store', kind: 'category', label: label('Store'), values: [] },
    { key: 'day', kind: 'time', label: label('Day'), values: [] },
  ],
}

describe('the editor picks from the model only', () => {
  it('a measure in an unavailable area is not pickable', () => {
    expect(pickableMeasures(MODEL).map((m) => m.key)).toEqual(['orders', 'p90'])
  })
  it('only the breakdowns every chosen measure allows', () => {
    expect(allowedDimensions([], MODEL).map((d) => d.key)).toEqual(['channel_group', 'store', 'day'])
    expect(allowedDimensions(['orders', 'p90'], MODEL).map((d) => d.key)).toEqual(['channel_group', 'day'])
  })
  it('the coloured breakdown is the last category one', () => {
    const d = (dimensions: string[]) => ({ chart: { type: 'line' as const }, query: { measures: ['orders'], dimensions, filters: [] } })
    expect(colourDimension(d(['day', 'store']), MODEL)).toBe('store')
    expect(colourDimension(d(['store', 'channel_group']), MODEL)).toBe('channel_group')
    expect(colourDimension(d(['day']), MODEL)).toBeNull()
  })
})

describe('series colours: a pick swaps, never duplicates', () => {
  it('members on screen settle first; the member that held the slot takes the old one', () => {
    // P1 → 0, P2 → 1, P3 → 2 by the entity rule; P3 picks slot 0, so P1 takes P3's 2.
    expect(withMemberSlot({}, ['P1', 'P2', 'P3'], 'P3', 0)).toEqual({ P1: 2, P2: 1, P3: 0 })
    expect(withMemberSlot({ P2: 4 }, ['P1', 'P2'], 'P1', 3)).toEqual({ P1: 3, P2: 4 })
  })
})

describe('opening the editor seeded', () => {
  it('a seed rides in route state and reads back; anything else is no seed', () => {
    const definition = { chart: { type: 'bar' as const }, query: { measures: ['orders'], dimensions: ['store'], filters: [], period: 'last-7-days' } }
    const link = newViewLink({ definition })
    expect(link.to).toBe('/analytics/new?kind=view')
    expect(readEditorSeed(link.state)?.definition.query).toEqual(definition.query)
    expect(newViewLink().state).toBeNull()
    expect(readEditorSeed(null)).toBeNull()
    expect(readEditorSeed({ editorSeed: { definition: 'x' } })).toBeNull()
  })
})
