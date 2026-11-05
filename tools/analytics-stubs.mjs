// Stubbed analytics doors for `tools/analytics-drive.mjs` (spec 766 §C — PROPOSED, owned by BackOffice 3378).
//
// There is no live SIS.Api door yet, so every drive scenario installs these on a Playwright page through
// route interception. The shapes are `src/core/models/analytics.ts`, camelCase, in the universal envelope.
//
// To stub a NEW door (770 Items, 771 DimensionValues, 776 Item writes …): add its fixture below and one
// `if (p === 'Analytics/…')` branch in `installAnalyticsStubs`, reading its answer from `opts` so a scenario
// can override it (an answer, a refusal from `refusal()`, or a `delayMs`). Keep the defaults a happy path.

export const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

/** A business refusal in the envelope: `refusal('ANALYTICS-404', 'Gone.', 404)`. */
export const refusal = (code, message = `Refused: ${code}.`, status = 400) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

const label = (en, ar) => ({ en, ar })

// ── The model: one fixed-slot dimension (channel group, values inline) and one open one (store) ──────────
export const MODEL = {
  areas: [
    { key: 'sales', available: true },
    { key: 'delivery', available: true },
    { key: 'callouts', available: false, unavailableReason: 'Waiting on the replica (753).' },
  ],
  measures: [
    {
      key: 'orders',
      area: 'sales',
      shape: 'additive',
      unit: 'count',
      label: label('Orders', 'الطلبات'),
      description: label('Orders placed', 'الطلبات المقدمة'),
      dimensions: ['channel_group', 'store', 'city', 'region', 'country', 'day'],
    },
    {
      key: 'till_value',
      area: 'sales',
      shape: 'additive',
      unit: 'SAR',
      label: label('Value through our tills', 'القيمة عبر صناديقنا'),
      description: label('Value through our tills', 'القيمة عبر صناديقنا'),
      dimensions: ['channel_group', 'store', 'city', 'region', 'country', 'day'],
    },
    {
      key: 'deliveries',
      area: 'sales',
      shape: 'additive',
      unit: 'count',
      label: label('Deliveries', 'التوصيلات'),
      description: label('Deliveries completed', 'التوصيلات المكتملة'),
      dimensions: ['channel_group', 'store', 'city', 'region', 'country', 'day'],
    },
    // 769: a rate (never in a donut; the combo's lower pane).
    {
      key: 'on_time_share',
      area: 'sales',
      shape: 'rate',
      unit: 'share',
      label: label('On-time share', 'نسبة الالتزام بالوقت'),
      description: label('Deliveries on time ÷ deliveries', 'التوصيلات في الوقت ÷ التوصيلات'),
      dimensions: ['channel_group', 'store', 'city', 'region', 'country', 'day'],
    },
    // 775: Q8's percentiles (capped at 92 days) and a measure in the unavailable callouts area.
    {
      key: 'order_to_delivered_p50',
      area: 'delivery',
      shape: 'percentile',
      unit: 'minutes',
      maxWindowDays: 92,
      label: label('Median order to delivered', 'الوسيط من الطلب إلى التسليم'),
      description: label('Median minutes from order to delivered', 'وسيط الدقائق من الطلب إلى التسليم'),
      dimensions: ['channel_group', 'store', 'day'],
    },
    {
      key: 'order_to_delivered_p90',
      area: 'delivery',
      shape: 'percentile',
      unit: 'minutes',
      maxWindowDays: 92,
      label: label('P90 order to delivered', 'المئين 90 من الطلب إلى التسليم'),
      description: label('90th percentile minutes from order to delivered', 'المئين 90 للدقائق من الطلب إلى التسليم'),
      dimensions: ['channel_group', 'store', 'day'],
    },
    {
      key: 'take_rate',
      area: 'callouts',
      shape: 'rate',
      unit: 'share',
      label: label('Take rate', 'نسبة الاستلام'),
      description: label('Callouts taken ÷ callouts', 'النداءات المستلمة ÷ النداءات'),
      dimensions: ['store'],
    },
  ],
  dimensions: [
    {
      key: 'channel_group',
      kind: 'category',
      label: label('Channel', 'القناة'),
      values: [
        { key: 'app', label: label('App', 'التطبيق') },
        { key: 'web', label: label('Web', 'الموقع') },
        { key: 'callcenter', label: label('Call center', 'مركز الاتصال') },
        { key: 'aggregator', label: label('Aggregators', 'المجمّعات') },
        { key: 'store', label: label('In store', 'في الفرع') },
      ],
    },
    { key: 'store', kind: 'category', label: label('Store', 'الفرع') },
    // 771: the place filters. City and region are searched (`DimensionValues`); country is small and inline.
    { key: 'city', kind: 'category', label: label('City', 'المدينة') },
    { key: 'region', kind: 'category', label: label('Region', 'المنطقة') },
    {
      key: 'country',
      kind: 'category',
      label: label('Country', 'الدولة'),
      values: [
        { key: 'SA', label: label('Saudi Arabia', 'السعودية') },
        { key: 'AE', label: label('United Arab Emirates', 'الإمارات') },
      ],
    },
    { key: 'day', kind: 'time', label: label('Day', 'اليوم') },
    // 769's heatmap axes.
    { key: 'weekday', kind: 'category', label: label('Weekday', 'يوم الأسبوع'), values: [] },
    { key: 'hour', kind: 'category', label: label('Hour', 'الساعة'), values: [] },
  ],
}

