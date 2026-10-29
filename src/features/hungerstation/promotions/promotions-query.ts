import { HUNGERSTATION_PROMOTIONS_TAKE, type HungerStationPromotionStatus, type HungerStationPromotionsQuery } from '@/core/models/hungerstation'
import { PROMOTION_STATUSES } from './promotion-status'

// The promotions list's search (ticket 665, reconciled to the BackOffice 3201 door contract
// 2026-10-29): the URL ⇄ query mapping. Pure: no React, no `t`. The door takes ONE status and no
// type. The open promotion (`?promotion=<id>`) and the editor (`?edit=`) ride the same URL, so a
// pasted link opens them; neither is ever sent to the list door.

/** One page of the list: the contract's default `take`. */
export const PROMOTIONS_PAGE_SIZE = HUNGERSTATION_PROMOTIONS_TAKE.default

/** The page's whole query: the door's filters plus the promotion open in the detail, and the one
 *  open in the editor (666): `new` for a new promotion, else a promotion id. */
export interface PromotionsPageQuery extends HungerStationPromotionsQuery {
  promotion: string | null
  edit: string | null
}

/** `?edit=` of a promotion not saved yet. */
export const NEW_PROMOTION = 'new'

const isStatus = (s: string): s is HungerStationPromotionStatus => PROMOTION_STATUSES.includes(s as HungerStationPromotionStatus)

/**
 * The page's query, read from its URL. A `status` the contract does not name is dropped (sending it
 * would be a 400 `HungerStationFilterUnknown`); an older link with several keeps the first it names;
 * `skip` is a whole number ≥ 0, anything else 0.
 */
export function promotionsFromParams(params: URLSearchParams): PromotionsPageQuery {
  const text = (key: string) => {
    const v = params.get(key)?.trim()
    return v ? v : null
  }
  const skip = Number(params.get('skip'))
  return {
    chain: text('chain'),
    status: params.getAll('status').map((v) => v.trim()).find(isStatus) ?? null,
    q: text('q'),
    store: text('store'),
    skip: Number.isInteger(skip) && skip > 0 ? skip : 0,
    take: PROMOTIONS_PAGE_SIZE,
    promotion: text('promotion'),
    edit: text('edit'),
  }
}

/** The query as URL params: only what is set; `skip` only past the first page; `take` never (the
 *  page's constant). */
export function promotionsToParams(query: PromotionsPageQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.chain) out.set('chain', query.chain)
  if (query.status) out.set('status', query.status)
  if (query.q) out.set('q', query.q)
  if (query.store) out.set('store', query.store)
  if (query.skip > 0) out.set('skip', String(query.skip))
  if (query.promotion) out.set('promotion', query.promotion)
  if (query.edit) out.set('edit', query.edit)
  return out
}

/** What the list door is sent: every filter, skip and take — never the open promotion. A `null`
 *  (the status `any`) is dropped by `buildQuery`. */
export function promotionsDoorParams(query: PromotionsPageQuery): HungerStationPromotionsQuery {
  return { chain: query.chain, status: query.status, q: query.q, store: query.store, skip: query.skip, take: query.take }
}
