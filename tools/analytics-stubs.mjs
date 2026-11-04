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
  areas: [{ key: 'sales', available: true }, { key: 'callouts', available: false, unavailableReason: 'Waiting on the replica (753).' }],
  measures: [
    {
      key: 'orders',
      area: 'sales',
      shape: 'additive',
      unit: 'count',
      label: label('Orders', 'الطلبات'),
      description: label('Orders placed', 'الطلبات المقدمة'),
      dimensions: ['channel_group', 'store', 'day'],
    },
    {
      key: 'till_value',
      area: 'sales',
      shape: 'additive',
      unit: 'SAR',
      label: label('Value through our tills', 'القيمة عبر صناديقنا'),
      description: label('Value through our tills', 'القيمة عبر صناديقنا'),
      dimensions: ['channel_group', 'store', 'day'],
    },
    {
      key: 'deliveries',
      area: 'sales',
      shape: 'additive',
      unit: 'count',
      label: label('Deliveries', 'التوصيلات'),
      description: label('Deliveries completed', 'التوصيلات المكتملة'),
      dimensions: ['channel_group', 'store', 'day'],
    },
    {
      key: 'on_time_share',
      area: 'sales',
      shape: 'rate',
      unit: 'share',
      label: label('On-time share', 'نسبة الالتزام بالوقت'),
      description: label('Deliveries on time ÷ deliveries', 'التوصيلات في الوقت ÷ التوصيلات'),
      dimensions: ['channel_group', 'store', 'day'],
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
    { key: 'day', kind: 'time', label: label('Day', 'اليوم') },
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

// Ranked by value, which is NOT the catalogue order: the colours must follow the channel, not the rank.
export const QUERY = {
  ...QUERY_768,
  'v-bar': result('channel_group', 'orders', [['aggregator', 4200], ['app', 3100], ['store', 2600], ['web', 1800], ['callcenter', 900]]),
  'v-titled': result('channel_group', 'orders', [['web', 1800], ['aggregator', 4200]]),
}

/**
 * Install the analytics doors on `page`. Every option overrides one door's answer:
 *   access:   an `{ canView, canCurate }` object, `'absent'` (a bare 404, the door not deployed) or `'bare403'`;
 *   items:    id → item, or id → a `refusal(...)` fulfil object;
 *   query:    id → result, or id → a `refusal(...)` fulfil object;
 *   queryDelayMs: hold every Query answer this long, so the loading frame is seen.
 * Returns `{ calls, bodies }`: every door path asked, and each POST body by path.
 */
export async function installAnalyticsStubs(page, opts = {}) {
  const { access = { canView: true, canCurate: false }, items = ITEMS, query = QUERY, model = MODEL, queryDelayMs = 0 } = opts
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
    if (p === 'Analytics/Model') return route.fulfill(envelope(model))
    if (p.startsWith('Analytics/Item/')) {
      const id = decodeURIComponent(p.slice('Analytics/Item/'.length))
      const it = items[id]
      if (!it) return route.fulfill(refusal('ANALYTICS-404', 'The item is not found.', 404))
      return route.fulfill(isFulfil(it) ? it : envelope(it))
    }
    if (p === 'Analytics/Query') {
      const body = req.postDataJSON() ?? {}
      if (queryDelayMs) await new Promise((r) => setTimeout(r, queryDelayMs))
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
