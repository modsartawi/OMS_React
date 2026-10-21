import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { isBareDenial } from '@/core/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { rulePromotionCampaignsQuery, rulePromotionsQuery } from '@/core/rules/promotion-api'
import {
  EMPTY_PROMOTION_QUERY,
  LIST_CONTEXT_KEY,
  listContextBackPath,
  listContextFromUrl,
  promotionCampaignsBody,
  withListContext,
  type PromotionListContext,
} from '@/core/rules/promotion-query'
import { campaignLookupBody, isUploadedCampaign, neighbourId, neighbours, promotionOfLookup, stepPath, type ListStep } from './list-step'

/** A Prev / Next: ready with its address; disabled at the list's end, while the neighbouring page is
 *  read, or when that read failed (`failure` says why). */
export type StepTarget = { state: 'ready'; to: string } | { state: 'end' } | { state: 'loading' } | { state: 'failed' }

export interface WorkspaceList {
  /** The list the campaign was opened from, or null (a direct link). */
  context: PromotionListContext | null
  /** The side menu's way back: the promotion's page as filtered, the no-promotion page, or the Promotions list. */
  back: string
  /** Prev / Next, or null when hidden: no context, or the campaign is not on its list's page. */
  steps: { prev: StepTarget; next: StepTarget } | null
  /** A read of the list that failed (a bare 403 included), or null. */
  failure: unknown
  /** The promotion whose upload the campaign is part of, or null. */
  uploadedFrom: string | null
  link: (path: string) => string
}

/**
 * The campaign workspace inside its promotion's list (ticket 537; BackOffice brief 2848 "The campaign
 * workspace"). The context is the address's (`?promotion=<code>&q=&mechanic=&status=&page=`, written
 * by the promotion's page). Its page is `Promotions/Campaigns` with the same body the promotion's page
 * sent (one cache entry for both); at a page's edge the neighbouring page is read the same way.
 *
 * A direct link has no context. BO ask J (BackOffice 2855, not built) puts `promotionCode` on a row:
 * once it answers, `Promotions/Campaigns { all, q: <id> }`'s exact row names the promotion and the
 * address takes it as its context (replaced, so Back is not doubled). Until then the row has no
 * `promotionCode` and the workspace falls back: back to `/campaigns`, no promotion in the crumb, no
 * Prev / Next.
 */
export function useWorkspaceList(id: string): WorkspaceList {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const context = useMemo(() => listContextFromUrl(new URLSearchParams(search)), [search])
  const base = campaignPath(id)
  const sub = pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : ''

  const lookup = useQuery({ ...rulePromotionCampaignsQuery(campaignLookupBody(id)), enabled: !context && !!id })
  const found = context ? null : promotionOfLookup(lookup.isPlaceholderData ? undefined : lookup.data, id)
  /** The promotion ask J named ('' = none), or null while not known. */
  const foundCode = found ? (found.promotionCode ?? '') : null
  useEffect(() => {
    if (foundCode === null) return
    const params = new URLSearchParams(search)
    params.set(LIST_CONTEXT_KEY, foundCode)
    navigate({ pathname, search: `?${params.toString()}` }, { replace: true })
  }, [foundCode, navigate, pathname, search])

  const body = promotionCampaignsBody(context?.promotionCode ?? null, context?.query ?? EMPTY_PROMOTION_QUERY)
  const current = useQuery({ ...rulePromotionCampaignsQuery(body), enabled: !!context })
  const around = context && !current.isPlaceholderData ? neighbours(id, current.data) : null
  const edgePage = (step: ListStep | null | undefined) => (step && !('id' in step) ? step.page : null)
  const prevPage = useQuery({ ...rulePromotionCampaignsQuery({ ...body, page: edgePage(around?.prev) ?? 1 }), enabled: edgePage(around?.prev) !== null })
  const nextPage = useQuery({ ...rulePromotionCampaignsQuery({ ...body, page: edgePage(around?.next) ?? 1 }), enabled: edgePage(around?.next) !== null })

  const target = (step: ListStep | null, read: typeof prevPage): StepTarget => {
    if (!step || !context) return { state: 'end' }
    if (!('id' in step) && read.isError) return { state: 'failed' }
    if (!('id' in step) && (read.isPending || read.isPlaceholderData)) return { state: 'loading' }
    const to = neighbourId(step, read.data)
    return to ? { state: 'ready', to: stepPath(to, sub, context, step.page) } : { state: 'end' }
  }

  const promotions = useQuery({ ...rulePromotionsQuery(), enabled: !!context?.promotionCode })
  // HQ matches a code in any case (a typed or shared link may not be HQ's spelling).
  const code = context?.promotionCode?.toLowerCase()
  const summary = code ? promotions.data?.find((p) => p.promotionCode?.toLowerCase() === code) : undefined

  return {
    context,
    back: listContextBackPath(context),
    steps: around ? { prev: target(around.prev, prevPage), next: target(around.next, nextPage) } : null,
    // A direct link's lookup is a quiet fallback (brief 2848), unless HQ denies it outright.
    failure: current.error ?? prevPage.error ?? nextPage.error ?? promotions.error ?? (isBareDenial(lookup.error) ? lookup.error : null),
    uploadedFrom: summary && isUploadedCampaign(id, summary) ? summary.promotionCode : null,
    link: (path: string) => withListContext(path, context),
  }
}
