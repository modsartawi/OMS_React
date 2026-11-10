import type { AnalyticsFilter, AnalyticsLabel } from './analytics'

/**
 * The calculation wire (BackOffice spec 3519, decisions 1–3, 7, 15, 26) — in ONE place, so reconciling the web
 * against the real server (BackOffice 3520) is a change to this file. Tickets 861 (render) and 862 (editor) both
 * read it.
 *
 * Phase 2 (BackOffice spec 3543, ticket 863): `within` on a share, `variants` on the query, `variant` on a result
 * column and `untilReached` per parent — reconciled against the built server (3545, 3546: `AnalyticsWire.cs`).
 *
 * ⚠ Built against the spec's wire before 3520 merged. Assumptions to check against the server:
 * - the query field is `calculations` (camelCase, like every other query field), null/absent/empty = none;
 * - a calculated result column is `{ key, role: 'measure', shape: 'rate', unit: 'percent', calculation: { kind,
 *   measure, of } }`, and its values are PERCENT POINTS (42.5 means 42.5 %, decision 6's `× 100`), 4 dp, `null`
 *   for a zero or missing denominator;
 * - the result carries `untilReached` (boolean) only when a `cumulativeShare` has an `until`; absent = no note;
 * - the result column does NOT carry the label: the label is the query's `calculations[i].label` (matched by key),
 *   else derived by the web.
 */

export type AnalyticsCalculationKind = 'shareOfTotal' | 'ratio' | 'cumulativeShare' | 'change' | 'average'

/**
 * Spec 3543 part C (BackOffice 3550) adds `average`: `measure ÷ of` per row, NOT × 100, in the MEASURE's own unit (the
 * first calculated column whose unit is not percent — read `column.unit`, never assume percent).
 */
export const CALCULATION_KINDS: readonly AnalyticsCalculationKind[] = ['shareOfTotal', 'ratio', 'cumulativeShare', 'change', 'average']

/** Decision 1: at most four per query. */
export const MAX_CALCULATIONS = 4

/** Decision 1: a calculation's key. Unique in the query; never a measure or dimension key. */
export const CALCULATION_KEY_PATTERN = /^[a-z][A-Za-z0-9_]{0,39}$/

/** One entry of `AnalyticsSemanticQuery.calculations` (decision 1). */
export interface AnalyticsCalculation {
  key: string
  kind: AnalyticsCalculationKind
  /** A measure the query already selects. */
  measure: string
  /** `ratio` and `average` (3550): the denominator, also a selected measure. */
  of?: string | null
  /** `cumulativeShare` only: cut the rows once the running share reaches this percent (e.g. 80). */
  until?: number | null
  /**
   * Spec 3543 decision 1 (BackOffice 3545): `shareOfTotal` / `cumulativeShare` only — the query dimensions that make
   * each row's parent (some, never all). Absent = a share of the whole result, exactly as in 3519.
   */
  within?: string[] | null
  /** Both languages or neither; absent → the web derives one from the kind and the measure's label. */
  label?: AnalyticsLabel | null
}

/** Spec 3543 decision 5 (BackOffice 3546): at most four variants per query. */
export const MAX_VARIANTS = 4

/**
 * One entry of `AnalyticsSemanticQuery.variants` (decision 5): a model measure under its own filters, named by `key`.
 * The key follows the calculation key rule, never collides with a measure, dimension or calculation key, and MUST also
 * be listed in `query.measures` (the owner kept 3546's default: that is what selects and places its column). At least
 * one filter, never on a dimension the query breaks down by.
 */
export interface AnalyticsVariant {
  key: string
  measure: string
  filters: AnalyticsFilter[]
  /** Both languages or neither; absent → "{measure} ({filter values})". */
  label?: AnalyticsLabel | null
}

/** `AnalyticsColumn.variant` (3546): a variant column's origin, for its label. */
export interface AnalyticsColumnVariant {
  measure: string
  filters: AnalyticsFilter[]
  label?: AnalyticsLabel | null
}

/** Spec 3543 decision 3: one parent of a running share within, and whether its `until` was reached. */
export interface AnalyticsParentReached {
  /** The parent's values, keyed by the `within` dimension keys. */
  parent: Record<string, string>
  reached: boolean
}

/** `AnalyticsColumn.calculation` (decision 2): what the column was computed from, for its label. */
export interface AnalyticsColumnCalculation {
  kind: AnalyticsCalculationKind
  measure: string
  of?: string | null
  /** Spec 3543 (3545): the parent dimensions of a share within; absent otherwise. */
  within?: string[] | null
}

/**
 * Decision 2: a calculated column's shape and unit, when the column does not say. An `average` (spec 3543 decision 9)
 * carries its measure's own unit on the column, which wins.
 */
export const CALCULATION_SHAPE = 'rate' as const
export const CALCULATION_UNIT = 'percent' as const

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const isKind = (v: unknown): v is AnalyticsCalculationKind => CALCULATION_KINDS.includes(v as AnalyticsCalculationKind)

