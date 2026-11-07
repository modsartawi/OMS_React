import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import type { AnalyticsAccess, AnalyticsCatalogMart } from '@/core/models/analytics'
import { rawOffer, rawRefusal, rawRequest, readRaw } from './catalog-raw'
import { refusalWords } from './wire'

const CURATOR: AnalyticsAccess = { canView: true, canAuthor: true, canCurate: true }
const VIEWER: AnalyticsAccess = { canView: true, canAuthor: false, canCurate: false }

/** `mart_item_sales_daily` as a curator reads it (BackOffice 3442: columns in table order, previewable flagged). */
const CURATED: AnalyticsCatalogMart = {
  key: 'mart_item_sales_daily',
  kind: 'mart',
  description: 'Item sales per store per day.',
  grain: 'One row per store, item and day.',
  sources: ['pos.RetailTrx'],
  columns: [
    { name: 'day', previewable: true },
    { name: 'store_code', previewable: true },
    { name: 'customer_id', previewable: false },
    { name: 'item_code', previewable: true },
    { name: 'mobile', previewable: false },
  ],
  rows: 1_284_311,
  sizeMb: 412.5,
}

/** The same mart as a viewer reads it: the server nulls every curator-only field. */
const AS_VIEWER: AnalyticsCatalogMart = { ...CURATED, columns: null, rows: null, sizeMb: null }

describe('raw preview', () => {
  it('raw preview is curator-only', () => {
    expect(rawOffer(CURATED, CURATOR)).toEqual({ rows: 1_284_311, sizeMb: 412.5, hiddenColumns: 2, orderBy: ['day', 'store_code', 'item_code'] })
    // A viewer gets nothing: no action, no hidden-column note, no row count or size (ruling 7).
    expect(rawOffer(AS_VIEWER, VIEWER)).toBeNull()
    // Even were the curator fields in the answer, the probe decides the action.
    expect(rawOffer(CURATED, VIEWER)).toBeNull()
    expect(rawOffer(CURATED, undefined)).toBeNull()
    // A curator on a mart the catalog does not describe, or whose columns the store could not read: no action.
    expect(rawOffer(null, CURATOR)).toBeNull()
    expect(rawOffer(AS_VIEWER, CURATOR)).toBeNull()
  })
})

describe('raw preview order', () => {
  const offer = rawOffer(CURATED, CURATOR)!

  it('order-by offers only previewable columns', () => {
    expect(offer.orderBy).toEqual(['day', 'store_code', 'item_code'])
    expect(offer.orderBy).not.toContain('customer_id')
    expect(offer.orderBy).not.toContain('mobile')
    // The first run asks the server's defaults: its first listed column, descending.
    expect(rawRequest('mart_item_sales_daily', offer, null)).toEqual({ mart: 'mart_item_sales_daily', orderBy: 'day', descending: true })
    expect(rawRequest('mart_item_sales_daily', offer, { orderBy: 'item_code', descending: false })).toEqual({
      mart: 'mart_item_sales_daily',
      orderBy: 'item_code',
      descending: false,
    })
    // A hidden column is never sent (it would be ANALYTICS-406 on orderBy): the first listed column instead.
    expect(rawRequest('mart_item_sales_daily', offer, { orderBy: 'customer_id', descending: true }).orderBy).toBe('day')
    // No listed column at all: no orderBy, so the server answers 417 (not previewable) rather than 406.
    expect(rawRequest('analytics_salt', { ...offer, orderBy: [] }, null)).toEqual({ mart: 'analytics_salt', descending: true })
  })
})

/** A refusal as `@/core/api` throws it: a business outcome carrying its `ANALYTICS-*` code. */
const coded = (code: string, message = 'server words') =>
  new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

/** The words at a dotted key of a bundle, as `t` would find them. */
const wordsIn = (bundle: unknown) => (key: string): string =>
  String(key.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), bundle) ?? key)

describe('raw preview refusals', () => {
  it('417 shows its sentence in both languages', () => {
    const r = rawRefusal(coded('ANALYTICS-417', 'Mart not previewable.'), 'fallback')
    expect(r).toEqual({ code: 'ANALYTICS-417', key: 'refusal.notPreviewable' })
    expect(refusalWords(r, wordsIn(en))).toBe('This table cannot be previewed raw: it is internal, a staging table, or has no allow-listed columns.')
    expect(refusalWords(r, wordsIn(ar))).toBe('لا يمكن معاينة هذا الجدول خامًا: فهو داخلي أو جدول تجهيز أو لا أعمدة مسموحًا بها فيه.')
  })

  it('402 asks for the curator grant, 408 names the raw preview its 10 seconds, the rest as every analytics door', () => {
    expect(rawRefusal(coded('ANALYTICS-402'), 'fallback')).toEqual({ code: 'ANALYTICS-402', key: 'refusal.needsCurator' })
    expect(rawRefusal(coded('ANALYTICS-408'), 'fallback')).toEqual({ code: 'ANALYTICS-408', key: 'catalog.raw.timedOut' })
    expect(rawRefusal(coded('ANALYTICS-409'), 'fallback')).toEqual({ code: 'ANALYTICS-409', key: 'refusal.engineDown' })
    expect(rawRefusal(coded('ANALYTICS-499', 'Something new.'), 'fallback')).toEqual({ code: 'ANALYTICS-499', message: 'Something new.' })
    for (const key of ['refusal.needsCurator', 'catalog.raw.timedOut']) {
      expect(wordsIn(en)(key), key).not.toBe(key)
      expect(wordsIn(ar)(key), key).not.toBe(key)
      expect(wordsIn(ar)(key)).not.toBe(wordsIn(en)(key))
    }
  })
})

describe('raw preview answer', () => {
  it('keeps only the listed columns, reads nulls as null and counts the hidden ones', () => {
    expect(
      readRaw({
        columns: ['day', 'store_code', ''],
        rows: [{ day: '2026-11-06T00:00:00', store_code: 'S101', customer_id: 'leak' }, { day: '2026-11-05T00:00:00', store_code: null }],
        hiddenColumnCount: 2,
      }),
    ).toEqual({
      columns: ['day', 'store_code'],
      rows: [
        { day: '2026-11-06T00:00:00', store_code: 'S101' },
        { day: '2026-11-05T00:00:00', store_code: null },
      ],
      hiddenColumnCount: 2,
    })
    expect(readRaw(null)).toEqual({ columns: [], rows: [], hiddenColumnCount: 0 })
  })
})
