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
  // 820: two measures over one breakdown — two bar series, each in its own slot (not every bar in slot 0).
  'v-bar-measures': def('bar', ['orders', 'deliveries'], ['channel_group']),
  // Review fix 14: a rate over seven stores draws five lines and says two are not shown.
  'v-rate-stores': def('line', ['on_time_share'], ['day', 'store']),
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

// ── 776: items by standing (the session user is `msartawi`). Their Query is answered inline. ─────────────
export const ITEMS_776 = {
  'v-theirs-shared': view('v-theirs-shared', { title: label('Orders by channel (Riyadh)', 'الطلبات حسب القناة (الرياض)'), tier: 'shared', owner: 'aalharbi', updatedBy: 'aalharbi' }),
  'v-mine-shared': view('v-mine-shared', { title: label('My orders by channel', 'طلباتي حسب القناة'), tier: 'shared' }),
  'v-cert-776': view('v-cert-776', { title: label('Orders, certified', 'الطلبات المعتمدة'), tier: 'certified', owner: 'curator1', updatedBy: 'curator1' }),
  'v-theirs-personal': view('v-theirs-personal', { tier: 'personal', owner: 'aalharbi' }),
  'v-copy-old': view('v-copy-old', { title: label('My copy of orders', 'نسختي من الطلبات'), copiedFrom: 'v-theirs-shared', sourceChangedSinceCopy: true }),
}
Object.assign(ITEMS, ITEMS_776)

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
// ── 779: an item's history. My Shared board at revision 3, with each revision's full snapshot (§C keeps them
// server side; the Revisions door answers who and when only). Revert writes the snapshot as a NEW revision. ──
const board779 = (panels) => ({
  panels: [
    { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: { x: 0, y: 0, w: 4, h: 3 } },
    { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 4, y: 0, w: 8, h: 3 } },
    { id: 'p-line', kind: 'view', viewId: 'v-line-measures', layout: { x: 0, y: 3, w: 12, h: 3 } },
  ].slice(0, panels),
})
export const REVISIONS_779 = {
  'b-779': [
    { revision: 1, updatedAt: '2026-11-01T08:15:00', updatedBy: 'msartawi', snapshot: { title: label('Week at a glance (draft)', 'الأسبوع في لمحة (مسودة)'), definition: board779(1) } },
    { revision: 2, updatedAt: '2026-11-03T11:30:00', updatedBy: 'msartawi', snapshot: { title: label('Week at a glance', 'الأسبوع في لمحة'), definition: board779(2) } },
    { revision: 3, updatedAt: '2026-11-05T09:20:00', updatedBy: 'msartawi', snapshot: { title: label('Week at a glance', 'الأسبوع في لمحة'), definition: board779(3) } },
  ],
}
export const BOARD_779 = {
  ...view('b-779', { title: label('Week at a glance', 'الأسبوع في لمحة'), tier: 'shared', updatedAt: '2026-11-05T09:20:00' }),
  kind: 'board',
  definition: board779(3),
}
ITEMS['b-779'] = BOARD_779
// 820: a board holding the two-measure bar (Recharts let each row's fill beat the series fill).
ITEMS['b-820'] = {
  ...view('b-820', { title: label('Orders and deliveries', 'الطلبات والتوصيلات') }),
  kind: 'board',
  definition: { panels: [{ id: 'p-bars', kind: 'view', viewId: 'v-bar-measures', layout: { x: 0, y: 0, w: 12, h: 4 } }] },
}
// 823 (spec 819 §C): a board that carries its own parameters — one of each of the seven kinds — and their
// bindings, so its panels ask by item and panel (`{ itemId, revision, panelId, values }`). The line is bound
// to the period and the grain only: every other parameter does not reach it (`notReached`, as the server says).
const p823 = (name, kind, en, ar, extra) => ({ name, kind, label: label(en, ar), required: false, ...extra })
export const PARAMS_823 = [
  p823('period', 'period', 'Period', 'الفترة', { required: true, default: { kind: 'period', token: 'last-30-days' } }),
  p823('region', 'members', 'Region', 'المنطقة', { dimension: 'region', pinned: null, multi: true, default: { kind: 'members', values: [] } }),
  p823('channel-one', 'members', 'One channel', 'قناة واحدة', { dimension: 'channel_group', pinned: ['app', 'web', 'store'], multi: false, default: { kind: 'members', values: ['app'] } }),
  p823('grain', 'grain', 'Grain', 'الدقة', { required: true, grains: ['day', 'week'], default: { kind: 'grain', grain: 'day' } }),
  p823('on-time', 'threshold', 'On time', 'في الوقت', { measure: 'on_time_share', default: { kind: 'threshold', op: 'off', value: 5 } }),
  p823('top', 'topN', 'Top', 'الأعلى', { required: true, default: { kind: 'topN', n: 10 } }),
  p823('figure', 'measure', 'Figure', 'الرقم', { required: true, options: ['orders', 'deliveries'], default: { kind: 'measure', key: 'orders' } }),
  p823('split', 'breakdown', 'Split by', 'التقسيم حسب', { required: true, options: ['channel_group', 'city'], default: { kind: 'breakdown', key: 'channel_group' } }),
]
export const BINDINGS_823 = {
  period: { 'p-bar': true, 'p-kpi': true, 'p-line': true },
  region: { 'p-bar': 'region', 'p-kpi': 'region' },
  'channel-one': { 'p-bar': 'channel_group' },
  grain: { 'p-line': true },
  'on-time': { 'p-bar': true },
  top: { 'p-bar': true },
  figure: { 'p-kpi': true },
  split: { 'p-bar': true },
}
ITEMS['b-params'] = {
  ...view('b-params', { title: label('Parameters at work', 'المعاملات في العمل'), tier: 'shared', revision: 6 }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: { x: 0, y: 0, w: 4, h: 3 }, optOut: [] },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 4, y: 0, w: 8, h: 3 }, optOut: [] },
      { id: 'p-line', kind: 'view', viewId: 'v-line-measures', layout: { x: 0, y: 3, w: 12, h: 3 }, optOut: [] },
    ],
    params: PARAMS_823,
    bindings: BINDINGS_823,
  },
}
// 825: named series — HungerStation (a channel) against QC (a delivery type), the acceptance case. The model
// gains the `delivery_type` dimension (in which QC lives) and the HungerStation channel; v1 scenarios keep MODEL.
export const MODEL_825 = {
  ...MODEL,
  measures: MODEL.measures.map((m) => (['orders', 'deliveries', 'till_value'].includes(m.key) ? { ...m, dimensions: [...m.dimensions, 'delivery_type'] } : m)),
  dimensions: [
    ...MODEL.dimensions.map((d) =>
      d.key === 'channel_group' ? { ...d, values: [...d.values, { key: 'hungerstation', label: label('HungerStation', 'هنقرستيشن') }] } : d,
    ),
    {
      key: 'delivery_type',
      kind: 'category',
      label: label('Delivery type', 'نوع التوصيل'),
      values: [
        { key: 'QC', label: label('Quick commerce', 'التجارة السريعة') },
        { key: 'scheduled', label: label('Scheduled', 'مجدول') },
      ],
    },
  ],
}
export const SERIES_825 = [
  { id: 'hs', label: label('HungerStation', 'هنقرستيشن'), filters: [{ dimension: 'channel_group', values: ['hungerstation'] }] },
  { id: 'qc', label: label('QC', 'التوصيل السريع'), filters: [{ dimension: 'delivery_type', values: ['QC'] }] },
]
export const VIEW_825 = { ...def('bar', ['orders'], ['day'], { orientation: 'vertical' }), series: SERIES_825 }
ITEMS['v-825'] = view('v-825', { title: label('HungerStation against QC', 'هنقرستيشن مقابل التوصيل السريع'), definition: VIEW_825 })
ITEMS['b-825'] = {
  ...view('b-825', { title: label('Aggregators', 'المجمّعات') }),
  kind: 'board',
  definition: { panels: [{ id: 'p-series', kind: 'view', viewId: 'v-825', layout: { x: 0, y: 0, w: 12, h: 4 } }] },
}

