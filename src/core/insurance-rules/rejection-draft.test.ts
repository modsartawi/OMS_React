/** oms 709 — a coded rejection report row becomes an unsaved guard draft (BackOffice spec 3271 A10, stories 49, 51). */
import { describe, expect, it } from 'vitest'
import { guardRuleOut } from './guard-wire'
import { effectiveCodes } from './guard-edit'
import type { GuardList, GuardRuleset } from './model'
import { readRejectionSeed, rejectionSeed, rejectionSeedState, seededGuardDraft } from './rejection-draft'

const ROW = { code: 'CV-4-5', payer: 'TAWUNIYA', sameKind: 'E1497' }
const SEED = { code: 'CV-4-5', payer: 'TAWUNIYA', kind: 'E1497' }

const kindList = (id: string, code: string): GuardList => ({
  id,
  name: { en: id, ar: id },
  filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: [code] }] }],
  include: [],
  exclude: [],
})

const doc = (lists: GuardList[] = []): GuardRuleset => ({ schema: 1, kind: 'guard', revision: 7, lists, rules: [] })

describe('rejectionSeed', () => {
  it('a coded row gives its payer, item kind and code', () => {
    expect(rejectionSeed(ROW)).toEqual(SEED)
  })

  it('a row with no code offers nothing', () => {
    expect(rejectionSeed({ ...ROW, code: null })).toBeNull()
    expect(rejectionSeed({ ...ROW, code: '  ' })).toBeNull()
  })
})

describe('readRejectionSeed', () => {
  it('reads back what the row navigated with, and nothing from any other state', () => {
    expect(readRejectionSeed(rejectionSeedState(SEED))).toEqual(SEED)
    expect(readRejectionSeed(null)).toBeNull()
    expect(readRejectionSeed({ folder: 'x' })).toBeNull()
    expect(readRejectionSeed({ rejectionSeed: { payer: 'TAWUNIYA', kind: 'E1497' } })).toBeNull()
  })
})

describe('seededGuardDraft', () => {
  it('adds a draft rule on the payer and a list of the kind, with the code in codes.nphies', () => {
    const next = seededGuardDraft(doc(), 'G-009', SEED)
    const rule = next.rules[0]
    expect(rule).toMatchObject({ id: 'G-009', state: 'draft', name: { en: '', ar: '' } })
    expect(rule.when).toEqual([
      { check: 'request', field: 'payer', anyOf: ['TAWUNIYA'] },
      { check: 'line', inList: 'kind-E1497' },
    ])
    expect(rule.filters).toEqual([{ id: 'kind-E1497', list: 'kind-E1497' }])
    expect(next.lists).toEqual([
      {
        id: 'kind-E1497',
        name: { en: 'E1497', ar: 'E1497' },
        filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E1497'] }] }],
        include: [],
        exclude: [],
      },
    ])
    expect(rule.then[0].codes?.nphies).toBe('CV-4-5')
    expect(effectiveCodes(rule, rule.then[0]).nphies).toBe('CV-4-5')
  })

  it('leaves the document it was given alone', () => {
    const before = doc()
    seededGuardDraft(before, 'G-009', SEED)
    expect(before).toEqual(doc())
  })

  it('reuses a list that is exactly this kind', () => {
    const next = seededGuardDraft(doc([kindList('sema', 'E1497')]), 'G-009', SEED)
    expect(next.lists.map((l) => l.id)).toEqual(['sema'])
    expect(next.rules[0].when[1]).toEqual({ check: 'line', inList: 'sema' })
  })

  it('never takes over a list that holds more than the kind, or another list under its id', () => {
    const wider = { ...kindList('both', 'E1497'), filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E1497', 'E1502'] }] }] }
    const taken = kindList('kind-E1497', 'E0101')
    const next = seededGuardDraft(doc([wider, taken]), 'G-009', SEED)
    expect(next.lists.map((l) => l.id)).toEqual(['both', 'kind-E1497', 'kind-E1497-2'])
    expect(next.rules[0].when[1]).toEqual({ check: 'line', inList: 'kind-E1497-2' })
  })

  it('reads on the wire as the engine spells it: a request block and a line in a list', () => {
    const out = guardRuleOut(seededGuardDraft(doc(), 'G-009', SEED).rules[0])
    expect(out.when).toEqual([
      { check: 'request', field: 'payer', anyOf: ['TAWUNIYA'] },
      { check: 'line', inList: 'kind-E1497' },
    ])
    expect(out).not.toHaveProperty('filters')
  })

  it('a kind with characters a list id refuses still makes a valid id', () => {
    const next = seededGuardDraft(doc(), 'G-009', { ...SEED, kind: 'E 14/97' })
    expect(next.lists[0].id).toBe('kind-E-14-97')
    expect(next.lists[0].filters[0].attributes[0]).toEqual({ field: 'ECode', anyOf: ['E 14/97'] })
  })
})
