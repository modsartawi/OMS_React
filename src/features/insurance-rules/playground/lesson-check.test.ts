/**
 * Ticket 689 — Check compares the latest answer with a lesson's assertion: met, or each expectation that differs,
 * with what the answer held instead.
 */
import { describe, expect, it } from 'vitest'
import { lessonCheck, type LessonExpect } from './lesson-check'
import { outcomeView } from './outcome'
import { verdictView } from './verdict'
import { intakeView } from './intake'

const line = (n: number, matched: boolean, trace: [string, string, string][]) => ({
  line: n,
  matched,
  trace: trace.map(([ruleId, blockPath, value]) => ({ ruleId, blockPath, value, why: null })),
})

/** Two lines: line 1 unknown, line 2 false, nothing matched; a category verdict and a Raw intake. */
const answer = {
  outcome: outcomeView({ errors: [], lines: [line(1, false, [['G-1', 'when[0]', 'unknown']]), line(2, false, [['G-1', 'when[0]', 'false']])] } as never),
  verdict: verdictView('category', [
    { line: 1, category: null, group: null, source: 'none', ruleId: null, unknowns: ['G-1'] },
    { line: 2, category: 'Brand', group: 'G2', source: 'rule', ruleId: 'C-2', unknowns: [] },
  ]),
  intake: intakeView({ read: [], ignored: [{ path: 'lines[0].qty', hint: 'quantity' }], refused: [] }),
}

describe('lessonCheck', () => {
  it('an answer meeting every expectation is met', () => {
    const expects: LessonExpect[] = [
      { expect: 'matched', lines: null },
      { expect: 'trace', line: 1, ruleId: 'G-1', blockPath: 'when[0]', value: 'unknown' },
      { expect: 'trace', line: 2, ruleId: 'G-1', blockPath: 'when[0]', value: false },
      { expect: 'verdict', line: 2, field: 'group', value: 'G2', ruleId: 'C-2' },
      { expect: 'ignored', path: 'lines[0].qty', hint: 'quantity' },
    ]
    const r = lessonCheck(expects, answer)
    expect(r.met).toBe(true)
    expect(r.differences).toEqual([])
  })

  it('matched: names the lines that matched instead of nothing', () => {
    const r = lessonCheck([{ expect: 'matched', lines: [1, 2] }], answer)
    expect(r.met).toBe(false)
    expect(r.differences).toEqual([{ expect: { expect: 'matched', lines: [1, 2] }, got: null }])
  })

  it('matched null: names the matched lines when something matched', () => {
    const matched = { ...answer, outcome: outcomeView({ errors: [], lines: [line(1, true, [['G-1', 'when[0]', 'true']])] } as never) }
    expect(lessonCheck([{ expect: 'matched', lines: null }], matched).differences).toEqual([{ expect: { expect: 'matched', lines: null }, got: [1] }])
  })

  it('a trace value: names the value the block read instead, or absent when the block is not on the line', () => {
    const e1: LessonExpect = { expect: 'trace', line: 1, ruleId: 'G-1', blockPath: 'when[0]', value: false }
    const e2: LessonExpect = { expect: 'trace', line: 3, ruleId: 'G-1', blockPath: 'when[0]', value: true }
    expect(lessonCheck([e1, e2], answer).differences).toEqual([
      { expect: e1, got: 'unknown' },
      { expect: e2, got: undefined },
    ])
  })

  it('a verdict field: names the value, and the rule that set it when the rule differs', () => {
    const e1: LessonExpect = { expect: 'verdict', line: 2, field: 'group', value: 'G1' }
    const e2: LessonExpect = { expect: 'verdict', line: 2, field: 'group', value: 'G2', ruleId: 'C-1' }
    expect(lessonCheck([e1, e2], answer).differences).toEqual([
      { expect: e1, got: 'G2' },
      { expect: e2, got: 'G2', gotRuleId: 'C-2' },
    ])
  })

  it('a coverage verdict cell and a guard outcome are read the same way', () => {
    const coverage = { ...answer, verdict: verdictView('coverage', { lines: [{ line: 1, quantityCap: { value: 1, source: 'rule', ruleId: 'C-1' } }] }) }
    expect(lessonCheck([{ expect: 'verdict', line: 1, field: 'quantityCap', value: 1, ruleId: 'C-1' }], coverage).met).toBe(true)
    const guard = { ...answer, verdict: verdictView('guard', [{ line: 1, outcome: 'warn', fired: [{ ruleId: 'G-7', severity: 'WARN' }] }]) }
    expect(lessonCheck([{ expect: 'verdict', line: 1, field: 'outcome', value: 'warn' }], guard).met).toBe(true)
    expect(lessonCheck([{ expect: 'verdict', line: 1, field: 'fired', value: ['G-7'] }], guard).met).toBe(true)
    expect(lessonCheck([{ expect: 'verdict', line: 1, field: 'outcome', value: 'pass' }], guard).differences[0].got).toBe('warn')
  })

  it('an intake ignore: names it absent, or the hint it carried instead', () => {
    const e1: LessonExpect = { expect: 'ignored', path: 'lines[0].days' }
    const e2: LessonExpect = { expect: 'ignored', path: 'lines[0].qty', hint: 'daysSupply' }
    expect(lessonCheck([e1, e2], answer).differences).toEqual([
      { expect: e1, got: undefined },
      { expect: e2, got: 'quantity' },
    ])
    expect(lessonCheck([e1], { ...answer, intake: null }).differences).toEqual([{ expect: e1, got: undefined }])
  })

  it('a reader error meets nothing: matched and trace read absent', () => {
    const errors = { ...answer, outcome: outcomeView({ errors: [{ path: 'rules[0].when[0].check', message: 'x' }] }) }
    const r = lessonCheck([{ expect: 'matched', lines: null }], errors)
    expect(r.met).toBe(false)
    expect(r.differences[0].got).toBe(undefined)
  })
})
