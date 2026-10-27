// The approval panel, by role (BackOffice door 3139; oms ticket 611). Pure: no React, no `t`.
//
// The guard ruleset is ONE document: an author asks for approval of the draft as a whole (`POST …/Submit
// { note }`), and a DIFFERENT user approves it or sends it back. Asking waits for a back-test of the current
// revision (`@/core/insurance-rules/backtest`) and for HQ's checks to show no error (`checksVerdict`: warnings
// never block). A shadow rule is promoted by an approver after 14 local days, or sooner with a reason.
//
// ⚠️ PROVISIONAL (611), 618 reconciles: the brief has no door that says where the draft stands nor who the
// viewer is. Guessed `GET InsuranceRules/Guards/Approval` → `DraftApproval` below; `viewer` stands in for the
// authoring / approving grants until 618's access probe.
import { backtestStanding, type BacktestStatus } from '@/core/insurance-rules/backtest'
import type { GuardRule } from '@/core/insurance-rules/model'

export interface DraftApproval {
  /** The draft revision this standing is of. */
  revision: number
  /** `draft` — being authored; `waiting` — asked for approval. */
  state: 'draft' | 'waiting'
  submittedBy: string | null
  /** Local moment. */
  submittedAt: string | null
  /** The author's note to the approver. */
  note: string | null
  /** The approver's last send-back, shown to the author. */
  sentBack: { by: string; at: string; note: string } | null
  /** What the session may do — the authoring and approving grants. */
  viewer: { author: boolean; approver: boolean }
}

export type SubmitWhy = 'noBacktest' | 'backtestRunning' | 'backtestFailed' | 'backtestStale' | 'checking' | 'checks'
export type ApproveWhy = 'ownSubmission'

export type ApprovalAction =
  | { kind: 'submit'; enabled: boolean; why: SubmitWhy | null }
  | { kind: 'approve' | 'sendBack'; enabled: boolean; why: ApproveWhy | null }

export interface ActionsInput {
  approval: DraftApproval
  userId: string | null
  backtest: BacktestStatus | null | undefined
  /** `checksVerdict` of HQ's Validate on this revision; null while it is being asked. */
  checks: { errors: number; warnings: number; blocked: boolean } | null
}

const STANDING_WHY = { none: 'noBacktest', running: 'backtestRunning', failed: 'backtestFailed', stale: 'backtestStale' } as const

export function actionsFor({ approval, userId, backtest, checks }: ActionsInput): ApprovalAction[] {
  if (approval.state === 'draft') {
    if (!approval.viewer.author) return []
    const standing = backtestStanding(backtest, approval.revision)
    const why: SubmitWhy | null = standing !== 'current' ? STANDING_WHY[standing] : !checks ? 'checking' : checks.blocked ? 'checks' : null
    return [{ kind: 'submit', enabled: why === null, why }]
  }
  if (!approval.viewer.approver) return []
  const own = !userId || !approval.submittedBy || userId.toLowerCase() === approval.submittedBy.toLowerCase()
  const why: ApproveWhy | null = own ? 'ownSubmission' : null
  return [
    { kind: 'approve', enabled: !own, why },
    { kind: 'sendBack', enabled: !own, why },
  ]
}

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
