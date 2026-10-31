/**
 * Ticket 674 — the coverage IF editor's item-list and eligibility rows: what a seeded item list filters on, and an
 * eligibility test's operator changed without touching the rest of the block.
 */
import { describe, expect, it } from 'vitest'
import { rulesetIn } from '@/core/insurance-rules/guard-wire'
import type { CoverageRuleset } from '@/core/insurance-rules/coverage-model'
import type { EligibilityCondition, FactCondition } from '@/core/insurance-rules/model'
import type { RegistryField } from '@/core/insurance-rules/registry'
import SEEDED from '../../../../tools/insurance-coverage-seeded.json'
import { drawsAsEligibilityRow, drawsAsFactRow, listSummary, renameTest, testChoices } from './conditions'

const doc = rulesetIn<CoverageRuleset>(SEEDED)
const list = (id: string) => doc.lists!.find((l) => l.id === id)!

describe('listSummary', () => {
  it('a seeded list reads its attribute filters, the field as written when the registry has no name for it', () => {
    expect(listSummary(list('a01-no-contract'), [])).toEqual({
      filters: [
        {
          attributes: [
            { field: 'Insurer.ItemMaster', label: null, op: 'anyOf', codes: ['Y'] },
            { field: 'ItemCustomer.Row', label: null, op: 'anyOf', codes: ['N'] },
          ],
          articles: 0,
          categories: 0,
        },
      ],
      include: [],
      exclude: [],
    })
  })

  it('names a field the registry holds, and reads noneOf', () => {
    const fields = [{ key: 'ECode', label: { en: 'E-code', ar: 'رمز E' }, scope: 'item', type: 'text', unit: '', source: '', retired: false }] as RegistryField[]
    const s = listSummary({ id: 'x', name: { en: '', ar: '' }, filters: [{ articles: ['1', '2'], categories: [], attributes: [{ field: 'ECode', noneOf: ['E1'] }] }], include: ['y'], exclude: [] }, fields)
    expect(s.filters[0]).toEqual({ attributes: [{ field: 'ECode', label: { en: 'E-code', ar: 'رمز E' }, op: 'noneOf', codes: ['E1'] }], articles: 2, categories: 0 })
    expect(s.include).toEqual(['y'])
  })
})

describe('an eligibility test changes operator in place', () => {
  const c: EligibilityCondition = { check: 'eligibility', field: 'benefit[13/day].benefit', atLeast: 100, atMost: 500, unit: 'SAR' }

  it('offers the bounds the block does not already use', () => {
    expect(testChoices(c, 'atLeast')).toEqual(['above', 'atLeast', 'under'])
    expect(testChoices({ check: 'eligibility', field: 'coverage.periodEnd', before: '2026-12-31' }, 'before')).toEqual(['before', 'onOrBefore', 'after', 'onOrAfter'])
    expect(testChoices({ check: 'eligibility', field: 'coverage.active', is: true }, 'is')).toEqual(['is'])
  })

  it('keeps the value and every key in its place', () => {
    expect(JSON.stringify(renameTest(c, 'atLeast', 'above'))).toBe(JSON.stringify({ check: 'eligibility', field: 'benefit[13/day].benefit', above: 100, atMost: 500, unit: 'SAR' }))
    // to an operator the block already has: nothing changes
    expect(renameTest(c, 'atLeast', 'atMost')).toBe(c)
  })
})

describe('oms 693: what the coverage editor draws, and what it keeps as written', () => {
  const fact = (op: FactCondition['op'], value: FactCondition['value'], system?: string): FactCondition => ({ check: 'fact', path: '$claim.x', op, value, ...(system ? { system } : {}) })
  it.each([
    ['a number', fact('atLeast', 5)],
    ['a number below', fact('below', 0)],
    ['codes', fact('anyOf', ['A'])],
    ['codes none of', fact('noneOf', ['A'])],
  ])('%s stays a row', (_n, c) => expect(drawsAsFactRow(c)).toBe(true))
  it.each([
    ['money', fact('atLeast', { amount: '1.500', currency: 'BHD' })],
    ['a quantity', fact('below', { value: '20', unit: '%' })],
    ['a code in a system', fact('anyOf', ['A'], 'urn:s')],
    ['a count', fact('countAtLeast', 2)],
    ['a flag', fact('is', true)],
    ['a day', fact('before', '2026-01-01')],
  ])('%s is kept as written', (_n, c) => expect(drawsAsFactRow(c)).toBe(false))
  it('an eligibility block with money in a bound is kept as written; a phase-1 block is drawn', () => {
    const money = { amount: '1', currency: 'SAR' } as unknown as number
    expect(drawsAsEligibilityRow({ check: 'eligibility', field: 'a', atLeast: money, under: 5 })).toBe(false)
    expect(drawsAsEligibilityRow({ check: 'eligibility', field: 'a', atLeast: 1, under: 5 })).toBe(true)
    expect(drawsAsEligibilityRow({ check: 'eligibility', field: 'a', anyOf: ['x'] })).toBe(true)
  })
})
