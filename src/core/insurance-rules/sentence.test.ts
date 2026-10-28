/**
 * Ticket 607 — a guard rule read as sentences (WHEN / IF / THEN). Every block kind of the guard templates
 * (history, supply, volume, line, reference, group + NOT) reads in full words, a list named by its CURRENT name
 * looked up by id. The rules are the drive's own stubs (`tools/insurance-rules-stubs.mjs`).
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-rules.json'
import { plainSentence, type Sentence } from '@/core/rules/sentence'
import { LISTS, RULES } from '../../../tools/insurance-rules-stubs.mjs'
import type { GuardRule } from './model'
import { conditionSentence, guardSentence, type ConditionNode } from './sentence'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'insurance-rules': en } },
  ns: ['insurance-rules'],
  defaultNS: 'insurance-rules',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const t = instance.getFixedT('en', 'insurance-rules') as unknown as (key: string, o: Record<string, unknown>) => string
const text = (s: Sentence) => plainSentence(s, t)
const node = (n: ConditionNode): string =>
  [text(n.sentence), ...n.clauses.map(text)].join('; ') + (n.children ? ` [${n.children.map(node).join(' | ')}]` : '')

const rule = (id: string): GuardRule => RULES.find((r) => r.id === id)!
const ifOf = (id: string) => rule(id).when.map((c) => node(conditionSentence(c, { rule: rule(id), lists: LISTS })))

describe('guardSentence_rendersEachBlockKind', () => {
  it('history — same item, dispenses, not counting this line (G-001)', () => {
    expect(ifOf('G-001')).toEqual(['the patient was dispensed the same item at least once in the last 3 days, not counting this line'])
  })

  it('history — a list by its current name, quantity, counting this line (G-003)', () => {
    expect(ifOf('G-003')).toEqual(['the patient received at least 5 units of an item in GLP-1 and biologics in the last 28 days, counting this line'])
  })

  it('history — same class other than the same kind (G-005), and distinct stores (G-010)', () => {
    expect(ifOf('G-005')).toEqual([
      'the patient was dispensed another medicine of the same therapeutic class at least once in the last 30 days, not counting this line',
    ])
    expect(ifOf('G-010')).toEqual(['the same kind of medicine was dispensed at 3 or more stores in the last 30 days, counting this line'])
  })

  it('supply — days before due, with its per-list days, accumulation and unknown supply as clauses (G-002)', () => {
    expect(ifOf('G-002')).toEqual([
      'the patient asks for the same kind of medicine more than 10 days before the last supply runs out; ' +
        '7 days for Controlled drugs; early refills add up to 10 spare days over 90 days; a supply of unknown length counts as 30 days',
    ])
  })

  it('supply — the percentage form', () => {
    const c = { check: 'supply' as const, match: 'sameItem' as const, consumedBelow: 0.75 }
    expect(node(conditionSentence(c, { rule: rule('G-002'), lists: LISTS }))).toBe('less than 75% of the last supply of the same item is used')
  })

  it('volume — per pharmacist, per day (G-006)', () => {
    expect(ifOf('G-006')).toEqual(['the pharmacist made at least 20 requests for an item in GLP-1 and biologics today, counting this line'])
  })

  it('line — a field above a number (G-004), and a field after a path', () => {
    expect(ifOf('G-004')).toEqual(["the line's days' supply is above 90"])
    const c = { check: 'line' as const, field: 'supplyEndsOn', after: '$eligibility.coverage.periodEnd' }
    expect(node(conditionSentence(c, { rule: rule('G-004'), lists: LISTS }))).toBe("the line's supply end date is after the policy's end date")
  })

  it('reference — SFDA status and price (G-008, G-009), formulary edit (G-011)', () => {
    expect(ifOf('G-008')).toEqual(['the item is not registered or not marketed with SFDA'])
    expect(ifOf('G-009')).toEqual(['the price is more than SAR 0.50 above the SFDA public price'])
    expect(ifOf('G-011')).toEqual(["the quantity is above the formulary's quantity limit"])
  })

  it('group + NOT — G-007 nests All of, NOT on a leaf, and a NOT Any of (none of)', () => {
    expect(ifOf('G-007')).toEqual([
      'all of these are true [' +
        'the item is in GLP-1 and biologics | ' +
        "it is not true that the line's diagnosis is on the formulary for the item | " +
        'none of these is true [the patient is on the patient list PL-VIP | the policy is on the policy list PO-EXT]]',
    ])
    const tree = conditionSentence(rule('G-007').when[0], { rule: rule('G-007'), lists: LISTS })
    expect(tree.children!.map((c) => [c.check, c.not])).toEqual([
      ['line', false],
      ['formulary', true],
      ['group', true],
    ])
  })

  it('request — switches on field: a policy list (the seeded C-SABIC spelling), a class list, a payer / class by codes', () => {
    const read = (c: unknown) => node(conditionSentence(c as GuardRule['when'][number], { rule: rule('G-001'), lists: LISTS }))
    expect(read({ check: 'request', field: 'policy', inList: 'sabic-policies' })).toBe('the policy is on the policy list sabic-policies')
    expect(read({ check: 'request', field: 'class', inList: 'CL-GOLD' })).toBe("the policy's class is on the class list CL-GOLD")
    expect(read({ check: 'request', field: 'payer', anyOf: ['0001100041', '0001100099'] })).toBe("the request's payer is any of 0001100041 or 0001100099")
    expect(read({ check: 'request', field: 'class', anyOf: ['VIP'] })).toBe("the request's policy class is any of VIP")
    expect(read({ check: 'request', field: 'channel', anyOf: ['bupa'], not: true })).toBe("it is not true that the request's channel is any of bupa")
    expect(read({ check: 'request', field: 'shoeSize', anyOf: ['44'] })).toBe("the request's shoeSize is any of 44")
  })

  it('a block this screen does not know reads as its check, never blank', () => {
    const c = { check: 'eligibility' } as unknown as GuardRule['when'][number]
    expect(node(conditionSentence(c, { rule: rule('G-001'), lists: LISTS }))).toBe('a block this screen cannot read yet: eligibility')
  })
})

describe('guardSentence — WHEN and THEN', () => {
  it('WHEN names the channels, the stores and the window (G-002, G-010)', () => {
    expect(guardSentence(rule('G-002'), LISTS).when.map(text)).toEqual([
      'Checked before a request is sent on NPHIES and Waseel, at stores P001 and P019',
      'From 2026-09-01, with no end',
    ])
    expect(guardSentence(rule('G-010'), LISTS).when.map(text)).toEqual([
      'Checked before a request is sent on NPHIES, Waseel, OMS, and Bupa, at every store',
      'From 2026-09-01 until 2026-12-31',
    ])
  })

  it('a rule naming no channel is checked on EVERY channel — never "on on no channel" (618, live walk)', () => {
    const r = { ...rule('G-001'), audience: { channels: [], stores: [] } } as GuardRule
    expect(text(guardSentence(r, LISTS).when[0])).toBe('Checked before a request is sent on every channel, at every store')
    expect(text(guardSentence({ ...r, audience: null }, LISTS).when[0])).toBe('Checked before a request is sent on every channel, at every store')
  })

  it('THEN says what the severity does, its codes and its suggestion (G-003); unknown facts per onUnknown', () => {
    const g = guardSentence(rule('G-003'), LISTS)
    expect(g.then.map((e) => [e.severity, text(e.does), e.codes.map(text), e.suggest.map(text)])).toEqual([
      ['OVERRIDE', 'let the pharmacist go on with a reason', ['conflict code HD', 'NPHIES code SE-1-9'], ['suggest at most {remaining} units']],
    ])
    expect(g.then[0].says).toEqual(rule('G-003').then[0].says)
    expect(text(g.onUnknown)).toBe('If a fact is unknown, the rule does not fire.')
    expect(text(guardSentence(rule('G-007'), LISTS).onUnknown)).toBe('If a fact is unknown, the pharmacist is warned.')
  })

  it('a severity decides the line: the heaviest effect first', () => {
    const r = { ...rule('G-001'), then: [{ ...rule('G-001').then[0], severity: 'WARN' as const }, rule('G-001').then[0]] }
    expect(guardSentence(r, LISTS).then.map((e) => e.severity)).toEqual(['REFUSE', 'WARN'])
  })
})
