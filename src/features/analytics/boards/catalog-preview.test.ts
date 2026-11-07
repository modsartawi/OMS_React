import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { AnalyticsCatalogArea } from '@/core/models/analytics'
import { readCatalogArea } from './catalog-wire'
import { analyticsPreviewKey, droppedNotes, previewChoice, previewRefusal, previewRequest, previewTable, readPreview, withPreviewPeriod } from './catalog-preview'

/** One area as `GET Analytics/Catalog` lists it (BackOffice spec3437). */
const AREA: AnalyticsCatalogArea = readCatalogArea({
  key: 'item_sales',
  label: { en: 'Item sales', ar: 'مبيعات الأصناف' },
  available: true,
  measures: [
    { key: 'net_sales', area: 'item_sales', shape: 'additive', unit: 'SAR', label: { en: 'Net sales', ar: 'صافي المبيعات' }, dimensions: ['date', 'store', 'item'] },
    { key: 'basket_rate', area: 'item_sales', shape: 'rate', unit: 'share', label: { en: 'Basket rate', ar: 'معدل السلة' }, dimensions: ['date', 'store'] },
  ],
  dimensions: [
    { key: 'date', kind: 'time', label: { en: 'Date', ar: 'التاريخ' }, values: [] },
    { key: 'store', kind: 'category', label: { en: 'Store', ar: 'الفرع' }, values: [] },
    { key: 'item', kind: 'category', label: { en: 'Item', ar: 'الصنف' }, values: [] },
  ],
})

describe('the catalog preview request (843, spec 3437 §D)', () => {
  it('preview request carries the defaults and re-runs on period change', () => {
    // An area node: the server's defaults — last 7 days, every dimension, every measure (absent = all).
    const first = previewRequest(AREA, previewChoice())
    expect(first).toEqual({ area: 'item_sales', period: 'last-7-days' })

    // A measure node previews that measure.
    expect(previewRequest(AREA, previewChoice('net_sales'))).toEqual({ area: 'item_sales', period: 'last-7-days', measures: ['net_sales'] })

    // A new period is a new request, under a new query key: the preview asks again.
    const next = previewRequest(AREA, withPreviewPeriod(previewChoice(), 'last-30-days'))
    expect(next).toEqual({ area: 'item_sales', period: 'last-30-days' })
    expect(analyticsPreviewKey(next)).not.toEqual(analyticsPreviewKey(first))
    expect(analyticsPreviewKey(first)).toEqual(['analytics', 'catalogPreview', { area: 'item_sales', period: 'last-7-days' }])

    // The column chooser sends category dimensions only — the server adds the date by day and strips it if sent.
    const chosen = previewRequest(AREA, { period: 'last-7-days', dimensions: ['date', 'store'], measures: ['net_sales'] })
    expect(chosen).toEqual({ area: 'item_sales', period: 'last-7-days', dimensions: ['store'], measures: ['net_sales'] })
  })
})

