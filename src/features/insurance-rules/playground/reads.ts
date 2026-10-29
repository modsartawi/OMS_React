import type { PlaygroundEvaluateReply } from '@/core/insurance-rules/playground'

// The Evaluate reply's `reads[]` (BackOffice 3251's read log, `[]` until then) → the read log the Outcome pane draws per
// line (oms ticket 686). Pure, and defensive like `outcomeView`: an absent array reads as empty.
//
// A read row is `{ ruleId, blockPath, path, raw, value, missing, noLiveSource }` (the brief's shape; 691 reconciles):
//   - `line.field.Key` / `request.field.Key` / `patient.field.Key` is a registry or scratch FIELD: its value is text
//     (`raw`) parsed by the field's declared type, and a blank or bad text reads unknown (ADR 0117);
//   - `patient.age` / `line.supplyEndsOn` are DERIVED by the engine (from the birth date, the as of, the supply);
//   - `eligibility.*` belongs to the WHOLE REQUEST: one value, the same on every line;
//   - a request- or patient-scope field has NO LIVE SOURCE at the till (HQ flags it; the path says it too).

export type ReadKind = 'fact' | 'field' | 'derived' | 'eligibility'

export type ReadShown =
  /** The value the engine got (as text), with the eligibility fact's unit when it has one. */
  | { state: 'value'; text: string; unit?: string }
  /** Not there: the read that makes a block unknown. */
  | { state: 'missing' }
  /** A field's raw text that did not parse as its type (`"abc"` → not a number) → unknown. */
  | { state: 'unparsed'; expected: string | null }

export interface ReadRow {
  ruleId: string
  blockPath: string
  path: string
  kind: ReadKind
  /** A field's raw text; null for any other read. */
  raw: string | null
  shown: ReadShown
  /** "No live source: reads unknown at the till." */
  noLiveSource: boolean
  /** An eligibility fact: it belongs to the whole request, not to the line. */
  wholeRequest: boolean
}

export interface LineReads {
  line: number
  rows: ReadRow[]
}

export type ReadsView = { kind: 'none' } | { kind: 'reads'; lines: LineReads[] }

const DERIVED = new Set(['patient.age', 'line.supplyEndsOn'])
const FIELD = /^(line|request|patient)\.field\.(.+)$/

export const readKind = (path: string): ReadKind =>
  FIELD.test(path) ? 'field' : DERIVED.has(path) ? 'derived' : path.startsWith('eligibility.') ? 'eligibility' : 'fact'

const arr = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])

/** The value as text, or null when there is none. An eligibility fact `{ type, number, unit }` reads its typed member. */
function valueOf(v: unknown): { text: string; unit?: string } | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    if (typeof o.type === 'string' && o.type in o) {
      const inner = valueOf(o[o.type])
      if (!inner) return null
      return typeof o.unit === 'string' && o.unit ? { text: inner.text, unit: o.unit } : inner
    }
    return { text: JSON.stringify(v) }
  }
  if (Array.isArray(v)) return { text: JSON.stringify(v) }
  return { text: String(v) }
}

/** The document's `fields` block → each field key's declared type. */
function fieldTypes(fields: unknown): Map<string, string> {
  const m = new Map<string, string>()
  for (const f of arr(fields as unknown[])) {
    const o = f as Record<string, unknown> | null
    if (o && typeof o.key === 'string' && typeof o.type === 'string') m.set(o.key, o.type)
  }
  return m
}

/**
 * The reply's read log, per line. `fields` is the experiment document's `fields` block, so an unparsed field names the
 * type it is not. No read on any line (the door before 3251, or a reader error) → `none`.
 */
export function readsView(reply: PlaygroundEvaluateReply | null | undefined, fields?: unknown): ReadsView {
  if (arr(reply?.errors).length) return { kind: 'none' }
  const types = fieldTypes(fields)
  const eligibility = new Map<string, ReadShown>()
  const lines: LineReads[] = arr(reply?.lines).map((l, i) => ({
    line: typeof l?.line === 'number' ? l.line : i + 1,
    rows: arr(l?.reads as Record<string, unknown>[] | undefined).map((r): ReadRow => {
      const path = String(r?.path ?? '')
      const kind = readKind(path)
      const field = FIELD.exec(path)
      const raw = kind === 'field' && r?.raw !== null && r?.raw !== undefined ? String(r.raw) : null
      const got = valueOf(r?.value)
      let shown: ReadShown =
        r?.missing === true ? { state: 'missing' } : got ? { state: 'value', ...got } : kind === 'field' && raw !== null ? { state: 'unparsed', expected: types.get(field![2]) ?? null } : { state: 'missing' }
      if (kind === 'eligibility') {
        // one value for the whole request: the first line's read stands for every line
        const first = eligibility.get(path)
        if (first) shown = first
        else eligibility.set(path, shown)
      }
      return {
        ruleId: String(r?.ruleId ?? ''),
        blockPath: String(r?.blockPath ?? ''),
        path,
        kind,
        raw,
        shown,
        noLiveSource: r?.noLiveSource === true || (field !== null && field[1] !== 'line'),
        wholeRequest: kind === 'eligibility',
      }
    }),
  }))
  return lines.some((l) => l.rows.length) ? { kind: 'reads', lines } : { kind: 'none' }
}
