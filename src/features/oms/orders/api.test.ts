/**
 * 3389 hotfix — the Order / ERX search reads the answer BackOffice built (`OrderDocumentSearchPage`):
 * `{ rows, limited }`, not a bare row array. Prod crashed with `t.rows.filter is not a function` in
 * `lensCounts` because the page fed the whole page object to the lenses. The network is stubbed at the
 * `@/core/api` boundary with a payload in the server's real shape (`./__fixtures__/order-search-page.json`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import page from './__fixtures__/order-search-page.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', () => ({ api }))

const { ordersApi } = await import('./api')
const { isCut, lensCounts } = await import('./lenses')
const { orderInspectorView } = await import('./inspector-model')
const { toSearchCriteria, BLANK_QUERY } = await import('./query-model')

const GRANTS = { canViewInsurance: true }
const criteria = () => toSearchCriteria(BLANK_QUERY, new Date(2026, 10, 5, 14, 0), GRANTS)

beforeEach(() => {
  api.get.mockReset().mockResolvedValue(page)
})

describe('the order search reads { rows, limited }', () => {
  it('the rows feed the lenses and are counted', async () => {
    const result = await ordersApi.search(criteria())
    expect(api.get).toHaveBeenCalledWith('SdDocumentWeb/OrderDocumentList', expect.any(Object))
    const counts = lensCounts({ rows: result.rows, limit: 500, limited: result.limited })
    expect(counts.all).toEqual({ key: 'atLeast', count: 3 })
    expect(counts.noDelivery).toEqual({ key: 'atLeast', count: 1 })
    expect(counts.channel).toEqual({ key: 'atLeast', count: 1 })
    expect(counts.engine).toEqual({ key: 'atLeast', count: 1 })
  })

  it("'cut' is the server's limited, not rows = Limit", async () => {
    const result = await ordersApi.search(criteria())
    expect(result.limited).toBe(true)
    expect(isCut({ rows: result.rows, limit: 500, limited: result.limited })).toBe(true)
    expect(isCut({ rows: result.rows, limit: 3, limited: false })).toBe(false)
  })

  it('a row shows its overall status and its latest delivery', async () => {
    const [first, , erx] = (await ordersApi.search(criteria())).rows
    const view = orderInspectorView(first, GRANTS)
    expect(view.header.status).toBe('B')
    expect(view.fulfilment.deliveryNo).toBe('8006358459')
    expect(view.deliveryTo).toBe('/oms/delivery/8006358459')
    expect(view.insurance?.ids).toEqual({ patientId: '1023456789', memberId: 'BUPA-7781230' })
    expect(orderInspectorView(erx, GRANTS).fulfilment.deliveryNo).toBeNull()
  })

  it('a malformed answer is no rows, never a crash', async () => {
    api.get.mockResolvedValue(null)
    expect(await ordersApi.search(criteria())).toEqual({ rows: [], limited: false })
  })
})
