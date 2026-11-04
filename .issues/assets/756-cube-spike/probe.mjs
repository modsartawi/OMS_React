// Ticket 756 — the spike's client. Mints a service JWT the way SIS.Api would (HS256 over
// CUBEJS_API_SECRET, no library), calls Cube's REST API, and writes each request+response to
// evidence/<name>.json. Usage: node probe.mjs <step> ; steps listed at the bottom.
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.CUBE_URL ?? 'http://10.211.55.2:4000/cubejs-api/v1';
const SECRET = 'spike-756-service-secret-not-for-prod-0123456789';
mkdirSync(new URL('./evidence/', import.meta.url), { recursive: true });

const b64u = (b) => Buffer.from(b).toString('base64url');
export function mintJwt(payload, secret = SECRET) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
const now = () => Math.floor(Date.now() / 1000);
// What SIS.Api would send: a short-lived service token carrying who asked (for audit), no PII.
const serviceToken = () =>
  mintJwt({ sub: 'sis-api', actor: 'ua:12345', iat: now(), exp: now() + 300 });

async function call(name, path, { token = serviceToken(), query, method = 'GET', poll = true } = {}) {
  const url = new URL(BASE + path);
  if (query && method === 'GET') url.searchParams.set('query', JSON.stringify(query));
  const headers = { 'content-type': 'application/json' };
  if (token !== null) headers.authorization = token;
  const started = Date.now();
  let res, json, waits = 0;
  for (;;) {
    res = await fetch(url, { method, headers, body: method === 'POST' ? JSON.stringify({ query }) : undefined });
    const text = await res.text();
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    // Cube answers 200 {"error":"Continue wait"} while a query runs; clients re-ask.
    if (poll && json?.error === 'Continue wait') { waits++; continue; }
    break;
  }
  const record = {
    step: name, at: new Date().toISOString(), ms: Date.now() - started, continueWaits: waits,
    request: { method, path, auth: token === null ? 'none' : token.slice(0, 24) + '…', query },
    status: res.status, response: json,
  };
  writeFileSync(new URL(`./evidence/${name}.json`, import.meta.url), JSON.stringify(record, null, 2));
  const summary = json?.data ? `rows=${json.data.length} usedPreAggregations=${JSON.stringify(json.usedPreAggregations ?? {})}` : JSON.stringify(json).slice(0, 300);
  console.log(`${name}: ${res.status} ${record.ms}ms waits=${waits} ${summary}`);
  return record;
}

// ---- the queries ---------------------------------------------------------------------------
// Item 3: the minimum structured query — measures, a dimension, a filter, a grain, a relative range.
export const loadQuery = {
  measures: ['till_sales_view.till_sales', 'till_sales_view.net_till_value_sar', 'till_sales_view.return_rate'],
  dimensions: ['till_sales_view.city'],
  filters: [{ member: 'till_sales_view.country', operator: 'equals', values: ['KSA'] }],
  timeDimensions: [{ dimension: 'till_sales_view.sales_date', granularity: 'week', dateRange: 'last 4 weeks' }],
};

