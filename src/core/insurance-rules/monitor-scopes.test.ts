/** Oms 701 (BackOffice spec 3271, A11, stories 43, 44): a monitor's communication and payment scopes. */
import { describe, expect, it } from 'vitest'
import { SCOPES_CATALOG } from '../../../tools/fhir-rules-stubs-701.mjs'
import { parseExpr } from '@/core/rules/expr'
import rulesEn from '@/locales/en/insurance-rules.json'
import rulesAr from '@/locales/ar/insurance-rules.json'
import guardsEn from '@/locales/en/insurance-guards.json'
import guardsAr from '@/locales/ar/insurance-guards.json'
import { factKey, type FhirCatalogRow } from './fhir-catalog'
import { factShapeOf, isFhirPath } from './fact-tests'
import { guardRuleIn, guardRuleOut } from './guard-wire'
import { MONITOR_FX_RECIPES, catalogFor, monitorFxFields, newMonitorCondition, newMonitorRule, paletteFor, setMonitorScope } from './monitor'
import type { GuardCondition, GuardRule } from './model'
import { guardSentence } from './sentence'

const keys = (rows: readonly FhirCatalogRow[]) => rows.map(factKey)
const fact = (path: string): GuardCondition => ({ check: 'fact', path, op: 'anyOf', value: [] })

describe('each scope offers only its own facts', () => {
  it('a communication monitor reads reason, category and the payload flag, and no $previous', () => {
    expect(keys(catalogFor(SCOPES_CATALOG, 'monitor', 'communicationRequest'))).toEqual(['$communicationRequest.reason', '$communicationRequest.category', '$communicationRequest.payloadTextPresent'])
  })

  it('the payload is a flag: no fact gives its content', () => {
    const payload = catalogFor(SCOPES_CATALOG, 'monitor', 'communicationRequest').filter((r) => /payload/i.test(r.key))
    expect(payload.map((r) => [r.key, r.type])).toEqual([['payloadTextPresent', 'flag']])
  })

  it('a payment monitor reads the four detail facts, and no $previous', () => {
    expect(keys(catalogFor(SCOPES_CATALOG, 'monitor', 'paymentReconciliation'))).toEqual([
      '$paymentReconciliation.detail.payment',
      '$paymentReconciliation.detail.earlyFee',
      '$paymentReconciliation.detail.nphiesFee',
      '$paymentReconciliation.detail.amount',
    ])
  })

  it('a claim response monitor still has its $previous, and neither new scope', () => {
    const offered = keys(catalogFor(SCOPES_CATALOG, 'monitor', 'claimResponse'))
    expect(offered).toContain('$previous.claimResponse.outcome')
    expect(offered.some((k) => /communicationRequest|paymentReconciliation/.test(k))).toBe(false)
  })

  it('a guard is offered neither new scope', () => {
    expect(keys(catalogFor(SCOPES_CATALOG, 'guard')).some((k) => /communicationRequest|paymentReconciliation/.test(k))).toBe(false)
  })

  it('the ƒx helper follows the scope, money as money and the flag as a yes or no', () => {
    const pay = monitorFxFields(SCOPES_CATALOG, 'en', 'paymentReconciliation')
    expect(pay.map((f) => f.code)).toEqual(['paymentReconciliation.detail.payment', 'paymentReconciliation.detail.earlyFee', 'paymentReconciliation.detail.nphiesFee', 'paymentReconciliation.detail.amount'])
    expect(pay.every((f) => f.type === 'money' && f.group === 'paymentReconciliation')).toBe(true)
    const comm = monitorFxFields(SCOPES_CATALOG, 'en', 'communicationRequest')
    expect(comm.find((f) => f.code === 'communicationRequest.payloadTextPresent')).toMatchObject({ type: 'bool', group: 'communicationRequest' })
  })

  it('each scope has its own recipes, and every one parses', () => {
    expect(MONITOR_FX_RECIPES.paymentReconciliation.map((r) => r.key)).toEqual(['underpaid'])
    expect(MONITOR_FX_RECIPES.communicationRequest.map((r) => r.key)).toEqual(['hasPayloadText'])
    expect(MONITOR_FX_RECIPES.claimResponse.map((r) => r.key)).toEqual(['cutQuantity', 'reissueReason'])
    for (const r of Object.values(MONITOR_FX_RECIPES).flat()) expect(parseExpr(r.formula, { filters: [] }).ok).toBe(true)
  })

  it('history is offered on the claim response only', () => {
    expect(paletteFor('monitor', 'claimResponse').flatMap((g) => g.checks)).toEqual(['history', 'fact', 'formula', 'group'])
    expect(paletteFor('monitor', 'communicationRequest').flatMap((g) => g.checks)).toEqual(['fact', 'formula', 'group'])
    expect(paletteFor('monitor', 'paymentReconciliation').flatMap((g) => g.checks)).toEqual(['fact', 'formula', 'group'])
  })

  it('a new fact starts on the scope, with a test its type can answer', () => {
    expect(newMonitorCondition('fact', 'communicationRequest')).toEqual({ check: 'fact', path: '$communicationRequest.reason', op: 'anyOf', value: [] })
    expect(newMonitorCondition('fact', 'paymentReconciliation')).toEqual({ check: 'fact', path: '$paymentReconciliation.detail.payment', op: 'below', value: { amount: '0', currency: 'SAR' } })
  })

  it('a scope key is a FHIR path and takes its shape from the catalog', () => {
    expect(isFhirPath('$paymentReconciliation.detail.amount')).toBe(true)
    expect(isFhirPath('$communicationRequest.reason')).toBe(true)
    const shape = factShapeOf({ check: 'fact', path: '$communicationRequest.payloadTextPresent', op: 'is', value: true }, SCOPES_CATALOG, [])
    expect(shape).toMatchObject({ type: 'flag', known: true })
  })
})

