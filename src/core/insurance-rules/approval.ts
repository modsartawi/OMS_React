// The approval by role (BackOffice door 3139; oms 611 for the guard ruleset, review 3126 P6b for the category and
// coverage rulesets on "the same authoring doors"). Pure: no React, no `t`.
//
// A ruleset is ONE document: an author asks for approval of the saved draft as a whole (`POST …/Submit { note }`),
// and a DIFFERENT user approves it or sends it back. The guard draft also waits for a back-test of the current
// revision (`./backtest`); every draft waits for HQ's checks to show no error (`checksVerdict`: warnings never block).
//
// As BUILT (oms 618 reconciled 3139): there is no `…/Approval` door — where the draft stands is the draft itself
// (`GET …/Guards/Draft`: `state`, `requestedBy/At`, `requestNote`, `reviewedBy`, `reviewNote`), read by `approvalOf`.
// BackOffice has no insurance-rules grant probe, so `viewer` grants both roles and HQ refuses what the session may not
// do (403 bare, or `GUARDS_SELF_APPROVAL`). The guard draft's back-test is found through `GET …/Guards/Backtests`
// (3140, `draftBacktest`).
import { backtestStanding, type GuardBacktest } from './backtest'
import type { RulesetDraft } from './ruleset-draft'

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
  /** The approver's last send-back, shown to the author. HQ stamps no review time (`at` null). */
  sentBack: { by: string; at: string | null; note: string } | null
  /** Who last saved the draft: HQ refuses them the approval too (`GUARDS_SELF_APPROVAL`). */
  lastEditedBy?: string | null
  /** There is a draft to ask about (`state` is not `none`). */
  exists?: boolean
  /** What the session may do — the authoring and approving grants. */
  viewer: { author: boolean; approver: boolean }
}

/** Where the draft stands, from the draft door's own fields. */
export function approvalOf(d: Pick<RulesetDraft<unknown>, 'revision' | 'state' | 'requestedBy' | 'requestedAt' | 'requestNote' | 'reviewedBy' | 'reviewNote' | 'updatedBy'>): DraftApproval {
  return {
    revision: d.revision,
    state: d.state === 'pending' ? 'waiting' : 'draft',
    submittedBy: d.requestedBy,
    submittedAt: d.requestedAt,
    note: d.requestNote,
    sentBack: d.state === 'sentBack' ? { by: d.reviewedBy ?? '', at: null, note: d.reviewNote ?? '' } : null,
    lastEditedBy: d.updatedBy,
    exists: d.state !== 'none',
    viewer: { author: true, approver: true },
  }
}

export type SubmitWhy = 'unsaved' | 'noBacktest' | 'backtestRunning' | 'backtestFailed' | 'backtestStale' | 'checking' | 'checks'
export type ApproveWhy = 'ownSubmission'

export type ApprovalAction =
  | { kind: 'submit'; enabled: boolean; why: SubmitWhy | null }
  | { kind: 'approve' | 'sendBack'; enabled: boolean; why: ApproveWhy | null }

export interface ActionsInput {
  approval: DraftApproval
  userId: string | null
  backtest: Pick<GuardBacktest, 'status' | 'revision'> | null | undefined
  /** `checksVerdict` of HQ's Validate on this revision; null while it is being asked. */
  checks: { errors: number; warnings: number; blocked: boolean } | null
  /** The guard draft waits for a back-test of its revision; a category / coverage draft has none (default true). */
  needsBacktest?: boolean
  /** Unsaved changes on screen: what is asked for is the SAVED revision, so save first. */
  dirty?: boolean
}

const STANDING_WHY = { none: 'noBacktest', running: 'backtestRunning', failed: 'backtestFailed', stale: 'backtestStale' } as const

export function actionsFor({ approval, userId, backtest, checks, needsBacktest = true, dirty = false }: ActionsInput): ApprovalAction[] {
  if (approval.state === 'draft') {
    if (!approval.viewer.author || approval.exists === false) return []
    const standing = needsBacktest ? backtestStanding(backtest, approval.revision) : 'current'
    const why: SubmitWhy | null = dirty
      ? 'unsaved'
      : standing !== 'current'
        ? STANDING_WHY[standing]
        : !checks
          ? 'checking'
          : checks.blocked
            ? 'checks'
            : null
    return [{ kind: 'submit', enabled: why === null, why }]
  }
  if (!approval.viewer.approver) return []
  const same = (who: string | null | undefined) => !!who && userId!.toLowerCase() === who.toLowerCase()
  const own = !userId || !approval.submittedBy || same(approval.submittedBy) || same(approval.lastEditedBy)
  const why: ApproveWhy | null = own ? 'ownSubmission' : null
  return [
    { kind: 'approve', enabled: !own, why },
    { kind: 'sendBack', enabled: !own, why },
  ]
}
