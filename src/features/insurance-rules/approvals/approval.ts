// The guard approval's own rule, shadow promotion (BackOffice door 3139; oms ticket 611). Pure: no React, no `t`.
// The approval by role itself (`actionsFor`, `DraftApproval`) is core's (`@/core/insurance-rules/approval`): the
// category and coverage rulesets ask for approval on the same doors (review 3126 P6b).
//
// A shadow rule is promoted by an approver after 14 local days, or sooner with a reason.
import type { GuardRule } from '@/core/insurance-rules/model'

// ── Shadow promotion (`POST …/Rules/{id}/Promote { skipReason? }`) ───────────────────────────────

/** A shadow rule may be promoted without a reason after this many local days (brief, door 3139). */
export const PROMOTE_AFTER_DAYS = 14

/** Whole LOCAL calendar days from the shadow day to `now`; null when the day is unknown. */
export function daysInShadow(shadowSince: string | null | undefined, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(shadowSince ?? '')
  if (!m) return null
  const since = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Rounded: a local day across a DST change is 23 or 25 hours long.
  return Math.round((today.getTime() - since.getTime()) / 86_400_000)
}

export type PromoteWhy = 'notShadow' | 'notApprover' | 'reason'

export interface PromoteGate {
  can: boolean
  days: number | null
  /** Under 14 days (or an unknown shadow day): promoting skips shadow, and needs a reason. */
  needsReason: boolean
  why: PromoteWhy | null
}

export function promoteGate({
  rule,
  now,
  approver,
  skipReason,
}: {
  rule: Pick<GuardRule, 'state' | 'shadowSince'>
  now: Date
  approver: boolean
  skipReason: string
}): PromoteGate {
  if (rule.state !== 'shadow') return { can: false, days: null, needsReason: false, why: 'notShadow' }
  const days = daysInShadow(rule.shadowSince, now)
  const needsReason = days === null || days < PROMOTE_AFTER_DAYS
  const why: PromoteWhy | null = !approver ? 'notApprover' : needsReason && !skipReason.trim() ? 'reason' : null
  return { can: why === null, days, needsReason, why }
}
