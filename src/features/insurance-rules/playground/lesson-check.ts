import type { PlaygroundTraceValue } from '@/core/insurance-rules/playground'
import type { IntakeView } from './intake'
import type { OutcomeView } from './outcome'
import type { VerdictView } from './verdict'

// A lesson's expected result and the Check that judges an answer against it (BackOffice spec 3243 stories 45-47; oms
// ticket 689). Pure. An assertion is MINIMAL: a few expectations on the outcome, each met or not on its own, so an
// edited lesson is told exactly which part it no longer meets. The answer is read through the same view models the
// Outcome pane draws (`outcomeView`, `verdictView`, `intakeView`), so Check sees what the user sees.

export type VerdictValue = string | number | boolean | null | string[]

export type LessonExpect =
  /** The lines whose whole condition held; null = nothing matched. */
  | { expect: 'matched'; lines: number[] | null }
  /** One block's value on one line (`when[0]`, `when[0].conditions[1]`). */
  | { expect: 'trace'; line: number; ruleId: string; blockPath: string; value: PlaygroundTraceValue }
  /**
   * One field of Tab B's verdict on a line: guard `outcome` | `fired` (rule ids); coverage a value key
   * (`quantityCap`); category `category` | `group` | `source`. `ruleId`, when given, is the rule that must have set it.
   */
  | { expect: 'verdict'; line: number; field: string; value: VerdictValue; ruleId?: string }
  /** A Raw key the engine ignored, with its near-miss when `hint` is given (null = no near-miss). */
  | { expect: 'ignored'; path: string; hint?: string | null }

export type LessonExpectKind = LessonExpect['expect']
export const LESSON_EXPECT_KINDS: readonly LessonExpectKind[] = ['matched', 'trace', 'verdict', 'ignored']

/** What the answer held instead: `undefined` = it was not there at all. `gotRuleId` only when the rule differed. */
export interface LessonDifference {
  expect: LessonExpect
  got: VerdictValue | PlaygroundTraceValue | number[] | undefined
  gotRuleId?: string | null
}

export interface LessonAnswer {
  outcome: OutcomeView
  verdict: VerdictView
  intake: IntakeView | null
}

export interface LessonCheck {
  met: boolean
  differences: LessonDifference[]
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The verdict's field on a line, and the rule that set it (null when the verdict names none). */
function verdictField(v: VerdictView, line: number, field: string): { value: VerdictValue; ruleId: string | null } | undefined {
  switch (v.kind) {
    case 'guard': {
      const l = v.lines.find((x) => x.line === line)
      if (!l) return undefined
      if (field === 'outcome') return { value: l.outcome, ruleId: null }
      if (field === 'fired') return { value: l.fired.map((f) => f.ruleId), ruleId: null }
      return undefined
    }
    case 'coverage': {
      const c = v.lines.find((x) => x.line === line)?.values.find((x) => x.key === field)
      return c ? { value: c.value, ruleId: c.ruleId } : undefined
    }
    case 'category': {
      const l = v.lines.find((x) => x.line === line)
      if (!l || !(field === 'category' || field === 'group' || field === 'source')) return undefined
      return { value: l[field], ruleId: l.ruleId }
    }
    default:
      return undefined
  }
}

function judge(e: LessonExpect, a: LessonAnswer): LessonDifference | null {
  switch (e.expect) {
    case 'matched': {
      if (a.outcome.kind !== 'outcome') return { expect: e, got: undefined }
      const got = a.outcome.matched?.map((l) => l.line) ?? null
      return same(got, e.lines) ? null : { expect: e, got }
    }
    case 'trace': {
      const lines = a.outcome.kind === 'outcome' ? a.outcome.lines : []
      const row = lines.find((l) => l.line === e.line)?.trace.find((r) => r.ruleId === e.ruleId && r.blockPath === e.blockPath)
      return row && row.value === e.value ? null : { expect: e, got: row?.value }
    }
    case 'verdict': {
      const f = verdictField(a.verdict, e.line, e.field)
      if (!f) return { expect: e, got: undefined }
      const ruleOk = e.ruleId === undefined || f.ruleId === e.ruleId
      if (same(f.value, e.value) && ruleOk) return null
      return ruleOk ? { expect: e, got: f.value } : { expect: e, got: f.value, gotRuleId: f.ruleId }
    }
    case 'ignored': {
      const hit = a.intake?.ignored.find((i) => i.path === e.path)
      if (!hit) return { expect: e, got: undefined }
      return e.hint === undefined || hit.hint === e.hint ? null : { expect: e, got: hit.hint }
    }
  }
}

/** Every expectation judged against the answer; met when none differs. */
export function lessonCheck(expects: readonly LessonExpect[], answer: LessonAnswer): LessonCheck {
  const differences = expects.map((e) => judge(e, answer)).filter((d): d is LessonDifference => d !== null)
  return { met: differences.length === 0, differences }
}
