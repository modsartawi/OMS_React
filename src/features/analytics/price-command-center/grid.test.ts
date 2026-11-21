/**
 * oms 935 (BackOffice spec 4127, decisions 6 and 8) — the product grid: one row per watched material, one column per
 * competitor. Each cell state is drawn its own way; the cheapest mark follows the endpoint's flag, ours included; the
 * filters and the sort are sent to the endpoint; a marketplace cell names its seller.
 *
 * ⚠ The endpoint is GUESSED (BO 4129 not built) — see the Grid section of `@/core/models/price-watch`.
 * Pure rules are tested directly; the cells are rendered as static markup through a real i18next instance (en and ar);
 * the network is stubbed at the `@/core/api` boundary.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRICE_GRID_CELL_STATES, PRICE_GRID_SORTS, type PriceGridCell, type PriceGridCompetitor, type PriceGridPage, type PriceGridRow } from '@/core/models/price-watch'
import { hasLocaleKey } from '@/core/test/locale'
import en from '@/locales/en/price-command-center.json'
import ar from '@/locales/ar/price-command-center.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { priceGridApi } = await import('./api')
const g = await import('./grid')
const { CompetitorCell, OursCell } = await import('./GridCells')

const NS = 'price-command-center'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ')

const NAHDI: PriceGridCompetitor = { competitorCode: 'NAHDI', name: 'Nahdi', kind: 'pharmacy', authoritativeSource: 'SCRAPER' }
const AMAZON: PriceGridCompetitor = { competitorCode: 'AMAZON_SA', name: 'Amazon SA', kind: 'marketplace', authoritativeSource: 'MINDSITE' }

const cell = (over: Partial<PriceGridCell> = {}): PriceGridCell => ({
  competitorCode: 'NAHDI',
  state: 'PRICED',
  paidPrice: 18,
  regularPrice: 20,
  offerPrice: 18,
  offerPercent: 10,
  sellerName: '',
  isPlatformSeller: true,
  inStock: true,
  observedAt: '2026-11-21T08:15:00',
  isStale: false,
  isCheapest: false,
  gapPercent: -20,
  source: 'SCRAPER',
  ...over,
})
const row = (over: Partial<PriceGridRow> = {}): PriceGridRow => ({
  materialNumber: '100012345',
  title: 'Panadol Extra 24 tablets',
  brand: 'Panadol',
  aLevel: 'A004',
  bLevel: 'B0041',
  currency: 'SAR',
  basicPrice: 25,
  effectivePrice: 22.5,
  isPriced: true,
  dealText: 'Buy 2 get 10% off',
  appliedDealText: '10% off',
  thirtyDayUnits: 400,
  isCheapest: false,
  widestGapPercent: -20,
  cells: [cell()],
  ...over,
})
const drawCell = (c: PriceGridCell, competitor = NAHDI, lng: 'en' | 'ar' = 'en') =>
  draw(createElement(CompetitorCell, { cell: c, competitor, currency: 'SAR' }), lng)

beforeEach(() => {
  api.get.mockReset()
})

describe('each cell state renders its own way', () => {
  it('PRICED with an offer: the paid price, the regular price struck through, the offer % and the observed time', () => {
    const html = drawCell(cell())
    expect(html).toContain('data-grid-cell="PRICED"')
    expect(text(html)).toContain('18.00')
    expect(html).toMatch(/line-through[^>]*>.*20\.00/)
    expect(text(html)).toContain('-10%')
    expect(text(html)).toContain('2026-11-21 08:15')
  })

  it('PRICED with no offer: the regular price alone, nothing struck', () => {
    const html = drawCell(cell({ paidPrice: 20, offerPrice: null, offerPercent: null }))
    expect(text(html)).toContain('20.00')
    expect(html).not.toContain('line-through')
    expect(html).not.toContain('data-grid-offer')
  })

  it('OOS: out of stock, with its last price', () => {
    const html = drawCell(cell({ state: 'OOS', inStock: false, paidPrice: 19, offerPrice: null, offerPercent: null, regularPrice: 19 }))
    expect(html).toContain('data-grid-cell="OOS"')
    expect(text(html)).toContain('Out of stock')
    expect(text(html)).toContain('Last price 19.00')
  })

  it.each([
    ['NOT_CARRIED', 'Not carried'],
    ['NO_MATCH', 'No product match'],
    ['COMPARABLE_ONLY', 'Comparable only'],
  ] as const)('%s: its own words and no price', (state, words) => {
    const html = drawCell(cell({ state, paidPrice: null, regularPrice: null, offerPrice: null, offerPercent: null, observedAt: null }))
    expect(html).toContain(`data-grid-cell="${state}"`)
    expect(text(html)).toContain(words)
    expect(text(html)).not.toMatch(/\d+\.\d\d/)
  })

  it('stale: the price shows, marked stale', () => {
    const html = drawCell(cell({ isStale: true }))
    expect(html).toContain('data-grid-stale=""')
    expect(text(html)).toContain('Stale')
    expect(drawCell(cell())).not.toContain('data-grid-stale')
  })

  it('draws every state in Arabic too, with no raw key', () => {
    for (const state of ['PRICED', 'OOS', 'NOT_CARRIED', 'NO_MATCH', 'COMPARABLE_ONLY'] as const) {
      const html = drawCell(cell({ state, isStale: true }), NAHDI, 'ar')
      expect(text(html)).not.toMatch(/grid\.[a-zA-Z]/)
    }
  })

  it('an unknown state from a newer server is drawn as unknown, not as a price', () => {
    expect(g.cellView(cell({ state: 'SOMETHING_NEW' as never }), NAHDI, 'SAR').kind).toBe('unknown')
  })
})

describe('the cheapest mark follows the endpoint’s flag, ours included', () => {
  it('marks a competitor cell the endpoint flags as cheapest', () => {
    expect(drawCell(cell({ isCheapest: true }))).toContain('data-grid-cheapest=""')
    expect(text(drawCell(cell({ isCheapest: true })))).toContain('Cheapest')
  })

  it('does not mark a cell the endpoint does not flag — even one that looks cheaper (the server decides ties and sources)', () => {
    expect(drawCell(cell({ isCheapest: false, paidPrice: 0.5 }))).not.toContain('data-grid-cheapest')
  })

  it('marks an OOS cell flagged cheapest too — the flag, not a client rule, decides', () => {
    expect(drawCell(cell({ state: 'OOS', isCheapest: true }))).toContain('data-grid-cheapest=""')
  })

  it('our column: the effective price, the basic price beneath it, the deal text — and the mark when we lead', () => {
    const ours = draw(createElement(OursCell, { row: row({ isCheapest: true }) }))
    expect(ours).toContain('data-grid-ours=""')
    expect(text(ours)).toMatch(/22\.50.*Basic 25\.00/)
    expect(text(ours)).toContain('10% off')
    expect(ours).toContain('data-grid-cheapest=""')
    expect(draw(createElement(OursCell, { row: row({ isCheapest: false }) }))).not.toContain('data-grid-cheapest')
  })

  it('our column says "not priced" when the engine could not price us', () => {
    const ours = draw(createElement(OursCell, { row: row({ isPriced: false, basicPrice: null, effectivePrice: null }) }))
    expect(text(ours)).toContain('Not priced')
    expect(text(ours)).not.toMatch(/\d+\.\d\d/)
  })
})

describe('a marketplace cell shows its seller', () => {
  it('names the seller on a marketplace column', () => {
    const html = drawCell(cell({ competitorCode: 'AMAZON_SA', sellerName: 'Pharma Hub KSA', isPlatformSeller: false }), AMAZON)
    expect(html).toContain('data-grid-seller=""')
    expect(text(html)).toContain('Seller Pharma Hub KSA')
    expect(html).toMatch(/<bdi>Pharma Hub KSA<\/bdi>/)
  })

  it('keeps the seller on an out-of-stock marketplace cell', () => {
    expect(text(drawCell(cell({ state: 'OOS', sellerName: 'Pharma Hub KSA' }), AMAZON))).toContain('Pharma Hub KSA')
  })

  it('names no seller on a pharmacy column, nor on a marketplace cell with none', () => {
    expect(drawCell(cell({ sellerName: 'Nahdi Online' }), NAHDI)).not.toContain('data-grid-seller')
    expect(drawCell(cell({ sellerName: '' }), AMAZON)).not.toContain('data-grid-seller')
  })
})

describe('the grid’s locale keys', () => {
  it.each([en, ar])('hold every key the grid builds from data', (locale) => {
    const keys = [
      ...PRICE_GRID_CELL_STATES.filter((s) => s !== 'PRICED').map((s) => `grid.state.${s}`),
      'grid.state.unknown',
      ...PRICE_GRID_SORTS.map((s) => `grid.sort.${s}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

describe('filter and sort are sent to the endpoint', () => {
  const page: PriceGridPage = { total: 0, page: 1, pageSize: 50, competitors: [], rows: [] }
  beforeEach(() => api.get.mockResolvedValue(page))

  it('the default reads page 1 sorted by our units, with no filter', async () => {
    await priceGridApi.page(g.gridRequest(g.DEFAULT_GRID_FILTER, 1))
    expect(api.get).toHaveBeenCalledWith('PriceWatch/Grid', { sort: 'units', page: 1, pageSize: 50 })
  })

  it('sends A-level, B-level, brand, competitor, "a competitor is cheaper" and the widest-gap sort — trimmed', async () => {
    const filter = { aLevel: ' A004 ', bLevel: 'B0041', brand: ' Panadol ', competitor: 'NAHDI', competitorCheaper: true, sort: 'gap' as const }
    await priceGridApi.page(g.gridRequest(filter, 3))
    expect(api.get).toHaveBeenCalledWith('PriceWatch/Grid', {
      aLevel: 'A004',
      bLevel: 'B0041',
      brand: 'Panadol',
      competitor: 'NAHDI',
      competitorCheaper: true,
      sort: 'gap',
      page: 3,
      pageSize: 50,
    })
  })

  it('leaves "a competitor is cheaper" off the query when it is not asked for', () => {
    expect(g.gridRequest({ ...g.DEFAULT_GRID_FILTER, competitorCheaper: false }, 1)).not.toHaveProperty('competitorCheaper')
  })
})