// Review fix 12 (766 §B, story 86): a view naming a measure the model no longer holds, and one the server refuses
// 406 naming the field; the board holding them still draws its other panel.
ITEMS['v-retired'] = view('v-retired', { definition: def('bar', ['retired_orders'], ['channel_group']) })
ITEMS['v-406'] = view('v-406', { definition: def('bar', ['orders'], ['channel_group']) })
export const QUERY_RETIRED = {
  'v-406': envelope({ field: 'query.measures[0]' }, { status: 400, success: false, message: 'Unknown member.', errors: [{ errorCode: 'ANALYTICS-406', internalErrorCode: '', errorMessage: 'Unknown member.' }] }),
}
ITEMS['b-retired'] = {
  ...view('b-retired', { title: label('Retired check', 'فحص الإلغاء'), tier: 'personal', updatedAt: '2026-11-05T09:30:00' }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 0, y: 0, w: 4, h: 3 }, optOut: [] },
      { id: 'p-retired', kind: 'view', viewId: 'v-retired', layout: { x: 4, y: 0, w: 4, h: 3 }, optOut: [] },
      { id: 'p-406', kind: 'view', viewId: 'v-406', layout: { x: 8, y: 0, w: 4, h: 3 }, optOut: [] },
    ],
  },
}
// Review fix 13: my copy of b-779, whose source has moved on since.
ITEMS['b-copy-old'] = { ...BOARD_779, id: 'b-copy-old', title: label('My week', 'أسبوعي'), tier: 'personal', copiedFrom: 'b-779', sourceChangedSinceCopy: true }
// The certified board 771 drew is curator1's: a non-curator may not edit it, so it shows no history.

/** Each panel's answer held this long, so the panels land one by one: KPI, bar, line, then area. */
export const DELAYS_771 = { 'v-kpi': 300, 'v-bar': 900, 'v-line-measures': 1500, 'v-area': 2100 }

// ── 777: my own board, one of whose views was deleted (`v-gone` is in no fixture: Item answers 404) ───────
export const BOARD_777 = {
  ...view('b-777', { title: label('My desk', 'مكتبي'), tier: 'personal', revision: 4 }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-head', kind: 'section', title: label('Today', 'اليوم'), layout: { x: 0, y: 0, w: 12, h: 1 } },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 0, y: 1, w: 6, h: 3 }, optOut: [] },
      { id: 'p-gone', kind: 'view', viewId: 'v-gone', layout: { x: 6, y: 1, w: 6, h: 3 }, optOut: ['store'] },
    ],
    refresh: 60,
  },
}
ITEMS['b-777'] = BOARD_777

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

// ── 778: a Shared board of someone else's (the home's `b-shared`), to certify; two views of the base ──────
export const BOARD_778 = {
  ...view('b-shared', { title: label('Riyadh stores', 'فروع الرياض'), tier: 'shared', owner: 'aalharbi', updatedBy: 'aalharbi', updatedAt: '2026-11-03T16:40:00', revision: 7 }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: { x: 0, y: 0, w: 4, h: 3 } },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 4, y: 0, w: 8, h: 3 } },
    ],
  },
}
ITEMS['b-shared'] = BOARD_778

/** The views the board editor's picker lists (777): mine, a Shared one and a Certified one, all readable. */
export const LIST_777 = [ITEMS['v-kpi'], ITEMS['v-bar'], ITEMS['v-titled'], ITEMS['v-cert-776'], board('b-777', { title: label('My desk', 'مكتبي') })]

// 824: a view whose measure (the p50) breaks down by channel and store only — a region parameter can't reach it.
ITEMS['v-824-p50'] = view('v-824-p50', {
  title: label('Delivery time by store', 'زمن التوصيل حسب الصيدلية'),
  definition: def('bar', ['order_to_delivered_p50'], ['store'], { orientation: 'vertical' }),
})
export const LIST_824 = [ITEMS['v-kpi'], ITEMS['v-bar'], ITEMS['v-824-p50']]

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
  'v-rate-stores': answer(
    [['day', 'dimension'], ['store', 'dimension'], ['on_time_share', 'measure', 'share']],
    DAYS.flatMap((day, i) => Object.entries(STORES).map(([store, base]) => ({ day, store, on_time_share: wave(i, base) / 1000 }))),
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
QUERY_768['v-bar-measures'] = answer(
  [['channel_group', 'dimension'], ['orders', 'measure', 'count'], ['deliveries', 'measure', 'count']],
  [['aggregator', 4200, 3900], ['app', 3100, 2800], ['store', 2600, 2500], ['web', 1800, 1500], ['callcenter', 900, 700]].map(([channel_group, orders, deliveries]) => ({ channel_group, orders, deliveries })),
)

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

// ── 772: a board to cross-filter and drill on ───────────────────────────────────────────────────────
// The store table is the source; the channel bar and the KPI take the cross-filter; the area panel opts
// out of it. Drill by asks an INLINE definition, answered here by its first dimension (`drill:<dim>`).
export const BOARD_772 = {
  ...view('b-stores', { title: label('Stores this month', 'الفروع هذا الشهر'), tier: 'shared' }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-stores', kind: 'view', viewId: 'v-table', layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] },
      { id: 'p-bar', kind: 'view', viewId: 'v-bar', layout: { x: 6, y: 0, w: 6, h: 3 }, optOut: [] },
      { id: 'p-kpi', kind: 'view', viewId: 'v-kpi', layout: { x: 0, y: 3, w: 4, h: 3 }, optOut: [] },
      { id: 'p-fixed', kind: 'view', viewId: 'v-area', layout: { x: 4, y: 3, w: 8, h: 3 }, optOut: ['crossFilter'] },
    ],
  },
}
ITEMS['b-stores'] = BOARD_772
export const DELAYS_772 = { 'v-table': 600, 'v-bar': 600, 'v-kpi': 600, 'v-area': 600, 'drill:city': 600 }
export const DRILL_772 = {
  'drill:city': answerShaped(
    [['city', 'dimension'], ['orders', 'measure', 'additive', 'count'], ['till_value', 'measure', 'additive', 'SAR']],
    [{ city: 'riyadh', orders: 610, till_value: 37515 }, { city: 'jeddah', orders: 290, till_value: 17835 }],
  ),
}
Object.assign(QUERY, DRILL_772)

