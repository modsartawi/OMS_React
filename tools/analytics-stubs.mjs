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
    // 769: a rate (never in a donut; the combo's lower pane).
    {
      key: 'on_time_share',
      area: 'sales',
      shape: 'rate',
      unit: 'share',
      label: label('On-time share', 'نسبة الالتزام بالوقت'),
      description: label('Share of orders delivered on time', 'نسبة الطلبات المسلّمة في الوقت'),
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

export const ITEMS = {
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

/** A many-column answer: `columns` as `[key, role, shape?, unit?]`, rows as objects. */
const answer = (columns, rows) => ({
  columns: columns.map(([key, role, shape, unit]) => (role === 'measure' ? { key, role, shape, unit } : { key, role })),
  rows,
  total: rows.length,
  truncated: false,
  period: { from: '2026-10-07', to: '2026-11-05' },
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
})

// Nine stores: the donut keeps the five largest (the palette's five hues) and folds four into "Other".
const STORES = [['P001', 900], ['P002', 800], ['P003', 700], ['P004', 600], ['P005', 500], ['P006', 400], ['P007', 300], ['P008', 200], ['P009', 100]]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const HOURS = ['08', '12', '16', '20']

// Ranked by value, which is NOT the catalogue order: the colours must follow the channel, not the rank.
export const QUERY = {
  'v-bar': result('channel_group', 'orders', [['aggregator', 4200], ['app', 3100], ['store', 2600], ['web', 1800], ['callcenter', 900]]),
  'v-titled': result('channel_group', 'orders', [['web', 1800], ['aggregator', 4200]]),
  'v-donut': result('store', 'orders', STORES),
  'v-donut-rate': answer([['channel_group', 'dimension'], ['on_time_share', 'measure', 'rate', 'share']], [{ channel_group: 'app', on_time_share: 0.91 }, { channel_group: 'web', on_time_share: 0.84 }]),
  'v-table': answer(
    [['store', 'dimension'], ['orders', 'measure', 'additive', 'count'], ['till_value', 'measure', 'additive', 'SAR']],
    STORES.map(([store, orders], i) => ({ store, orders: orders + i * 37, till_value: (orders + i * 37) * 61.5 })).reverse(),
  ),
  // Orders by weekday × hour: 10 at Sun 08 (the minimum), 200 at Thu 20 (the maximum); Wed 16 is empty.
  'v-heatmap': answer(
    [['weekday', 'dimension'], ['hour', 'dimension'], ['orders', 'measure', 'additive', 'count']],
    WEEKDAYS.flatMap((weekday, w) =>
      HOURS.filter((hour) => !(weekday === 'Wed' && hour === '16')).map((hour, h) => ({
        weekday,
        hour,
        orders: weekday === 'Sun' && hour === '08' ? 10 : weekday === 'Thu' && hour === '20' ? 200 : 20 + w * 25 + h * 10,
      })),
    ),
  ),
  'v-combo': answer(
    [['day', 'dimension'], ['orders', 'measure', 'additive', 'count'], ['on_time_share', 'measure', 'rate', 'share']],
    ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((day, i) => ({ day, orders: 300 + i * 40, on_time_share: 0.8 + i * 0.03 })),
  ),
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
