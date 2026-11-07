// Catalog fixtures for the analytics drive (ticket 841 — BackOffice spec 3437 §C, as built on BO branch spec3437:
// `Sartawi.Retail.Data/Modules/Analytics/AnalyticsCatalog.cs`). camelCase, nulls written; a non-curator's view
// (mart `columns`/`rows`/`sizeMb` null). 842–845 extend these (planned, untapped, curator fields, preview answers).

const label = (en, ar) => ({ en, ar })
const measure = (key, area, shape, unit, en, ar, dimensions, extra = {}) => ({
  key, area, shape, unit, maxWindowDays: null,
  label: label(en, ar), description: label(`${en}, as the model defines it.`, `${ar} كما يعرّفه النموذج.`),
  dimensions, caveat: null, mayStillRiseDays: null, ...extra,
})
const dimension = (key, kind, en, ar) => ({ key, kind, label: label(en, ar), description: label(`The ${en.toLowerCase()}.`, ar), values: [] })
const mart = (key, kind, description, grain, sources) => ({ key, kind, description, grain, sources, columns: null, rows: null, sizeMb: null })
const source = (key, server, database, table, description, usedBy) => ({ key, server, database, table, description, usedBy })
const area = (key, en, ar, measures, dimensions, marts, extra = {}) => ({
  key, label: label(en, ar), description: label(`What ${en.toLowerCase()} covers.`, `ما يغطيه مجال ${ar}.`),
  owner: 'Analytics team', available: true, unavailableReason: null,
  dataAsOf: '2026-11-05T09:45:12', historyStart: '2026-01-01', refresh: label('Every hour.', 'كل ساعة.'),
  boundary: [label('Values include VAT.', 'القيم تشمل ضريبة القيمة المضافة.')], readBy: ['copilot', 'designer'],
  usedBy: { views: 3, boards: 1, reports: 0 }, access: { grant: 'AnalyticsView' },
  measures, dimensions, marts, ...extra,
})

const DATE = dimension('date', 'time', 'Date', 'التاريخ')
const STORE = dimension('store', 'category', 'Store', 'الفرع')
const ITEM = dimension('item', 'category', 'Item', 'الصنف')
const CHANNEL = dimension('channel', 'category', 'Channel', 'القناة')

export const CATALOG_841 = {
  imageVersion: '1.4.0',
  lineageAvailable: true,
  areas: [
    area('till_sales', 'Till sales', 'مبيعات الصندوق',
      [
        measure('net_sales', 'till_sales', 'additive', 'SAR', 'Net sales', 'صافي المبيعات', ['date', 'store', 'item']),
        measure('return_rate', 'till_sales', 'rate', 'share', 'Return rate', 'مُعَدَّل الإرجاع', ['date', 'store']),
      ],
      [DATE, STORE, ITEM],
      ['mart_till_sales_daily', 'dim_date']),
    area('delivery_speed', 'Delivery speed', 'سرعة التوصيل',
      [measure('delivery_minutes_p50', 'delivery_speed', 'percentile', 'minutes', 'Median delivery time', 'وسيط زمن التوصيل', ['date', 'channel'], { maxWindowDays: 92 })],
      [DATE, CHANNEL, STORE],
      ['fct_delivery']),
    area('coupon_redemptions', 'Coupon redemptions', 'استبدال القسائم', [], [], [], {
      available: false,
      unavailableReason: label('Waiting on the coupon feed.', 'بانتظار تغذية القسائم.'),
      dataAsOf: '', historyStart: '400d', readBy: [], usedBy: null,
    }),
  ],
  marts: [
    mart('mart_till_sales_daily', 'mart', 'Till sales summed by day.', 'One row per day × store × item × channel', ['pos.RetailTrx', 'pos.RetailTrxDetail']),
    mart('dim_date', 'dim', 'The calendar.', '', []),
    mart('fct_delivery', 'fact', 'One delivery each.', 'One row per delivery', ['oms.SdDocument']),
  ],
  sources: [
    source('pos.RetailTrx', 'POS-SQL01', 'POS', 'RetailTrx', 'Till transaction headers.', ['mart_till_sales_daily']),
    source('pos.RetailTrxDetail', 'POS-SQL01', 'POS', 'RetailTrxDetail', 'Till transaction lines.', ['mart_till_sales_daily']),
    source('oms.SdDocument', 'OMS-SQL01', 'OMS', 'SdDocument', 'Delivery documents.', ['fct_delivery']),
  ],
  planned: [],
  untappedSources: [],
}

