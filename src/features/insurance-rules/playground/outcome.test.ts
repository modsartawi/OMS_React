/**
 * Ticket 677 — the Evaluate reply → the Outcome pane's view model: the matched lines with their trace rows, null when
 * no line matched ("nothing matched"), only the reader errors when there are any, absent arrays read as empty.
 */
import { describe, expect, it } from 'vitest'
import { outcomeView } from './outcome'

describe('outcomeView', () => {
  it('a reply with matched lines gives those lines, each with its trace rows (values read from text)', () => {
    const v = outcomeView({
      errors: [],
      lines: [
        { line: 1, matched: true, trace: [{ ruleId: 'G-1', blockPath: 'when[0]', value: 'true' as never, why: 'daysSupply 120 > 90' }] },
        { line: 2, matched: false, trace: [{ ruleId: 'G-1', blockPath: 'when[0]', value: 'false' as never, why: 'daysSupply 30 ≤ 90' }] },
        { line: 3, matched: true, trace: [{ ruleId: 'G-1', blockPath: 'when[0]', value: 'unknown' as never }] },
      ],
    })
    expect(v.kind).toBe('outcome')
    if (v.kind !== 'outcome') return
    expect(v.matched?.map((l) => l.line)).toEqual([1, 3])
    expect(v.matched?.[0].trace).toEqual([{ ruleId: 'G-1', blockPath: 'when[0]', value: true, why: 'daysSupply 120 > 90' }])
    expect(v.matched?.[1].trace).toEqual([{ ruleId: 'G-1', blockPath: 'when[0]', value: 'unknown', why: null }])
    // every line keeps its trace, so an unmatched line still shows why
    expect(v.lines.map((l) => [l.line, l.matched])).toEqual([
      [1, true],
      [2, false],
      [3, true],
    ])
    expect(v.lines[1].trace[0].value).toBe(false)
  })

  it('a reply where no line matched gives null — "nothing matched"', () => {
    const v = outcomeView({ lines: [{ line: 1, matched: false, trace: [] }] })
    expect(v).toEqual({ kind: 'outcome', matched: null, lines: [{ line: 1, matched: false, trace: [] }] })
  })

  it('a non-empty errors gives only the errors, whatever else came', () => {
    const v = outcomeView({
      errors: [{ path: 'rules[0].when[1].expr', message: 'Unknown function "lenght".' }],
      lines: [{ line: 1, matched: true, trace: [] }],
    })
    expect(v).toEqual({ kind: 'errors', errors: [{ path: 'rules[0].when[1].expr', message: 'Unknown function "lenght".' }] })
  })

  it('absent arrays read as empty: no reply, no lines, a line with no trace', () => {
    expect(outcomeView(null)).toEqual({ kind: 'outcome', matched: null, lines: [] })
    expect(outcomeView({ errors: null, lines: null })).toEqual({ kind: 'outcome', matched: null, lines: [] })
    expect(outcomeView({ lines: [{ line: 4, matched: true } as never] })).toEqual({
      kind: 'outcome',
      matched: [{ line: 4, matched: true, trace: [] }],
      lines: [{ line: 4, matched: true, trace: [] }],
    })
  })

  it('a line with no number takes its place from 1', () => {
    const v = outcomeView({ lines: [{ matched: false } as never, { matched: true } as never] })
    expect(v.kind === 'outcome' && v.lines.map((l) => l.line)).toEqual([1, 2])
  })
})
