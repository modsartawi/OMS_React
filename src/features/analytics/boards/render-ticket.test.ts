/**
 * Ticket 835 (ADR 0125, amended): a scheduled report's PDF is headless Chromium printing the web's print route with a
 * render ticket in its URL — no session. Under a ticket the page reads the four ticket doors, the ticket in the
 * `X-Analytics-Render-Ticket` header and never in a door's query string, and asks no session door (the access probe
 * would answer 401 and send the renderer to the login page). The network is stubbed at the `@/core/api` boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { analyticsApi } = await import('./api')
const { analyticsAccessQuery } = await import('./access')
const { RENDER_TICKET_HEADER, renderTicket, setRenderTicket, ticketOf } = await import('./render-ticket')

const REPORT = { id: 'r1', kind: 'report', revision: 3, title: { en: 'Daily', ar: 'يومي' }, definition: { params: [], bindings: {}, sections: [] } }
const headers = { [RENDER_TICKET_HEADER]: 'T-secret' }

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})
afterEach(() => setRenderTicket(null))

describe('ticketOf: the print route’s ticket, from its URL', () => {
  it('reads the trimmed ticket, or none', () => {
    expect(ticketOf(new URLSearchParams('period=yesterday&lang=en&ticket=%20T-secret%20'))).toBe('T-secret')
    expect(ticketOf(new URLSearchParams('period=yesterday'))).toBeNull()
    expect(ticketOf(new URLSearchParams('ticket='))).toBeNull()
  })
})

describe('under a render ticket, the print page reads the four ticket doors with the header', () => {
  beforeEach(() => setRenderTicket({ ticket: 'T-secret', lang: 'ar' }))

  it('the report at the ticket’s revision: GET Render/Report/{id}', async () => {
    api.get.mockResolvedValue(REPORT)
    const report = await analyticsApi.report('r1')
    expect(api.get).toHaveBeenCalledWith('Analytics/Render/Report/r1', undefined, headers)
    expect(report.revision).toBe(3)
  })

  it('the model: GET Render/Model', async () => {
    api.get.mockResolvedValue({ areas: [] })
    await analyticsApi.model()
    expect(api.get).toHaveBeenCalledWith('Analytics/Render/Model', undefined, headers)
  })

  it('a panel: POST Render/Query with the item and panel alone (the revision and values are the ticket’s)', async () => {
    api.post.mockResolvedValue({ rows: [] })
    await analyticsApi.query({ itemId: 'r1', revision: 3, panelId: 'p1', values: { period: { kind: 'period', token: 'yesterday' } } })
    expect(api.post).toHaveBeenCalledWith('Analytics/Render/Query', { itemId: 'r1', panelId: 'p1' }, undefined, headers)
  })

  it('the words: POST Render/Report/{id}/Words in the run’s language', async () => {
    api.post.mockResolvedValue({ figures: {}, summary: null })
    await analyticsApi.words('r1', { revision: 3, values: {} })
    expect(api.post).toHaveBeenCalledWith('Analytics/Render/Report/r1/Words', { lang: 'ar' }, undefined, headers)
  })

  it('asks no session door: the access probe answers a runner without a call', async () => {
    const access = await analyticsAccessQuery().queryFn()
    expect(access).toMatchObject({ canView: true, canAuthor: false, canCurate: false })
    expect(api.get).not.toHaveBeenCalled()
  })
})

describe('without a ticket, the session doors as before', () => {
  it('reads Item, Model, Query and Words with no ticket header', async () => {
    expect(renderTicket()).toBeNull()
    api.get.mockResolvedValue(REPORT)
    await analyticsApi.report('r1')
    expect(api.get).toHaveBeenCalledWith('Analytics/Item/r1')
    api.post.mockResolvedValue({ rows: [] })
    const input = { itemId: 'r1', revision: 3, panelId: 'p1', values: {} }
    await analyticsApi.query(input)
    expect(api.post).toHaveBeenCalledWith('Analytics/Query', input)
  })
})
