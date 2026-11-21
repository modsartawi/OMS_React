/**
 * oms 936 (BackOffice spec 4127, decision 8) — a material's drill-down: our price and every matched competitor's price
 * history on one chart, each observation's source labelled, the authoritative source solid and the other faint; the
 * product matches with Break (Manage only); a comparable match compared per unit.
 *
 * ⚠ The history, match id and who/when ride the GUESSED BO 4128 extension of `Materials/{material}/Comparison`.
 * Components are rendered as static markup through a real i18next instance; the network is stubbed at `@/core/api`.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PriceWatchComparison, PriceWatchCompetitorSide } from '@/core/models/price-watch'
import en from '@/locales/en/price-command-center.json'
import ar from '@/locales/ar/price-command-center.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const dd = await import('./drilldown')
const { HistoryKey, MatchesTable, breakAndRefresh } = await import('./MaterialDrillDown')

const NS = 'price-command-center'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}
const strip = (s: string) => s.replace(/[⁦-⁩]/g, '')

const side = (over: Partial<PriceWatchCompetitorSide> = {}): PriceWatchCompetitorSide => ({
  competitorCode: 'NAHDI',
  competitorName: 'Nahdi',
  matchKind: 'Exact',
  madeBy: 'Barcode',
  listingUrl: 'https://nahdi.example/p/1',
  listingTitle: 'Panadol Extra 24 tablets',
  hasPrice: true,
  regularPrice: 21,
  offerPrice: 19.95,
  observedAt: '2026-11-21T08:15:00',
  sellerName: 'Nahdi Online',
  isPlatformSeller: true,
  inStock: true,
  isStale: false,
  isGone: false,
  gapPercent: -11.3,
  mayAlert: true,
  perUnitBasis: '',
  ourPricePerUnit: null,
  theirPricePerUnit: null,
  matchId: 'M-1',
  matchedByUser: 'jdoe',
  matchedAt: '2026-10-01T09:00:00',
  authoritativeSource: 'MINDSITE',
  source: 'MINDSITE',
  history: [
    { priceId: 'p1', observedAt: '2026-11-20T08:00:00', source: 'MINDSITE', isAuthoritative: true, regularPrice: 21, offerPrice: null, sellerName: 'Nahdi Online', inStock: true },
    { priceId: 'p2', observedAt: '2026-11-20T09:00:00', source: 'SCRAPER', isAuthoritative: false, regularPrice: 21.5, offerPrice: 20, sellerName: 'Nahdi Online', inStock: true },
    { priceId: 'p3', observedAt: '2026-11-21T08:15:00', source: 'MINDSITE', isAuthoritative: true, regularPrice: 21, offerPrice: 19.95, sellerName: 'Nahdi Online', inStock: true },
  ],
  ...over,
})

const comparison = (over: Partial<PriceWatchComparison> = {}): PriceWatchComparison => ({
  material: '100012345',
  referenceStore: '1001',
  pricedAt: '2026-11-21T06:00:00',
  isPriced: true,
  unpricedReason: '',
  currency: 'SAR',
  basicPrice: 25,
  effectivePrice: 22.5,
  competitors: [side()],
  ourHistory: [
    { priceDay: '2026-11-20', isPriced: true, basicPrice: 25, effectivePrice: 25 },
    { priceDay: '2026-11-21', isPriced: true, basicPrice: 25, effectivePrice: 22.5 },
  ],
  ...over,
})

const label = (s: { owner: string; price: string; source: string }) => `${s.owner}|${s.price}|${s.source}`

beforeEach(() => {
  api.get.mockReset()
  api.post.mockReset()
})

describe('a comparable match shows the per-unit price', () => {
  const comparable = side({ matchKind: 'Comparable', madeBy: 'Person', perUnitBasis: 'g', ourPricePerUnit: 0.09375, theirPricePerUnit: 0.0831, gapPercent: -11.4 })

  it('a comparable match compares per unit, at four decimals, naming the cheaper side', () => {
    expect(dd.perUnitView(comparable)).toEqual({ basis: 'g', ours: '0.0938', theirs: '0.0831', cheaper: 'competitor' })
    expect(dd.perUnitView(side({ matchKind: 'Comparable', perUnitBasis: 'ml', ourPricePerUnit: 0.5, theirPricePerUnit: 0.62 }))).toEqual({
      basis: 'ml',
      ours: '0.5000',
      theirs: '0.6200',
      cheaper: 'us',
    })
  })

  it('an exact match, or a comparable one with no per-unit price yet, has none', () => {
    expect(dd.perUnitView(side())).toBeNull()
    expect(dd.perUnitView(side({ matchKind: 'Comparable', perUnitBasis: 'piece', ourPricePerUnit: 1.2, theirPricePerUnit: null }))).toBeNull()
  })

  it('the row draws the per-unit price as one isolated rate in its basis', () => {
    const html = strip(draw(createElement(MatchesTable, { comparison: comparison({ competitors: [comparable] }), canManage: false, breaking: null, onBreak: () => {} })))
    expect(html).toContain('0.0938 / g')
    expect(html).toContain('0.0831 / g')
    expect(html).toMatch(/data-match-per-unit="g"/)
    const ar = strip(draw(createElement(MatchesTable, { comparison: comparison({ competitors: [comparable] }), canManage: false, breaking: null, onBreak: () => {} }), 'ar'))
    expect(ar).toContain('0.0831 / غ')
  })

  it('reads the comparison gap in its own sense: negative = the competitor is cheaper', () => {
    expect(dd.comparisonGap(-11.4)).toEqual({ kind: 'competitorCheaper', percent: '11.4%' })
    expect(dd.comparisonGap(4.2)).toEqual({ kind: 'weCheaper', percent: '4.2%' })
    expect(dd.comparisonGap(0)).toEqual({ kind: 'level', percent: '0.0%' })
    expect(dd.comparisonGap(null)).toEqual({ kind: 'none', percent: '' })
  })
})

describe('break sends and refreshes, and is hidden without Manage', () => {
  const drawTable = (canManage: boolean, c = comparison()) =>
    draw(createElement(MatchesTable, { comparison: c, canManage, breaking: null, onBreak: () => {} }))

  it('sends Break for the product match, then reads every PriceWatch answer again', async () => {
    const broken = { matchId: 'M-1', isBroken: true }
    api.post.mockResolvedValue(broken)
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await expect(breakAndRefresh(client, 'M-1')).resolves.toBe(broken)
    expect(api.post).toHaveBeenCalledWith('PriceWatch/Matches/M-1/Break', {})
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['price-watch'] })
  })

  it('a refused Break refreshes nothing and reaches the caller with its code', async () => {
    const { ApiError } = await import('@/core/api')
    api.post.mockRejectedValue(new ApiError('business', 'already broken', 400, [{ errorMessage: 'already broken', errorCode: 'PWT-00026', internalErrorCode: '' }]))
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await expect(breakAndRefresh(client, 'M-1')).rejects.toMatchObject({ kind: 'business' })
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('hides Break without the Manage grant — the product matches, who and when, still show', () => {
    const html = strip(drawTable(false))
    expect(html).not.toContain('data-match-break')
    expect(html).toContain('data-match-row="NAHDI"')
    expect(html).toContain('jdoe')
    expect(html).toContain('By barcode')
  })

  it('offers Break with the Manage grant, on the side’s product match id', () => {
    expect(drawTable(true)).toContain('data-match-break="M-1"')
  })

  it('a side with no match id (pre-4128) cannot be broken, and says why', () => {
    const html = drawTable(true, comparison({ competitors: [side({ matchId: undefined, matchedByUser: undefined, matchedAt: undefined })] }))
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('Break needs the product match id')
    expect(html).toContain('Who and when not recorded')
  })

  it('says the gap in the comparison’s own sense: a negative gap reads "competitor cheaper"', () => {
    const html = strip(drawTable(false))
    expect(html).toContain('Competitor cheaper by 11.3%')
    expect(strip(drawTable(false, comparison({ competitors: [side({ gapPercent: 3 })] })))).toContain('We are cheaper by 3.0%')
  })
})

describe('the drill-down opens by URL, from any tab', () => {
  it('sets ?material= and keeps the open tab; null closes it', () => {
    expect(dd.drillDownSearch('?tab=alerts', '100012345')).toBe('?tab=alerts&material=100012345')
    expect(dd.drillDownSearch('?tab=grid&material=1', ' 2 ')).toBe('?tab=grid&material=2')
    expect(dd.drillDownSearch('?tab=alerts&material=100012345', null)).toBe('?tab=alerts')
    expect(dd.drillDownSearch('', null)).toBe('')
  })

  it('reads the material the URL names, or null', () => {
    expect(dd.drillDownMaterial('?tab=alerts&material=100012345')).toBe('100012345')
    expect(dd.drillDownMaterial('?tab=alerts&material=%20')).toBeNull()
    expect(dd.drillDownMaterial('')).toBeNull()
  })
})

describe('the authoritative series is solid and the other source faint, both labelled', () => {
  it('splits each competitor by source: the authoritative source solid, the cross-check source faint', () => {
    const { series } = dd.historyChart(comparison(), { locale: 'en', label })
    const by = Object.fromEntries(series.map((s) => [s.key, s]))
    expect(by['NAHDI.MINDSITE.regular'].faint).toBe(false)
    expect(by['NAHDI.MINDSITE.offer'].faint).toBe(false)
    expect(by['NAHDI.SCRAPER.regular'].faint).toBe(true)
    expect(by['NAHDI.SCRAPER.offer'].faint).toBe(true)
    // our price is never faint; the shelf price (basic / regular) is dashed beside the price paid
    expect(by['ours.effective']).toMatchObject({ faint: false, dashed: false })
    expect(by['ours.basic']).toMatchObject({ faint: false, dashed: true })
    expect(by['NAHDI.MINDSITE.regular'].dashed).toBe(true)
    expect(by['NAHDI.SCRAPER.regular'].label).toBe('NAHDI|regular|SCRAPER')
  })

  it('lines each day up: our price per day, and each source’s latest observation that day', () => {
    const { rows } = dd.historyChart(comparison(), { locale: 'en', label })
    expect(rows.map((r) => r.x)).toEqual(['2026-11-20', '2026-11-21'])
    expect(rows[0].values).toMatchObject({ 'ours.effective': 25, 'NAHDI.MINDSITE.regular': 21, 'NAHDI.MINDSITE.offer': null, 'NAHDI.SCRAPER.offer': 20 })
    expect(rows[1].values).toMatchObject({ 'ours.effective': 22.5, 'NAHDI.MINDSITE.offer': 19.95, 'NAHDI.SCRAPER.offer': null })
  })

  it('reads a pre-4128 answer (no history) as no series for that competitor, not a crash', () => {
    const { series, rows } = dd.historyChart(comparison({ competitors: [side({ history: undefined })], ourHistory: undefined }), { locale: 'en', label })
    expect(series).toEqual([])
    expect(rows).toEqual([])
  })

  it('the key names each series’ source, the faint one marked faint', () => {
    const i18n = i18next.createInstance()
    i18n.init({ lng: 'en', resources: { en: { [NS]: en } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
    const { series } = dd.historyChart(comparison(), { locale: 'en', label: dd.seriesLabelWith(i18n.t) })
    const html = strip(draw(createElement(HistoryKey, { series })))
    expect(html).toMatch(/data-series-key="NAHDI\.SCRAPER\.offer"[^>]*data-series-faint="true"/)
    expect(html).toMatch(/data-series-key="NAHDI\.MINDSITE\.offer"[^>]*data-series-faint="false"/)
    expect(html).toContain('Nahdi: offer price from Mindsite (authoritative)')
    expect(html).toContain('Nahdi: offer price from Scraper')
    expect(html).toContain('Our effective price')
  })
})
