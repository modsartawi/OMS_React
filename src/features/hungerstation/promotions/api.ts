import { api } from '@/core/api'
import type {
  HungerStationPromotionCheckResult,
  HungerStationPromotionDetail,
  HungerStationPromotionEditCheckBody,
  HungerStationPromotionReasonBody,
  HungerStationPromotionReplaceBody,
  HungerStationPromotionRemoveItemsBody,
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

  /** PUT HungerStationWeb/Promotions/{promotionId} — save the draft again; on a SENT promotion, the
   *  in-place edit (670, BackOffice 3215): saved and the affected parts re-sent. DHS-00008 / 00016 /
   *  00017 (a part is Sending) / 00019 / 00021 (the name, stores, start or end changed: a Replace). */
  save(promotionId: string, body: HungerStationPromotionSaveBody): Promise<HungerStationPromotionDetail> {
    return api.put<HungerStationPromotionDetail>(promotionPath(promotionId), body)
  },

  /** POST …/{promotionId}/Check — NO body: every pre-check on the SAVED promotion, nothing written
   *  (ticket 667, BackOffice 3212). Refusals per row and per header field; price warnings name the
   *  stores. DHS-00016.
   *
   *  670: on a SENT promotion the edit rides as the body (nothing is written), and the answer's
   *  `changes` say what changes on HungerStation per part. 🚩 Assumed: BackOffice 3215 names no
   *  preview door, and a live promotion's save IS its re-send, so the preview cannot read a saved
   *  version. */
  check(promotionId: string, edit?: HungerStationPromotionEditCheckBody): Promise<HungerStationPromotionCheckResult> {
    return api.post<HungerStationPromotionCheckResult>(`${promotionPath(promotionId)}/Check`, edit)
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

  // ── 671: Replace and Switch off ──────────────────────────────────────────────────────────────

  /** POST HungerStationWeb/Promotions/{promotionId}/Replace — the server switches off every part
   *  of the old promotion FIRST; only if each is accepted it makes the new one (linked through
   *  `replacesId`, the same items) and sends it. Returns the NEW promotion's detail (BackOffice
   *  3216). DHS-00008 / 00016 / 00017 / 00019 / 00020 (a switch-off refused — nothing new was sent,
   *  the old one unchanged; `data` names the part). */
  replace(promotionId: string, body: HungerStationPromotionReplaceBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/Replace`, body)
  },

  /** POST HungerStationWeb/Promotions/{promotionId}/SwitchOff — `active: false` for every part;
   *  nothing is deleted. Returns the detail, then Switched off. DHS-00008 / 00016 / 00017 / 00014. */
  switchOff(promotionId: string, body: HungerStationPromotionReasonBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/SwitchOff`, body)
  },

  // ── 670: edit in place, remove items ────────────────────────────────────────────────────────

  /** POST …/{promotionId}/RemoveItems — those materials go out `active: false` in their parts and
   *  read Removed; they stay listed. Returns the detail. DHS-00008 / 00016 / 00017. */
  removeItems(promotionId: string, body: HungerStationPromotionRemoveItemsBody): Promise<HungerStationPromotionDetail> {
    return api.post<HungerStationPromotionDetail>(`${promotionPath(promotionId)}/RemoveItems`, body)
  },
}