// ── Items: views by id ───────────────────────────────────────────────────────────────────────────────
const view = (id, over = {}) => ({
  id,
  kind: 'view',
  title: label('', ''),
  subtitle: label('', ''),
  owner: 'msartawi',
  tier: 'personal',
  sourceChangedSinceCopy: false,
  revision: 3,
  updatedAt: '2026-11-05T09:00:00',
  updatedBy: 'msartawi',
  definition: {
    chart: { type: 'bar', orientation: 'vertical' },
    query: { measures: ['orders'], dimensions: ['channel_group'], filters: [], period: 'last-30-days' },
  },
  ...over,
})

// 768: one view per form. `def(type, measures, dimensions, chart)` is a definition over the last 30 days.
const def = (type, measures, dimensions, chart = {}, query = {}) => ({
  chart: { type, ...chart },
  query: { measures, dimensions, filters: [], period: 'last-30-days', ...query },
})
export const VIEWS_768 = {
  'v-kpi': def('kpi', ['orders'], ['day'], {}, { compareToPrevious: true }),
  'v-kpi-zero': def('kpi', ['deliveries'], [], {}, { compareToPrevious: true }),
  'v-line-measures': def('line', ['orders', 'deliveries'], ['day']),
  'v-line-stores': def('line', ['orders'], ['day', 'store']),
  'v-area': def('area', ['orders'], ['day', 'channel_group']),
  'v-bar-horizontal': def('bar', ['till_value'], ['channel_group'], { orientation: 'horizontal', format: 'SAR' }),
  'v-bar-stacked': def('bar', ['orders'], ['store', 'channel_group'], { stack: 'stacked' }),
  'v-bar-grouped': def('bar', ['orders'], ['store', 'channel_group'], { stack: 'grouped' }),
  'v-rate-stacked': def('area', ['on_time_share'], ['day', 'channel_group']),
}

export const ITEMS = {
  ...Object.fromEntries(Object.entries(VIEWS_768).map(([id, definition]) => [id, view(id, { definition })])),
  // Title empty, as the AI leaves it: the screen generates "Orders by Channel".
  'v-bar': view('v-bar'),
  'v-titled': view('v-titled', { title: label('Orders by channel, last 30 days', 'الطلبات حسب القناة، آخر 30 يومًا'), tier: 'shared' }),
  // ── 769: the donut, the table with cell bars, the heatmap and the combo ──
  'v-donut': view('v-donut', { definition: { chart: { type: 'donut' }, query: { measures: ['orders'], dimensions: ['store'], filters: [], period: 'last-30-days' } } }),
  'v-donut-rate': view('v-donut-rate', { definition: { chart: { type: 'donut' }, query: { measures: ['on_time_share'], dimensions: ['channel_group'], filters: [] } } }),
  'v-table': view('v-table', {
    definition: { chart: { type: 'table', topN: 5 }, query: { measures: ['orders', 'till_value'], dimensions: ['store'], filters: [] } },
  }),
  'v-heatmap': view('v-heatmap', { definition: { chart: { type: 'heatmap' }, query: { measures: ['orders'], dimensions: ['weekday', 'hour'], filters: [] } } }),
  'v-combo': view('v-combo', { definition: { chart: { type: 'combo' }, query: { measures: ['orders', 'on_time_share'], dimensions: ['day'], filters: [] } } }),
}

