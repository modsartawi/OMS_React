// The rule playground's door (BackOffice spec 3243, door 3244 guard; oms ticket 677). One experiment — the engine's
// `data`, a scratch mini-ruleset `document`, a kind and an "as of" — goes to `POST InsuranceRules/Playground/Evaluate`
// and comes back as what the engine saw: per line whether the whole condition held (`matched`) and the trace of every
// block it read. Shapes from the brief's "HQ contract" (3244-3252); 3244 owns the final spelling (reconciled in 691).
//
// In `core` (not the playground feature) because "Open in playground" (688) builds an experiment from the guard,
// coverage and category screens, and a feature may not import another. Pure: no React, no http.

export const PLAYGROUND_KINDS = ['guard', 'coverage', 'category'] as const
export type PlaygroundKind = (typeof PLAYGROUND_KINDS)[number]

/** The scratch mini-ruleset, in the engine's spelling (the same document the guard / coverage / category doors read). */
export interface PlaygroundDocument {
  schema: 1
  kind: PlaygroundKind
  revision: number
  fields: unknown[]
  lists: unknown[]
  rules: unknown[]
}

/** `POST InsuranceRules/Playground/Evaluate` — exactly one of `data` | `raw` (raw is 684's). */
export interface PlaygroundEvaluateBody {
  kind: PlaygroundKind
  /** The engine shape (`request`, `patient`, `lines`, `history`, `reference`, `eligibility`, `payer`). */
  data?: unknown
  raw?: string
  document: unknown
  /** Local wall-clock, `yyyy-MM-ddTHH:mm:ss`, no `Z`. */
  asOf: string
}

export type PlaygroundTraceValue = true | false | 'unknown'

/** One block the engine read on a line: its rule, its place in the rule (`when[1]`), its value and why. */
export interface PlaygroundTraceStep {
  ruleId: string
  blockPath: string
  /** HQ sends the TEXT `"true" | "false" | "unknown"` (the 3140 precedent); read through `traceValueIn`. */
  value: PlaygroundTraceValue
  why?: string | null
}

export interface PlaygroundLine {
  line: number
  /** The rule's whole condition held on the line, for any rule in the ruleset. */
  matched: boolean
  trace: PlaygroundTraceStep[]
  /** 3251's read log; `[]` until then. Drawn by 686. */
  reads?: unknown[]
}

/** A reader error, pointed at a block of the document (`rules[0].when[1].expr`). */
export interface PlaygroundReaderError {
  path: string
  message: string
}

export interface PlaygroundEvaluateReply {
  /** Non-empty → nothing else is in the reply. */
  errors?: PlaygroundReaderError[] | null
  lines?: PlaygroundLine[] | null
  /** The live check's answer (678's Tab B). */
  verdict?: unknown
  /** Raw data only (684). */
  intake?: unknown
}

/** HQ's trace value (`"true" | "false" | "unknown"`, a string) → the screen's; a boolean is taken as it is. */
export const traceValueIn = (v: unknown): PlaygroundTraceValue => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : 'unknown')

/** Local wall-clock as the doors take it: `yyyy-MM-ddTHH:mm:ss`, no `Z`, no offset. */
export function localAsOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
