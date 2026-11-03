/* PROTOTYPE — throwaway. Wayfinder ticket 747 (map 741).
 *
 * The AI STAND-IN for the "Ask" variant: a keyword matcher that turns an HQ question into a
 * STRUCTURED query (measure · by · filters · period · chart) and then into Metabase MBQL. It never
 * writes SQL — which is the rule spec 734 puts on the real model. In the build, spec 734's loop
 * fills the same `Plan` shape from the model's tool call; only the planner changes, not the rest.
 */

export type Plan = {
  table: 'till_sales' | 'orders' | 'deliveries'
  measure: { key: string; label: string }
  by: { col: string; label: string; unit?: 'day' | 'week' | 'month' }[]
  filters: { col: string; label: string; value: string | number; unit?: 'day' | 'week' | 'month' }[]
  period: { label: string; clause: (date: unknown) => unknown[] }
  display: 'line' | 'bar' | 'row' | 'table' | 'scalar' | 'pie'
  topN?: number
  title: string
}

type Fields = Record<string, Record<string, number>>

const CITIES = ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Abha', 'Tabuk', 'Buraidah', 'Manama']
const CHANNELS: [RegExp, string][] = [
  [/hunger\s*station|hs\b/i, 'HungerStation'],
  [/call\s*cent(re|er)/i, 'Call centre'],
  [/insurance platform/i, 'Insurance platform'],
  [/\bapp\b|web/i, 'Own app + web'],
]

const DATE_COL = { till_sales: 'trx_date', orders: 'entry_time', deliveries: 'created_at' } as const

export function plan(text: string): Plan {
  const s = text.toLowerCase()
  let table: Plan['table'] = 'till_sales'
  let measure = { key: 'net', label: 'Value through our tills (SAR)' }
  if (/deliver|speed|fast|slow|minute|same.day/.test(s)) {
    table = 'deliveries'
    measure = /same.day/.test(s)
      ? { key: 'sameDay', label: 'Delivered same day (share)' }
      : /ready/.test(s)
        ? { key: 'r2dMedian', label: 'Average ready → delivered (min)' }
        : { key: 'o2dMedian', label: 'Average order → delivered (min)' }
  } else if (/order/.test(s) && !/linked to an? (oms )?order/.test(s)) {
    table = 'orders'
    measure = { key: 'count', label: 'Orders' }
  } else if (/loyal/.test(s)) measure = { key: 'loyShare', label: 'Loyalty-identified share' }
  else if (/return rate|returns?/.test(s)) measure = { key: 'returnRate', label: 'Return rate' }
  else if (/insurance|nphies/.test(s)) measure = { key: 'nphies', label: 'Insurance (NPHIES) till sales' }
  else if (/how many|count|till sales|transactions|top \d+ stores by till sales/.test(s) && !/value/.test(s))
    measure = { key: 'tillCount', label: 'Till sales' }

  const by: Plan['by'] = []
  if (/by city|per city|each city|cities/.test(s)) by.push({ col: 'city', label: 'City' })
  if (/by region|per region|regions/.test(s)) by.push({ col: 'region', label: 'Region' })
  if (/by channel|per channel|channels/.test(s)) by.push({ col: 'channel', label: 'Channel' })
  if (/stores?\b/.test(s) && /by store|top|slowest|fastest|which stores|stores with/.test(s)) by.push({ col: 'store_name', label: 'Store' })
  const unit = /by month|monthly|per month|each month|trend/.test(s) ? 'month' : /by week|weekly|per week/.test(s) ? 'week' : /by day|daily|per day/.test(s) ? 'day' : undefined
  if (unit) by.unshift({ col: DATE_COL[table], label: unit[0].toUpperCase() + unit.slice(1), unit })

  const filters: Plan['filters'] = []
  for (const c of CITIES) if (s.includes(c.toLowerCase())) filters.push({ col: 'city', label: 'City', value: c })
  if (/bahrain/.test(s)) filters.push({ col: 'country', label: 'Country', value: 'Bahrain' })
  if (table !== 'till_sales') for (const [re, ch] of CHANNELS) if (re.test(s)) { filters.push({ col: 'channel', label: 'Channel', value: ch }); break }
  if (table === 'deliveries') filters.push({ col: 'delivered', label: 'Delivered', value: 1 })

  const period: Plan['period'] =
    /this week/.test(s) ? { label: 'This week', clause: (d) => ['time-interval', d, 'current', 'week'] }
    : /last 7 days|past week/.test(s) ? { label: 'Last 7 days', clause: (d) => ['time-interval', d, -7, 'day'] }
    : /last 4 weeks|28 days/.test(s) ? { label: 'Last 4 weeks', clause: (d) => ['time-interval', d, -4, 'week'] }
    : /last 30 days|past month/.test(s) ? { label: 'Last 30 days', clause: (d) => ['time-interval', d, -30, 'day'] }
    : /this month/.test(s) ? { label: 'This month', clause: (d) => ['time-interval', d, 'current', 'month'] }
    : /year to date|ytd|this year/.test(s) ? { label: 'Year to date', clause: (d) => ['time-interval', d, 'current', 'year'] }
    : /last 12 months|past year|trend/.test(s) || unit === 'month' ? { label: 'Last 12 months', clause: (d) => ['time-interval', d, -12, 'month'] }
    : { label: 'Last 30 days', clause: (d) => ['time-interval', d, -30, 'day'] }

  const top = s.match(/top (\d+)/)
  const topN = top ? Number(top[1]) : /slowest|fastest/.test(s) ? 10 : undefined
  const display: Plan['display'] = unit ? (by.length > 1 ? 'line' : unit === 'week' ? 'bar' : 'line') : by.length === 0 ? 'scalar' : by[0].col === 'store_name' ? 'table' : by[0].col === 'channel' && table === 'orders' ? 'pie' : 'row'

  const title = `${measure.label}${by.length ? ' by ' + by.map((b) => b.label.toLowerCase()).join(' and ') : ''}${filters.filter((f) => f.col !== 'delivered').map((f) => ` · ${f.value}`).join('')} · ${period.label.toLowerCase()}`
  return { table, measure, by, filters, period, display, topN, title }
}