// ── 771: a board of four views, a section header and a text panel ────────────────────────────────────
// Laid out out of DOM order on purpose (the page reads them row by row, then column by column). The area
// panel opts out of the store filter, so a store change leaves it alone; the donut opts out of them all.
export const BOARD_771 = {
  ...view('b-ops', { title: label('Operations week', 'أسبوع العمليات'), tier: 'certified', owner: 'curator1', updatedAt: '2026-10-20T08:00:00' }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-note', kind: 'text', text: label('Figures are for HQ use only.', 'الأرقام لاستخدام الإدارة فقط.'), layout: { x: 0, y: 10, w: 12, h: 1 } },
      // A 769 form through the same dispatch as the view page, opted out of every board filter: it never re-asks.
      { id: 'p-donut', kind: 'view', viewId: 'v-donut', layout: { x: 0, y: 7, w: 12, h: 3 }, optOut: ['period', 'city', 'region', 'store', 'channel', 'country'] },
      { id: 'p-area', kind: 'view', viewId: 'v-area', layout: { x: 6, y: 4, w: 6, h: 3 }, optOut: ['store'] },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 4, y: 1, w: 8, h: 3 } },
      { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: { x: 0, y: 1, w: 4, h: 3 } },
      { id: 'p-line', kind: 'view', viewId: 'v-line-measures', layout: { x: 0, y: 4, w: 6, h: 3 } },
      { id: 'p-head', kind: 'section', title: label('Orders', 'الطلبات'), layout: { x: 0, y: 0, w: 12, h: 1 } },
    ],
  },
}
ITEMS['b-ops'] = BOARD_771
/** Each panel's answer held this long, so the panels land one by one: KPI, bar, line, then area. */
export const DELAYS_771 = { 'v-kpi': 300, 'v-bar': 900, 'v-line-measures': 1500, 'v-area': 2100 }

/** `GET Analytics/DimensionValues` (771): the searched members, by dimension. */
export const MEMBERS = {
  region: [
    { key: 'central', label: label('Central', 'الوسطى') },
    { key: 'western', label: label('Western', 'الغربية') },
    { key: 'eastern', label: label('Eastern', 'الشرقية') },
  ],
  city: [
    { key: 'riyadh', label: label('Riyadh', 'الرياض') },
    { key: 'jeddah', label: label('Jeddah', 'جدة') },
  ],
  store: [
    { key: 'P001', label: 'Olaya' },
    { key: 'P002', label: 'Malaz' },
    { key: 'P003', label: 'Corniche' },
  ],
}

// ── `GET Analytics/Items` (770): the home's list, deliberately NOT in tier or date order ─────────────────
const board = (id, over = {}) => ({ ...view(id, over), kind: 'board', definition: {} })
export const LIST = [
  ITEMS['v-bar'], // personal, untitled → "Orders by Channel", 2026-11-05 09:00
  board('b-ops', { title: label('Operations week', 'أسبوع العمليات'), tier: 'certified', owner: 'curator1', updatedAt: '2026-10-20T08:00:00' }),
  ITEMS['v-titled'], // shared, 2026-11-05 09:00
  view('v-old', { title: label('Value through our tills', 'القيمة عبر صناديقنا'), updatedAt: '2026-10-01T12:30:00' }),
  view('v-cert', { title: label('Orders, certified', 'الطلبات المعتمدة'), tier: 'certified', owner: 'curator1', updatedAt: '2026-11-02T07:15:00' }),
  board('b-shared', { title: label('Riyadh stores', 'فروع الرياض'), tier: 'shared', owner: 'aalharbi', updatedAt: '2026-11-03T16:40:00' }),
]

// ── The copilot's doors (ticket 782): the ask box hands its question to the ONE copilot panel ─────────
export const COPILOT_ANSWER = {
  conversationId: 'c-analytics-1',
  questionNo: 1,
  answer: 'Aggregators took the most orders in the last 30 days.',
  orderRefs: [],
  trace: [{ tool: 'query_analytics', input: { measure: 'orders' }, rows: 5, ms: 90, ok: true }],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-05T10:15:00',
}

// ── Query answers, keyed by view id ──────────────────────────────────────────────────────────────────
const result = (dimension, measure, rows) => ({
  columns: [
    { key: dimension, role: 'dimension' },
    { key: measure, role: 'measure', shape: 'additive', unit: 'count' },
  ],
  rows: rows.map(([member, value]) => ({ [dimension]: member, [measure]: value })),
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-07', to: '2026-11-05' },
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
})

