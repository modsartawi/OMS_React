import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import { allowedDimensions, colourDimension, colourMemberWords, comparesToPrevious, withCompare, editItemLink, newViewLink, pickableMeasures, readEditorSeed, withMemberSlot } from './editor'

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

describe('series colours: each member reads by its label, never its bare key', () => {
  const withChannels: AnalyticsModel = {
    ...MODEL,
    dimensions: [{ key: 'channel_group', kind: 'category', label: label('Channel'), values: [{ key: 'app', label: { en: 'App', ar: 'التطبيق' } }] }, ...MODEL.dimensions.slice(1)],
  }
  const names = new Map([['P003', { en: 'Corniche', ar: 'الكورنيش' }]])
  it("an inline member reads by the model's label, as free text", () => {
    expect(colourMemberWords('channel_group', 'app', withChannels, names, 'ar')).toEqual({ text: 'التطبيق', kind: 'text' })
  })
  it('a looked-up member reads as its code · name pair, one machine value', () => {
    expect(colourMemberWords('store', 'P003', MODEL, names, 'en')).toEqual({ text: 'P003 · Corniche', kind: 'machine' })
  })
  it('a member nothing names reads as its code', () => {
    expect(colourMemberWords('store', 'P009', MODEL, names, 'en')).toEqual({ text: 'P009', kind: 'machine' })
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

  it('editing an existing item seeds its definition, words and standing (776)', () => {
    const definition = { chart: { type: 'bar' as const }, query: { measures: ['orders'], dimensions: ['store'], filters: [], period: 'last-7-days' } }
    const item = {
      id: 'v-titled',
      kind: 'view' as const,
      title: { en: 'Orders', ar: 'الطلبات' },
      subtitle: { en: '', ar: '' },
      owner: 'aalharbi',
      tier: 'shared' as const,
      copiedFrom: null,
      sourceChangedSinceCopy: false,
      revision: 4,
      updatedAt: '2026-11-05T09:00:00',
      updatedBy: 'aalharbi',
      definition,
    }
    const seed = readEditorSeed(editItemLink(item).state)
    expect(editItemLink(item).to).toBe('/analytics/new?kind=view')
    expect(seed?.title).toEqual({ en: 'Orders', ar: 'الطلبات' })
    expect(seed?.item).toEqual({ id: 'v-titled', kind: 'view', owner: 'aalharbi', tier: 'shared', revision: 4, copiedFrom: null, sourceChangedSinceCopy: false })
    expect(readEditorSeed(newViewLink({ definition }).state)?.item).toBeUndefined()
    // A malformed standing is no standing: the editor then saves a new item, never PUTs blind.
    expect(readEditorSeed({ editorSeed: { definition, item: { id: 'v-1' } } })?.item).toBeUndefined()
  })
})

describe('compare with the previous period (766 story 23)', () => {
  it('is offered where the shape allows it: a KPI and a line over time', () => {
    expect(comparesToPrevious('kpi')).toBe(true)
    expect(comparesToPrevious('line')).toBe(true)
    for (const c of ['area', 'bar-vertical', 'bar-grouped', 'donut', 'table', 'heatmap', 'combo'] as const) expect(comparesToPrevious(c)).toBe(false)
  })
  it('is stored in the definition when on and offered, and left out otherwise', () => {
    const q = { measures: ['orders'], dimensions: [], filters: [], period: 'last-7-days' }
    expect(withCompare(q, 'kpi', true)).toEqual({ ...q, compareToPrevious: true })
    expect(withCompare({ ...q, compareToPrevious: true }, 'kpi', false)).toEqual(q)
    expect(withCompare({ ...q, compareToPrevious: true }, 'table', true)).toEqual(q)
  })
})
