/**
 * Reading the code legend (ticket 300, BackOffice 1392).
 *
 * 🔑 **Every code renders RAW, with its label beside it — never the label
 * alone.** A consultant reading this screen is holding a SAP ticket open beside
 * it and needs the literal value to paste into it. A screen that shows only a
 * friendly name is unusable for the job it exists for, so nothing in this module
 * can return a label without the code it belongs to.
 *
 * 🔑 **No vocabulary is compiled into this bundle.** The nine closed vocabularies
 * are generated server-side off the pipeline's own C# constants and arrive whole
 * on `IDocInspector/Metadata`; this repo is on its own release cadence, so a copy
 * here — even a copy of only the *labels* — would be wrong the first time a
 * constant changes. What follows indexes what arrived and reads it. There is no
 * member of any vocabulary written down in this file, and there is deliberately
 * no fallback table for a legend that failed to load: a missing label means the
 * code renders alone, which is the honest answer and still the useful one.
 *
 * ⚠️ The **condition type** is not here at all. It is open master data — a
 * pricing analyst adds one without a deployment — and its description arrives
 * already resolved on each condition row. See `conditionTypeMeaning`.
 *
 * Pure — no React, no i18n, no network. The seam the ticket's Proof names.
 */
import type {
  IDocInspectorCodeValue,
  IDocInspectorLegend,
  IDocInspectorMetadata,
} from '@/core/models/idoc-inspector'

/** One of the nine. Derived from the wire type, so a vocabulary added or renamed
 *  server-side is a compile error here rather than a silently dead lookup. */
export type CodeVocabulary = keyof IDocInspectorLegend

/**
 * ⚠️ **The empty string is a first-class VALUE, meaning something different in
 * every vocabulary that persists one, and one grey dash for all of them is
 * misinformation.** The LEGEND carries three of them; the ticket's three are a
 * *different* three, because its third is the one blank the legend deliberately
 * does not carry:
 *
 * | `""` in | means | drawn as |
 * |---|---|---|
 * | `sourceTag` | a pre-feature row — provenance unknown, **never `pos`** | a dimmed `unknown` chip |
 * | `errorType` | **no error** — the ordinary case, not a finding | ticket 298's, with the banner that reads it |
 * | `discTypeCode` | no SAP mapping was found — **a defect** | attention ink, beside its own column |
 * | `conditionSource` | the engine stamped no origin | ⚠️ **nothing** — see below |
 *
 * ⚠️ **The condition-source blank draws as nothing, and that is a decision rather
 * than a gap.** It appears only beside a source tag, so an empty one would put a
 * second dimmed mark next to the tag's own *unknown* — two kinds of nothing on
 * one row, which reads as one fact told twice. `describeCode` still names it,
 * because the legend genuinely carries it and a model denying that would be a lie
 * about the wire; what the screen does with it is `ConditionProvenance`'s.
 *
 * `discTypeCode` is absent from the legend for a reason of its own — it is derived
 * from a map each billing type may override — so it has a separate reading below,
 * `discTypeCodeDisplay`, precisely so the two can never be confused.
 *
 * The legend carries a `name` for each blank it does hold (`SourceUnknown` /
 * `OriginNotSet` / `NoError`), but the screen's wording is the locale file's:
 * blanks are the one part of this the client owns, because they are meanings
 * rather than members.
 */
export type BlankVocabulary = Extract<
  CodeVocabulary,
  'sourceTag' | 'conditionSource' | 'errorType'
>

/** ⚠️ `Extract`, not a fresh union: a vocabulary renamed server-side then fails to
 *  compile here rather than quietly losing its blank's meaning. */
const BLANK_VOCABULARIES: ReadonlySet<CodeVocabulary> = new Set<CodeVocabulary>([
  'sourceTag',
  'conditionSource',
  'errorType',
])

/**
 * How one code renders: **the code, always**, plus whatever the legend could say
 * about it.
 *
 * `label` is `null` when the legend does not carry this code — a value persisted
 * before the constant existed, or a legend that never loaded. The code then
 * renders alone; nothing is invented to fill the gap.
 */
