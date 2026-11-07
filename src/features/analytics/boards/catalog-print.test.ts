/**
 * Ticket 845 (BackOffice spec 3437 §G, story 52): the catalog prints as a PDF. The server's Chromium opens
 * `/analytics/print/catalog?lang=…&ticket=…`; the page reads `GET Analytics/Render/Catalog` under the ticket and lays
 * out every area (what it holds, its sources, freshness, boundary) and then the Planned and untapped section. The
 * network is stubbed at the `@/core/api` boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), postJsonBlob: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { catalogPrint, catalogPrintQueries, pdfRefusal, catalogPdfName } = await import('./catalog-print')
const { analyticsApi } = await import('./api')
const { readCatalog } = await import('./catalog-wire')
const { RENDER_TICKET_HEADER, setRenderTicket } = await import('./render-ticket')

const label = (en: string, ar: string) => ({ en, ar })
const measure = (key: string, area: string) => ({
  key,
  area,
  shape: 'additive',
  unit: 'SAR',
  maxWindowDays: null,
  label: label(`M ${key}`, `م ${key}`),
  description: label('', ''),
  dimensions: ['date'],
  caveat: null,
  mayStillRiseDays: null,
})
const dimension = (key: string) => ({ key, kind: key === 'date' ? 'time' : 'category', label: label(`D ${key}`, `ب ${key}`), description: label('', ''), values: [] })
const area = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  label: label(`Area ${key}`, `مجال ${key}`),
  description: label(`About ${key}.`, `عن ${key}.`),
  owner: 'Analytics team',
  available: true,
  unavailableReason: null,
  dataAsOf: '2026-11-05T09:45:12',
  historyStart: '400d',
  refresh: label('Every hour.', 'كل ساعة.'),
  boundary: [label('No personal data.', 'لا بيانات شخصية.')],
  readBy: ['copilot', 'designer'],
  usedBy: { views: 3, boards: 1, reports: 0 },
  access: { grant: 'AnalyticsView' },
  measures: [measure('net_sales', key)],
  dimensions: [dimension('date'), dimension('store')],
  marts: [],
  ...over,
})
const mart = (key: string, sources: string[], curator = false) => ({
  key,
  kind: 'mart',
  description: `The ${key}.`,
  grain: 'One row per store and day.',
  sources,
  columns: curator ? [{ name: 'store', previewable: true }, { name: 'salt', previewable: false }] : null,
  rows: curator ? 1200 : null,
  sizeMb: curator ? 4.5 : null,
})
const source = (key: string) => ({ key, server: 'POS-SQL01', database: 'POS', table: key.split('.')[1], description: `${key} rows.`, usedBy: [] })

/** BackOffice spec3437's catalog answer, two areas (one unavailable, no mart) and the roadmap. */
const WIRE = {
  imageVersion: '1.4.0',
  lineageAvailable: true,
  areas: [
    area('till_sales', { marts: ['mart_till_sales_daily', 'dim_date', 'mart_gone'] }),
    area('coupon_redemptions', {
      available: false,
      unavailableReason: label('Not loaded yet.', 'لم يحمل بعد.'),
      dataAsOf: '',
      readBy: [],
      usedBy: null,
      marts: [],
    }),
  ],
  marts: [mart('mart_till_sales_daily', ['pos.RetailTrx', 'pos.RetailTrxLine']), mart('dim_date', ['pos.RetailTrx', 'pos.Missing'])],
  sources: [source('pos.RetailTrx'), source('pos.RetailTrxLine')],
  planned: [
    { key: 'stock_cover', label: label('Stock cover', 'تغطية المخزون'), status: 'building', questions: [label('How many days?', 'كم يوما؟')], sources: ['pos.StockMove', 'pos.RetailTrx'], unknownSources: [] },
    { key: 'churn', label: label('Churn', 'التسرب'), status: 'idea', questions: [], sources: ['loy.Ghost'], unknownSources: ['loy.Ghost'] },
  ],
  untappedSources: [{ key: 'pos.StockMove', server: 'POS-SQL01', database: 'POS', table: 'StockMove', note: 'Stock movements.' }],
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})
afterEach(() => setRenderTicket(null))

