import { api } from '@/core/api'
import type {
  HungerStationPromotionDetail,
  HungerStationPromotionsPage,
  HungerStationPromotionsQuery,
} from '@/core/models/hungerstation'

// The HungerStation promotion doors (BackOffice spec 3201 § Doors; every shape in
// `@/core/models/hungerstation` § Promotions). 665 reads; 666–671 add the writes here. The area's
// shared reads (the access probe, the chain list) live in `@/core/hungerstation/api`.
//
// 🚩 No door is built yet (BackOffice 3211–3216): every call is proven against stubs only.
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every promotion read — the lists, whatever their filters, and each promotion's detail. A write
 *  refreshes them all. */
export const PROMOTIONS_KEY = ['hungerstation', 'promotions'] as const

export const promotionKey = (promotionId: string) => [...PROMOTIONS_KEY, 'detail', promotionId] as const

export const promotionPath = (promotionId: string) => `HungerStationWeb/Promotions/${encodeURIComponent(promotionId)}`

export const promotionsApi = {
  /** GET HungerStationWeb/Promotions?chain=&status=&type=&q=&store=&skip=&take= — `status` as
   *  repeated keys (`buildQuery` repeats an array), an empty one not at all. */
  list(query: HungerStationPromotionsQuery): Promise<HungerStationPromotionsPage> {
    return api.get<HungerStationPromotionsPage>('HungerStationWeb/Promotions', {
      chain: query.chain,
      status: query.status,
      type: query.type,
      q: query.q,
      store: query.store,
      skip: query.skip,
      take: query.take,
    })
  },

  /** GET HungerStationWeb/Promotions/{promotionId} — header, parts, stores, items, sends. DHS-00016. */
  detail(promotionId: string): Promise<HungerStationPromotionDetail> {
    return api.get<HungerStationPromotionDetail>(promotionPath(promotionId))
  },
}