export interface CodeDisplay {
  /** The raw, persisted value — trimmed of the fixed-width column's padding, and
   *  otherwise untouched. This is what renders, always. */
  code: string
  /** The legend's `name` for it, or `null` when the legend does not carry it. */
  label: string | null
  /** Set only when `code` is `""` **and** this vocabulary persists one — which of
   *  the three meanings applies. The caller resolves its own copy from it. */
  blank: BlankVocabulary | null
}

/**
 * The legend, indexed for lookup.
 *
 * Opaque on purpose: the components take one of these and ask it questions, so
 * the shape of the index can change without touching a render site.
 */
export interface LegendIndex {
  /** vocabulary → (code → name) */
  readonly by: ReadonlyMap<CodeVocabulary, ReadonlyMap<string, string>>
}

/** An index over nothing — what a screen renders with while the legend is still
 *  in flight, or after it failed. Every code then renders alone, which is what
 *  the raw-code-always rule makes safe. */
export const EMPTY_LEGEND: LegendIndex = { by: new Map() }

const indexVocabulary = (
  values: IDocInspectorCodeValue[] | null | undefined,
): ReadonlyMap<string, string> => {
  const map = new Map<string, string>()
  for (const value of values ?? []) {
    // 🚩 Trimmed on the way IN as well as on the way out. These come off
    // fixed-width columns at both ends, so an indexed `"pos "` would never match
    // a rendered `"pos"` and the label would silently vanish.
    if (value && typeof value.code === 'string') map.set(value.code.trim(), value.name)
  }
  return map
}

/**
 * Index what `Metadata` answered.
 *
 * ⚠️ Tolerant of a missing half — a legend that arrives without one of the nine,
 * or does not arrive at all, must degrade to *unlabelled codes* and never to a
 * blank screen. The codes are what the consultant came for.
 */
export function indexLegend(metadata: IDocInspectorMetadata | null | undefined): LegendIndex {
  const legend = metadata?.legend
  if (!legend) return EMPTY_LEGEND
  const by = new Map<CodeVocabulary, ReadonlyMap<string, string>>()
  for (const vocabulary of Object.keys(legend) as CodeVocabulary[]) {
    by.set(vocabulary, indexVocabulary(legend[vocabulary]))
  }
  return { by }
}

/**
 * How this code renders in this vocabulary.
 *
 * 🔑 The code comes back **whatever happens** — legend loaded or not, code known
 * or not. That is the one invariant this whole module exists to hold.
 */
export function describeCode(
  index: LegendIndex,
  vocabulary: CodeVocabulary,
  code: string | null | undefined,
): CodeDisplay {
  const raw = (code ?? '').trim()
  const label = index.by.get(vocabulary)?.get(raw) ?? null
  return {
    code: raw,
    label,
    blank:
      raw === '' && BLANK_VOCABULARIES.has(vocabulary) ? (vocabulary as BlankVocabulary) : null,
  }
}

/**
 * A condition type's meaning — the one code on this screen that does **not** come
 * from the legend.
 *
 * 🔑 Condition types are **open master data**: a pricing analyst adds one without
 * a deployment, so a closed legend of them would be stale by design. The server
 * resolves the description per row from the estate's own condition-type table.
 *
 * ⚠️ **No description ⇒ the code alone. Never invent one**, and never fall back to
 * the code as its own description — a code echoed into the meaning column reads
 * as a table that has an answer when it does not.
 */
export function conditionTypeMeaning(description: string | null | undefined): string | null {
  const meaning = (description ?? '').trim()
  return meaning === '' ? null : meaning
}

/**
 * The SAP posting code a condition was mapped to — and the **third** first-class
 * empty string, which is neither of the legend's two.
 *
 * ⚠️ **Empty means no mapping was found, and that is a defect**, not an absence.
 * `discTypeCode` is derived from a mapping each billing type may override, so it
 * is deliberately absent from the legend (BackOffice 1392): a closed list of it
 * could disagree with what was actually posted. The blank therefore gets its
 * meaning here, beside its own column, exactly as the spec says it should.
 */
export type DiscTypeCodeDisplay = { kind: 'unmapped' } | { kind: 'code'; code: string }

export function discTypeCodeDisplay(code: string | null | undefined): DiscTypeCodeDisplay {
  const raw = (code ?? '').trim()
  return raw === '' ? { kind: 'unmapped' } : { kind: 'code', code: raw }
}