// 768: a generic answer (rows already keyed by column) and the series fixtures.
const answer = (columns, rows, previous = []) => ({
  columns: columns.map(([key, role, unit]) => ({ key, role, ...(role === 'measure' ? { shape: unit === 'share' ? 'rate' : 'additive', unit } : {}) })),
  rows,
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-07', to: '2026-11-05' },
  previous,
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
})
// 769: a many-column answer with an explicit shape: `columns` as `[key, role, shape?, unit?]`, rows as objects.
const answerShaped = (columns, rows) => ({
  columns: columns.map(([key, role, shape, unit]) => (role === 'measure' ? { key, role, shape, unit } : { key, role })),
  rows,
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-07', to: '2026-11-05' },
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
})
export const DAYS = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']
const CHANNELS = ['app', 'web', 'callcenter', 'aggregator', 'store']
// Seven stores: the five biggest are named and the two smallest (P006, P007) fold into "Other".
export const STORES = { P001: 900, P002: 700, P003: 520, P004: 400, P005: 310, P006: 40, P007: 25 }
const wave = (i, base) => Math.round(base * (1 + 0.15 * Math.sin(i)))

export const QUERY_768 = {
  // Σ orders = 12,840; previous 11,464 → ▲ 12.0 %.
  'v-kpi': answer([['day', 'dimension'], ['orders', 'measure', 'count']], DAYS.map((day, i) => ({ day, orders: [1700, 1820, 1650, 1900, 1880, 1990, 1900][i] })), [{ orders: 11464 }]),
  // From a zero previous: up, but by no percentage.
  'v-kpi-zero': answer([['deliveries', 'measure', 'count']], [{ deliveries: 40 }], [{ deliveries: 0 }]),
  'v-line-measures': answer(
    [['day', 'dimension'], ['orders', 'measure', 'count'], ['deliveries', 'measure', 'count']],
    DAYS.map((day, i) => ({ day, orders: wave(i, 1800), deliveries: wave(i + 1, 1300) })),
  ),
  'v-line-stores': answer(
    [['day', 'dimension'], ['store', 'dimension'], ['orders', 'measure', 'count']],
    DAYS.flatMap((day, i) => Object.entries(STORES).map(([store, base]) => ({ day, store, orders: wave(i, base) }))),
  ),
  'v-area': answer(
    [['day', 'dimension'], ['channel_group', 'dimension'], ['orders', 'measure', 'count']],
    DAYS.flatMap((day, i) => CHANNELS.map((channel_group, c) => ({ day, channel_group, orders: wave(i + c, [600, 300, 150, 900, 250][c]) }))),
  ),
  'v-bar-horizontal': answer(
    [['channel_group', 'dimension'], ['till_value', 'measure', 'SAR']],
    [['aggregator', 182400.5], ['app', 121000], ['store', 98000.25], ['web', 64000], ['callcenter', 21000]].map(([channel_group, till_value]) => ({ channel_group, till_value })),
  ),
  'v-bar-stacked': answer(
    [['store', 'dimension'], ['channel_group', 'dimension'], ['orders', 'measure', 'count']],
    ['P001', 'P002', 'P003'].flatMap((store, s) => CHANNELS.map((channel_group, c) => ({ store, channel_group, orders: (5 - c) * 40 + s * 15 }))),
  ),
  'v-rate-stacked': answer([['day', 'dimension'], ['channel_group', 'dimension'], ['on_time_share', 'measure', 'share']], [{ day: DAYS[0], channel_group: 'app', on_time_share: 0.91 }]),
}
QUERY_768['v-bar-grouped'] = QUERY_768['v-bar-stacked']

// Nine stores: the donut keeps the five largest (the palette's five hues) and folds four into "Other".
const NINE_STORES = [['P001', 900], ['P002', 800], ['P003', 700], ['P004', 600], ['P005', 500], ['P006', 400], ['P007', 300], ['P008', 200], ['P009', 100]]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const HOURS = ['08', '12', '16', '20']

