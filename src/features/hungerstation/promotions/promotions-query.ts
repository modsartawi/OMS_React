import {
  HUNGERSTATION_PROMOTIONS_TAKE,
  type HungerStationPromotionStatus,
  type HungerStationPromotionType,
  type HungerStationPromotionsQuery,
} from '@/core/models/hungerstation'
import { PROMOTION_STATUSES } from './promotion-status'

// The promotions list's search (BackOffice spec 3201, ticket 665): the URL ⇄ query mapping. Pure:
// no React, no `t`. The open promotion (`?promotion=<id>`) rides the same URL, so a pasted link
// opens it; it is never sent to the list door.

/** One page of the list: the contract's default `take`. */
export const PROMOTIONS_PAGE_SIZE = HUNGERSTATION_PROMOTIONS_TAKE.default

/** The types, in the order the editor offers them. */
export const PROMOTION_TYPES: readonly HungerStationPromotionType[] = ['STRIKETHROUGH', 'SAME_ITEM_BUNDLE']

/** The page's whole query: the door's filters plus the promotion open in the detail, and the one
 *  open in the editor (666): `new` for a new strikethrough, else a promotion id. */
export interface PromotionsPageQuery extends HungerStationPromotionsQuery {
  promotion: string | null
  edit: string | null
}

/** `?edit=` of a promotion not saved yet. */
export const NEW_PROMOTION = 'new'

/**
 * The page's query, read from its URL. A `status` or `type` the contract does not name is
 * dropped (sending it would be a 400 `HungerStationFilterUnknown`); `status` is a repeated key,
 * de-duplicated; `skip` is a whole number ≥ 0, anything else 0.
 */
export function promotionsFromParams(params: URLSearchParams): PromotionsPageQuery {
  const text = (key: string) => {
    const v = params.get(key)?.trim()
    return v ? v : null
  }
  const status = [...new Set(params.getAll('status').map((v) => v.trim()))].filter((s): s is HungerStationPromotionStatus =>
    PROMOTION_STATUSES.includes(s as HungerStationPromotionStatus),
  )
  const type = text('type')
  const skip = Number(params.get('skip'))
  return {
    chain: text('chain'),
    status,
    type: PROMOTION_TYPES.includes(type as HungerStationPromotionType) ? (type as HungerStationPromotionType) : null,
    q: text('q'),
    store: text('store'),
    skip: Number.isInteger(skip) && skip > 0 ? skip : 0,
    take: PROMOTIONS_PAGE_SIZE,
    promotion: text('promotion'),
    edit: text('edit'),
  }
}

/** The query as URL params: only what is set; `status` as repeated keys; `skip` only past the
 *  first page; `take` never (the page's constant). */
export function promotionsToParams(query: PromotionsPageQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.chain) out.set('chain', query.chain)
  for (const s of query.status) out.append('status', s)
  if (query.type) out.set('type', query.type)
  if (query.q) out.set('q', query.q)
  if (query.store) out.set('store', query.store)
  if (query.skip > 0) out.set('skip', String(query.skip))
  if (query.promotion) out.set('promotion', query.promotion)
  if (query.edit) out.set('edit', query.edit)
  return out
}

/** What the list door is sent: every filter, skip and take — never the open promotion. A `null`
 *  is dropped by `buildQuery`, an array repeats its key. */
export function promotionsDoorParams(query: PromotionsPageQuery): HungerStationPromotionsQuery {
  return {
    chain: query.chain,
    status: query.status,
    type: query.type,
    q: query.q,
    store: query.store,
    skip: query.skip,
    take: query.take,
  }
}