// ── 773: a board of panels in every state, plus the panel actions ────────────────────────────────────
// A slow panel (408 once, then answered on retry), an engine-down panel (409 every time), a panel over the
// unavailable `callouts` area (410), an empty one, one cut at the row cap, and one whose data is behind.
// The drive freezes the clock at 10:10, so 09:45 is fine (25 min) and 09:20 is behind (50 min).
export const CALLOUTS_MEASURE = {
  key: 'callouts',
  area: 'callouts',
  shape: 'additive',
  unit: 'count',
  label: label('Callouts', 'الاستدعاءات'),
  description: label('Dispatch callouts', 'استدعاءات التوزيع'),
  dimensions: ['store'],
}
export const MODEL_773 = { ...MODEL, measures: [...MODEL.measures, CALLOUTS_MEASURE] }
const bar = (measure, dimension) => ({ chart: { type: 'bar', orientation: 'vertical' }, query: { measures: [measure], dimensions: [dimension], filters: [], period: 'last-30-days' } })
export const ITEMS_773 = {
  ...ITEMS,
  'v-773-slow': view('v-773-slow', { title: label('Slow panel', 'لوحة بطيئة'), definition: bar('orders', 'channel_group') }),
  'v-773-down': view('v-773-down', { title: label('Engine down', 'المحرك متوقف'), definition: bar('orders', 'channel_group') }),
  'v-773-gone': view('v-773-gone', { title: label('Callouts by store', 'الاستدعاءات حسب الفرع'), definition: bar('callouts', 'store') }),
  'v-773-empty': view('v-773-empty', { title: label('Nothing here', 'لا شيء هنا'), definition: bar('orders', 'store') }),
  'v-773-cut': view('v-773-cut', { title: label('Cut at the cap', 'مقطوع عند الحد'), definition: bar('orders', 'store') }),
  'v-773-stale': view('v-773-stale', { title: label('Stale figures', 'أرقام قديمة'), definition: bar('orders', 'channel_group') }),
}
const vp = (id, viewId, x, y) => ({ id, kind: 'view', viewId, layout: { x, y, w: 4, h: 3 }, optOut: [] })
export const BOARD_773 = {
  ...view('b-773', { title: label('Panel states', 'حالات اللوحات') }),
  kind: 'board',
  definition: {
    panels: [
      vp('p-bar', 'v-bar', 0, 0),
      vp('p-slow', 'v-773-slow', 4, 0),
      vp('p-down', 'v-773-down', 8, 0),
      vp('p-gone', 'v-773-gone', 0, 3),
      vp('p-empty', 'v-773-empty', 4, 3),
      vp('p-cut', 'v-773-cut', 8, 3),
      vp('p-stale', 'v-773-stale', 0, 6),
      { ...vp('p-line', 'v-line-measures', 4, 6), layout: { x: 4, y: 6, w: 8, h: 3 } },
    ],
  },
}
ITEMS_773['b-773'] = BOARD_773
export const PANEL_IDS_773 = BOARD_773.definition.panels.map((p) => p.id)
export const QUERY_773 = {
  ...QUERY,
  'v-773-slow': result('channel_group', 'orders', [['app', 300], ['web', 200]]),
  'v-773-empty': result('store', 'orders', []),
  'v-773-cut': { ...result('store', 'orders', [['P001', 900], ['P002', 700]]), truncated: true },
  'v-773-stale': { ...result('channel_group', 'orders', [['app', 120]]), dataAsOf: '2026-11-05T09:20:00' },
  'v-773-down': refusal('ANALYTICS-409', 'The analytics engine is unreachable.', 503),
  'v-773-gone': refusal('ANALYTICS-410', 'The area is not available yet.', 503),
}
/** Answers taken in order, the last one standing: the slow panel times out once, then answers. */
export const SEQUENCE_773 = { 'v-773-slow': [refusal('ANALYTICS-408', 'The query passed 30 s.', 504), QUERY_773['v-773-slow']] }

// ── 774: drill to detail — a store panel of orders (offers "See deliveries") beside one with till value ─
ITEMS['v-store-orders'] = view('v-store-orders', {
  definition: { chart: { type: 'table' }, query: { measures: ['orders'], dimensions: ['store'], filters: [] } },
})
QUERY['v-store-orders'] = answerShaped([['store', 'dimension'], ['orders', 'measure', 'additive', 'count']], NINE_STORES.map(([store, orders]) => ({ store, orders })))
export const BOARD_774 = {
  ...view('b-detail', { title: label('Stores, last 30 days', 'الفروع، آخر 30 يومًا'), tier: 'shared' }),
  kind: 'board',
  definition: {
    panels: [
      { id: 'p-stores', kind: 'view', viewId: 'v-store-orders', layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] },
      { id: 'p-till', kind: 'view', viewId: 'v-table', layout: { x: 6, y: 0, w: 6, h: 3 }, optOut: [] },
    ],
  },
}
ITEMS['b-detail'] = BOARD_774
/** Two delivery documents of store P001, as `SdDocumentWeb/DeliveryDocumentList` answers. */
export const DELIVERIES_774 = [
  { deliveryNo: '8000001', documentNo: '5000001', storeCode: 'P001', orderNo: 'O-1', documentDate: '2026-11-04T09:00:00', customerName: 'Test One', cityName: 'Riyadh', netTotal: 120, deliveryStatus: '' },
  { deliveryNo: '8000002', documentNo: '5000002', storeCode: 'P001', orderNo: 'O-2', documentDate: '2026-11-03T09:00:00', customerName: 'Test Two', cityName: 'Riyadh', netTotal: 80, deliveryStatus: '' },
]

// ── 775: the editor's inline definitions ────────────────────────────────────────────────────────────
const INLINE_MEMBERS = { channel_group: CHANNELS, store: Object.keys(STORES), day: DAYS, weekday: WEEKDAYS, hour: HOURS }
/** Periods longer than a percentile's 92-day window. */
const LONG_PERIODS = new Set(['year-to-date'])

/**
 * The server's answer to an inline `definition`: every member combination of its breakdowns, each measure a
 * deterministic figure. A percentile over a period past its window is refused `ANALYTICS-407`, as §C says.
 */
export function inlineAnswer(definition, model = MODEL, compareToPrevious = false) {
  const q = definition?.query ?? {}
  const measures = (q.measures ?? []).map((k) => model.measures.find((m) => m.key === k) ?? { key: k, shape: 'additive', unit: 'count' })
  if (measures.some((m) => m.shape === 'percentile') && LONG_PERIODS.has(q.period)) {
    return refusal('ANALYTICS-407', 'A percentile is answered over at most 92 days.', 400)
  }
  const dims = q.dimensions ?? []
  let rows = [{}]
  for (const d of dims) rows = rows.flatMap((r) => (INLINE_MEMBERS[d] ?? ['a', 'b']).map((v) => ({ ...r, [d]: v })))
  // 825: named series — one row set per series (each its own query on the server), merged under a `series`
  // column; each series' figures are its own (the second a third lower, and so on), so the colours are told apart.
  const named = definition?.series ?? []
  if (named.length) rows = named.flatMap((s, si) => rows.map((r) => ({ series: s.id, ...r, __scale: 1 - si * 0.3 })))
  rows = rows.map((r, i) => {
    const { __scale: scale = 1, ...rest } = r
    const out = { ...rest }
    measures.forEach((m, j) => {
      out[m.key] = m.unit === 'share' ? 0.7 + ((i + j) % 5) * 0.05 : m.unit === 'minutes' ? 30 + ((i * 7 + j * 11) % 40) + j * 15 : 400 + ((i * 37 + j * 53) % 500)
      if (scale !== 1) out[m.key] = Math.round(out[m.key] * scale * 100) / 100
    })
    return out
  })
  return {
    columns: [...(named.length ? [{ key: 'series', role: 'series' }] : []), ...dims.map((key) => ({ key, role: 'dimension' })), ...measures.map((m) => ({ key: m.key, role: 'measure', shape: m.shape, unit: m.unit }))],
    rows,
    total: rows.length,
    truncated: false,
    period: { from: '2026-10-30', to: '2026-11-05' },
    // Review fix 11: asked to compare, the previous period's rows (each figure 10 % lower) ride back.
    previous: compareToPrevious ? rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 0.9 * 100) / 100 : v]))) : [],
    fetchedAt: '2026-11-05T10:00:00',
    dataAsOf: '2026-11-05T09:45:00',
  }
}