// Ranked by value, which is NOT the catalogue order: the colours must follow the channel, not the rank.
export const QUERY = {
  ...QUERY_768,
  'v-bar': result('channel_group', 'orders', [['aggregator', 4200], ['app', 3100], ['store', 2600], ['web', 1800], ['callcenter', 900]]),
  'v-titled': result('channel_group', 'orders', [['web', 1800], ['aggregator', 4200]]),
  'v-donut': result('store', 'orders', NINE_STORES),
  'v-donut-rate': answerShaped([['channel_group', 'dimension'], ['on_time_share', 'measure', 'rate', 'share']], [{ channel_group: 'app', on_time_share: 0.91 }, { channel_group: 'web', on_time_share: 0.84 }]),
  'v-table': answerShaped(
    [['store', 'dimension'], ['orders', 'measure', 'additive', 'count'], ['till_value', 'measure', 'additive', 'SAR']],
    NINE_STORES.map(([store, orders], i) => ({ store, orders: orders + i * 37, till_value: (orders + i * 37) * 61.5 })).reverse(),
  ),
  // Orders by weekday × hour: 10 at Sun 08 (the minimum), 200 at Thu 20 (the maximum); Wed 16 is empty.
  'v-heatmap': answerShaped(
    [['weekday', 'dimension'], ['hour', 'dimension'], ['orders', 'measure', 'additive', 'count']],
    WEEKDAYS.flatMap((weekday, w) =>
      HOURS.filter((hour) => !(weekday === 'Wed' && hour === '16')).map((hour, h) => ({
        weekday,
        hour,
        orders: weekday === 'Sun' && hour === '08' ? 10 : weekday === 'Thu' && hour === '20' ? 200 : 20 + w * 25 + h * 10,
      })),
    ),
  ),
  'v-combo': answerShaped(
    [['day', 'dimension'], ['orders', 'measure', 'additive', 'count'], ['on_time_share', 'measure', 'rate', 'share']],
    ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((day, i) => ({ day, orders: 300 + i * 40, on_time_share: 0.8 + i * 0.03 })),
  ),
}

// ── 775: the editor's inline definitions ────────────────────────────────────────────────────────────
const INLINE_MEMBERS = { channel_group: CHANNELS, store: Object.keys(STORES), day: DAYS, weekday: WEEKDAYS, hour: HOURS }
/** Periods longer than a percentile's 92-day window. */
const LONG_PERIODS = new Set(['year-to-date'])

/**
 * The server's answer to an inline `definition`: every member combination of its breakdowns, each measure a
 * deterministic figure. A percentile over a period past its window is refused `ANALYTICS-407`, as §C says.
 */
export function inlineAnswer(definition, model = MODEL) {
  const q = definition?.query ?? {}
  const measures = (q.measures ?? []).map((k) => model.measures.find((m) => m.key === k) ?? { key: k, shape: 'additive', unit: 'count' })
  if (measures.some((m) => m.shape === 'percentile') && LONG_PERIODS.has(q.period)) {
    return refusal('ANALYTICS-407', 'A percentile is answered over at most 92 days.', 400)
  }
  const dims = q.dimensions ?? []
  let rows = [{}]
  for (const d of dims) rows = rows.flatMap((r) => (INLINE_MEMBERS[d] ?? ['a', 'b']).map((v) => ({ ...r, [d]: v })))
  rows = rows.map((r, i) => {
    const out = { ...r }
    measures.forEach((m, j) => {
      out[m.key] = m.unit === 'share' ? 0.7 + ((i + j) % 5) * 0.05 : m.unit === 'minutes' ? 30 + ((i * 7 + j * 11) % 40) + j * 15 : 400 + ((i * 37 + j * 53) % 500)
    })
    return out
  })
  return {
    columns: [...dims.map((key) => ({ key, role: 'dimension' })), ...measures.map((m) => ({ key: m.key, role: 'measure', shape: m.shape, unit: m.unit }))],
    rows,
    total: rows.length,
    truncated: false,
    period: { from: '2026-10-30', to: '2026-11-05' },
    previous: [],
    fetchedAt: '2026-11-05T10:00:00',
    dataAsOf: '2026-11-05T09:45:00',
  }
}

