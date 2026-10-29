import { api } from '@/core/api'
import type {
  HungerStationPromotionCheck,
  HungerStationPromotionDetail,
  HungerStationPromotionReasonBody,
  HungerStationPromotionRemoveItemsBody,
  HungerStationPromotionReplaceBody,
  HungerStationPromotionSaveBody,
  HungerStationPromotionSaved,
  HungerStationPromotionStoreChoice,
  HungerStationPromotionsPage,
  HungerStationPromotionsQuery,
} from '@/core/models/hungerstation'

// The HungerStation promotion doors — every shape in `@/core/models/hungerstation` § Promotions,
// field for field the BackOffice door contract
// (`C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md`; 3211–3216
// are built). The area's shared reads (the access probe, the chain list) live in
// `@/core/hungerstation/api`.
//
// 🚩 Still proven against STUBS only: no live SIS.Api call has been made from this page.
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every promotion read — the lists, whatever their filters, and each promotion's detail. A write
 *  refreshes them all. */
export const PROMOTIONS_KEY = ['hungerstation', 'promotions'] as const

export const promotionKey = (promotionId: string) => [...PROMOTIONS_KEY, 'detail', promotionId] as const

/** The stores picker of one chain. */
export const promotionStoresKey = (chain: string) => [...PROMOTIONS_KEY, 'stores', chain] as const

export const promotionPath = (promotionId: string) => `HungerStationWeb/Promotions/${encodeURIComponent(promotionId)}`

export const promotionsApi = {
  /** GET HungerStationWeb/Promotions?chain=&status=&q=&store=&skip=&take= — ONE status (`null` =
   *  any, dropped by `buildQuery`). HungerStationFilterUnknown / HungerStationInputInvalid. */
  list(query: HungerStationPromotionsQuery): Promise<HungerStationPromotionsPage> {
    return api.get<HungerStationPromotionsPage>('HungerStationWeb/Promotions', {
      chain: query.chain,
      status: query.status,
      q: query.q,
      store: query.store,
      skip: query.skip,
      take: query.take,
    })
  },

  /** GET HungerStationWeb/Promotions/{promotionId} — the promotion row. DHS-00016. */
  detail(promotionId: string): Promise<HungerStationPromotionDetail> {
    return api.get<HungerStationPromotionDetail>(promotionPath(promotionId))
  },

  /** GET HungerStationWeb/Promotions/Stores?chain= — the chain's onboarded stores: removed ones left
   *  out, paused ones kept. Rides the PROMOTIONS grant, unlike `Chains`. DHS-00006. */
  async stores(chain: string): Promise<HungerStationPromotionStoreChoice[]> {
    return (await api.get<HungerStationPromotionStoreChoice[] | null>('HungerStationWeb/Promotions/Stores', { chain })) ?? []
  },

  /** POST HungerStationWeb/Promotions — save a new draft. Nothing reaches HungerStation. The answer
   *  carries `check` (Save reports the checks, never refuses on them). DHS-00001 / 06 / 07 / 08. */
  create(body: HungerStationPromotionSaveBody): Promise<HungerStationPromotionSaved> {
    return api.post<HungerStationPromotionSaved>('HungerStationWeb/Promotions', body)
  },

  /** PUT HungerStationWeb/Promotions/{promotionId} — save the draft again; on a SENT promotion, the
   *  in-place edit (3215): every check runs and refuses (DHS-00018 / 19), the affected parts are
   *  re-sent. Answers the row plus `check`. DHS-00016 / 17 / 21 / HungerStationPromotionSent / 14. */
  save(promotionId: string, body: HungerStationPromotionSaveBody): Promise<HungerStationPromotionSaved> {
    return api.put<HungerStationPromotionSaved>(promotionPath(promotionId), body)
  },

  /** POST …/{promotionId}/Check — NO body: every pre-check on the SAVED promotion, nothing written
   *  (3212); the part preview (3213). DHS-00006 / 00016. */
  check(promotionId: string): Promise<HungerStationPromotionCheck> {
    return api.post<HungerStationPromotionCheck>(`${promotionPath(promotionId)}/Check`, undefined)
  },

  /** POST …/{promotionId}/Send — the promotion then reads Sending. DHS-00006 / 08 / 16 / 17 / 18 /
   *  19 / HungerStationPromotionSent / 14. */
  send(promotionId: string, body: HungerStationPromotionReasonBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Send`, body)
  },

  /** POST …/{promotionId}/Refresh — NO body: asks HungerStation for each open job now. DHS-00016. */
  refresh(promotionId: string): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Refresh`, undefined)
  },

  /** POST …/Parts/{partId}/Resend — re-sends one part, unchanged, under its identity (3214).
   *  DHS-00008 / 16 / HungerStationInputInvalid / 06 / 17 (that part is Sending) / 14. */
  resend(promotionId: string, partId: string, body: HungerStationPromotionReasonBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Parts/${encodeURIComponent(partId)}/Resend`, body)
  },

  /** POST …/{promotionId}/RemoveItems — those materials go out `active: false` in their parts and
   *  read Removed (3215). The plain row. DHS-00008 / 16 / InputInvalid / PromotionSent / 17 / 06 / 14. */
  removeItems(promotionId: string, body: HungerStationPromotionRemoveItemsBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/RemoveItems`, body)
  },

  /** POST …/{promotionId}/Replace — the old promotion's parts switched off FIRST; only if each is
   *  accepted the successor is saved and sent. Returns the SUCCESSOR's row (3216). DHS-00008 / 16 /
   *  InputInvalid / PromotionSent / 17 / 01 / 06 / 07 / 18 / 19 / 20 (a switch-off refused: nothing
   *  new sent, the message names the part) / 14 (the successor's own send failed). */
  replace(promotionId: string, body: HungerStationPromotionReplaceBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Replace`, body)
  },

  /** POST …/{promotionId}/SwitchOff — one `active: false` PUT per active part; nothing deleted. It
   *  reads Sending until every switch-off job completes, then Switched off (3216). A refused part
   *  answers DHS-00014 naming it, the others still switched off. DHS-00008 / 16 / InputInvalid /
   *  PromotionSent / 17 / 06 / 14. */
  switchOff(promotionId: string, body: HungerStationPromotionReasonBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/SwitchOff`, body)
  },
}