/**
 * Install the analytics doors on `page`. Every option overrides one door's answer:
 *   access:   an `{ canView, canAuthor, canCurate }` object (default an author, 822), `'absent'` (a bare 404, the door not deployed) or `'bare403'`;
 *   items:    id → item, or id → a `refusal(...)` fulfil object;
 *   list:     the `Analytics/Items` answer (an array of items), or a `refusal(...)` fulfil object;
 *   query:    id → result, or id → a `refusal(...)` fulfil object;
 *   queryDelayMs: hold every Query answer this long, so the loading frame is seen;
 *   querySequence: view id → answers taken in order, the last one standing (773's time-out then retry);
 *   queryDelayFor: view id → ms, held instead of `queryDelayMs` for that view (771's one-by-one landing);
 *   members:  dimension → `DimensionValues` members (default `MEMBERS`), narrowed by `search`;
 *   copilot:  `Copilot/Access` — `'denied'` (the default: `canAsk: false`), `'granted'`, or `'absent'` (a bare 404);
 *   copilotAnswer: the `Copilot/Ask` answer (default `COPILOT_ANSWER`), or `(body, n) => answer` for the nth ask (832).
 *   inlineQuery: (body) → result or `refusal(...)` for a Query with an inline `definition` (default `inlineAnswer`);
 *   paramAnswer: (body, answer) → the answer to a by-item Query (823: `{ itemId, revision, panelId, values }`), given
 *             the one the stub made — the panel's view's answer plus `notReached` for every parameter the board does
 *             not bind to the panel; return it changed, or a `refusal(...)` fulfil object (412). Default: unchanged.
 *   create:   the `POST Analytics/Item` answer — a `refusal(...)` fulfil object, or omitted: the created Personal item
 *             (id `v-new`, `b-new` for a board, `r-new` for a report), which `Analytics/Item/<id>` (and a view's Query) then serve.
 *             824: or `(body, n) => fulfil | null` for the n-th POST (from 1); `null` makes the item as above.
 *   update:   the `PUT Analytics/Item/{id}` answer (776) — a `refusal(...)` fulfil object, or omitted: the item at
 *             `baseRevision + 1` with the body's words and definition, served from then on.
 *   share / unshare / certify / uncertify / remove: the 778 doors' answers — a `refusal(...)` fulfil object, or
 *             omitted: Share/Unshare flip Personal ↔ Shared; Certify freezes `<id>-cert` (Certified, `certifiedFrom: id`)
 *             or bumps its revision when it exists; Uncertify makes it Shared; DELETE removes it (Item → 404). Each
 *             write is served from then on, and `Analytics/Items` lists it (a new item added, a deleted one gone).
 *   copy:     the `POST Analytics/Item/{id}/Copy` answer (776) — a `refusal(...)` fulfil object, or omitted: a Personal
 *             item `v-copy` of msartawi's recording `copiedFrom: id`, served from then on.
 *   revisions: id → the `…/Revisions` answer (a list or a `refusal(...)`); default `REVISIONS_779`, else the item's
 *             own revision alone. Each entry's `snapshot` (title, definition) is what a revert restores.
 *   revert:   the `POST …/Revert` answer (779) — a `refusal(...)` fulfil object, or omitted: the snapshot written as
 *             revision max + 1 (`revertedFrom` recorded), served from then on, with the history grown.
 *   health:   the `GET Analytics/Health` answer (785, BackOffice 3386) — a health object, or a `refusal(...)` fulfil
 *             object; default `HEALTH_OK`.
 * Returns `{ calls, bodies }`: every door path asked, and each POST/PUT body by path (a PUT under `PUT <path>`).
 */
// ── 826: audiences. Roles from authz (one deleted), analytics users, and a board shared with a chosen audience. ──
export const ROLES_826 = [
  { key: 'HQ_SALES', label: label('HQ Sales', 'مبيعات المركز الرئيسي') },
  { key: 'DELIVERY_OPS', label: label('Delivery operations', 'عمليات التوصيل') },
  { key: 'FINANCE', label: label('Finance', 'المالية') },
  { key: 'OLD_ECOM', label: label('E-commerce (old)', 'التجارة الإلكترونية (قديم)'), removed: true },
]
export const USERS_826 = [
  { id: 'nalharbi', name: 'Noura Alharbi', employeeId: '10442' },
  { id: 'kalotaibi', name: 'Khalid Alotaibi', employeeId: '10551' },
  { id: 'sqahtani', name: 'Sara Alqahtani', employeeId: '10663' },
]
/** A store-side audience resolver: write keys → the resolved read (labels, `removed`, names). */
export const resolveAudience = (a) =>
  !a || a.everyone
    ? { everyone: true }
    : {
        everyone: false,
        roles: (a.roles ?? []).map((k) => ROLES_826.find((r) => r.key === k) ?? { key: k, label: label(k, k), removed: true }),
        users: (a.users ?? []).map((id) => USERS_826.find((u) => u.id === id) ?? { id, name: id, employeeId: '' }),
      }
/** aalharbi's Shared board, shared with Delivery operations, the deleted E-commerce role and Noura. */
export const BOARD_826 = {
  ...view('b-826', { title: label('Delivery desk', 'مكتب التوصيل'), tier: 'shared', owner: 'aalharbi', updatedBy: 'aalharbi', revision: 4 }),
  kind: 'board',
  audience: resolveAudience({ roles: ['DELIVERY_OPS', 'OLD_ECOM'], users: ['nalharbi'] }),
  definition: { panels: [{ id: 'p1', kind: 'text', text: label('Desk notes', 'ملاحظات'), layout: { x: 0, y: 0, w: 6, h: 2 } }] },
}
ITEMS['b-826'] = BOARD_826
/** The `ANALYTICS-413` an outsider gets for a link to an item outside its audience: who to ask, nothing else. */
export const NOT_SHARED_826 = envelope({ owner: 'msartawi', ownerName: 'Mohamed Sartawi' }, { status: 403, success: false, message: 'Not shared with you.', errors: [{ errorCode: 'ANALYTICS-413', internalErrorCode: '', errorMessage: 'Not shared with you.' }] })

