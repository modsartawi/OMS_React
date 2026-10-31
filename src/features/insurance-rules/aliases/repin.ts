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

// ── The doors as built (3294, 3297). A door row names a ruleset by its kind and groups its changes; the list shows one per change.

export interface RepinDoorChange {
  scope: string
  key: string
  oldPath?: string | null
  newPath?: string | null
  aliasesAdded?: unknown[] | null
  aliasesRemoved?: unknown[] | null
}

export interface RepinDoorAffected {
  kind: string
  versionNo: number
  pendingDraftId?: string | null
  changes?: RepinDoorChange[] | null
}

export interface LabelsDoorAffected {
  kind: string
  versionNo: number
  labelVersionNo: number
  latestLabelVersionNo: number
  pendingDraftId?: string | null
}

const changeKind = (c: RepinDoorChange): RepinKind => ((c.oldPath ?? '') === (c.newPath ?? '') && ((c.aliasesAdded?.length ?? 0) > 0 || (c.aliasesRemoved?.length ?? 0) > 0) ? 'alias' : 'path')
const orNull = (s: string | null | undefined): string | null => s || null

export function affectedRows(paths: readonly RepinDoorAffected[] | null | undefined, labels: readonly LabelsDoorAffected[] | null | undefined): AffectedRuleset[] {
  return [
    ...(paths ?? []).flatMap((r) =>
      (r.changes ?? []).map((c): AffectedRuleset => ({
        kind: changeKind(c),
        subject: `${c.scope}.${c.key}`,
        before: orNull(c.oldPath),
        after: orNull(c.newPath),
        changeId: c.key,
        rulesetId: r.kind,
        rulesetName: r.kind,
        rulesetVersion: r.versionNo,
        draftId: orNull(r.pendingDraftId),
      })),
    ),
    ...(labels ?? []).map((r): AffectedRuleset => ({
      kind: 'labels',
      subject: `${r.labelVersionNo} → ${r.latestLabelVersionNo}`,
      before: String(r.labelVersionNo),
      after: String(r.latestLabelVersionNo),
      changeId: 'labels',
      rulesetId: r.kind,
      rulesetName: r.kind,
      rulesetVersion: r.versionNo,
      draftId: orNull(r.pendingDraftId),
    })),
  ]
}

export interface RepinDoorDraft {
  id: string
  kind: string
  baseVersionNo: number
  state: string
  requestedBy?: string | null
  requestedAt?: string | null
  decidedBy?: string | null
  decidedAt?: string | null
  labelsOnly?: boolean
  labelVersionNo?: number
  changes?: RepinDoorChange[] | null
  labelChanges?: { texts?: { ruleId: string; enBefore?: string | null; enAfter?: string | null; arBefore?: string | null; arAfter?: string | null }[] | null } | null
  /** Counts per field and payer: the door keeps no per-bundle list. */
  backtest?: { rows?: { same?: number; gained?: number; lost?: number; changed?: number }[] | null }[] | null
}

const stamped = (at: string | null | undefined): string | null => (at && !at.startsWith('0001-') ? at : null)

export function draftOf(d: RepinDoorDraft): RepinDraft {
  const changes = d.changes ?? []
  const rows = (d.backtest ?? []).flatMap((b) => b.rows ?? [])
  const moved = rows.reduce((n, r) => n + (r.gained ?? 0) + (r.lost ?? 0) + (r.changed ?? 0), 0)
  return {
    id: d.id,
    kind: d.labelsOnly ? 'labels' : changes.length > 0 && changes.every((c) => changeKind(c) === 'alias') ? 'alias' : 'path',
    subject: changes.map((c) => `${c.scope}.${c.key}`).join(', '),
    before: d.labelsOnly ? null : orNull(changes.map((c) => c.oldPath).filter(Boolean).join(', ')),
    after: d.labelsOnly ? (d.labelVersionNo ? String(d.labelVersionNo) : null) : orNull(changes.map((c) => c.newPath).filter(Boolean).join(', ')),
    rulesetId: d.kind,
    rulesetName: d.kind,
    rulesetVersion: d.baseVersionNo,
    state: d.state === 'pending' ? 'open' : 'approved',
    createdBy: d.requestedBy ?? null,
    createdAt: stamped(d.requestedAt),
    approvedBy: orNull(d.decidedBy),
    approvedAt: stamped(d.decidedAt),
    backtest: d.labelsOnly ? null : { status: 'done', error: null, bundles: rows.reduce((n, r) => n + (r.same ?? 0), moved), changedTotal: moved, changes: [] },
    texts: (d.labelChanges?.texts ?? []).map((t) => ({ ruleId: t.ruleId, before: { en: t.enBefore ?? '', ar: t.arBefore ?? '' }, after: { en: t.enAfter ?? '', ar: t.arAfter ?? '' } })),
  }
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
