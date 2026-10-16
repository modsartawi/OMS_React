// The Pick support diagnosis panel's pure readings (ticket 496, brief 2691). No React, no `t`.
//
// 🚩 BackOffice decides every word (the brief's rules 1–6). Nothing here maps a code to a
// sentence or decides whether a fix is still valid: it only says WHICH state a verdict card
// takes, whether a stamp was ever written, and how the timeline narrows.

import {
  PICK_SUPPORT_HOLDS,
  PICK_SUPPORT_TIMELINE_SOURCES,
  type PickSupportDiagnosis,
  type PickSupportDonorRequest,
  type PickSupportShapeMatch,
  type PickSupportTimelineEntry,
} from '@/core/models/pick-support'

/**
 * The verdict card's state (the brief's panel §1, rule 5):
 * - `stuck` — one card per shape, in the server's order, each with its own fix slot (497);
 * - `healthy` — the quiet "Nothing is stuck";
 * - `escalate` — UNKNOWN, any verdict the client does not know, and STUCK with no shape to fix.
 *   It carries no fix slot by construction: only the copy-diagnosis button.
 */
export type VerdictView =
  | { kind: 'stuck'; cards: PickSupportShapeMatch[] }
  | { kind: 'healthy' }
  | { kind: 'escalate' }

export function verdictView(d: Pick<PickSupportDiagnosis, 'verdict' | 'shapes'>): VerdictView {
  const shapes = d.shapes ?? []
  if (d.verdict === 'STUCK' && shapes.length > 0) return { kind: 'stuck', cards: shapes }
  if (d.verdict === 'HEALTHY') return { kind: 'healthy' }
  return { kind: 'escalate' }
}

/**
 * A stamp as it is shown (rule 6): exactly as sent — local wall clock, never parsed into a `Date`,
 * never converted — or `null` (the dash) when it was never written: blank, or the column's floor
 * (`0001-01-01T00:00:00`, or any year ≤ 1900).
 */
export function readStamp(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  if (!v) return null
  const year = /^(\d{1,4})-/.exec(v)
  if (year && Number(year[1]) <= 1900) return null
  return v
}

/**
 * A donor request's transfer (the brief's panel §5): `started` when the STO is set and the posted
 * time is still at the floor, `posted` once both are set, `none` without an STO.
 */
export type TransferView =
  | { kind: 'none' }
  | { kind: 'started'; stoNo: string }
  | { kind: 'posted'; stoNo: string; at: string; sapDocumentNo: string }

export function transferView(
  r: Pick<PickSupportDonorRequest, 'transferStoNo' | 'transferredAt' | 'transferSapDocumentNo'>,
): TransferView {
  const stoNo = (r.transferStoNo ?? '').trim()
  if (!stoNo) return { kind: 'none' }
  const at = readStamp(r.transferredAt)
  if (at === null) return { kind: 'started', stoNo }
  return { kind: 'posted', stoNo, at, sapDocumentNo: r.transferSapDocumentNo ?? '' }
}

/** The timeline's two filters: one source (blank = all) and text over `key`. */
export interface TimelineFilter {
  source: string
  key: string
}

/**
 * The timeline narrowed by source and by a trimmed, case-blind contains over `key` — in the
 * server's order, each entry passed through as it came (so `reconstructed` is carried).
 */
export function filterTimeline(entries: readonly PickSupportTimelineEntry[], filter: TimelineFilter): PickSupportTimelineEntry[] {
  const needle = filter.key.trim().toLowerCase()
  return entries.filter(
    (e) => (!filter.source || e.source === filter.source) && (!needle || (e.key ?? '').toLowerCase().includes(needle)),
  )
}

/** The source filter's options: the three known sources, then any unlisted one the list holds. */
export function timelineSources(entries: readonly PickSupportTimelineEntry[]): string[] {
  const known: readonly string[] = PICK_SUPPORT_TIMELINE_SOURCES
  const extra = [...new Set(entries.map((e) => e.source).filter((s) => s && !known.includes(s)))]
  return [...known, ...extra]
}

/**
 * How a serial hold is shown (the brief's hold table): the three legitimate holds are neutral,
 * STUCK is a warning that links to its delivery, and UNKNOWN — or any hold the client does not
 * know — reads as escalate.
 */
export type HoldView = 'neutral' | 'stuck' | 'escalate'

const HOLD_VIEW: Record<(typeof PICK_SUPPORT_HOLDS)[number], HoldView> = {
  LIVE_PICK: 'neutral',
  PUT_BACK_BASKET: 'neutral',
  CENTRAL_INVOICED: 'neutral',
  STUCK: 'stuck',
  UNKNOWN: 'escalate',
}

export function holdView(hold: string): HoldView {
  return (PICK_SUPPORT_HOLDS as readonly string[]).includes(hold) ? HOLD_VIEW[hold as keyof typeof HOLD_VIEW] : 'escalate'
}