function readLabel(v: unknown): AnalyticsLabel | null {
  const l = obj(v)
  const en = str(l.en)
  const ar = str(l.ar)
  return en || ar ? { en, ar } : null
}

const readWithin = (v: unknown): string[] | null => {
  const keys = Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && !!k) : []
  return keys.length ? keys : null
}

function readFilters(v: unknown): AnalyticsFilter[] {
  return (Array.isArray(v) ? v : [])
    .map(obj)
    .map((f) => ({ dimension: str(f.dimension), values: Array.isArray(f.values) ? f.values.filter((x): x is string => typeof x === 'string') : [] }))
    .filter((f) => !!f.dimension && f.values.length > 0)
}

/**
 * The query's `calculations`, tolerantly: an entry without a key, a measure or a known kind is left out.
 * `undefined` when the wire has none, so a definition without calculations keeps its old object shape.
 */
export function readCalculations(raw: unknown): AnalyticsCalculation[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const list = raw
    .map(obj)
    .filter((c) => !!str(c.key) && !!str(c.measure) && isKind(c.kind))
    .map((c) => {
      const out: AnalyticsCalculation = { key: str(c.key), kind: c.kind as AnalyticsCalculationKind, measure: str(c.measure) }
      if (str(c.of)) out.of = str(c.of)
      if (typeof c.until === 'number' && Number.isFinite(c.until)) out.until = c.until
      const within = readWithin(c.within)
      if (within) out.within = within
      const label = readLabel(c.label)
      if (label) out.label = label
      return out
    })
  return list.length ? list : undefined
}

/** A result column's `calculation`, or `null` when it is not a calculated column. */
export function readColumnCalculation(raw: unknown): AnalyticsColumnCalculation | null {
  const c = obj(raw)
  if (!isKind(c.kind) || !str(c.measure)) return null
  const within = readWithin(c.within)
  return { kind: c.kind, measure: str(c.measure), ...(str(c.of) ? { of: str(c.of) } : {}), ...(within ? { within } : {}) }
}

/**
 * The query's `variants`, tolerantly: one without a key, a measure or a filter holding a value is left out (the server
 * refuses a variant with no filter). `undefined` when the wire has none, so an older definition keeps its shape.
 */
export function readVariants(raw: unknown): AnalyticsVariant[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const list = raw
    .map(obj)
    .map((v): AnalyticsVariant => {
      const out: AnalyticsVariant = { key: str(v.key), measure: str(v.measure), filters: readFilters(v.filters) }
      const label = readLabel(v.label)
      if (label) out.label = label
      return out
    })
    .filter((v) => !!v.key && !!v.measure && v.filters.length > 0)
  return list.length ? list : undefined
}

/** A result column's `variant`, or `null` when it is not a variant column. */
export function readColumnVariant(raw: unknown): AnalyticsColumnVariant | null {
  const v = obj(raw)
  if (!str(v.measure)) return null
  const label = readLabel(v.label)
  return { measure: str(v.measure), filters: readFilters(v.filters), ...(label ? { label } : {}) }
}

/**
 * The result's `untilReached`: a boolean (3519), the list per parent of a running share within (3545: each entry needs
 * a `parent` object and a boolean `reached`), or `undefined` when absent (no note).
 */
export function readUntilReached(raw: unknown): boolean | AnalyticsParentReached[] | undefined {
  if (typeof raw === 'boolean') return raw
  if (!Array.isArray(raw)) return undefined
  return raw
    .map(obj)
    .filter((p) => typeof p.reached === 'boolean' && !!p.parent && typeof p.parent === 'object' && !Array.isArray(p.parent))
    .map((p) => ({
      parent: Object.fromEntries(Object.entries(obj(p.parent)).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')])),
      reached: p.reached as boolean,
    }))
}

// ── Cross-area results (spec 3543 part D: BackOffice 3548, 3549) ─────────────────────────────────────────────

/**
 * `AnalyticsQueryResult.notSplit` (decision 12): a figure whose area cannot be split by some asked dimensions. Its value
 * is on the "All" rows (`isTotal: true`), never on the split rows. `notFiltered` (decision 18) has the same shape: a
 * figure left unfiltered by filters on dimensions its area lacks.
 */
export interface AnalyticsFigureDimensions {
  measure: string
  /** The dimensions, in the query's (notSplit) or the filters' (notFiltered) order. */
  by: string[]
}

/** The row key of an "All" row (decision 12); absent on every other row. */
export const IS_TOTAL_KEY = 'isTotal'

/** `notSplit` / `notFiltered`, tolerantly: an entry needs a measure and one dimension. `undefined` when absent, null or empty. */
export function readFigureDimensions(raw: unknown): AnalyticsFigureDimensions[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const list = raw
    .map(obj)
    .map((e) => ({ measure: str(e.measure), by: Array.isArray(e.by) ? e.by.filter((k): k is string => typeof k === 'string' && !!k) : [] }))
    .filter((e) => !!e.measure && e.by.length > 0)
  return list.length ? list : undefined
}

/** A column's `dateBasis` (decision 14), both languages or `null`. */
export const readDateBasis = (raw: unknown): AnalyticsLabel | null => readLabel(raw)
