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

export const ITEMS = {
  // Title empty, as the AI leaves it: the screen generates "Orders by Channel".
  'v-bar': view('v-bar'),
  'v-titled': view('v-titled', { title: label('Orders by channel, last 30 days', 'الطلبات حسب القناة، آخر 30 يومًا'), tier: 'shared' }),
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

// Ranked by value, which is NOT the catalogue order: the colours must follow the channel, not the rank.
export const QUERY = {
  'v-bar': result('channel_group', 'orders', [['aggregator', 4200], ['app', 3100], ['store', 2600], ['web', 1800], ['callcenter', 900]]),
  'v-titled': result('channel_group', 'orders', [['web', 1800], ['aggregator', 4200]]),
}

/**
 * Install the analytics doors on `page`. Every option overrides one door's answer:
 *   access:   an `{ canView, canCurate }` object, `'absent'` (a bare 404, the door not deployed) or `'bare403'`;
 *   items:    id → item, or id → a `refusal(...)` fulfil object;
 *   list:     the `Analytics/Items` answer (an array of items), or a `refusal(...)` fulfil object;
 *   query:    id → result, or id → a `refusal(...)` fulfil object;
 *   queryDelayMs: hold every Query answer this long, so the loading frame is seen;
 *   copilot:  `Copilot/Access` — `'denied'` (the default: `canAsk: false`), `'granted'`, or `'absent'` (a bare 404);
 *   copilotAnswer: the `Copilot/Ask` answer (default `COPILOT_ANSWER`).
 * Returns `{ calls, bodies }`: every door path asked, and each POST body by path.
 */
export async function installAnalyticsStubs(page, opts = {}) {
  const { access = { canView: true, canCurate: false }, items = ITEMS, list = LIST, query = QUERY, model = MODEL, queryDelayMs = 0, copilot = 'denied', copilotAnswer = COPILOT_ANSWER } = opts
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
    if (p === 'Analytics/Items') return route.fulfill(isFulfil(list) ? list : envelope(list))
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