describe('the catalog preview answer (843)', () => {
  /** The answer as the built door gives it: the query door's result plus `dropped`. */
  const WIRE = {
    columns: [
      { key: 'date', role: 'dimension', shape: null, unit: null },
      { key: 'item', role: 'dimension', shape: null, unit: null },
      { key: 'net_sales', role: 'measure', shape: 'additive', unit: 'SAR' },
    ],
    rows: [{ date: '2026-11-06', item: '100234', net_sales: 1520.5 }],
    total: 1,
    truncated: false,
    period: { from: '2026-10-31', to: '2026-11-06' },
    previous: null,
    previousPeriod: null,
    fetchedAt: '2026-11-07T10:00:00Z',
    dataAsOf: '2026-11-07T09:45:12',
    notReached: null,
    fellBack: null,
    values: null,
    dropped: [{ measure: 'basket_rate', because: 'item' }, { because: 'store' }],
  }

  it('dropped measures show a note', () => {
    const preview = readPreview(WIRE)
    // The reader keeps `dropped` (an entry naming no measure is left out) and the rest of the answer.
    expect(preview.dropped).toEqual([{ measure: 'basket_rate', because: 'item' }])
    expect(preview.rows).toHaveLength(1)

    // Each note names the measure and the dimension that refused it, in the screen's language.
    expect(droppedNotes(preview, AREA, 'en')).toEqual([{ measure: 'basket_rate', label: 'Basket rate', because: 'Item' }])
    expect(droppedNotes(preview, AREA, 'ar')).toEqual([{ measure: 'basket_rate', label: 'معدل السلة', because: 'الصنف' }])
    // A key the area does not hold reads as the key itself.
    expect(droppedNotes(readPreview({ ...WIRE, dropped: [{ measure: 'gone', because: 'bin' }] }), AREA, 'en')).toEqual([
      { measure: 'gone', label: 'gone', because: 'bin' },
    ])
    // Nothing dropped, no note.
    expect(droppedNotes(readPreview({ ...WIRE, dropped: [] }), AREA, 'en')).toEqual([])
  })
})

const refused = (code: string, data?: unknown) =>
  new ApiError('business', `${code} words`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: `${code} words` }], data)

describe('the catalog preview grid and its refusals (843)', () => {
  it('names the columns like the charts and leaves values to the formatters', () => {
    const preview = readPreview({
      columns: [
        { key: 'date', role: 'dimension' },
        { key: 'store', role: 'dimension' },
        { key: 'net_sales', role: 'measure', shape: 'additive', unit: 'SAR' },
      ],
      rows: [
        { date: '2026-11-06', store: 'S001', net_sales: 300 },
        { date: '2026-11-05', store: 'S002', net_sales: -1200 },
      ],
      dropped: [],
    })
    const table = previewTable(preview, AREA, 'en')
    expect(table.columns).toEqual([
      { key: 'date', role: 'dimension', label: 'Date' },
      { key: 'store', role: 'dimension', label: 'Store' },
      { key: 'net_sales', role: 'measure', label: 'Net sales', unit: 'SAR', max: 1200 },
    ])
    // The day is written as the charts write it; the row order (newest first) is the server's.
    expect(table.rows[0]).toEqual({ date: 'Nov 6, 2026', store: 'S001', net_sales: 300 })
    expect(previewTable(preview, AREA, 'ar').columns[0].label).toBe('التاريخ')
  })

  it('words the preview refusals in its own terms', () => {
    // Unavailable area: the area's reason from the refusal's data first.
    expect(previewRefusal(refused('ANALYTICS-410', { area: 'item_sales', unavailableReason: { en: 'Not loaded yet.', ar: 'لم يحمّل بعد.' } }), AREA)).toEqual({
      kind: 'area',
      reason: { en: 'Not loaded yet.', ar: 'لم يحمّل بعد.' },
      message: 'ANALYTICS-410 words',
    })
    // Every chosen measure dropped: 406 on measures → choose fewer dimensions.
    expect(previewRefusal(refused('ANALYTICS-406', { field: 'measures' }), AREA)).toEqual({ kind: 'words', code: 'ANALYTICS-406', key: 'catalog.preview.refusal.allDropped' })
    expect(previewRefusal(refused('ANALYTICS-406', { field: 'dimensions[0]' }), AREA)).toEqual({ kind: 'words', code: 'ANALYTICS-406', key: 'catalog.preview.refusal.invalid' })
    expect(previewRefusal(refused('ANALYTICS-408'), AREA)).toEqual({ kind: 'words', code: 'ANALYTICS-408', key: 'catalog.preview.refusal.timedOut' })
    // Anything else falls back to the analytics words.
    expect(previewRefusal(refused('ANALYTICS-409'), AREA)).toEqual({ kind: 'words', code: 'ANALYTICS-409', key: 'refusal.engineDown' })
  })
})
