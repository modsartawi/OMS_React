import type { RulePromotionCampaignsBody } from '@/core/models/rule-promotion'
import { campaignPath } from './campaign-state'

// A promotion's page as its address holds it (ticket 535; BackOffice brief 2848 D2): the search, the
// mechanic, the status and the page live in the URL (`?q=&mechanic=&status=&page=`), so Back and a
// shared link restore the view. The page sends them to `Promotions/Campaigns`, HQ filters and pages.
// A row opens its campaign WITH this context (`?promotion=<code>&…`, `promotion` empty = no promotion),
// which the campaign workspace reads (ticket 537) — so it sits in `core/rules`, where both reach it.
// Pure: no React, no fetch.

/** The filters and page of a promotion's page. "" = no filter. */
export interface PromotionQuery {
  /** Matches the id and both names, any case (Arabic works). */
  q: string
  /** A key of the page's `mechanics` (`builder` included). */
  mechanic: string
  /** One of `PROMOTION_CAMPAIGN_STATUSES`. */
  status: string
  /** 1-based. */
  page: number
}

export const EMPTY_PROMOTION_QUERY: PromotionQuery = { q: '', mechanic: '', status: '', page: 1 }

/** Rows a page: HQ's default (at most 200). */
export const PROMOTION_PAGE_SIZE = 50

/** The statuses a campaign row has and the filter offers; HQ accepts any case. */
export const PROMOTION_CAMPAIGN_STATUSES = ['Published', 'Disabled', 'Pending'] as const

const WHOLE = /^[1-9]\d*$/

/** The query an address holds: a status in any case reads as its listed spelling, an unlisted one as
 *  no filter; a page that is not a whole number from 1 reads as page 1. */
export function promotionQueryFromUrl(params: URLSearchParams): PromotionQuery {
  const status = (params.get('status') ?? '').toLowerCase()
  const page = params.get('page') ?? ''
  return {
    q: params.get('q') ?? '',
    mechanic: params.get('mechanic') ?? '',
    status: PROMOTION_CAMPAIGN_STATUSES.find((s) => s.toLowerCase() === status) ?? '',
    page: WHOLE.test(page) ? Number(page) : 1,
  }
}

/** The address a query writes: only what is set, and the page past the first. */
export function urlFromPromotionQuery(query: PromotionQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.q) out.set('q', query.q)
  if (query.mechanic) out.set('mechanic', query.mechanic)
  if (query.status) out.set('status', query.status)
  if (query.page > 1) out.set('page', String(query.page))
  return out
}

/** A filter changed: back to page 1. The same filter again changes nothing. */
export function withPromotionFilter(prev: PromotionQuery, change: Partial<Omit<PromotionQuery, 'page'>>): PromotionQuery {
  const next = { ...prev, ...change }
  if (next.q === prev.q && next.mechanic === prev.mechanic && next.status === prev.status) return prev
  return { ...next, page: 1 }
}

/** `Promotions/Campaigns`' body for a promotion, or for no promotion (`promotionCode: null`). */
export function promotionCampaignsBody(promotionCode: string | null, query: PromotionQuery): RulePromotionCampaignsBody {
  const q = query.q.trim()
  return {
    promotionCode,
    ...(q ? { q } : {}),
    ...(query.mechanic ? { mechanic: query.mechanic } : {}),
    ...(query.status ? { status: query.status } : {}),
    page: query.page,
    pageSize: PROMOTION_PAGE_SIZE,
  }
}

/** A campaign opened from a promotion's page, with the list context the workspace reads (537). */
export function campaignInPromotionPath(id: string, promotionCode: string | null, query: PromotionQuery): string {
  const params = new URLSearchParams({ promotion: promotionCode ?? '' })
  for (const [k, v] of urlFromPromotionQuery(query)) params.set(k, v)
  return `${campaignPath(id)}?${params.toString()}`
}