/** An image before 1.4.0 (no `/catalog`): areas still served, no lineage. */
export const CATALOG_NO_LINEAGE_841 = {
  ...CATALOG_841,
  imageVersion: '',
  lineageAvailable: false,
  marts: [],
  sources: [],
}

/**
 * 842: the catalog with BackOffice 3440's roadmap and untapped list (the till area also names two boundary entries),
 * as `GET Analytics/Catalog` answers on spec3437. `loy.Ghost` names neither a lineage nor an untapped source.
 */
export const CATALOG_842 = {
  ...CATALOG_841,
  areas: CATALOG_841.areas.map((a) =>
    a.key === 'till_sales' ? { ...a, boundary: [label('No personal data.', 'لا بيانات شخصية.'), ...a.boundary] } : a),
  planned: [
    { key: 'stock_cover', label: label('Stock cover', 'تغطية المخزون'), status: 'building',
      questions: [label('How many days of stock does each store hold?', 'كم يومًا من المخزون لدى كل فرع؟')],
      sources: ['pos.StockMove', 'pos.RetailTrx'], unknownSources: [] },
    { key: 'loyalty_churn', label: label('Loyalty churn', 'تسرب أعضاء الولاء'), status: 'idea',
      questions: [label('Which members stopped buying?', 'أي الأعضاء توقفوا عن الشراء؟')],
      sources: ['loy.LoyMember', 'loy.Ghost'], unknownSources: ['loy.Ghost'] },
    { key: 'supplier_fill', label: label('Supplier fill rate', 'نسبة توريد الموردين'), status: 'approved', questions: [], sources: [], unknownSources: [] },
  ],
  untappedSources: [
    { key: 'pos.StockMove', server: 'POS-SQL01', database: 'POS', table: 'StockMove', note: 'Stock movements; nothing reads them yet.' },
    { key: 'loy.LoyMember', server: 'LOY-SQL01', database: 'Loyalty', table: 'LoyMember', note: 'Loyalty members.' },
  ],
}

// ── 844 (BackOffice 3442): a curator's catalog and the Raw door ──────────────────────────────────────────────────
// A curator reads every mart's `columns` (table order, previewable flagged), `rows` and `sizeMb`; a view (dim_date
// here) stores neither. `customer_id` and `mobile` are off the allow-list.
const TILL_COLUMNS = [
  { name: 'day', previewable: true },
  { name: 'store_code', previewable: true },
  { name: 'customer_id', previewable: false },
  { name: 'item_code', previewable: true },
  { name: 'net_sales', previewable: true },
  { name: 'mobile', previewable: false },
]
export const CATALOG_CURATED_844 = {
  ...CATALOG_841,
  marts: CATALOG_841.marts.map((m) =>
    m.key === 'mart_till_sales_daily' ? { ...m, columns: TILL_COLUMNS, rows: 1284311, sizeMb: 412.5 }
      : m.key === 'dim_date' ? { ...m, columns: [{ name: 'date_key', previewable: true }], rows: null, sizeMb: null }
        : { ...m, columns: [{ name: 'delivery_id', previewable: true }], rows: 52000, sizeMb: 18 }),
}

/** The Raw door's answer for a body: 30 rows of the mart's listed columns, ordered as asked (default first, desc). */
export function rawAnswer844(body) {
  const mart = CATALOG_CURATED_844.marts.find((m) => m.key === body.mart)
  const listed = (mart?.columns ?? []).filter((c) => c.previewable).map((c) => c.name)
  const rows = Array.from({ length: 30 }, (_, i) => ({
    day: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T00:00:00`,
    store_code: `S${100 + (i % 7)}`,
    item_code: `I${2000 + i}`,
    net_sales: Math.round((i * 37.5 + 12) * 100) / 100,
    customer_id: 'never-sent',
  })).map((r) => Object.fromEntries(listed.map((c) => [c, r[c] ?? null])))
  const by = body.orderBy ?? listed[0]
  const desc = body.descending !== false
  rows.sort((a, b) => (a[by] < b[by] ? -1 : a[by] > b[by] ? 1 : 0) * (desc ? -1 : 1))
  return { columns: listed, rows, hiddenColumnCount: (mart?.columns ?? []).length - listed.length }
}