const steps = {
  async ready() {
    const r = await fetch(BASE.replace('/cubejs-api/v1', '/readyz'));
    console.log('readyz', r.status, await r.text());
  },
  // item 7
  async auth() {
    await call('7a-no-token', '/meta', { token: null });
    await call('7b-bad-signature', '/meta', { token: mintJwt({ sub: 'sis-api', iat: now(), exp: now() + 300 }, 'wrong-secret') });
    await call('7c-expired', '/meta', { token: mintJwt({ sub: 'sis-api', iat: now() - 600, exp: now() - 300 }) });
    await call('7d-garbage', '/meta', { token: 'not-a-jwt' });
    await call('7e-service-jwt', '/meta');
  },
  // item 4
  async meta() { await call('4-meta', '/meta'); },
  // item 3
  async load() {
    await call('3a-load-min', '/load', { query: loadQuery });
    await call('3b-sql', '/sql', { query: loadQuery });
    await call('3c-load-hidden-member', '/load', { query: { measures: ['till_sales_daily.gross_till_value_sar'] } });
    await call('3d-load-undeclared-member', '/load', { query: { measures: ['till_sales_view.till_sales'], dimensions: ['till_sales_daily.top_customer_mobile'] } });
    await call('3e-load-not-in-view', '/load', { query: { measures: ['till_sales_view.gross_till_value_sar'] } });
    await call('3f-load-hidden-pk', '/load', { query: { measures: ['till_sales_daily.till_sales'], dimensions: ['till_sales_daily.pk'] } });
  },
  // item 5
  async rollup() {
    const q = { measures: ['till_sales_daily.till_sales', 'till_sales_daily.net_till_value_sar'], dimensions: ['stores.city'],
      timeDimensions: [{ dimension: 'till_sales_daily.sales_date', granularity: 'month', dateRange: 'last 90 days' }] };
    await call('5a-rollup-cube-query', '/load', { query: q });
    await call('5b-rollup-view-query', '/load', { query: loadQuery });
    await call('5c-rollup-sql', '/sql', { query: q });
    // return_rate is a number over two rolled-up sums: does it still match the rollup?
    await call('5d-rollup-derived-measure', '/load', { query: { measures: ['till_sales_daily.return_rate'], dimensions: ['stores.city'],
      timeDimensions: [{ dimension: 'till_sales_daily.sales_date', granularity: 'week', dateRange: 'last 4 weeks' }] } });
  },
  // item 6
  async limits() {
    const daily = { measures: ['till_sales_daily.till_sales'], dimensions: ['till_sales_daily.store_code'],
      timeDimensions: [{ dimension: 'till_sales_daily.sales_date', granularity: 'day', dateRange: 'last 150 days' }] };
    await call('6a-no-limit-15000-rows', '/load', { query: daily });
    await call('6b-limit-10000', '/load', { query: { ...daily, limit: 10000 } });
    await call('6c-limit-10001', '/load', { query: { ...daily, limit: 10001 } });
    await call('6d-limit-50000', '/load', { query: { ...daily, limit: 50000 } });
    await call('6e-ungrouped-no-limit', '/load', { query: { dimensions: ['till_sales_daily.store_code'], ungrouped: true } });
  },
  // variant B: cubes public: false, the view public
  async variantB() {
    await call('B1-meta-views-only', '/meta');
    await call('B2-view-load', '/load', { query: loadQuery });
    await call('B3-hidden-cube-member', '/load', { query: { measures: ['till_sales_daily.till_sales'] } });
    await call('B4-saudi-week', '/load', { query: { ...loadQuery, timezone: 'Asia/Riyadh',
      timeDimensions: [{ dimension: 'till_sales_view.sales_date', granularity: 'saudi_week', dateRange: 'last 4 weeks' }] } });
    await call('B5-total-flag', '/load', { query: { measures: ['till_sales_view.till_sales'], dimensions: ['till_sales_view.store_code'],
      timeDimensions: [{ dimension: 'till_sales_view.sales_date', granularity: 'day', dateRange: 'last 150 days' }], total: true } });
  },
  // item 1: a query the rollup cannot serve (store_name is not in it) goes to SQL Server
  async source() {
    await call(process.env.STEP ?? '1-source-query', '/load', { query: { measures: ['till_sales_view.till_sales'],
      dimensions: ['till_sales_view.store_name'], limit: 3, order: { 'till_sales_view.till_sales': 'desc' },
      timeDimensions: [{ dimension: 'till_sales_view.sales_date', dateRange: 'last 7 days' }] } });
  },
  async slow() { await call('6f-slow-30s', '/load', { query: { measures: ['slow_probe.n'] } }); },
};

const which = process.argv.slice(2);
for (const s of which.length ? which : Object.keys(steps)) await steps[s]();
