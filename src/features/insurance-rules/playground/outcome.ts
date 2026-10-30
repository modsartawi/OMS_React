import { traceValueIn, type PlaygroundEvaluateReply, type PlaygroundReaderError, type PlaygroundTraceValue } from '@/core/insurance-rules/playground'

// The Evaluate reply → the Outcome pane's view model (oms ticket 677). Pure. Defensive like the simulator's
// `simulateIn`: an absent array reads as empty, a trace value arrives as text. Later tickets add their readers
// beside this one (686 the read log, 678 the verdict, 684 the intake) — the pane draws only what is built here.

export interface TraceRow {
  ruleId: string
  blockPath: string
  value: PlaygroundTraceValue
  /** HQ's reason, one free-text line; null when none. */
  why: string | null
}

export interface LineView {
  line: number
  matched: boolean
  trace: TraceRow[]
}

export type OutcomeView =
  /** A non-empty `errors[]`: the reader refused the document, and nothing else is shown. */
  | { kind: 'errors'; errors: PlaygroundReaderError[] }
  /** `matched` is null when no line matched ("nothing matched"); `lines` keeps every line's trace. */
  | { kind: 'outcome'; matched: LineView[] | null; lines: LineView[] }

const arr = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : [])

export function outcomeView(reply: PlaygroundEvaluateReply | null | undefined): OutcomeView {
  const errors = arr(reply?.errors).map((e) => ({ path: String(e?.path ?? ''), message: String(e?.message ?? '') }))
  if (errors.length) return { kind: 'errors', errors }
  const lines: LineView[] = arr(reply?.lines).map((l, i) => ({
    line: typeof l?.line === 'number' ? l.line : i + 1,
    matched: l?.matched === true,
    trace: arr(l?.trace).map((t) => ({ ruleId: String(t?.ruleId ?? ''), blockPath: String(t?.blockPath ?? ''), value: traceValueIn(t?.value), why: t?.why ? String(t.why) : null })),
  }))
  const matched = lines.filter((l) => l.matched)
  return { kind: 'outcome', matched: matched.length ? matched : null, lines }
}

/** The reply's reader errors (`errors[]`), read as `outcomeView` reads them; [] when none. */
export function outcomeErrors(reply: PlaygroundEvaluateReply | null | undefined): PlaygroundReaderError[] {
  const v = outcomeView(reply)
  return v.kind === 'errors' ? v.errors : []
}

/** An errors view keeping only `rest` (679: the others are shown on their block in the Rule pane). */
export const outcomeWithout = (view: OutcomeView, rest: readonly PlaygroundReaderError[]): OutcomeView =>
  view.kind === 'errors' ? { kind: 'errors', errors: [...rest] } : view
