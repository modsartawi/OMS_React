// The approval by role (BackOffice door 3139; oms 611 for the guard ruleset, review 3126 P6b for the category and
// coverage rulesets on "the same authoring doors"). Pure: no React, no `t`.
//
// A ruleset is ONE document: an author asks for approval of the saved draft as a whole (`POST …/Submit { note }`),
// and a DIFFERENT user approves it or sends it back. The guard draft also waits for a back-test of the current
// revision (`./backtest`); every draft waits for HQ's checks to show no error (`checksVerdict`: warnings never block).
//
// PROVISIONAL (611), 618 reconciles: the brief has no door that says where the draft stands nor who the viewer is.
// Guessed `GET InsuranceRules/{Guards|Categories|Coverage}/Approval` -> `DraftApproval` below; `viewer` stands in for
// the authoring / approving grants until 618's access probe, and `backtestId` names the guard draft's latest back-test.
import { backtestStanding, type GuardBacktest } from './backtest'

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
  /** The draft's latest back-test (612's job id), or null when it was never back-tested. ⚠️ GUESSED field. */
  backtestId: string | null
  /** What the session may do — the authoring and approving grants. */
  viewer: { author: boolean; approver: boolean }
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
    if (!approval.viewer.author) return []
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
  const own = !userId || !approval.submittedBy || userId.toLowerCase() === approval.submittedBy.toLowerCase()
  const why: ApproveWhy | null = own ? 'ownSubmission' : null
  return [
    { kind: 'approve', enabled: !own, why },
    { kind: 'sendBack', enabled: !own, why },
  ]
}
