import type { GuardLineOutcome } from '@/core/insurance-rules/guard-check'
import { GUARD_LINE_OUTCOMES } from '@/core/insurance-rules/guard-check'
import type { CategorySource, ResolvedSource } from '@/core/insurance-rules/coverage-model'
import { RESOLVED_SOURCES } from '@/core/insurance-rules/coverage-model'
import { GUARD_SEVERITIES, type GuardSeverity } from '@/core/insurance-rules/model'
import type { PlaygroundKind } from '@/core/insurance-rules/playground'

// The Evaluate reply's `verdict` → Tab B, "What the live check would say" (oms ticket 678). Pure. Shapes as the
// brief's HQ contract draws them (3244 guard, 3245 coverage/category), with the field names of the doors they mirror
// (3134 Guards/Check, 3146 Coverage/Resolve, 3145 Categories/Simulate); 691 reconciles them with the door as built.
//   guard:    [{ line, outcome, fired: [{ ruleId, severity, en, ar, … }] }]
//   coverage: { lines: [{ line, covered, priorApproval, deductiblePercent, deductibleMax, priceCap, quantityCap,
//               daysSupplyCap }], invoice: { segment, exceptionPrescriptions } }, each value `{ value, source, ruleId }`
//   category: [{ line, category, group, source, ruleId, unknowns[] }]
// Defensive like `outcomeView`: a list may come bare or as `{ lines }`, a line without a number takes its place from 1.

export interface FiredView {
  ruleId: string
  severity: GuardSeverity | null
  /** The rule's message as the engine filled it, EN + AR; null when HQ sent only the id. */
  message: { en: string; ar: string } | null
}

export interface GuardVerdictLine {
  line: number
  /** null when HQ sent an outcome the screen has no word for. */
  outcome: GuardLineOutcome | null
  fired: FiredView[]
}

export type CoverageValueType = 'yesNo' | 'money' | 'number' | 'percent' | 'text'

export interface CoverageCell {
  key: string
  type: CoverageValueType
  value: boolean | number | string | null
  /** Where it came from; null when HQ sent the bare value with no source. */
  source: ResolvedSource | null
  ruleId: string | null
}

export interface CategoryVerdictLine {
  line: number
  category: string | null
  group: string | null
  source: CategorySource
  /** The category rule that set it — only when a rule did. */
  ruleId: string | null
  unknowns: string[]
}

export type VerdictView =
  | { kind: 'none' }
  | { kind: 'guard'; lines: GuardVerdictLine[] }
  | { kind: 'coverage'; lines: { line: number; values: CoverageCell[] }[]; invoice: CoverageCell[] }
  | { kind: 'category'; lines: CategoryVerdictLine[] }

const NONE: VerdictView = { kind: 'none' }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)
const lineNo = (l: Obj, i: number) => (typeof l.line === 'number' ? l.line : i + 1)

/** A verdict list, bare or wrapped in `{ lines }`; null when it is neither. */
function linesOf(v: unknown): Obj[] | null {
  const list = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.lines) ? v.lines : null
  return list ? list.map((l) => (isObj(l) ? l : {})) : null
}

const oneOf = <T extends string>(all: readonly T[], v: unknown): T | null => ((all as readonly unknown[]).includes(v) ? (v as T) : null)

function fired(f: unknown): FiredView | null {
  if (typeof f === 'string') return f ? { ruleId: f, severity: null, message: null } : null
  if (!isObj(f) || !str(f.ruleId)) return null
  const en = str(f.en)
  const ar = str(f.ar)
  return { ruleId: str(f.ruleId)!, severity: oneOf(GUARD_SEVERITIES, f.severity), message: en || ar ? { en: en ?? '', ar: ar ?? '' } : null }
}

function guardView(v: unknown): VerdictView {
  const lines = linesOf(v)
  if (!lines?.length) return NONE
  return {
    kind: 'guard',
    lines: lines.map((l, i) => ({
      line: lineNo(l, i),
      outcome: oneOf(GUARD_LINE_OUTCOMES, l.outcome),
      fired: (Array.isArray(l.fired) ? l.fired : []).map(fired).filter((f): f is FiredView => f !== null),
    })),
  }
}