describe('print route renders every area and the planned section from the wire', () => {
  const print = catalogPrint(readCatalog(WIRE))

  it('lays out every area in the wire order, with what it holds, its freshness and boundary', () => {
    expect(print.areas.map((a) => a.area.key)).toEqual(['till_sales', 'coupon_redemptions'])
    const [sales, coupons] = print.areas
    expect(sales.area.measures.map((m) => m.key)).toEqual(['net_sales'])
    expect(sales.area.dimensions.map((d) => d.key)).toEqual(['date', 'store'])
    expect(sales.facts.dataAsOf).toEqual({ day: '2026-11-05', at: '2026-11-05T09:45:12' })
    expect(sales.facts.history).toEqual({ kind: 'days', days: 400 })
    expect(sales.facts.boundary).toEqual([label('No personal data.', 'لا بيانات شخصية.')])
    expect(coupons.facts.dataAsOf).toBeNull()
    expect(coupons.facts.usedBy).toBeNull()
  })

  it('names each area’s source tables once, through its marts, keeping a key the lineage cannot resolve', () => {
    const [sales, coupons] = print.areas
    expect(sales.marts.map((m) => m.key)).toEqual(['mart_till_sales_daily', 'dim_date'])
    expect(sales.missingMarts).toEqual(['mart_gone'])
    expect(sales.sources.map((s) => [s.key, s.source?.table ?? null])).toEqual([
      ['pos.RetailTrx', 'RetailTrx'],
      ['pos.RetailTrxLine', 'RetailTrxLine'],
      ['pos.Missing', null],
    ])
    expect(coupons.marts).toEqual([])
    expect(coupons.sources).toEqual([])
  })

  it('draws curator facts (rows, size, hidden columns) only when the answer carries them', () => {
    expect(print.areas[0].marts.every((m) => m.columns === null)).toBe(true)
    expect(print.curator).toBe(false)
    const curated = catalogPrint(readCatalog({ ...WIRE, marts: [mart('mart_till_sales_daily', ['pos.RetailTrx'], true)] }))
    expect(curated.curator).toBe(true)
    expect(curated.areas[0].marts[0]).toMatchObject({ rows: 1200, sizeMb: 4.5, hidden: 1 })
  })

  it('ends with the Planned and untapped section: planned by status, sources resolved, untapped tables listed', () => {
    expect(print.planned.map((g) => [g.status, g.planned.map((p) => p.planned.key)])).toEqual([
      ['idea', ['churn']],
      ['building', ['stock_cover']],
    ])
    expect(print.planned[1].planned[0].sources.map((s) => [s.key, s.kind])).toEqual([
      ['pos.StockMove', 'untapped'],
      ['pos.RetailTrx', 'lineage'],
    ])
    expect(print.planned[0].planned[0].sources).toEqual([{ key: 'loy.Ghost', kind: 'unknown' }])
    expect(print.untapped.map((u) => u.key)).toEqual(['pos.StockMove'])
    expect(print).toMatchObject({ imageVersion: '1.4.0', lineageAvailable: true })
  })

  it('an image without lineage still prints its areas, with no marts and no roadmap', () => {
    const bare = catalogPrint(readCatalog({ ...WIRE, imageVersion: '', lineageAvailable: false, marts: [], sources: [], planned: [], untappedSources: [] }))
    expect(bare.lineageAvailable).toBe(false)
    expect(bare.areas).toHaveLength(2)
    expect(bare.planned).toEqual([])
    expect(bare.untapped).toEqual([])
  })
})

describe('print route never asks the access probe under a render ticket', () => {
  beforeEach(() => setRenderTicket({ ticket: 'T-catalog', lang: 'ar' }))

  it('its only read is GET Analytics/Render/Catalog with the ticket header — no Access, no Model, no Catalog', async () => {
    api.get.mockResolvedValue(WIRE)
    const queries = catalogPrintQueries()
    for (const q of queries) await q.queryFn()
    expect(api.get.mock.calls).toEqual([['Analytics/Render/Catalog', undefined, { [RENDER_TICKET_HEADER]: 'T-catalog' }]])
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('the Print button downloads the PDF in the chosen language', () => {
  it('POSTs Analytics/Catalog/Render with { lang } and names the file as the server does', async () => {
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    api.postJsonBlob.mockResolvedValue({ blob, filename: null })
    const file = await analyticsApi.catalogPdf('ar')
    expect(api.postJsonBlob).toHaveBeenCalledWith('Analytics/Catalog/Render', { lang: 'ar' })
    expect(file.blob).toBe(blob)
    expect(catalogPdfName('ar')).toBe('catalog-ar.pdf')
    expect(catalogPdfName('en')).toBe('catalog.pdf')
  })

  it('words the render’s timeout and failure as the PDF’s, every other refusal as every door', () => {
    const coded = (code: string) => new ApiError('business', `Server says ${code}.`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: '' }])
    expect(pdfRefusal(coded('ANALYTICS-408'), 'f')).toEqual({ code: 'ANALYTICS-408', key: 'catalog.print.timedOut' })
    expect(pdfRefusal(coded('ANALYTICS-409'), 'f')).toEqual({ code: 'ANALYTICS-409', key: 'catalog.print.failed' })
    expect(pdfRefusal(coded('ANALYTICS-401'), 'f')).toEqual({ code: 'ANALYTICS-401', key: 'refusal.noAccess' })
  })
})
