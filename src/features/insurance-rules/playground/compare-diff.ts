import type { PlaygroundEvaluateReply, PlaygroundKind } from '@/core/insurance-rules/playground'
import { outcomeView, type LineView, type OutcomeView, type TraceRow } from './outcome'
import { readsView, type ReadRow, type ReadsView } from './reads'
import { verdictView, type VerdictView } from './verdict'

// Compare (A/B), oms ticket 690. Pure. Two experiments' answers, each read by the same view readers as the Outcome
// pane, are lined up by key and every row is marked:
//   - a LINE by its number: `differs` when its matched state differs;
//   - a TRACE row by `line|ruleId|blockPath`: `differs` when its value differs (HQ's `why` is not compared);
//   - a READ row by `line|ruleId|blockPath|path`: `differs` when what is shown (value, missing, unparsed) differs;
//   - the VERDICT per line (and the coverage invoice): `differs` when anything in it differs.
// A row on one side only is `onlyA` / `onlyB`. The same key twice on one line is told apart by its occurrence (`#2`).

export type Mark = 'same' | 'differs' | 'onlyA' | 'onlyB'

/** One side's answer, as the Outcome pane reads it. */
export interface CompareSide {
  view: OutcomeView
  verdict: VerdictView
  reads: ReadsView
}

/** One answer → its side. `fields` is the sent document's `fields` block (686's read log reads their types). */
export const sideOf = (kind: PlaygroundKind, reply: PlaygroundEvaluateReply | null | undefined, fields?: unknown): CompareSide => ({
  view: outcomeView(reply),
  verdict: verdictView(kind, reply?.verdict),
  reads: readsView(reply, fields),
})

export interface Paired<T> {
  key: string
  mark: Mark
  a: T | null
  b: T | null
}

export interface CompareLine {
  line: number
  mark: Mark
  a: LineView | null
  b: LineView | null
  trace: Paired<TraceRow>[]
  reads: Paired<ReadRow>[]
}

export interface CompareDiff {
  a: CompareSide
  b: CompareSide
  /** Nothing differs anywhere: no highlight. */
  same: boolean
  lines: CompareLine[]
  verdict: { mark: 'same' | 'differs'; lines: { line: number; mark: Mark }[] }
}

/** Rows → key → row, keys in first-seen order; a repeated key takes `#n`. */
function keyed<T>(rows: T[], keyOf: (r: T) => string): Map<string, T> {
  const out = new Map<string, T>()
  const seen = new Map<string, number>()
  for (const r of rows) {
    const k = keyOf(r)
    const n = (seen.get(k) ?? 0) + 1
    seen.set(k, n)
    out.set(n === 1 ? k : `${k}#${n}`, r)
  }
  return out
}

/** A's keys in order, then B's that A has not. Each pair marked by `differs`. */
function pair<T>(a: Map<string, T>, b: Map<string, T>, differs: (x: T, y: T) => boolean): Paired<T>[] {
  const keys = [...a.keys(), ...[...b.keys()].filter((k) => !a.has(k))]
  return keys.map((key) => {
    const x = a.get(key) ?? null
    const y = b.get(key) ?? null
    const mark: Mark = x === null ? 'onlyB' : y === null ? 'onlyA' : differs(x, y) ? 'differs' : 'same'
    return { key, mark, a: x, b: y }
  })
}

const linesOf = (s: CompareSide): LineView[] => (s.view.kind === 'outcome' ? s.view.lines : [])
const readsOf = (s: CompareSide, line: number): ReadRow[] => (s.reads.kind === 'reads' ? (s.reads.lines.find((l) => l.line === line)?.rows ?? []) : [])
const json = (v: unknown) => JSON.stringify(v)

function verdictLines(v: VerdictView): Map<string, unknown> {
  if (v.kind === 'none') return new Map()
  const m = new Map<string, unknown>(v.lines.map((l) => [String(l.line), l]))
  return m
}

export function compareDiff(a: CompareSide, b: CompareSide): CompareDiff {
  const lines: CompareLine[] = pair(keyed(linesOf(a), (l) => String(l.line)), keyed(linesOf(b), (l) => String(l.line)), (x, y) => x.matched !== y.matched).map((p) => {
    const line = (p.a ?? p.b)!.line
    const trace = pair(
      keyed(p.a?.trace ?? [], (r) => `${line}|${r.ruleId}|${r.blockPath}`),
      keyed(p.b?.trace ?? [], (r) => `${line}|${r.ruleId}|${r.blockPath}`),
      (x, y) => x.value !== y.value,
    )
    const readKey = (r: ReadRow) => `${line}|${r.ruleId}|${r.blockPath}|${r.path}`
    const reads = pair(keyed(readsOf(a, line), readKey), keyed(readsOf(b, line), readKey), (x, y) => json(x.shown) !== json(y.shown))
    return { line, mark: p.mark, a: p.a, b: p.b, trace, reads }
  })

  const vLines = pair(verdictLines(a.verdict), verdictLines(b.verdict), (x, y) => json(x) !== json(y)).map((p) => ({ line: Number(p.key), mark: p.mark }))
  const invoice = (v: VerdictView) => (v.kind === 'coverage' ? v.invoice : null)
  const verdictDiffers = a.verdict.kind !== b.verdict.kind || vLines.some((l) => l.mark !== 'same') || json(invoice(a.verdict)) !== json(invoice(b.verdict))

  const errorsDiffer = a.view.kind !== b.view.kind || (a.view.kind === 'errors' && json(a.view) !== json(b.view))
  const same = !errorsDiffer && !verdictDiffers && lines.every((l) => l.mark === 'same' && l.trace.every((r) => r.mark === 'same') && l.reads.every((r) => r.mark === 'same'))
  return { a, b, same, lines, verdict: { mark: verdictDiffers ? 'differs' : 'same', lines: vLines } }
}
