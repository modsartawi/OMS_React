import type { RulePromotionOrigin, RulePromotionState, RulePromotionSummary } from '@/core/models/rule-promotion'
import type { RuleUploadState } from '@/core/models/rule-upload'
import { NO_PROMOTION_PATH, promotionPath } from '@/core/rules/campaign-state'
import { windowDays } from '@/core/rules/wire-days'
import type { Severity } from '@/core/ui/severity'

/**
 * What the Promotions list makes of a `Promotions/List` row (ticket 534; BackOffice brief 2848 D1):
 * pure, no React, no i18n — the page renders these words through its own keys.
 *
 * The decided rules it serves: the no-promotion row is told by `promotionCode: null`, never by
 * `origin` (a stray code's row has `origin: null` too, and gets no kind); an unknown state renders
 * as `disabled`; `windowUntil` is the inclusive last day, shown as sent.
 */

/** The states this client has words for, in the order the badge reads them. */
export const PROMOTION_STATES = ['live', 'pending', 'ended', 'disabled'] as const
export type PromotionBadge = (typeof PROMOTION_STATES)[number]

/** Live runs well; pending and disabled need a human (as a campaign's waiting and disabled do); ended is over. */
export const PROMOTION_STATE_SEV: Record<PromotionBadge, Severity> = { live: 'ok', pending: 'warn', ended: 'mute', disabled: 'warn' }

/** The badge for a state: a listed one as itself, any other as `disabled`. */
export const promotionBadge = (state: RulePromotionState): PromotionBadge =>
  (PROMOTION_STATES as readonly string[]).includes(state) ? (state as PromotionBadge) : 'disabled'

export type PromotionKind = 'uploaded' | 'handMade'

/** The kind from `origin`: Uploaded or Hand-made; none for a null or unlisted origin. */
export function promotionKind(origin: RulePromotionOrigin | null): PromotionKind | null {
  if (origin === 'upload') return 'uploaded'
  if (origin === 'manual') return 'handMade'
  return null
}

/** The upload behind a promotion: its revision, state, uploader and approver ("" when never activated). */
export interface PromotionUploadFacts {
  revision: number
  uploadState: RuleUploadState
  uploadedBy: string
  approvedBy: string
}

export interface PromotionRowView {
  /** Unique within the list: a code, or a key no code can be (codes are `A-Z a-z 0-9 . _ -`). */
  key: string
  promotionCode: string | null
  /** The last row: the hand-built campaigns that belong to no promotion. */
  noPromotion: boolean
  nameEn: string
  nameAr: string
  /** False when both names are empty: the code is shown alone. */
  named: boolean
  kind: PromotionKind | null
  badge: PromotionBadge
  /** A pending re-upload's new campaigns are not counted until activated. */
  campaignCount: number
  skuCount: number
  /** The inclusive days as ONE range (isolate it once), or null without a window. */
  window: string | null
  /** Only when live. */
  liveVersionNo: number | null
  /** Null without an upload. */
  upload: PromotionUploadFacts | null
  path: string
}

const NO_PROMOTION_KEY = ' no-promotion'

export function promotionRowView(p: RulePromotionSummary): PromotionRowView {
  const noPromotion = p.promotionCode === null
  const nameEn = (p.nameEn ?? '').trim()
  const nameAr = (p.nameAr ?? '').trim()
  const badge = promotionBadge(p.state)
  return {
    key: p.promotionCode ?? NO_PROMOTION_KEY,
    promotionCode: p.promotionCode,
    noPromotion,
    nameEn,
    nameAr,
    named: nameEn !== '' || nameAr !== '',
    kind: promotionKind(p.origin),
    badge,
    campaignCount: p.campaignCount,
    skuCount: p.skuCount,
    window: windowDays(p.windowFrom, p.windowUntil),
    liveVersionNo: p.state === 'live' && p.liveVersionNo != null ? p.liveVersionNo : null,
    // Shown whenever HQ holds an upload of the code (revision set): a hand-made promotion an upload waits on too.
    upload:
      !noPromotion && p.revision != null
        ? { revision: p.revision, uploadState: p.uploadState ?? '', uploadedBy: p.uploadedBy ?? '', approvedBy: p.approvedBy ?? '' }
        : null,
    path: p.promotionCode === null ? NO_PROMOTION_PATH : promotionPath(p.promotionCode),
  }
}