/** The coverage values in the order the tab draws them, each with its kind of value. */
const LINE_VALUES: readonly [string, CoverageValueType][] = [
  ['covered', 'yesNo'],
  ['priorApproval', 'yesNo'],
  ['deductiblePercent', 'percent'],
  ['deductibleMax', 'money'],
  ['priceCap', 'money'],
  ['quantityCap', 'number'],
  ['daysSupplyCap', 'number'],
]
const INVOICE_VALUES: readonly [string, CoverageValueType][] = [
  ['segment', 'text'],
  ['exceptionPrescriptions', 'yesNo'],
]
/** The keys the tab names (`verdict.coverage.values.<key>`). */
export const COVERAGE_LINE_KEYS = LINE_VALUES.map(([k]) => k)
export const COVERAGE_INVOICE_KEYS = INVOICE_VALUES.map(([k]) => k)

function scalar(v: unknown, type: CoverageValueType): CoverageCell['value'] {
  if (type === 'yesNo') return typeof v === 'boolean' ? v : null
  if (type === 'text') return str(v)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function cell(key: string, type: CoverageValueType, raw: unknown): CoverageCell {
  if (raw === undefined || raw === null) return { key, type, value: null, source: 'none', ruleId: null }
  if (isObj(raw) && ('value' in raw || 'source' in raw)) {
    return { key, type, value: scalar(raw.value, type), source: oneOf(RESOLVED_SOURCES, raw.source), ruleId: str(raw.ruleId) }
  }
  return { key, type, value: scalar(raw, type), source: null, ruleId: null }
}

/** A line, with a deductible spelled as the effect (`deductible: { value: { percent, max } }`) unfolded. */
function coverageLine(l: Obj): Obj {
  const d = l.deductible
  if (!isObj(d) || 'deductiblePercent' in l || 'deductibleMax' in l) return l
  const inner = isObj(d.value) ? d.value : d
  const wrap = (v: unknown) => (isObj(d.value) ? { value: v, source: d.source, ruleId: d.ruleId } : v)
  return { ...l, deductiblePercent: wrap(inner.percent), deductibleMax: wrap(inner.max) }
}

function coverageView(v: unknown): VerdictView {
  if (!isObj(v)) return NONE
  const lines = (Array.isArray(v.lines) ? v.lines : []).map((l) => (isObj(l) ? coverageLine(l) : {}))
  const invoice = isObj(v.invoice) ? v.invoice : {}
  return {
    kind: 'coverage',
    lines: lines.map((l, i) => ({ line: lineNo(l, i), values: LINE_VALUES.map(([k, t]) => cell(k, t, l[k])) })),
    invoice: INVOICE_VALUES.map(([k, t]) => cell(k, t, invoice[k])),
  }
}

const CATEGORY_SOURCES: readonly CategorySource[] = ['rule', 'default', 'none']

/** The rule ids a line could not decide, `"K-2"` or `{ ruleId }`, repeats dropped. */
function unknownIds(v: unknown): string[] {
  const out: string[] = []
  for (const u of Array.isArray(v) ? v : []) {
    const id = typeof u === 'string' ? u : isObj(u) ? str(u.ruleId) : null
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

function categoryView(v: unknown): VerdictView {
  const lines = linesOf(v)
  if (!lines?.length) return NONE
  return {
    kind: 'category',
    lines: lines.map((l, i) => {
      const source = oneOf(CATEGORY_SOURCES, l.source) ?? 'none'
      return {
        line: lineNo(l, i),
        category: str(l.category) ?? str(l.insuranceItemCategory),
        group: str(l.group),
        source,
        ruleId: source === 'rule' ? str(l.ruleId) : null,
        unknowns: unknownIds(l.unknowns),
      }
    }),
  }
}

/** The verdict as the experiment's kind reads it; an absent or mis-shaped verdict is none. */
export function verdictView(kind: PlaygroundKind, verdict: unknown): VerdictView {
  if (verdict === null || verdict === undefined) return NONE
  switch (kind) {
    case 'guard':
      return guardView(verdict)
    case 'coverage':
      return coverageView(verdict)
    case 'category':
      return categoryView(verdict)
  }
}
