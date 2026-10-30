/**
 * Ticket 690 — Compare (A/B): `compareDiff` lines up two outcomes by key and flags what differs: a line whose matched
 * state differs, a trace row (line + ruleId + blockPath) whose value differs, a read-log row whose value differs, a
 * verdict that differs. A row present on one side only is marked as such.
 */
import { describe, expect, it } from 'vitest'
import { compareDiff, sideOf } from './compare-diff'

const step = (ruleId: string, blockPath: string, value: string, why = '') => ({ ruleId, blockPath, value, why })
const read = (ruleId: string, blockPath: string, path: string, value: unknown) => ({ ruleId, blockPath, path, raw: null, value, missing: value === null, noLiveSource: false })

/** A guard reply: line 1 matched on G-1, line 2 not (when[1] false). */
const replyA = () => ({
  errors: [],
  lines: [
    { line: 1, matched: true, trace: [step('G-1', 'when[0]', 'true'), step('G-1', 'when[1]', 'true')], reads: [read('G-1', 'when[1]', 'line.quantity', 2)] },
    { line: 2, matched: false, trace: [step('G-1', 'when[0]', 'true'), step('G-1', 'when[1]', 'false')], reads: [read('G-1', 'when[1]', 'line.quantity', 1)] },
  ],
  verdict: [
    { line: 1, outcome: 'warn', fired: [{ ruleId: 'G-1', severity: 'WARN', en: 'x', ar: 'y' }] },
    { line: 2, outcome: 'pass', fired: [] },
  ],
})

const side = (reply: unknown) => sideOf('guard', reply as never)

describe('compareDiff', () => {
  it('equal outcomes give no highlight', () => {
    const d = compareDiff(side(replyA()), side(replyA()))
    expect(d.same).toBe(true)
    expect(d.lines.map((l) => [l.line, l.mark])).toEqual([
      [1, 'same'],
      [2, 'same'],
    ])
    expect(d.lines.flatMap((l) => l.trace.map((r) => r.mark))).toEqual(['same', 'same', 'same', 'same'])
    expect(d.lines.flatMap((l) => l.reads.map((r) => r.mark))).toEqual(['same', 'same'])
    expect(d.verdict.mark).toBe('same')
  })

  it('a flipped when[1] on line 2 flags that trace row, that line and the verdict', () => {
    const b = replyA()
    b.lines[1].trace[1].value = 'true'
    b.lines[1].matched = true
    b.verdict[1] = { line: 2, outcome: 'warn', fired: [{ ruleId: 'G-1', severity: 'WARN', en: 'x', ar: 'y' }] }
    const d = compareDiff(side(replyA()), side(b))
    expect(d.same).toBe(false)
    const l2 = d.lines.find((l) => l.line === 2)!
    expect(l2.mark).toBe('differs')
    expect(l2.trace.map((r) => [r.key, r.mark])).toEqual([
      ['2|G-1|when[0]', 'same'],
      ['2|G-1|when[1]', 'differs'],
    ])
    expect(l2.trace[1].a?.value).toBe(false)
    expect(l2.trace[1].b?.value).toBe(true)
    expect(d.lines.find((l) => l.line === 1)!.mark).toBe('same')
    expect(d.verdict.mark).toBe('differs')
    expect(d.verdict.lines).toEqual([
      { line: 1, mark: 'same' },
      { line: 2, mark: 'differs' },
    ])
  })

  it('a line matched only in B, and a line present only in B, are each marked', () => {
    const b = replyA()
    b.lines[1].matched = true
    b.lines.push({ line: 3, matched: true, trace: [step('G-1', 'when[0]', 'true')], reads: [] })
    const d = compareDiff(side(replyA()), side(b))
    expect(d.lines.map((l) => [l.line, l.mark])).toEqual([
      [1, 'same'],
      [2, 'differs'],
      [3, 'onlyB'],
    ])
    const l3 = d.lines[2]
    expect(l3.a).toBeNull()
    expect(l3.trace.map((r) => [r.key, r.mark, r.a])).toEqual([['3|G-1|when[0]', 'onlyB', null]])
  })

  it('a differing read value is flagged by its key; a one-sided read row is marked', () => {
    const b = replyA()
    b.lines[0].reads = [read('G-1', 'when[1]', 'line.quantity', 5)]
    b.lines[1].reads = []
    const d = compareDiff(side(replyA()), side(b))
    expect(d.lines[0].reads.map((r) => [r.key, r.mark])).toEqual([['1|G-1|when[1]|line.quantity', 'differs']])
    expect(d.lines[1].reads.map((r) => [r.key, r.mark])).toEqual([['2|G-1|when[1]|line.quantity', 'onlyA']])
    expect(d.same).toBe(false)
  })

  it('a trace row only in A is marked onlyA; the same key twice on a line is told apart', () => {
    const b = replyA()
    b.lines[0].trace = [step('G-1', 'when[0]', 'true')]
    const a = replyA()
    a.lines[1].trace.push(step('G-1', 'when[1]', 'false'))
    b.lines[1].trace.push(step('G-1', 'when[1]', 'true'))
    const d = compareDiff(side(a), side(b))
    expect(d.lines[0].trace.map((r) => r.mark)).toEqual(['same', 'onlyA'])
    expect(d.lines[1].trace.map((r) => [r.key, r.mark])).toEqual([
      ['2|G-1|when[0]', 'same'],
      ['2|G-1|when[1]', 'same'],
      ['2|G-1|when[1]#2', 'differs'],
    ])
  })

  it('a side the reader refused has no lines: every line of the other side is one-sided', () => {
    const d = compareDiff(side({ errors: [{ path: 'rules[0].when[0].check', message: 'no' }] }), side(replyA()))
    expect(d.a.view.kind).toBe('errors')
    expect(d.lines.map((l) => l.mark)).toEqual(['onlyB', 'onlyB'])
    expect(d.same).toBe(false)
  })
})
