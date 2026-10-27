/**
 * Ticket 612 — the condition trace of a simulated line, laid onto the rule's own IF tree: each condition HQ read
 * carries true / false / unknown and why; a condition HQ did not read (an any-group short-circuits) carries none;
 * a trace entry whose block is not in the draft is kept aside, never dropped. The rules are the drive's stubs.
 */
import { describe, expect, it } from 'vitest'
import { RULESET } from '../../../../tools/insurance-rules-stubs.mjs'
import type { SimLineResult } from './simulate'
import { lineRules, type TraceNode } from './trace'

const flat = (nodes: readonly TraceNode[]): string[] =>
  nodes.flatMap((n) => [`${n.path} ${n.check}${n.not ? ' NOT' : ''} = ${n.value === null ? '—' : String(n.value)}`, ...flat(n.children ?? [])])

const line: SimLineResult = {
  line: 1,
  unknowns: ['G-007'],
  outcome: 'override',
  fired: [
    { ruleId: 'G-010', severity: 'WARN', en: 'Dispensed at 3 stores in 30 days', ar: 'صُرف في 3 فروع خلال 30 يوماً' },
    { ruleId: 'G-007', severity: 'OVERRIDE', en: 'GLP-1 without a diabetes diagnosis', ar: 'GLP-1 بدون تشخيص سكري', codes: { conflict: 'DC', nphies: 'CV-4-5' } },
  ],
  trace: [
    { ruleId: 'G-001', blockPath: 'when[0]', value: false, why: { en: 'Last dispensed 12 days ago', ar: 'آخر صرف قبل 12 يوماً' } },
    { ruleId: 'G-007', blockPath: 'when', value: true, why: 'Every block holds' },
    { ruleId: 'G-007', blockPath: 'when[0]', value: true },
    { ruleId: 'G-007', blockPath: 'when[0].conditions[0]', value: true },
    { ruleId: 'G-007', blockPath: 'when[0].conditions[1]', value: true, why: 'No ICD-10-AM code on the line' },
    { ruleId: 'G-007', blockPath: 'when[0].conditions[2]', value: true },
    { ruleId: 'G-007', blockPath: 'when[0].conditions[2].conditions[0]', value: false },
    { ruleId: 'G-007', blockPath: 'when[0].conditions[2].conditions[1]', value: 'unknown' },
    { ruleId: 'G-007', blockPath: 'when[3]', value: true },
    { ruleId: 'G-010', blockPath: 'when[0]', value: true },
    { ruleId: 'G-099', blockPath: 'when[0]', value: true },
  ],
}

describe('lineRules', () => {
  const rules = lineRules(line, RULESET)

  it('reads the fired rules heaviest first, then the rules that were only read, in trace order', () => {
    expect(rules.map((r) => [r.ruleId, r.fired?.severity ?? null])).toEqual([
      ['G-007', 'OVERRIDE'],
      ['G-010', 'WARN'],
      ['G-001', null],
      ['G-099', null],
    ])
  })

  it('lays the trace onto the rule’s IF tree, NOT kept on its node', () => {
    expect(flat(rules[0].nodes)).toEqual([
      'when[0] group = true',
      'when[0].conditions[0] line = true',
      'when[0].conditions[1] formulary NOT = true',
      'when[0].conditions[2] group NOT = true',
      'when[0].conditions[2].conditions[0] patient = false',
      'when[0].conditions[2].conditions[1] policy = unknown',
    ])
    expect(rules[0].nodes[0].children?.[1].why).toBe('No ICD-10-AM code on the line')
    expect(rules[0].nodes[0].sentence.key).toBe('sentence.group.all')
  })

  it('reads `when` as the rule’s whole condition, above its tree — not as a block set aside', () => {
    expect(rules[0].whole).toEqual({ value: true, why: 'Every block holds' })
    expect(rules[2].whole).toBeNull()
    expect(rules[0].loose.map((t) => t.blockPath)).not.toContain('when')
  })

  it('keeps a trace entry whose block is not in the rule aside', () => {
    expect(rules[0].loose.map((t) => t.blockPath)).toEqual(['when[3]'])
  })

  it('a rule not in the draft has no tree, all its entries aside', () => {
    expect(rules[3]).toMatchObject({ ruleId: 'G-099', rule: null, nodes: [] })
    expect(rules[3].loose).toHaveLength(1)
  })

  it('a condition HQ did not read carries no value', () => {
    const g1 = rules.find((r) => r.ruleId === 'G-001')!
    expect(flat(g1.nodes)).toEqual(['when[0] history = false'])
    const short = lineRules({ ...line, trace: [{ ruleId: 'G-007', blockPath: 'when[0]', value: false }] }, RULESET)[0]
    expect(flat(short.nodes).slice(0, 2)).toEqual(['when[0] group = false', 'when[0].conditions[0] line = —'])
  })
})
