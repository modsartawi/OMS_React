/**
 * Provenance: who minted a line, and who minted a condition (ticket 297).
 *
 * 🔑 **One column, and only one.** The source tag is a chip on every line row and
 * every condition row. The condition's own origin (`conditionSource`) is
 * deliberately NOT a second column — outside `sourceTag = pos` it is a
 * near-constant `M`, so a column of its own would be a wall of one letter
 * inviting the consultant to read *keyed by hand*. It rides as a small marked
 * letter beside the tag (BackOffice 1381).
 *
 * Pure — no React, no i18n, no network. The seam the ticket's Proof names, and
 * the spec's client-test ruling: vitest on pure modules only.
 */
import type { IDocInspectorCondition, IDocInspectorLine } from '@/core/models/idoc-inspector'

/**
 * How one source tag renders.
 *
 * ⚠️ **`""` is `unknown`, and never `pos`.** The ledger's source-provenance
 * convention defaults an untagged row to POS; this screen must not, because
 * doing so would make a provenance bug — the one thing this column exists to
 * catch — indistinguishable from a genuine POS line. The API sends `""`
 * verbatim for exactly this reason, and applying the default here would throw
 * that away one layer further down.
 *
 * A `null` or absent tag reads as `unknown` too: a field that failed to arrive
 * is no more a POS line than an empty one is.
 */
export type SourceTagDisplay = { kind: 'unknown' } | { kind: 'tag'; code: string }

/** One spelling of "what this tag actually is" — trimmed, and an absent tag is
 *  the empty one. Every comparison below goes through it so the filter bar's
 *  buttons and the rows they match can never read the same value differently. */
const normaliseTag = (tag: string | null | undefined): string => (tag ?? '').trim()

/** The one reading of the rule above, shared by the line rows and the condition
 *  rows so the two can never disagree about what an empty tag means. */
export function sourceTagDisplay(tag: string | null | undefined): SourceTagDisplay {
  const code = normaliseTag(tag)
  return code === '' ? { kind: 'unknown' } : { kind: 'tag', code }
}

/**
 * The **filter bar's** vocabulary: every distinct tag present on this
 * document's lines and their conditions, in first-seen order.
 *
 * 🚩 First-seen order rather than sorted, so the bar is stable against a
 * re-render and reads down the document the way the document reads. `""` is a
 * value like any other and gets its own button — *unknown* is precisely what a
 * consultant hunting a provenance bug filters for.
 *
 * ⚠️ **Trimmed, and it must be**: the tag comes off a fixed-width column, so a
 * padded value and a clean one are the same tag. `sourceTagDisplay` trims, so
 * without this the bar could offer two visually identical buttons — including
 * two *unknown* ones — of which only one would ever match anything.
 */
export function mintedByTags(lines: readonly IDocInspectorLine[]): string[] {
  const seen: string[] = []
  const add = (tag: string | null | undefined) => {
    const normalised = normaliseTag(tag)
    if (!seen.includes(normalised)) seen.push(normalised)
  }
  for (const line of lines) {
    add(line.sourceTag)
    for (const condition of line.conditions) add(condition.sourceTag)
  }
  return seen
}

/**
 * Does this line survive the filter?
 *
 * 🔑 **A line survives if IT or ANY OF ITS CONDITIONS carries the tag.** Filtering
 * lines on their own tag alone would hide the line whose *fee condition* an
 * enricher minted — which is the commonest question the filter is asked, and the
 * one it would then be unable to answer.
 */
export function lineMatchesTag(line: IDocInspectorLine, tag: string): boolean {
  return (
    normaliseTag(line.sourceTag) === tag ||
    line.conditions.some((condition) => normaliseTag(condition.sourceTag) === tag)
  )
}

/** The lines to draw. `null` — no filter — is the whole document, untouched. */
export function filterLines(
  lines: readonly IDocInspectorLine[],
  tag: string | null,
): IDocInspectorLine[] {
  return tag === null ? [...lines] : lines.filter((line) => lineMatchesTag(line, tag))
}

/**
 * The conditions to draw inside an open line, and how many there are in total.
 *
 * 🚩 The expansion of a filtered line shows only the matching conditions **and
 * says `3 of 7`** — the count is what stops a filter from reading as a document
 * that only ever had three conditions.
 */
export function conditionsForTag(
  line: IDocInspectorLine,
  tag: string | null,
): { shown: IDocInspectorCondition[]; total: number; filtered: boolean } {
  const total = line.conditions.length
  if (tag === null) return { shown: [...line.conditions], total, filtered: false }
  return {
    shown: line.conditions.filter((condition) => normaliseTag(condition.sourceTag) === tag),
    total,
    filtered: true,
  }
}