export function toMbql(p: Plan, F: Fields, tables: Record<string, number>, database: number) {
  const f = (c: string, opts: unknown = null) => ['field', F[p.table][c], opts]
  const named = (agg: unknown[], name: string) => ['aggregation-options', agg, { name, 'display-name': name }]
  const sale = ['=', f('trx_kind'), 'sale']
  const aggs: Record<string, unknown[]> = {
    net: named(['sum', ['case', [[sale, f('value_sar')]], { default: ['*', -1, f('value_sar')] }]], p.measure.label),
    tillCount: named(['count-where', sale], p.measure.label),
    loyShare: named(['/', ['count-where', ['and', sale, ['=', f('loyalty_identified'), 1]]], ['count-where', sale]], p.measure.label),
    returnRate: named(['/', ['count-where', ['=', f('trx_kind'), 'return']], ['count-where', sale]], p.measure.label),
    nphies: named(['count-where', ['and', sale, ['=', f('nphies_linked'), 1]]], p.measure.label),
    count: named(['count'], p.measure.label),
    o2dMedian: named(['avg', f('order_to_delivered_min')], p.measure.label),
    r2dMedian: named(['avg', f('ready_to_delivered_min')], p.measure.label),
    sameDay: named(['avg', f('same_day')], p.measure.label),
  }
  const dateCol = DATE_COL[p.table]
  const clauses: unknown[] = [p.period.clause(f(dateCol)), ...p.filters.map((x) => ['=', f(x.col, x.unit ? { 'temporal-unit': x.unit } : null), x.value])]
  const query: Record<string, unknown> = {
    'source-table': tables[p.table],
    aggregation: [aggs[p.measure.key]],
    filter: clauses.length > 1 ? ['and', ...clauses] : clauses[0],
  }
  if (p.by.length) query.breakout = p.by.map((b) => f(b.col, b.unit ? { 'temporal-unit': b.unit } : null))
  if (p.topN || (p.by.length && !p.by.some((b) => b.unit))) query['order-by'] = [['desc', ['aggregation', 0]]]
  if (p.topN) query.limit = p.topN
  const pct = ['loyShare', 'returnRate', 'sameDay'].includes(p.measure.key)
  const viz = pct ? { column_settings: { [JSON.stringify(['name', p.measure.label])]: { number_style: 'percent', decimals: 1 } } } : {}
  return { dataset_query: { database, type: 'query', query }, visualization_settings: viz }
}

export const SEED_QUESTIONS = [
  'Value through our tills by city this month',
  'Top 20 stores by till sales this week',
  'Loyalty share by region, last 4 weeks',
  'Orders by channel per day, this week',
  'HungerStation orders in Riyadh by day, last 30 days',
  'Median order to delivered time by channel, last 7 days',
  'Same day delivery share by city',
  'Slowest stores by ready to delivered time this month',
  'Bahrain value through our tills, year to date',
  'Insurance till sales by city, last 30 days',
]
