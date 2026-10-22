import type { RulePromotionCampaignsBody, RulePromotionSummary } from '@/core/models/rule-promotion'
import { NO_PROMOTION_PATH, PROMOTIONS_PATH, campaignPath, promotionPath } from './campaign-state'

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
  status: PromotionCampaignStatus | ''
  /** 1-based. */
  page: number
}

export const EMPTY_PROMOTION_QUERY: PromotionQuery = { q: '', mechanic: '', status: '', page: 1 }

/** Rows a page: HQ's default (at most 200). */
export const PROMOTION_PAGE_SIZE = 50

/** The statuses a campaign row has and the filter offers; HQ accepts any case. */
export const PROMOTION_CAMPAIGN_STATUSES = ['Published', 'Disabled', 'Pending'] as const
export type PromotionCampaignStatus = (typeof PROMOTION_CAMPAIGN_STATUSES)[number]

/** A promotion's `Promotions/List` row by its code (null = the no-promotion row). HQ keeps codes unique
 *  in any case, and a typed or shared link may not be HQ's spelling, so the code matches in any case. */
export function findRulePromotion(list: readonly RulePromotionSummary[] | undefined, code: string | null): RulePromotionSummary | undefined {
  const wanted = code?.toLowerCase()
  return list?.find((p) => (wanted === undefined ? p.promotionCode === null : p.promotionCode?.toLowerCase() === wanted))
}

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

/**
 * The list a campaign's workspace was opened from (ticket 537): the promotion (null = no promotion)
 * and that page's filters and page. It rides in the workspace's address — `?promotion=<code>&q=&…`,
 * `promotion` empty = no promotion — so a reload or a shared link keeps it; without `promotion` there
 * is none (a direct link).
 */
export interface PromotionListContext {
  promotionCode: string | null
  query: PromotionQuery
}

/** The address key that holds the list context's promotion ("" = no promotion). */
export const LIST_CONTEXT_KEY = 'promotion'

/** The list context an address holds, or null for a direct link. */
export function listContextFromUrl(params: URLSearchParams): PromotionListContext | null {
  const code = params.get(LIST_CONTEXT_KEY)
  if (code === null) return null
  return { promotionCode: code || null, query: promotionQueryFromUrl(params) }
}

/** The search a context writes (`?promotion=…&…`), or "" for none. */
export function listContextSearch(context: PromotionListContext | null): string {
  if (!context) return ''
  const params = new URLSearchParams({ [LIST_CONTEXT_KEY]: context.promotionCode ?? '' })
  for (const [k, v] of urlFromPromotionQuery(context.query)) params.set(k, v)
  return `?${params.toString()}`
}

/** A workspace address that keeps the list context, so it survives every page of the workspace. */
export const withListContext = (path: string, context: PromotionListContext | null): string => `${path}${listContextSearch(context)}`

/** The way back: the promotion's page as it was filtered, the no-promotion page, or — without a
 *  context — the Promotions list. */
export function listContextBackPath(context: PromotionListContext | null): string {
  if (!context) return PROMOTIONS_PATH
  const search = urlFromPromotionQuery(context.query).toString()
  const page = context.promotionCode === null ? NO_PROMOTION_PATH : promotionPath(context.promotionCode)
  return search ? `${page}?${search}` : page
}

/** A campaign opened from a promotion's page, with the list context the workspace reads (537). */
export function campaignInPromotionPath(id: string, promotionCode: string | null, query: PromotionQuery): string {
  return withListContext(campaignPath(id), { promotionCode, query })
}
