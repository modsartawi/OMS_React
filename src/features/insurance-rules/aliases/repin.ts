/**
 * A re-pin draft (ticket 705; BackOffice spec 3271 stories 22, 23, D8, D11, door 3294). A published ruleset runs on the
 * paths and aliases copied in at publish; a changed registry row or alias reaches it only through a draft, back-tested
 * old against new over the kept bundles and approved by someone else. Until then it runs as pinned. Pure.
 */
import { authorshipOf } from '@/core/insurance-rules/approval'
import type { BacktestStatus } from '@/core/insurance-rules/backtest'
import type { Says } from '@/core/models/rule-campaign'

/** `labels` (708; L9, door 3297): only the label version moves, so the draft shows text and carries no back-test. */
export type RepinKind = 'path' | 'alias' | 'labels'
export const REPIN_KINDS: readonly RepinKind[] = ['path', 'alias', 'labels']

/** A labels-only draft can change no decision, so the back-test is not asked of it. */
export const repinNeedsBacktest = (kind: RepinKind): boolean => kind !== 'labels'

/** One rule's text as the pinned label version renders it, and as the new one would. */
export interface RepinLabelText {
  ruleId: string
  before: Says
  after: Says
}

/** One language of one rule whose text moves. An empty side means that language had, or will have, no text. */
export interface RepinTextPair {
  ruleId: string
  lang: 'en' | 'ar'
  before: string
  after: string
}

/** The before / after pairs of a labels-only draft: only what moves, in the door's rule order, English first. */
export function labelPairs(texts: readonly RepinLabelText[] | null | undefined): RepinTextPair[] {
  return (texts ?? []).flatMap((t) =>
    (['en', 'ar'] as const).filter((lang) => t.before[lang] !== t.after[lang]).map((lang) => ({ ruleId: t.ruleId, lang, before: t.before[lang], after: t.after[lang] })),
  )
}

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
  /** A labels-only draft: each rule's text before and after. `before` / `after` above are then its label versions. */
  texts?: RepinLabelText[] | null
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
export function repinStanding(draft: Pick<RepinDraft, 'kind' | 'state' | 'createdBy' | 'backtest'>, userId: string | null): RepinStanding {
  if (draft.state !== 'open') return 'none'
  if (repinNeedsBacktest(draft.kind) && draft.backtest?.status !== 'done') return 'noBacktest'
  return authorshipOf(userId, draft.createdBy) === 'other' ? 'may' : 'ownDraft'
}
