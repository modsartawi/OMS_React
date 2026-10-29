import { api } from '@/core/api'
import type {
  HungerStationPromotionDetail,
  HungerStationPromotionReasonBody,
  HungerStationPromotionSaveBody,
  HungerStationPromotionStoreChoice,
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

/** The stores picker of one chain. */
export const promotionStoresKey = (chain: string) => [...PROMOTIONS_KEY, 'stores', chain] as const

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

  // ── 666: the strikethrough editor, Send and Refresh ───────────────────────────────────────────

  /** GET HungerStationWeb/Promotions/Stores?chain= — the chain's onboarded stores: removed ones left
   *  out, paused ones kept. Rides the PROMOTIONS grant, unlike `Chains`. DHS-00006 for an unknown chain. */
  async stores(chain: string): Promise<HungerStationPromotionStoreChoice[]> {
    return (await api.get<HungerStationPromotionStoreChoice[] | null>('HungerStationWeb/Promotions/Stores', { chain })) ?? []
  },

  /** POST HungerStationWeb/Promotions — save a new draft. Nothing reaches HungerStation.
   *  DHS-00008 / 00019. */
  create(body: HungerStationPromotionSaveBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>('HungerStationWeb/Promotions', body)
  },

  /** PUT HungerStationWeb/Promotions/{promotionId} — save the draft again. DHS-00008 / 00016 / 00017 / 00019. */
  save(promotionId: string, body: HungerStationPromotionSaveBody): Promise<HungerStationPromotionDetail> {
    return api.put<HungerStationPromotionDetail>(promotionPath(promotionId), body)
  },

  /** POST …/{promotionId}/Send — the promotion then reads Sending. DHS-00008 / 00016 / 00017 / 00018. */
  send(promotionId: string, body: HungerStationPromotionReasonBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Send`, body)
  },

  /** POST …/{promotionId}/Refresh — NO body: asks HungerStation for each part's job now. */
  refresh(promotionId: string): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Refresh`, undefined)
  },

  /** POST HungerStationWeb/Promotions/{promotionId}/Parts/{partId}/Resend — re-sends one part,
   *  unchanged, under its identity (ticket 669, BackOffice 3214). Returns the detail. DHS-00008 /
   *  00016 / 00017 (that part is Sending) / 00014 (HungerStation unavailable). */
  resend(promotionId: string, partId: string, body: HungerStationPromotionReasonBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Parts/${encodeURIComponent(partId)}/Resend`, body)
  },
}
