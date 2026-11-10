import { describe, expect, it } from 'vitest'
import type { AnalyticsModel } from '@/core/models/analytics'
import { allowedDimensions, colourDimension, colourMemberWords, comparesToPrevious, withCompare, editItemLink, newViewLink, pickableMeasures, readEditorSeed, withMemberSlot, pickerSubjects, moveDimension, dimensionRole, searchableFilterDimensions, grainFor, readRange, rangePeriod, rangeProblem } from './editor'

const label = (en: string) => ({ en, ar: '' })
const MODEL: AnalyticsModel = {
  areas: [{ key: 'sales', available: true }, { key: 'callouts', available: false, unavailableReason: { en: 'Later.', ar: 'لاحقاً.' } }],
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
  it('a chart that colours no member has no coloured breakdown (local walk 2026-11-10: a table listed every store)', () => {
    for (const type of ['table', 'kpi', 'heatmap', 'combo'] as const)
      expect(colourDimension({ chart: { type }, query: { measures: ['orders'], dimensions: ['store'], filters: [] } }, MODEL)).toBeNull()
    for (const type of ['bar', 'donut', 'line', 'area'] as const)
      expect(colourDimension({ chart: { type }, query: { measures: ['orders'], dimensions: ['store'], filters: [] } }, MODEL)).toBe('store')
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
  it('is offered where the shape shows it: a KPI, a line over time, a table and a bar (spec 3519 review)', () => {
    for (const c of ['kpi', 'line', 'table', 'bar-vertical', 'bar-grouped'] as const) expect(comparesToPrevious(c)).toBe(true)
    for (const c of ['area', 'donut', 'heatmap', 'combo'] as const) expect(comparesToPrevious(c)).toBe(false)
  })
  it('is stored in the definition when on and offered, and left out otherwise', () => {
    const q = { measures: ['orders'], dimensions: [], filters: [], period: 'last-7-days' }
    expect(withCompare(q, 'kpi', true)).toEqual({ ...q, compareToPrevious: true })
    expect(withCompare({ ...q, compareToPrevious: true }, 'kpi', false)).toEqual(q)
    expect(withCompare({ ...q, compareToPrevious: true }, 'donut', true)).toEqual(q)
  })
})

describe('builder pass (CTO demo)', () => {
  const m = (key: string, area: string, label: string, description = '') => ({
    key, area, shape: 'additive' as const, unit: 'count' as const, label: { en: label, ar: label }, description: { en: description, ar: description }, dimensions: ['date', 'city'],
  })
  const model = {
    areas: [{ key: 'ops', available: true }, { key: 'till', available: true }],
    measures: [m('delivery_count', 'ops', 'Deliveries', 'Deliveries created'), m('failure_rate', 'ops', 'Failure rate'), m('till_sales', 'till', 'Till sales')],
    dimensions: [
      { key: 'date', kind: 'time' as const, label: { en: 'Date', ar: 'التاريخ' }, values: [] },
      { key: 'city', kind: 'category' as const, label: { en: 'City', ar: 'المدينة' }, values: [] },
      { key: 'store_name', kind: 'category' as const, label: { en: 'Store name', ar: 'اسم الفرع' }, values: [] },
    ],
  }

  it('groups measures by subject, the chosen subject first; another subject stays open (864: up to four)', () => {
    const groups = pickerSubjects(model, ['till_sales'], '', 'en')
    expect(groups.map((g) => g.area)).toEqual(['till', 'ops'])
    expect(groups.flatMap((g) => g.measures).every((x) => x.blocked === null)).toBe(true)
  })

  it('searches label and description, and drops subjects with no match', () => {
    expect(pickerSubjects(model, [], 'created', 'en').map((g) => g.measures.map((x) => x.key))).toEqual([['delivery_count']])
  })

  it('moves a breakdown and names its role', () => {
    expect(moveDimension(['date', 'city'], 1, -1)).toEqual(['city', 'date'])
    expect(moveDimension(['date', 'city'], 0, -1)).toEqual(['date', 'city'])
    expect([0, 1, 2].map(dimensionRole)).toEqual(['axis', 'series', 'column'])
  })

  it('offers searchable filters on open breakdowns, not on the store name', () => {
    expect(searchableFilterDimensions(model.dimensions).map((d) => d.key)).toEqual(['city'])
  })

  it('keeps a grain only with a date breakdown, and leaves day out', () => {
    expect(grainFor(['date'], model, 'week')).toBe('week')
    expect(grainFor(['date'], model, 'day')).toBeNull()
    expect(grainFor(['city'], model, 'month')).toBeNull()
  })

  it('reads and checks a custom range', () => {
    expect(readRange(rangePeriod('2026-10-01', '2026-10-31'))).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(readRange('last-30-days')).toBeNull()
    expect(rangeProblem('2026-10-31', '2026-10-01')).toBe('reversed')
    expect(rangeProblem('', '2026-10-01')).toBe('incomplete')
  })
})
