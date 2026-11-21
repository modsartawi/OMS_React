/**
 * oms 938 (BackOffice spec 4127, decision 5) — the Index tab's shelf/paid switch is which Cube measure it asks
 * `Analytics/Query` for; the network is stubbed at `@/core/api`.
 *
 * ⚠ The member names are GUESSED from BO 4132 (not built) — see `index-tab.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { priceIndexApi } = await import('./api')
const { indexByCompetitorQuery, indexByCategoryQuery, indexTrendQuery, scoreQuery } = await import('./index-tab')

const sent = () => {
  const [path, body] = api.post.mock.calls.at(-1) ?? []
  return { path, query: (body as { definition: { query: { measures: string[]; dimensions: string[]; period: string; grain?: string } } }).definition.query }
}

describe('the shelf/paid switch', () => {
  beforeEach(() => {
    api.post.mockReset()
    api.post.mockResolvedValue({ columns: [], rows: [] })
  })

  it('asks for the shelf price index on Shelf and the paid one on Paid', async () => {
    await priceIndexApi.query(indexByCompetitorQuery('shelf', 'last-28-days'))
    expect(sent().path).toBe('Analytics/Query')
    expect(sent().query.measures).toEqual(['shelf_price_index', 'price_indexed_materials'])
    expect(sent().query.dimensions).toEqual(['competitor'])
    expect(sent().query.period).toBe('last-28-days')

    await priceIndexApi.query(indexByCompetitorQuery('paid', 'last-28-days'))
    expect(sent().query.measures).toEqual(['paid_price_index', 'price_indexed_materials'])
  })

  it('switches the A-level table and the trend too', async () => {
    await priceIndexApi.query(indexByCategoryQuery('paid', 'last-7-days'))
    expect(sent().query.measures).toEqual(['paid_price_index'])
    expect(sent().query.dimensions).toEqual(['category', 'competitor'])

    await priceIndexApi.query(indexTrendQuery('shelf', 'week', 'last-28-days'))
    expect(sent().query.measures).toEqual(['shelf_price_index'])
    expect(sent().query.dimensions).toEqual(['competitor', 'date'])
    expect(sent().query.grain).toBe('week')
  })

  it('switches the lowest-price score: flagged on the chosen basis over the counted', async () => {
    await priceIndexApi.query(scoreQuery('paid', 'competitor', 'last-28-days'))
    expect(sent().query.measures).toEqual(['paid_lowest_price_flagged', 'lowest_price_counted'])
    expect(sent().query.dimensions).toEqual(['competitor'])

    await priceIndexApi.query(scoreQuery('shelf', 'overall', 'last-28-days'))
    expect(sent().query.measures).toEqual(['shelf_lowest_price_flagged', 'lowest_price_counted'])
    expect(sent().query.dimensions).toEqual([])
  })
})