// ── 827: a report (spec 819 §C, ⚠ proposed) — the acceptance case's shape, in real report blocks ─────────────
// The model gains a cancellation rate with the "inside OMS only" caveat and an 8-day "may still rise" window.
export const MODEL_827 = {
  ...MODEL_825,
  areas: [...MODEL_825.areas, { key: 'orders', available: true }],
  measures: [
    ...MODEL_825.measures,
    {
      key: 'cancellation_rate',
      area: 'orders',
      shape: 'rate',
      unit: 'share',
      label: label('Cancellation rate', 'نسبة الإلغاء'),
      description: label('Orders cancelled, of orders placed', 'الطلبات الملغاة من الطلبات المقدمة'),
      dimensions: ['channel_group', 'delivery_type', 'store', 'city', 'region', 'day'],
      caveat: label('HungerStation cancellations are counted inside OMS only.', 'تُحتسب إلغاءات هنقرستيشن داخل نظام الطلبات فقط.'),
      mayStillRiseDays: 8,
    },
  ],
}
const panel827 = (id, en, ar, definition) => ({ id, kind: 'panel', title: label(en, ar), definition })
export const REPORT_827 = {
  ...view('r-827', { title: label('Channel sales: HungerStation against QC', 'مبيعات القنوات: هنقرستيشن مقابل QC'), tier: 'shared', owner: 'aalharbi', updatedBy: 'aalharbi', revision: 3 }),
  kind: 'report',
  audience: resolveAudience({ roles: ['HQ_SALES', 'DELIVERY_OPS'], users: ['nalharbi'] }),
  definition: {
    params: [
      p823('period', 'period', 'Period', 'الفترة', { required: true, default: { kind: 'period', token: 'last-7-days' } }),
      p823('city', 'members', 'City', 'المدينة', { dimension: 'city', pinned: null, multi: true, default: { kind: 'members', values: [] } }),
      p823('grain', 'grain', 'By', 'حسب', { required: true, grains: ['day', 'week'], default: { kind: 'grain', grain: 'day' } }),
    ],
    bindings: {
      period: { p1: true, p2: true, p3: true, p4: true },
      city: { p1: 'city', p2: 'city', p4: 'city' },
      grain: { p2: true, p3: true },
    },
    sections: [
      {
        id: 's1',
        heading: label('Sales by channel', 'المبيعات حسب القناة'),
        blocks: [
          panel827('p1', 'Net sales by channel', 'صافي المبيعات حسب القناة', def('bar', ['till_value'], ['channel_group'])),
          { id: 't1', kind: 'text', text: label('Across every channel the tills took {p1:total} in the period.', 'حصّلت نقاط البيع {p1:total} عبر جميع القنوات خلال الفترة.') },
        ],
      },
      {
        id: 's2',
        heading: label('HungerStation against QC', 'هنقرستيشن مقابل QC'),
        blocks: [
          { ...panel827('p2', 'Orders: HungerStation against QC', 'الطلبات: هنقرستيشن مقابل QC', { ...def('bar', ['orders'], ['day']), series: SERIES_825 }), from: { viewId: 'v-825', revision: 3 }, sourceChangedSinceCopy: true },
          panel827('p3', 'Cancellation rate: HungerStation against QC', 'نسبة الإلغاء: هنقرستيشن مقابل QC', { ...def('line', ['cancellation_rate'], ['day']), series: SERIES_825 }),
          {
            id: 't2',
            kind: 'text',
            text: label('HungerStation took {p2:hs} orders against QC’s {p2:qc}. Their cancellation rates were {p3:hs} and {p3:qc}.', 'تلقّت هنقرستيشن {p2:hs} طلبًا مقابل {p2:qc} لـ QC. وكانت نسبتا الإلغاء {p3:hs} و{p3:qc}.'),
          },
        ],
      },
      { id: 's3', heading: label('Stores', 'الصيدليات'), blocks: [panel827('p4', '', '', def('table', ['orders', 'till_value'], ['store']))] },
      { id: 's4', heading: label('Summary', 'الملخص'), blocks: [{ id: 'sum', kind: 'summary' }] },
    ],
  },
}
ITEMS['r-827'] = REPORT_827
// A board panel shows the model's marks too: a board over the cancellation rate by day.
ITEMS['v-827-rate'] = view('v-827-rate', { title: label('Cancellation rate by day', 'نسبة الإلغاء حسب اليوم'), definition: def('line', ['cancellation_rate'], ['day']) })
ITEMS['b-827'] = {
  ...view('b-827', { title: label('Cancellations', 'الإلغاءات') }),
  kind: 'board',
  definition: { panels: [{ id: 'p-rate', kind: 'view', viewId: 'v-827-rate', layout: { x: 0, y: 0, w: 12, h: 4 }, optOut: [] }] },
}
QUERY['v-827-rate'] = inlineAnswer(ITEMS['v-827-rate'].definition, MODEL_827)

/**
 * 827: the default `POST Analytics/Report/{id}/Words` answer — each figure the run's own (scaled by the period, so a
 * period change changes them), formatted as the server would; the summary written from them. `opts.words(body)`
 * overrides it (an answer, or a `refusal(...)`); `wordsAnswer827(body, { summary: 'unavailable', drop: [token] })`
 * is the failed number check, with a figure the run lacks.
 */
const PERIOD_SCALE = { 'last-7-days': 1, 'last-week': 0.8, 'last-month': 3.5, yesterday: 0.15 }
export function wordsAnswer827(body, { summary = 'written', drop = [] } = {}) {
  const token = body?.values?.period?.token
  const k = PERIOD_SCALE[token] ?? 2
  const n = (x) => Math.round(x * k).toLocaleString('en-US')
  const figures = { '{p1:total}': `SAR ${n(1250000)}`, '{p2:hs}': n(4200), '{p2:qc}': n(3100), '{p3:hs}': '6.4%', '{p3:qc}': '3.9%' }
  for (const t of drop) delete figures[t]
  return {
    figures,
    summary:
      summary === 'written'
        ? { text: label(`HungerStation outsold QC (${figures['{p2:hs}']} against ${figures['{p2:qc}']}) but cancelled more often.`, `تفوقت هنقرستيشن على QC في الطلبات (${figures['{p2:hs}']} مقابل ${figures['{p2:qc}']}) لكن نسبة إلغائها أعلى.`) }
        : { unavailable: 'A number in the summary did not match this run.' },
  }
}

/** 785: `GET Analytics/Health`, the container's /health as SIS.Api passes it on (BackOffice 3386). */
// ── 833: schedules and kept runs (spec 819 §C, ⚠ proposed) ─────────────────────────────────────────────────────
/** msartawi's own copy of the 827 report, so the session user is its owner (an author) and manages its schedules. */
export const REPORT_833 = { ...REPORT_827, id: 'r-833', owner: 'msartawi', updatedBy: 'msartawi' }
ITEMS['r-833'] = REPORT_833
// ── 832 (spec 819 §D): the copilot builds a report, then edits it in the designer ─────────────────────────────
/** The report a stubbed `create_report` wrote: the 827 sample, msartawi's own, Personal, at revision 1. */
export const REPORT_832 = { ...REPORT_827, id: 'r-832', tier: 'personal', owner: 'msartawi', updatedBy: 'msartawi', revision: 1 }
ITEMS['r-832'] = REPORT_832
/** The acceptance sentence's answer: `create_report` saved r-832; the assumptions one line each. */
export const CREATE_ANSWER_832 = {
  ...COPILOT_ANSWER,
  conversationId: 'c-832',
  questionNo: 1,
  answer: 'I built the report. Open it in the designer to check it, then share and schedule it.',
  trace: [
    { tool: 'describe_model', input: { area: 'sales' }, rows: 14, ms: 30, ok: true },
    { tool: 'create_report', input: { title: 'Channel sales: HungerStation against QC' }, rows: 1, ms: 140, ok: true },
  ],
  reportRefs: [{ id: 'r-832', revision: 1, title: REPORT_832.title }],
  assumptions: [
    label('Period: a parameter, default yesterday', 'الفترة: معامل، افتراضيًا أمس'),
    label('HungerStation and QC: two named series', 'هنقرستيشن وQC: سلسلتان مسماتان'),
    label('Cancellation rate: cancelled ÷ all orders', 'نسبة الإلغاء: الملغاة ÷ جميع الطلبات'),
  ],
}
/** `edit_report` against the report in context: its draft plus a cancellation-rate bar in s2, unsaved (`reportEdit`). */
export function editAnswer832(body) {
  const ctx = body.reportContext
  const definition = structuredClone(ctx.draft.definition)
  const s2 = definition.sections.find((x) => x.id === 's2') ?? definition.sections[0]
  s2.blocks.push({ id: 'p5', kind: 'panel', title: label('Cancellation rate by channel', 'نسبة الإلغاء حسب القناة'), definition: def('bar', ['cancellation_rate'], ['channel_group']) })
  return {
    ...COPILOT_ANSWER,
    conversationId: 'c-832',
    questionNo: 2,
    answer: 'I added the cancellation rate by channel as a bar to the second section.',
    trace: [{ tool: 'edit_report', input: { reportId: ctx.reportId }, rows: 1, ms: 90, ok: true }],
    reportEdit: { reportId: ctx.reportId, definition, note: label('Added "Cancellation rate by channel" as a bar.', 'أُضيفت "نسبة الإلغاء حسب القناة" كأعمدة.') },
  }
}

