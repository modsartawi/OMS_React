import type { LineView, OutcomeView, TraceRow } from './outcome'
import type { ReadRow, ReadsView } from './reads'

// "Explain this result" (oms ticket 686): the trace and the read log → a plain-words paragraph, as sentence KEYS with
// their values. Pure; the pane renders each with `t(key, values)`, every value wrapped in `fsi` (a `t()` interpolation
// is a string-only sink). No words live here, so the paragraph is EN and AR from the same keys.
//
// Per line, per rule (in the trace's order): every top-level block true → the rule matched; else the first FALSE block
// decided (false wins an `all`), else the first UNKNOWN one — and its reason is the missing or unparsed read under that
// block. With no read log (the door before 3251) it works from the trace alone, and says so.

export interface ExplainSentence {
  /** A key under the `insurance-playground` namespace (`explain.*`). */
  key: string
  /** Values, as data: the pane isolates each one. */
  values: Record<string, string>
}

const TOP = /^when\[\d+\]$/
const TYPED = new Set(['number', 'date', 'flag', 'text'])

const s = (key: string, values: Record<string, string> = {}): ExplainSentence => ({ key: `explain.${key}`, values })

function byRule(trace: TraceRow[]): Map<string, TraceRow[]> {
  const m = new Map<string, TraceRow[]>()
  for (const r of trace) m.set(r.ruleId, [...(m.get(r.ruleId) ?? []), r])
  return m
}

/** The read under a block that made it unknown: a missing fact, or a field whose text did not parse. */
function reasonFor(rows: ReadRow[], ruleId: string, block: string): ExplainSentence | null {
  const r = rows.find(
    (x) => x.ruleId === ruleId && (x.blockPath === block || x.blockPath.startsWith(`${block}.`)) && x.shown.state !== 'value',
  )
  if (!r) return null
  if (r.shown.state === 'missing') return s('missing', { path: r.path })
  const expected = r.shown.state === 'unparsed' ? r.shown.expected : null
  return s(expected && TYPED.has(expected) ? `unparsedAs.${expected}` : 'unparsed', { path: r.path, raw: r.raw ?? '' })
}

function lineSentences(l: LineView, rows: ReadRow[]): ExplainSentence[] {
  const line = String(l.line)
  if (!l.trace.length) return [s('lineNoTrace', { line })]
  const out: ExplainSentence[] = []
  for (const [rule, steps] of byRule(l.trace)) {
    const top = steps.some((x) => TOP.test(x.blockPath)) ? steps.filter((x) => TOP.test(x.blockPath)) : steps
    const decided = top.find((x) => x.value === false) ?? top.find((x) => x.value === 'unknown')
    if (!decided) {
      out.push(s('matched', { line, rule }))
      continue
    }
    const unknown = decided.value === 'unknown'
    out.push(s(unknown ? 'unknown' : 'false', { line, rule, block: decided.blockPath }))
    const reason = unknown ? reasonFor(rows, rule, decided.blockPath) : null
    if (reason) out.push(reason)
    else if (decided.why) out.push(s('why', { why: decided.why }))
  }
  return out
}

export function explain(view: OutcomeView, reads: ReadsView): ExplainSentence[] {
  if (view.kind === 'errors') return []
  if (!view.lines.length) return [s('noLines')]
  const rowsOf = (line: number) => (reads.kind === 'reads' ? (reads.lines.find((x) => x.line === line)?.rows ?? []) : [])
  const out: ExplainSentence[] = view.matched === null ? [s('nothingMatched')] : []
  for (const l of view.lines) out.push(...lineSentences(l, rowsOf(l.line)))
  if (reads.kind === 'none') out.push(s('noReads'))
  return out
}
