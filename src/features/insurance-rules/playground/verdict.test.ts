/**
 * Ticket 678 — the reply's `verdict` → Tab B ("What the live check would say"), per kind, as the brief draws it
 * (guard `[{ line, outcome, fired[] }]` · coverage `{ lines[], invoice }` · category `[{ line, category, group, source,
 * ruleId, unknowns[] }]`). An absent or mis-shaped verdict reads as none.
 */
import { describe, expect, it } from 'vitest'
import { verdictView } from './verdict'

describe('verdictView — guard', () => {
  it('each line: its outcome and the rules that fired, with their severity and message', () => {
    const v = verdictView('guard', [
      { line: 1, outcome: 'warn', fired: [{ ruleId: 'G-1', version: 0, severity: 'WARN', en: 'More than 90 days', ar: 'أكثر من 90 يوماً', codes: { conflict: null, nphies: null } }] },
      { line: 2, outcome: 'pass', fired: [] },
    ])
    expect(v).toEqual({
      kind: 'guard',
      lines: [
        { line: 1, outcome: 'warn', fired: [{ ruleId: 'G-1', severity: 'WARN', message: { en: 'More than 90 days', ar: 'أكثر من 90 يوماً' } }] },
        { line: 2, outcome: 'pass', fired: [] },
      ],
    })
  })

  it('a fired rule spelled as its bare id, an unknown outcome, a missing line number', () => {
    const v = verdictView('guard', { lines: [{ outcome: 'maybe', fired: ['G-7'] }] })
    expect(v).toEqual({ kind: 'guard', lines: [{ line: 1, outcome: null, fired: [{ ruleId: 'G-7', severity: null, message: null }] }] })
  })
})

describe('verdictView — coverage', () => {
  it('each line and the invoice: every value with where it came from and the rule that set it', () => {
    const v = verdictView('coverage', {
      lines: [
        {
          line: 1,
          covered: { value: true, source: 'payer', ruleId: null, version: null },
          quantityCap: { value: 1, source: 'rule', ruleId: 'C-1', version: 0 },
          deductiblePercent: { value: 20, source: 'payer', ruleId: null },
          deductibleMax: { value: 50, source: 'ruleOverridesPayer', ruleId: 'C-2' },
          priceCap: { value: 99.5, source: 'rule', ruleId: 'C-3' },
        },
      ],
      invoice: { segment: { value: 'ELITE', source: 'rule', ruleId: 'C-9' }, exceptionPrescriptions: { value: false, source: 'none', ruleId: null } },
    })
    expect(v.kind).toBe('coverage')
    if (v.kind !== 'coverage') return
    expect(v.lines).toHaveLength(1)
    expect(v.lines[0].line).toBe(1)
    expect(v.lines[0].values).toEqual([
      { key: 'covered', type: 'yesNo', value: true, source: 'payer', ruleId: null },
      { key: 'priorApproval', type: 'yesNo', value: null, source: 'none', ruleId: null },
      { key: 'deductiblePercent', type: 'percent', value: 20, source: 'payer', ruleId: null },
      { key: 'deductibleMax', type: 'money', value: 50, source: 'ruleOverridesPayer', ruleId: 'C-2' },
      { key: 'priceCap', type: 'money', value: 99.5, source: 'rule', ruleId: 'C-3' },
      { key: 'quantityCap', type: 'number', value: 1, source: 'rule', ruleId: 'C-1' },
      { key: 'daysSupplyCap', type: 'number', value: null, source: 'none', ruleId: null },
    ])
    expect(v.invoice).toEqual([
      { key: 'segment', type: 'text', value: 'ELITE', source: 'rule', ruleId: 'C-9' },
      { key: 'exceptionPrescriptions', type: 'yesNo', value: false, source: 'none', ruleId: null },
    ])
  })

  it('a deductible spelled as the effect `{ percent, max }`, and a bare value with no source', () => {
    const v = verdictView('coverage', { lines: [{ line: 3, deductible: { value: { percent: 10, max: 25 }, source: 'rule', ruleId: 'C-4' }, covered: true }] })
    if (v.kind !== 'coverage') throw new Error(v.kind)
    const by = Object.fromEntries(v.lines[0].values.map((c) => [c.key, c]))
    expect(by.deductiblePercent).toEqual({ key: 'deductiblePercent', type: 'percent', value: 10, source: 'rule', ruleId: 'C-4' })
    expect(by.deductibleMax).toEqual({ key: 'deductibleMax', type: 'money', value: 25, source: 'rule', ruleId: 'C-4' })
    expect(by.covered).toEqual({ key: 'covered', type: 'yesNo', value: true, source: null, ruleId: null })
    expect(v.invoice.map((c) => [c.key, c.value, c.source])).toEqual([
      ['segment', null, 'none'],
      ['exceptionPrescriptions', null, 'none'],
    ])
  })
})

describe('verdictView — category', () => {
  it("each line's category, group, who set it and the rule, and the rules that could not decide", () => {
    const v = verdictView('category', [
      { line: 1, category: 'Brand', group: 'G2', source: 'rule', ruleId: 'K-1', unknowns: ['K-2', { ruleId: 'K-3' }, 'K-2'] },
      { line: 2, insuranceItemCategory: 'Generic-IR', group: 'G1', source: 'default', ruleId: 'K-1', unknowns: [] },
      { line: 3, category: null, group: null, source: 'none', ruleId: null },
    ])
    expect(v).toEqual({
      kind: 'category',
      lines: [
        { line: 1, category: 'Brand', group: 'G2', source: 'rule', ruleId: 'K-1', unknowns: ['K-2', 'K-3'] },
        { line: 2, category: 'Generic-IR', group: 'G1', source: 'default', ruleId: null, unknowns: [] },
        { line: 3, category: null, group: null, source: 'none', ruleId: null, unknowns: [] },
      ],
    })
  })
})

describe('verdictView — none', () => {
  it('an absent verdict reads as none, whatever the kind', () => {
    for (const kind of ['guard', 'coverage', 'category'] as const) {
      expect(verdictView(kind, null)).toEqual({ kind: 'none' })
      expect(verdictView(kind, undefined)).toEqual({ kind: 'none' })
    }
  })

  it('a verdict that is not its kind’s shape, or has no lines, reads as none', () => {
    expect(verdictView('coverage', [{ line: 1 }])).toEqual({ kind: 'none' })
    expect(verdictView('guard', 'pass')).toEqual({ kind: 'none' })
    expect(verdictView('category', [])).toEqual({ kind: 'none' })
    expect(verdictView('guard', { lines: [] })).toEqual({ kind: 'none' })
  })
})