/**
 * Install the analytics doors on `page`. Every option overrides one door's answer:
 *   access:   an `{ canView, canCurate }` object, `'absent'` (a bare 404, the door not deployed) or `'bare403'`;
 *   items:    id → item, or id → a `refusal(...)` fulfil object;
 *   list:     the `Analytics/Items` answer (an array of items), or a `refusal(...)` fulfil object;
 *   query:    id → result, or id → a `refusal(...)` fulfil object;
 *   queryDelayMs: hold every Query answer this long, so the loading frame is seen;
 *   queryDelayFor: view id → ms, held instead of `queryDelayMs` for that view (771's one-by-one landing);
 *   members:  dimension → `DimensionValues` members (default `MEMBERS`), narrowed by `search`;
 *   copilot:  `Copilot/Access` — `'denied'` (the default: `canAsk: false`), `'granted'`, or `'absent'` (a bare 404);
 *   copilotAnswer: the `Copilot/Ask` answer (default `COPILOT_ANSWER`).
 *   inlineQuery: (body) → result or `refusal(...)` for a Query with an inline `definition` (default `inlineAnswer`);
 *   create:   the `POST Analytics/Item` answer — a `refusal(...)` fulfil object, or omitted: the created Personal item
 *             (id `v-new`), which `Analytics/Item/v-new` and its Query then serve.
 * Returns `{ calls, bodies }`: every door path asked, and each POST body by path.
 */
export async function installAnalyticsStubs(page, opts = {}) {
  const { access = { canView: true, canCurate: false }, items = ITEMS, list = LIST, query = QUERY, model = MODEL, queryDelayMs = 0, queryDelayFor = {}, members = MEMBERS, copilot = 'denied', copilotAnswer = COPILOT_ANSWER, inlineQuery = (body) => inlineAnswer(body.definition, model), create } = opts
  const made = {}
  const calls = []
  const bodies = {}
  const isFulfil = (v) => v && typeof v === 'object' && 'contentType' in v && 'body' in v

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (req.method() === 'POST') (bodies[p] ??= []).push(req.postDataJSON())

    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Analytics/Access') {
      if (access === 'absent') return route.fulfill({ status: 404, contentType: 'text/plain', body: '' })
      if (access === 'bare403') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope(access))
    }
    if (p === 'Copilot/Access') {
      if (copilot === 'absent') return route.fulfill({ status: 404, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope({ canAsk: copilot === 'granted', canUseMcp: false }))
    }
    if (p === 'Copilot/Ask') return route.fulfill(envelope(copilotAnswer))
    if (p === 'Analytics/Model') return route.fulfill(envelope(model))
    if (p === 'Analytics/DimensionValues') {
      const search = (url.searchParams.get('search') ?? '').toLowerCase()
      const all = members[url.searchParams.get('dimension')] ?? []
      const text = (m) => [m.key, typeof m.label === 'string' ? m.label : `${m.label.en} ${m.label.ar}`].join(' ').toLowerCase()
      return route.fulfill(envelope(all.filter((m) => !search || text(m).includes(search)).slice(0, 50)))
    }
    if (p === 'Analytics/Items') return route.fulfill(isFulfil(list) ? list : envelope(list))
    if (p === 'Analytics/Item' && req.method() === 'POST') {
      if (create) return route.fulfill(create)
      const body = req.postDataJSON() ?? {}
      made['v-new'] = view('v-new', { title: body.title, subtitle: body.subtitle, definition: body.definition, revision: 1, updatedAt: '2026-11-05T10:05:00' })
      return route.fulfill(envelope(made['v-new']))
    }
    if (p.startsWith('Analytics/Item/')) {
      const id = decodeURIComponent(p.slice('Analytics/Item/'.length))
      const it = made[id] ?? items[id]
      if (!it) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      return route.fulfill(isFulfil(it) ? it : envelope(it))
    }
    if (p === 'Analytics/Query') {
      const body = req.postDataJSON() ?? {}
      const hold = queryDelayFor[body.viewId] ?? queryDelayMs
      if (hold) await new Promise((r) => setTimeout(r, hold))
      if (body.definition) {
        const inline = inlineQuery(body)
        return route.fulfill(isFulfil(inline) ? inline : envelope(inline))
      }
      if (made[body.viewId]) return route.fulfill(envelope(inlineAnswer(made[body.viewId].definition, model)))
      const answer = query[body.viewId]
      if (!answer) return route.fulfill(refusal('ANALYTICS-404', 'The view is not found.', 404))
      return route.fulfill(isFulfil(answer) ? answer : envelope(answer))
    }
    // Every other screen's probe denies, so the nav holds only what a scenario grants.
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canView: false }))
    return route.fulfill(envelope([]))
  })
  return { calls, bodies }
}