const mail = (id) => `${id}@al-dawaa.com.sa`
/** A report's candidates: the 826 users (in its audience, with the run grant) and three it may not send to. */
export const USERS_833 = [
  ...USERS_826.map((u) => ({ ...u, email: mail(u.id), canRun: true, inAudience: true })),
  { id: 'tkhan', name: 'Tariq Khan', employeeId: '10777', email: 'tariq.khan@gmail.com', canRun: true, inAudience: true },
  { id: 'mnasser', name: 'Maha Nasser', employeeId: '10888', email: mail('mnasser'), canRun: false, inAudience: true },
  { id: 'oyousef', name: 'Omar Yousef', employeeId: '10999', email: mail('oyousef'), canRun: true, inAudience: false },
]
/** One schedule already there, suspended: its saved city no longer resolves. */
export const SCHEDULES_833 = {
  'r-833': [
    {
      id: 'sch-old',
      cadence: { kind: 'weekly', days: [0, 3] },
      time: '08:00',
      values: { period: { kind: 'period', token: 'last-week' }, city: { kind: 'members', values: ['tabuk-old'] }, grain: { kind: 'grain', grain: 'day' } },
      lang: 'ar',
      recipients: ['nalharbi'],
      enabled: true,
      suspended: { reason: 'value', param: 'city' },
    },
  ],
}
const run833 = (id, more) => ({
  id,
  reportId: 'r-833',
  scheduleId: 'sch-old',
  revision: 3,
  trigger: 'schedule',
  values: { period: { kind: 'period', token: 'last-week' }, city: { kind: 'members', values: [] }, grain: { kind: 'grain', grain: 'day' } },
  recipients: [USERS_826[0]],
  dropped: [],
  outcome: 'sent',
  summary: null,
  artefactsKept: true,
  hasPdf: true,
  dataAsOf: '2026-11-04T23:30:00',
  ...more,
})
/** Kept runs, newest first: one whose artefacts the server will answer 410 for, and one past its 90 days. */
export const RUNS_833 = {
  'r-833': [
    run833('run-410', { ranAt: '2026-08-09T08:00:00', outcome: 'chartsUnavailable', hasPdf: false }),
    run833('run-old', { ranAt: '2026-07-05T08:00:00', trigger: 'late', artefactsKept: false, dropped: [USERS_826[2]] }),
  ],
}

export const HEALTH_OK = {
  status: 'ok',
  version: '1.0.0',
  cube: 'ready',
  marts: { status: 'fresh', lastGoodRunAtRiyadh: '2026-11-05 09:45:12', minutesSince: 7, maxMinutes: 45, lastRun: 'intraday success at 2026-11-05 09:45:12' },
  checkedAt: '2026-11-05T09:52:00',
}

const body823 = (req) => (req.method() === 'POST' ? req.postDataJSON() : null)
const isFulfilAt = (v) => v && typeof v === 'object' && 'contentType' in v && 'body' in v

