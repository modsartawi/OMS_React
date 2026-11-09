import type { HybrisStockPreviewOutcome, HybrisStockPreviewRow, HybrisStockUploadPreview } from '@/core/models/hybris-stock'

// The material upload's preview, as the dialog reads it (spec 3447 stories 13–17; ticket 848). Pure.
//
// The server classifies each row new / changed / unchanged / refused and the commit applies exactly
// that preview. This module turns the answer into what the dialog shows: the four counts (from the
// ROWS — the list the user reads — never from a `counts` block that could disagree with it), the rows
// grouped in a fixed order, each refused row's reason as a key, and whether there is anything to
// commit. An upload never deletes: a material absent from the file is untouched, and nothing here
// computes a removal.

export const OUTCOMES: readonly HybrisStockPreviewOutcome[] = ['new', 'changed', 'unchanged', 'refused']

/** The contract's refusals, named in the dialog's own words (`malformed` covers a bad number AND an
 *  enabled value not in the table); any other word reads as `other`. */
export const REFUSAL_KINDS = ['unknownMaterial', 'malformed', 'repeated', 'other'] as const
export type RefusalKind = (typeof REFUSAL_KINDS)[number]

export function refusalKind(refusal: string | null | undefined): RefusalKind {
  return (REFUSAL_KINDS as readonly string[]).includes(refusal ?? '') ? (refusal as RefusalKind) : 'other'
}

/** What a changed row changes: an upload carries only the enabled column, so it is enable or disable. */
export type ChangeKind = 'enable' | 'disable' | null

export function changeKind(row: Pick<HybrisStockPreviewRow, 'outcome' | 'enabled' | 'currentEnabled'>): ChangeKind {
  if (row.outcome !== 'changed' || row.enabled === null) return null
  return row.enabled ? 'enable' : 'disable'
}

/** The state a row leaves the material in: the file's ask, else the list's state, else enabled (a new
 *  material whose row states nothing is added enabled). */
export function rowState(row: Pick<HybrisStockPreviewRow, 'enabled' | 'currentEnabled'>): boolean {
  return row.enabled ?? row.currentEnabled ?? true
}

export interface PreviewSummary {
  counts: Record<HybrisStockPreviewOutcome, number>
  /** The rows of each outcome, in file order. */
  groups: Record<HybrisStockPreviewOutcome, HybrisStockPreviewRow[]>
  /** How many refused rows each reason accounts for, the named reasons in a fixed order. */
  refusals: { kind: RefusalKind; count: number }[]
  /** Something to apply: at least one new or changed row. A file of only unchanged / refused rows commits nothing. */
  canCommit: boolean
  /** The server's `counts` disagreed with its rows — shown, never silently trusted. */
  countsMismatch: boolean
}

export function previewSummary(preview: Pick<HybrisStockUploadPreview, 'rows' | 'counts'>): PreviewSummary {
  const rows = preview.rows ?? []
  const groups = Object.fromEntries(OUTCOMES.map((o) => [o, [] as HybrisStockPreviewRow[]])) as Record<HybrisStockPreviewOutcome, HybrisStockPreviewRow[]>
  for (const row of rows) {
    // An outcome the door does not name is not applied by anything we show — read it as refused.
    const outcome = OUTCOMES.includes(row.outcome) ? row.outcome : 'refused'
    groups[outcome].push(row)
  }
  const counts = Object.fromEntries(OUTCOMES.map((o) => [o, groups[o].length])) as Record<HybrisStockPreviewOutcome, number>
  const byKind = new Map<RefusalKind, number>()
  for (const row of groups.refused) byKind.set(refusalKind(row.refusal), (byKind.get(refusalKind(row.refusal)) ?? 0) + 1)
  const refusals = REFUSAL_KINDS.filter((k) => byKind.has(k)).map((kind) => ({ kind, count: byKind.get(kind)! }))
  const server = preview.counts
  const countsMismatch = !!server && OUTCOMES.some((o) => typeof server[o] === 'number' && server[o] !== counts[o])
  return { counts, groups, refusals, canCommit: counts.new + counts.changed > 0, countsMismatch }
}
