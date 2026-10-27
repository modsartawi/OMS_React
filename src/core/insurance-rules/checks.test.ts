/**
 * Ticket 608 — HQ's Validate answer read where it points: on the rule, on a block (a condition at any depth,
 * or an effect) and on a field; issues of other rules counted apart; only errors block.
 */
import { describe, expect, it } from 'vitest'
import { RULES } from '../../../tools/insurance-rules-stubs.mjs'
import { blockKey, checksVerdict, indexChecks, parseBlockPath, type GuardIssue } from './checks'

const issue = (ruleId: string, blockPath: string | null, field: string | null, severity: 'error' | 'warning' = 'error'): GuardIssue => ({
  ruleId,
  blockPath,
  field,
  severity,
  en: 'x',
  ar: 'س',
})

describe('checks', () => {
  it('reads a block path', () => {
    expect(parseBlockPath('when[0].conditions[2]')).toEqual({ section: 'when', path: [0, 2] })
    expect(parseBlockPath('then[0]')).toEqual({ section: 'then', path: [0] })
    expect(parseBlockPath('')).toBeNull()
    expect(parseBlockPath(null)).toBeNull()
    expect(parseBlockPath('when[0].oops')).toBeNull()
  })

  it('indexes the issues at rule, block and field', () => {
    const issues = [
      issue('G-012', null, 'name.ar'),
      issue('G-012', 'when[0].conditions[2]', 'inList'),
      issue('G-012', 'then[0]', 'says.ar', 'warning'),
      issue('G-001', null, null),
      issue('G-012', 'when[9]', 'atLeast'),
    ]
    // G-007's shape as G-012: its first block is a group of three; it has no `when[9]`, so that issue sits on the rule.
    const ix = indexChecks(issues, { ...RULES.find((r) => r.id === 'G-007')!, id: 'G-012' })
    expect(ix.rule.map((i) => i.field)).toEqual(['name.ar', 'atLeast'])
    expect(ix.blocks.get(blockKey('when', [0, 2]))?.map((i) => i.field)).toEqual(['inList'])
    expect(ix.blocks.get(blockKey('then', [0]))?.map((i) => i.field)).toEqual(['says.ar'])
    expect(ix.elsewhere).toHaveLength(1)
    expect(checksVerdict(issues)).toEqual({ errors: 4, warnings: 1, blocked: true })
    expect(checksVerdict([issue('G-1', null, null, 'warning')])).toEqual({ errors: 0, warnings: 1, blocked: false })
  })
})