describe('changing a monitor scope', () => {
  const on: GuardRule = {
    ...newMonitorRule('M-001'),
    when: [
      fact('$claimResponse.outcome'),
      fact('$previous.claimResponse.outcome'),
      { check: 'formula', formula: 'line.claimResponse.approvedQuantity < previous.line.claimResponse.approvedQuantity' },
      { check: 'group', mode: 'any', conditions: [fact('$line.claimResponse.copay')] },
    ] as GuardCondition[],
  }

  it('drops what the new scope cannot read, an emptied group with it, and the uses', () => {
    const r = setMonitorScope(on, 'paymentReconciliation')
    expect(r.scope).toBe('paymentReconciliation')
    expect(r.when).toEqual([])
    expect(r.uses).toBeUndefined()
  })

  it('keeps what the new scope reads, inside a group too', () => {
    const own = fact('$communicationRequest.reason')
    const rule = { ...on, when: [own, { check: 'group', mode: 'any', conditions: [own, fact('$claimResponse.outcome')] }] as GuardCondition[] }
    expect(setMonitorScope(rule, 'communicationRequest').when).toEqual([own, { check: 'group', mode: 'any', conditions: [own] }])
  })

  it('history goes when leaving the claim response, and both uses come back on returning', () => {
    const history = { ...on, when: [newMonitorCondition('history')] }
    expect(setMonitorScope(history, 'communicationRequest').when).toEqual([])
    const back = setMonitorScope(setMonitorScope(on, 'communicationRequest'), 'claimResponse')
    expect(back.uses).toEqual(['preauthorization', 'claim'])
  })

  it('the same scope is the same rule', () => {
    expect(setMonitorScope(on, 'claimResponse')).toBe(on)
  })
})

describe('on the wire, and read', () => {
  const wire = {
    id: 'M-002',
    kind: 'monitor',
    scope: 'paymentReconciliation',
    name: { en: 'Under', ar: 'أقل' },
    folder: '',
    state: 'draft',
    when: [
      { check: 'paymentReconciliation', field: 'detail.payment', under: { amount: '100.125', currency: 'SAR' } },
      { check: 'formula', expr: ['<', '$paymentReconciliation.detail.payment', '$paymentReconciliation.detail.amount'] },
    ],
    then: [{ effect: 'reviewItem', severity: 'action', says: { en: 'Under', ar: 'أقل' } }],
  }

  it('a payment monitor goes back unchanged, its amount never through a float', () => {
    const rule = guardRuleIn(wire)
    expect(rule.when[0]).toEqual({ check: 'fact', path: '$paymentReconciliation.detail.payment', op: 'below', value: { amount: '100.125', currency: 'SAR' } })
    expect(rule.uses).toBeUndefined()
    expect(guardRuleOut(rule)).toEqual(wire)
  })

  it('a communication monitor reads its flag and its noneOf', () => {
    const blocks = [
      { check: 'communicationRequest', field: 'payloadTextPresent', is: true },
      { check: 'communicationRequest', field: 'reason', noneOf: ['x'] },
    ]
    const rule = guardRuleIn({ ...wire, scope: 'communicationRequest', when: blocks })
    expect(rule.when[0]).toEqual({ check: 'fact', path: '$communicationRequest.payloadTextPresent', op: 'is', value: true })
    expect((guardRuleOut(rule) as { when: unknown }).when).toEqual(blocks)
  })

  it('uses never go out on a scope that has none', () => {
    expect(guardRuleOut({ ...newMonitorRule('M-003'), scope: 'communicationRequest' })).not.toHaveProperty('uses')
  })

  it('a sentence says which message it reads, not answers to a claim', () => {
    expect(guardSentence({ ...newMonitorRule('M-1'), scope: 'communicationRequest', uses: undefined }, []).when[0].key).toBe('sentence.when.monitorScope.communicationRequest')
    expect(guardSentence({ ...newMonitorRule('M-1'), scope: 'paymentReconciliation', uses: undefined }, []).when[0].key).toBe('sentence.when.monitorScope.paymentReconciliation')
    expect(guardSentence(newMonitorRule('M-1'), []).when[0].key).toBe('sentence.when.monitor')
  })
})

describe('every word in both languages', () => {
  it('en and ar', () => {
    for (const rules of [rulesEn, rulesAr]) {
      expect(rules.catalog.message.communicationRequest).toBeTruthy()
      expect(rules.catalog.message.paymentReconciliation).toBeTruthy()
      expect(rules.sentence.when.monitorScope.communicationRequest).toBeTruthy()
      expect(rules.sentence.when.monitorScope.paymentReconciliation).toBeTruthy()
    }
    for (const guards of [guardsEn, guardsAr]) {
      expect(guards.monitor.unknownFor.communicationRequest).toBeTruthy()
      expect(guards.monitor.unknownFor.paymentReconciliation).toBeTruthy()
      expect(guards.monitor.scopeNote.communicationRequest).toBeTruthy()
      expect(guards.monitor.scopeNote.paymentReconciliation).toBeTruthy()
      expect(guards.monitor.scopeDropped).toBeTruthy()
      expect(guards.fx.group.communicationRequest).toBeTruthy()
      expect(guards.fx.group.paymentReconciliation).toBeTruthy()
      expect(guards.fx.recipe.underpaid.title).toBeTruthy()
      expect(guards.fx.recipe.hasPayloadText.title).toBeTruthy()
    }
  })
})
