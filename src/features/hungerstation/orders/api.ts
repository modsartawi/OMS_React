import { api } from '@/core/api'
import type {
  HungerStationOrderDetail,
  HungerStationOrderRaw,
  HungerStationOrdersPage,
  HungerStationOrdersQuery,
  HungerStationRetryResult,
} from '@/core/models/hungerstation'

// The HungerStation orders monitor doors (BackOffice spec 3028; contract § Orders monitor). The
// area's shared reads — the access probe and the chain list — live in `@/core/hungerstation/api`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every orders read — the lists, whatever their filters, and each order's detail and raw bodies.
 *  A retry refreshes them all. */
export const ORDERS_KEY = ['hungerstation', 'orders'] as const

export const orderKey = (orderId: string) => [...ORDERS_KEY, 'detail', orderId] as const
export const rawKey = (orderId: string, receiveId: string) => [...ORDERS_KEY, 'raw', orderId, receiveId] as const

const orderPath = (orderId: string) => `HungerStationWeb/Orders/${encodeURIComponent(orderId)}`

export const ordersApi = {
  /**
   * GET HungerStationWeb/Orders?from=&to=&store=&chain=&outcome=&q=&skip=&take= — `from` and `to`
   * always sent; `outcome` as repeated keys (`buildQuery` repeats an array), an empty one not at all.
   * 400 HungerStationWindowInvalid.
   */
  list(query: HungerStationOrdersQuery): Promise<HungerStationOrdersPage> {
    return api.get<HungerStationOrdersPage>('HungerStationWeb/Orders', {
      from: query.from,
      to: query.to,
      store: query.store,
      chain: query.chain,
      outcome: query.outcome,
      q: query.q,
      skip: query.skip,
      take: query.take,
    })
  },

  /** GET HungerStationWeb/Orders/{orderId} — the row, its lines and its deliveries. DHS-00011. */
  detail(orderId: string): Promise<HungerStationOrderDetail> {
    return api.get<HungerStationOrderDetail>(orderPath(orderId))
  },

  /** GET HungerStationWeb/Orders/{orderId}/Deliveries/{receiveId}/Raw — the body as a JSON STRING. DHS-00011. */
  raw(orderId: string, receiveId: string): Promise<HungerStationOrderRaw> {
    return api.get<HungerStationOrderRaw>(`${orderPath(orderId)}/Deliveries/${encodeURIComponent(receiveId)}/Raw`)
  },

  /** POST HungerStationWeb/Orders/{orderId}/Retry { reason } — re-queues the latest run. DHS-00008/00011/00012. */
  retry(orderId: string, reason: string): Promise<HungerStationRetryResult> {
    return api.post<HungerStationRetryResult>(`${orderPath(orderId)}/Retry`, { reason })
  },
}
