import { api } from '@/core/api'
import type {
  DeliverectOrderDetail,
  DeliverectOrderRaw,
  DeliverectOrdersPage,
  DeliverectOrdersQuery,
} from '@/core/models/deliverect'

// The Deliverect orders monitor doors (BackOffice 2626; contract § Orders monitor). The area's shared
// reads — the access probe and the platform list — live in `@/core/deliverect/api`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every orders read — the lists, whatever their filters, and each order's detail and raw body. A
 *  retry refreshes them all. */
export const ORDERS_KEY = ['deliverect', 'orders'] as const

export const orderKey = (id: string) => [...ORDERS_KEY, 'detail', id] as const
export const orderRawKey = (id: string) => [...ORDERS_KEY, 'raw', id] as const

const orderPath = (id: string) => `DeliverectWeb/Orders/${encodeURIComponent(id)}`

export const ordersApi = {
  /**
   * GET DeliverectWeb/Orders?from=&to=&platform=&store=&outcome=&q=&skip=&take= — `from` and `to`
   * are always sent; `platform` and `outcome` travel as repeated keys (`buildQuery` repeats an
   * array), an empty one not at all.
   */
  list(query: DeliverectOrdersQuery): Promise<DeliverectOrdersPage> {
    return api.get<DeliverectOrdersPage>('DeliverectWeb/Orders', {
      from: query.from,
      to: query.to,
      platform: query.platform,
      store: query.store,
      outcome: query.outcome,
      q: query.q,
      skip: query.skip,
      take: query.take,
    })
  },

  /** GET DeliverectWeb/Orders/{id} — the row, plus its lines and the statuses sent. DLV-00006. */
  detail(id: string): Promise<DeliverectOrderDetail> {
    return api.get<DeliverectOrderDetail>(orderPath(id))
  },

  /** GET DeliverectWeb/Orders/{id}/Raw — the body as received (shape ruled in the model, HITL-478). */
  raw(id: string): Promise<DeliverectOrderRaw> {
    return api.get<DeliverectOrderRaw>(`${orderPath(id)}/Raw`)
  },

  /**
   * POST DeliverectWeb/Orders/{id}/Retry — re-run a refused order, or re-send a failed status call.
   * The contract names no body and no reason: an empty JSON object is sent, as every body-less POST
   * in the app does. Its answer is unspecified, so nothing is read from it (the reads are refreshed).
   * Refusals: DLV-00006, DLV-00007.
   */
  retry(id: string): Promise<unknown> {
    return api.post<unknown>(`${orderPath(id)}/Retry`, {})
  },
}
