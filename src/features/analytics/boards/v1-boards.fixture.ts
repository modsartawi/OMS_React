import type { AnalyticsBoardDefinition, AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'

/**
 * v1's boards, for the 821 parity tests (spec 819 §C): the drive's stub boards (771 `b-ops`, 772
 * `b-stores`, 777 `b-777`) plus one with saved filters, their views and a model where not every measure
 * breaks down by every place. Test data only — no screen imports it.
 *
 * `v1-permalink-keys.json` beside it is the oracle: every board × permalink's panel keys, captured by
 * running v1's own `readBoardFilters` + `effectiveQuery` (at 4131741e, before 821) over these fixtures.
 */

const label = (en: string) => ({ en, ar: en })

export const V1_MODEL: AnalyticsModel = {
  areas: [],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders'), description: label(''), dimensions: ['channel_group', 'store', 'city', 'region', 'country', 'day'] },
    // No channel breakdown: a channel filter never reaches till sales.
    { key: 'till_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Till'), description: label(''), dimensions: ['store', 'city', 'region', 'day'] },
    // Store and channel only: city, region and country never reach deliveries.
    { key: 'deliveries', area: 'sales', shape: 'additive', unit: 'count', label: label('Deliveries'), description: label(''), dimensions: ['channel_group', 'store', 'day'] },
  ],
  dimensions: [
    { key: 'channel_group', kind: 'category', label: label('Channel'), values: [{ key: 'app', label: label('App') }, { key: 'web', label: label('Web') }] },
    { key: 'store', kind: 'category', label: label('Store'), values: [] },
    { key: 'city', kind: 'category', label: label('City'), values: [] },
    { key: 'region', kind: 'category', label: label('Region'), values: [] },
    { key: 'country', kind: 'category', label: label('Country'), values: [{ key: 'SA', label: label('Saudi Arabia') }] },
    { key: 'day', kind: 'time', label: label('Day'), values: [] },
  ],
}

const def = (measures: string[], dimensions: string[], compareToPrevious = false): AnalyticsViewDefinition => ({
  chart: { type: 'bar' },
  query: { measures, dimensions, filters: [], period: 'last-30-days', ...(compareToPrevious ? { compareToPrevious: true } : {}) },
})

/** Each view by id, at revision 3. */
export const V1_VIEWS: Record<string, AnalyticsViewDefinition> = {
  'v-kpi': def(['orders'], ['day'], true),
  'v-bar': def(['orders'], ['channel_group']),
  'v-area': def(['orders'], ['day', 'channel_group']),
  'v-line-measures': def(['orders', 'deliveries'], ['day']),
  'v-donut': def(['orders'], ['store']),
  'v-table': def(['orders', 'till_value'], ['store']),
  'v-till': def(['till_value'], ['day']),
  'v-deliveries': def(['deliveries'], ['store']),
}

const at = (x: number, y: number) => ({ x, y, w: 6, h: 3 })

export const V1_BOARDS: Record<string, AnalyticsBoardDefinition> = {
  'b-ops': {
    panels: [
      { id: 'p-note', kind: 'text', text: label('HQ only'), layout: at(0, 10) },
      { id: 'p-donut', kind: 'view', viewId: 'v-donut', layout: at(0, 7), optOut: ['period', 'city', 'region', 'store', 'channel', 'country'] },
      { id: 'p-area', kind: 'view', viewId: 'v-area', layout: at(6, 4), optOut: ['store'] },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: at(4, 1), optOut: [] },
      { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: at(0, 1), optOut: [] },
      { id: 'p-line', kind: 'view', viewId: 'v-line-measures', layout: at(0, 4), optOut: [] },
      { id: 'p-head', kind: 'section', title: label('Orders'), layout: at(0, 0) },
    ],
  },
  'b-stores': {
    panels: [
      { id: 'p-stores', kind: 'view', viewId: 'v-table', layout: at(0, 0), optOut: [] },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: at(6, 0), optOut: [] },
      { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: at(0, 3), optOut: [] },
      { id: 'p-fixed', kind: 'view', viewId: 'v-area', layout: at(4, 3), optOut: ['crossFilter'] },
    ],
  },
  'b-777': {
    panels: [
      { id: 'p-head', kind: 'section', title: label('Today'), layout: at(0, 0) },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: at(0, 1), optOut: [] },
      { id: 'p-gone', kind: 'view', viewId: 'v-gone', layout: at(6, 1), optOut: ['store'] },
    ],
    refresh: 60,
  },
  // Saved filters: the strip opens on this week, Central and the app channel.
  'b-saved': {
    panels: [
      { id: 'p-till', kind: 'view', viewId: 'v-till', layout: at(0, 0), optOut: [] },
      { id: 'p-deliveries', kind: 'view', viewId: 'v-deliveries', layout: at(6, 0), optOut: ['period', 'crossFilter'] },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: at(0, 3), optOut: ['region'] },
    ],
    filters: { period: { kind: 'relative', token: 'this-week' }, region: ['central'], channel: ['app'] },
  },
}

/** v1 permalinks: the drive's, a fixed range, a cleared default, a bad period, reserved keys and a cross-filter. */
export const V1_PERMALINKS = [
  '',
  'region=central&store=P001',
  'period=last-week',
  'period=2026-10-01..2026-10-31&city=riyadh&city=jeddah',
  'channel=web&channel=app&country=SA',
  'region=',
  'region=&channel=',
  'period=last-century&store=P009',
  'tv=1&refresh=30s&region=central&cross=channel_group:app&crossFrom=p-bar',
  'cross=store:P001&crossFrom=p-stores&channel=app',
  'period=today&store=P002&store=P001&store=P002',
]
