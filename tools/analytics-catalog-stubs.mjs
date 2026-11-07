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