export async function installAnalyticsStubs(page, opts = {}) {
  const { access = { canView: true, canAuthor: true, canCurate: false }, items = ITEMS, list = LIST, query = QUERY, model = MODEL, queryDelayMs = 0, queryDelayFor = {}, querySequence = {}, members = MEMBERS, copilot = 'denied', copilotAnswer = COPILOT_ANSWER, deliveries, inlineQuery = (body) => inlineAnswer(body.definition, model, body.compareToPrevious === true), create, update, copy, revisions = REVISIONS_779, revert, share, unshare, certify, uncertify, remove, health = HEALTH_OK, audience, reassign, candidates, paramAnswer = (_body, answer) => answer, words = (body) => wordsAnswer827(body), schedules = SCHEDULES_833, scheduleSave, runs = RUNS_833, artefact } = opts
  const history = Object.fromEntries(Object.entries(revisions).map(([id, list]) => [id, isFulfilAt(list) ? list : list.map((r) => ({ ...r }))]))
  const made = {}
  // 833: each report's schedules and kept runs, written by the schedule doors and Send now.
  const scheduled = Object.fromEntries(Object.entries(schedules).map(([id, list]) => [id, list.map((x) => ({ ...x }))]))
  const kept = Object.fromEntries(Object.entries(runs).map(([id, list]) => [id, [...list]]))
  // 778: the tier writes, which (unlike 775/776's) the home's list follows.
  const listedNow = new Map()
  const removed = new Set()
  const calls = []
  const bodies = {}
  /** 774: GET query strings by path (the Deliveries list's search). */
  const gets = {}
  const isFulfil = (v) => v && typeof v === 'object' && 'contentType' in v && 'body' in v

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (req.method() === 'POST') (bodies[p] ??= []).push(req.postDataJSON())
    if (req.method() === 'PUT') (bodies[`PUT ${p}`] ??= []).push(req.postDataJSON())

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
    if (p === 'Copilot/Ask') return route.fulfill(envelope(typeof copilotAnswer === 'function' ? copilotAnswer(req.postDataJSON() ?? {}, bodies[p].length) : copilotAnswer))
    if (p === 'Analytics/Model') return route.fulfill(envelope(model))
    if (p === 'Analytics/Health') return route.fulfill(isFulfil(health) ? health : envelope(health))
    if (p === 'Analytics/DimensionValues') {
      const search = (url.searchParams.get('search') ?? '').toLowerCase()
      const all = members[url.searchParams.get('dimension')] ?? []
      const text = (m) => [m.key, typeof m.label === 'string' ? m.label : `${m.label.en} ${m.label.ar}`].join(' ').toLowerCase()
      return route.fulfill(envelope(all.filter((m) => !search || text(m).includes(search)).slice(0, 50)))
    }
    if (p === 'Analytics/Items') {
      // Review fix 15: the `kind` / `tier` / `search` params are recorded, and ignored — the screens narrow
      // what comes back themselves, so a server that ignores them still works.
      ;(gets[p] ??= []).push(Object.fromEntries(url.searchParams))
      if (isFulfil(list)) return route.fulfill(list)
      const now = list.map((it) => listedNow.get(it.id) ?? it).concat([...listedNow.values()].filter((it) => !list.some((x) => x.id === it.id)))
      return route.fulfill(envelope(now.filter((it) => !removed.has(it.id))))
    }
    // 826: the candidates (roles and users matching `search`), the Audience door and Reassign.
    if (p === 'Analytics/AudienceCandidates') {
      ;(gets[p] ??= []).push(Object.fromEntries(url.searchParams))
      if (candidates) return route.fulfill(candidates)
      const q = (url.searchParams.get('search') ?? '').toLowerCase()
      const hit = (...xs) => !q || xs.join(' ').toLowerCase().includes(q)
      // 833: asked for a report, each user carries an address, the run grant and whether they sit in its audience.
      if (url.searchParams.get('reportId')) return route.fulfill(envelope({ roles: [], users: USERS_833.filter((u) => hit(u.id, u.name, u.employeeId)) }))
      return route.fulfill(envelope({ roles: ROLES_826.filter((r) => hit(r.key, r.label.en, r.label.ar)), users: USERS_826.filter((u) => hit(u.id, u.name, u.employeeId)) }))
    }
    const audienceDoor = /^Analytics\/Item\/([^/]+)\/(Audience|Reassign)$/.exec(p)
    if (audienceDoor && (req.method() === 'PUT' || req.method() === 'POST')) {
      const [id, door] = [decodeURIComponent(audienceDoor[1]), audienceDoor[2]]
      const override = door === 'Audience' ? audience : reassign
      if (override) return route.fulfill(override)
      const before = made[id] ?? items[id]
      if (!before) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      const body = req.postDataJSON() ?? {}
      // Not a revision: the item keeps its revision (no 405 for an editor holding it); the history gains an event.
      const after = door === 'Audience' ? { ...before, audience: resolveAudience(body.audience) } : { ...before, owner: body.owner }
      made[id] = after
      listedNow.set(id, after)
      const rows = (history[id] ??= [{ revision: before.revision, updatedAt: before.updatedAt, updatedBy: before.updatedBy }])
      if (Array.isArray(rows)) rows.push({ revision: before.revision, updatedAt: '2026-11-05T10:20:00', updatedBy: 'msartawi', event: door === 'Audience' ? 'audience' : 'reassign', ...(door === 'Reassign' ? { owner: body.owner } : {}) })
      return route.fulfill(envelope(after))
    }
    // 778: Share / Unshare / Certify / Uncertify, and DELETE.
    const tierDoor = /^Analytics\/Item\/([^/]+)\/(Share|Unshare|Certify|Uncertify)$/.exec(p)
    if ((tierDoor && req.method() === 'POST') || (p.startsWith('Analytics/Item/') && req.method() === 'DELETE')) {
      const [id, door] = tierDoor ? [decodeURIComponent(tierDoor[1]), tierDoor[2]] : [decodeURIComponent(p.slice('Analytics/Item/'.length)), 'Delete']
      const override = { Share: share, Unshare: unshare, Certify: certify, Uncertify: uncertify, Delete: remove }[door]
      if (override) return route.fulfill(override)
      const before = made[id] ?? items[id]
      if (!before || removed.has(id)) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      const keep = (it) => {
        made[it.id] = it
        listedNow.set(it.id, it)
        return route.fulfill(envelope(it))
      }
      const at = { updatedAt: '2026-11-05T10:08:00', updatedBy: 'msartawi' }
      // 826: Share takes an audience; Unshare drops it.
      if (door === 'Share') return keep({ ...before, tier: 'shared', audience: resolveAudience(req.postDataJSON()?.audience), ...at })
      if (door === 'Unshare') {
        const { audience: _dropped, ...rest } = before
        return keep({ ...rest, tier: 'personal', ...at })
      }
      if (door === 'Uncertify') return keep({ ...before, tier: 'shared', ...at })
      if (door === 'Delete') {
        removed.add(id)
        return route.fulfill(envelope(null))
      }
      const copyId = `${id}-cert`
      const prior = made[copyId]
      return keep({ ...before, id: copyId, tier: 'certified', certifiedFrom: id, copiedFrom: null, revision: prior ? prior.revision + 1 : 1, ...at })
    }
    if (p === 'Analytics/Item' && req.method() === 'POST') {
      const answer = typeof create === 'function' ? create(req.postDataJSON() ?? {}, bodies[p].length) : create
      if (answer) return route.fulfill(answer)
      const body = req.postDataJSON() ?? {}
      // 777: a board is made as `b-new`, a view as `v-new`; 828: a report as `r-new`.
      const id = body.kind === 'board' ? 'b-new' : body.kind === 'report' ? 'r-new' : 'v-new'
      made[id] = { ...view(id, { title: body.title, subtitle: body.subtitle, definition: body.definition, revision: 1, updatedAt: '2026-11-05T10:05:00' }), kind: body.kind ?? 'view' }
      return route.fulfill(envelope(made[id]))
    }
    if (p.startsWith('Analytics/Item/') && p.endsWith('/Copy') && req.method() === 'POST') {
      if (copy) return route.fulfill(copy)
      const from = decodeURIComponent(p.slice('Analytics/Item/'.length, -'/Copy'.length))
      const body = req.postDataJSON() ?? {}
      const source = made[from] ?? items[from] ?? {}
      made['v-copy'] = view('v-copy', {
        title: body.title ?? source.title,
        subtitle: body.subtitle ?? source.subtitle,
        definition: body.definition ?? source.definition,
        copiedFrom: from,
        revision: 1,
        updatedAt: '2026-11-05T10:06:00',
      })
      return route.fulfill(envelope(made['v-copy']))
    }
    if (p.startsWith('Analytics/Item/') && p.endsWith('/Revisions')) {
      const id = decodeURIComponent(p.slice('Analytics/Item/'.length, -'/Revisions'.length))
      const list = history[id]
      if (isFulfil(list)) return route.fulfill(list)
      const it = made[id] ?? items[id]
      if (!list && !it) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      const rows = list ?? [{ revision: it.revision, updatedAt: it.updatedAt, updatedBy: it.updatedBy }]
      return route.fulfill(envelope(rows.map(({ snapshot, ...r }) => r)))
    }
    if (p.startsWith('Analytics/Item/') && p.endsWith('/Revert') && req.method() === 'POST') {
      if (revert) return route.fulfill(revert)
      const id = decodeURIComponent(p.slice('Analytics/Item/'.length, -'/Revert'.length))
      const body = req.postDataJSON() ?? {}
      const list = history[id]
      const from = Array.isArray(list) ? list.find((r) => r.revision === body.revision) : null
      const before = made[id] ?? items[id]
      if (!from || !before) return route.fulfill(refusal('ANALYTICS-404', 'That revision is not found.', 404))
      const revision = Math.max(...list.map((r) => r.revision)) + 1
      const updatedAt = `2026-11-05T10:${String(10 + revision).padStart(2, '0')}:00`
      made[id] = { ...before, ...from.snapshot, revision, updatedAt, updatedBy: 'msartawi' }
      list.push({ revision, updatedAt, updatedBy: 'msartawi', revertedFrom: from.revision, snapshot: from.snapshot })
      return route.fulfill(envelope(made[id]))
    }
    if (p.startsWith('Analytics/Item/') && req.method() === 'PUT') {
      if (update) return route.fulfill(update)
      const id = decodeURIComponent(p.slice('Analytics/Item/'.length))
      const body = req.postDataJSON() ?? {}
      const before = made[id] ?? items[id]
      if (!before) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      made[id] = { ...before, title: body.title, subtitle: body.subtitle, definition: body.definition, revision: (body.baseRevision ?? before.revision) + 1, updatedAt: '2026-11-05T10:07:00', updatedBy: 'msartawi' }
      return route.fulfill(envelope(made[id]))
    }
    if (p.startsWith('Analytics/Item/')) {
      const id = decodeURIComponent(p.slice('Analytics/Item/'.length))
      const it = made[id] ?? items[id]
      if (!it || removed.has(id)) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      return route.fulfill(isFulfil(it) ? it : envelope(it))
    }
    // 833: a report's schedules (GET / POST / PUT / DELETE), Send now, its kept runs and their artefacts.
    const scheduleDoor = /^Analytics\/Report\/([^/]+)\/Schedules(?:\/([^/]+))?(\/SendNow)?$/.exec(p)
    if (scheduleDoor) {
      const [id, sid, send] = [decodeURIComponent(scheduleDoor[1]), scheduleDoor[2] && decodeURIComponent(scheduleDoor[2]), !!scheduleDoor[3]]
      const list = (scheduled[id] ??= [])
      if (send) {
        const s = list.find((x) => x.id === sid)
        const at = `2026-11-06T09:${String(10 + (kept[id]?.length ?? 0)).padStart(2, '0')}:00`
        const run = { id: `run-now-${(kept[id]?.length ?? 0) + 1}`, reportId: id, scheduleId: sid, revision: 3, ranAt: at, dataAsOf: '2026-11-06T08:45:00', trigger: 'sendNow', values: s?.values ?? {}, recipients: (s?.recipients ?? []).map((r) => USERS_833.find((u) => u.id === r) ?? r), dropped: [], outcome: 'sent', summary: null, artefactsKept: true, hasPdf: true }
        ;(kept[id] ??= []).unshift(run)
        return route.fulfill(envelope(run))
      }
      if (req.method() === 'GET') return route.fulfill(envelope(list))
      if (req.method() === 'DELETE') {
        scheduled[id] = list.filter((x) => x.id !== sid)
        return route.fulfill(envelope(null))
      }
      const body = req.postDataJSON() ?? {}
      const override = typeof scheduleSave === 'function' ? scheduleSave(body, (bodies[req.method() === 'PUT' ? `PUT ${p}` : p] ?? []).length) : scheduleSave
      if (override) return route.fulfill(override)
      const saved = { ...body, id: sid ?? `sch-${list.length + 1}`, suspended: null }
      scheduled[id] = [...list.filter((x) => x.id !== saved.id), saved]
      return route.fulfill(envelope(saved))
    }
    const runsDoor = /^Analytics\/Report\/([^/]+)\/Runs$/.exec(p)
    if (runsDoor) return route.fulfill(envelope(kept[decodeURIComponent(runsDoor[1])] ?? []))
    const artefactDoor = /^Analytics\/ReportRun\/([^/]+)\/(Html|Pdf)$/.exec(p)
    if (artefactDoor) {
      const [runId, kind] = [decodeURIComponent(artefactDoor[1]), artefactDoor[2]]
      const answer = artefact?.(runId, kind)
      if (answer) return route.fulfill(answer)
      return kind === 'Html'
        ? route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>${runId}</title><p data-run-email>${runId}</p>` })
        : route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%stub\n' })
    }
    const runDoor = /^Analytics\/ReportRun\/([^/]+)$/.exec(p)
    if (runDoor) {
      const run = Object.values(kept).flat().find((r) => r.id === decodeURIComponent(runDoor[1]))
      return route.fulfill(run ? envelope(run) : refusal('ANALYTICS-404', 'The run is not found.', 404))
    }
    // 827: a report's Words — its live figures and summary for one run.
    if (/^Analytics\/Report\/[^/]+\/Words$/.test(p) && req.method() === 'POST') {
      const answer = words(body823(req))
      return route.fulfill(isFulfil(answer) ? answer : envelope(answer))
    }
    // 827: one panel of a report — its inline definition answered, and every parameter not bound to it not reached.
    if (p === 'Analytics/Query' && body823(req)?.itemId && (made[body823(req).itemId] ?? items[body823(req).itemId])?.kind === 'report') {
      const body = body823(req)
      const report = made[body.itemId] ?? items[body.itemId]
      const block = report.definition.sections.flatMap((x) => x.blocks).find((b) => b.id === body.panelId && b.kind === 'panel')
      if (!block) return route.fulfill(refusal('ANALYTICS-404', 'The panel is not found.', 404))
      if (queryDelayMs) await new Promise((r) => setTimeout(r, queryDelayMs))
      const bindings = report.definition.bindings ?? {}
      const notReached = (report.definition.params ?? []).filter((x) => !bindings[x.name]?.[block.id]).map((x) => ({ param: x.name, reason: 'notInArea' }))
      const answer = paramAnswer(body, { ...inlineAnswer(block.definition, model), notReached, fellBack: [] })
      return route.fulfill(isFulfil(answer) ? answer : envelope(answer))
    }
    if (p === 'Analytics/Query' && body823(req)?.itemId) {
      // 823: one panel of an item with parameters — the board's panel's view answers, and the server says which
      // parameters do not reach the panel (every one the board does not bind to it).
      const body = body823(req)
      const board = made[body.itemId] ?? items[body.itemId]
      const panel = board?.definition?.panels?.find((x) => x.id === body.panelId)
      if (!panel) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      const hold = queryDelayFor[panel.viewId] ?? queryDelayMs
      if (hold) await new Promise((r) => setTimeout(r, hold))
      const base = query[panel.viewId]
      if (!base) return route.fulfill(refusal('ANALYTICS-404', 'The view is not found.', 404))
      const bindings = board.definition.bindings ?? {}
      const notReached = (board.definition.params ?? []).filter((x) => !bindings[x.name]?.[panel.id]).map((x) => ({ param: x.name, reason: 'notInArea' }))
      const answer = paramAnswer(body, { ...base, notReached, fellBack: [] })
      return route.fulfill(isFulfil(answer) ? answer : envelope(answer))
    }
    if (p === 'Analytics/Query') {
      const body = req.postDataJSON() ?? {}
      // 772: an inline definition (drill by) is answered by its first dimension, `drill:<dimension>`.
      const id = body.viewId ?? `drill:${body.definition?.query?.dimensions?.[0] ?? ''}`
      const hold = queryDelayFor[id] ?? queryDelayMs
      if (hold) await new Promise((r) => setTimeout(r, hold))
      // 772's drill answers (`drill:<dimension>`) win over 775's generic inline answer.
      if (body.definition && !query[id]) {
        const inline = inlineQuery(body)
        return route.fulfill(isFulfil(inline) ? inline : envelope(inline))
      }
      if (made[body.viewId]) return route.fulfill(envelope(inlineAnswer(made[body.viewId].definition, model, body.compareToPrevious === true)))
      // 825: a saved view with named series is answered per series from its own definition.
      if (items[body.viewId]?.definition?.series?.length && !query[body.viewId]) return route.fulfill(envelope(inlineAnswer(items[body.viewId].definition, model, body.compareToPrevious === true)))
      if (ITEMS_776[body.viewId] && !query[body.viewId]) return route.fulfill(envelope(inlineAnswer(ITEMS_776[body.viewId].definition, model)))
      const seq = querySequence[id]
      const answer = seq?.length ? (seq.length > 1 ? seq.shift() : seq[0]) : query[id]
      if (!answer) return route.fulfill(refusal('ANALYTICS-404', 'The view is not found.', 404))
      return route.fulfill(isFulfil(answer) ? answer : envelope(answer))
    }
    // 774: the Deliveries list, granted only when a scenario hands it rows.
    if (deliveries && p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (deliveries && p === 'SdDocumentWeb/DeliveryDocumentList') {
      ;(gets[p] ??= []).push(Object.fromEntries(url.searchParams))
      return route.fulfill(envelope(deliveries))
    }
    // Every other screen's probe denies, so the nav holds only what a scenario grants.
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canView: false }))
    return route.fulfill(envelope([]))
  })
  return { calls, bodies, gets }
}
