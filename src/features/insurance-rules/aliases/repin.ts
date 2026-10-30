/**
 * A re-pin draft (ticket 705; BackOffice spec 3271 stories 22, 23, D8, D11, door 3294). A published ruleset runs on the
 * paths and aliases copied in at publish; a changed registry row or alias reaches it only through a draft, back-tested
 * old against new over the kept bundles and approved by someone else. Until then it runs as pinned. Pure.
 */
import type { BacktestStatus } from '@/core/insurance-rules/backtest'

/** 708 adds the labels-only kind, which carries no back-test. */
export type RepinKind = 'path' | 'alias'
export const REPIN_KINDS: readonly RepinKind[] = ['path', 'alias']

/** The decisions the words exist for. Another value from the door is shown as sent. */
export const REPIN_DECISIONS = ['PASS', 'WARN', 'OVERRIDE', 'REFUSE', 'NOT_EVALUATED'] as const
export const knownDecision = (d: string): boolean => (REPIN_DECISIONS as readonly string[]).includes(d)

/** What moves: the path of a field, or what a payer's URL is read as. `before` null means nothing was pinned. */
export interface RepinChange {
  kind: RepinKind
  /** The field key, or the payer and wrong URL as one machine pair. */
  subject: string
  before: string | null
  after: string | null
}

/** A published ruleset still on the old form. `draftId` is its open draft, when someone raised one. */
export interface AffectedRuleset extends RepinChange {
  changeId: string
  rulesetId: string
  rulesetName: string
  rulesetVersion: number
  draftId: string | null
}

/** One kept bundle whose decision would move. */
export interface RepinBacktestChange {
  bundleId: string
  /** Local day, `yyyy-MM-dd`. */
  on: string
  payer: string
  ruleId: string
  /** As HQ masks it; `maskedKey()` masks it again on the way to the screen. */
  maskedKey: string
  before: string
  after: string
}

export interface RepinBacktest {
  status: BacktestStatus
  /** HQ's words when it failed. */
  error: string | null
  /** Kept bundles replayed. */
  bundles: number
  /** Every bundle whose decision moved; `changes` holds the first of them. */
  changedTotal: number
  changes: RepinBacktestChange[]
}

export interface RepinDraft extends RepinChange {
  id: string
  rulesetId: string
  rulesetName: string
  rulesetVersion: number
  state: 'open' | 'approved'
  createdBy: string | null
  /** Local moment. */
  createdAt: string | null
  approvedBy: string | null
  /** Local moment. */
  approvedAt: string | null
  backtest: RepinBacktest | null
}

export interface RepinMove {
  from: string
  to: string
  count: number
}

export interface RepinSummary {
  bundles: number
  changed: number
  unchanged: number
  /** How the decisions moved, the most common first, over the lines that arrived. */
  moves: RepinMove[]
  shown: number
  /** HQ counted more changes than it sent, so `moves` is partial. */
  truncated: boolean
}

/** The old-against-new summary. A line whose decision did not move is no change, whatever the door counted. */
export function repinSummary(bt: Pick<RepinBacktest, 'bundles' | 'changedTotal' | 'changes'>): RepinSummary {
  const moved = bt.changes.filter((c) => c.before !== c.after)
  const changed = Math.max(moved.length, bt.changedTotal - (bt.changes.length - moved.length))
  const moves: RepinMove[] = []
  for (const c of moved) {
    const move = moves.find((m) => m.from === c.before && m.to === c.after)
    if (move) move.count++
    else moves.push({ from: c.before, to: c.after, count: 1 })
  }
  moves.sort((a, b) => b.count - a.count)
  return { bundles: bt.bundles, changed, unchanged: Math.max(0, bt.bundles - changed), moves, shown: moved.length, truncated: changed > moved.length }
}

export type RepinStanding = 'may' | 'ownDraft' | 'noBacktest' | 'none'

/**
 * What this user is offered on a draft. No one approves before the difference can be seen, so an unfinished back-test
 * comes first. The client only hides the action: HQ still decides.
 */
export function repinStanding(draft: Pick<RepinDraft, 'state' | 'createdBy' | 'backtest'>, userId: string | null): RepinStanding {
  if (draft.state !== 'open') return 'none'
  if (draft.backtest?.status !== 'done') return 'noBacktest'
  if (!userId || !draft.createdBy) return 'ownDraft'
  return userId.toLowerCase() === draft.createdBy.toLowerCase() ? 'ownDraft' : 'may'
}
