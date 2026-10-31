/** Oms 699 (BackOffice spec 3271, A1, A2, A7, A9): what the builder offers per rule kind, and a monitor's wire shape. */
import { describe, expect, it } from 'vitest'
import { FHIR_CATALOG } from '../../../tools/fhir-rules-stubs-692.mjs'
import { REISSUE_REASON_ROW } from '../../../tools/fhir-rules-stubs-699.mjs'
import rulesEn from '@/locales/en/insurance-rules.json'
import rulesAr from '@/locales/ar/insurance-rules.json'
import guardsEn from '@/locales/en/insurance-guards.json'
import guardsAr from '@/locales/ar/insurance-guards.json'
import { factKey, groupCatalog, type FhirCatalogRow } from './fhir-catalog'
import { factShapeOf, isFhirPath, rowOfPath } from './fact-tests'
import { documentIn, guardRuleIn, guardRuleOut } from './guard-wire'
import { catalogFor, effectSeveritiesFor, isMonitor, monitorFxFields, newMonitorCondition, newMonitorRule, nextMonitorId, paletteFor, toggleUse } from './monitor'
import { GUARD_SEVERITIES, ruleSeverity, severityRank, type GuardRule, type GuardRuleset } from './model'
import { guardSentence } from './sentence'
import { newGuardRule } from './guard-edit'
import { guardSeverityTone, GUARD_SEVERITY_TONE } from './tones'

const CATALOG = [...FHIR_CATALOG, REISSUE_REASON_ROW] as unknown as FhirCatalogRow[]
const keys = (rows: readonly FhirCatalogRow[]) => rows.map(factKey)

describe('what the builder offers per kind', () => {
  it('a monitor offers info and action and no guard severity; a guard offers no monitor severity', () => {
    expect(effectSeveritiesFor('monitor')).toEqual(['info', 'action'])
    expect(effectSeveritiesFor('guard')).toEqual(['REFUSE', 'OVERRIDE', 'WARN'])
  })

  it('a new monitor raises one review item and has no till effect, audience or unknown rule', () => {
    const r = newMonitorRule('M-001')
    expect(r).toMatchObject({ id: 'M-001', kind: 'monitor', scope: 'claimResponse', uses: ['preauthorization', 'claim'], state: 'draft', onUnknown: 'none' })
    expect(r.then).toEqual([{ effect: 'reviewItem', severity: 'action', says: { en: '', ar: '' } }])
    expect(r.audience).toBeUndefined()
    expect(isMonitor(r)).toBe(true)
    expect(isMonitor(newGuardRule('G-001'))).toBe(false)
  })

  it('numbers its own ids, past a guard id or a hole', () => {
    expect(nextMonitorId([{ id: 'G-009' }])).toBe('M-001')
    expect(nextMonitorId([{ id: 'M-002' }, { id: 'G-009' }, { id: 'M-010' }])).toBe('M-011')
  })

  it('a monitor palette has only what a kept answer can answer', () => {
    expect(paletteFor('monitor').flatMap((g) => g.checks)).toEqual(['history', 'fact', 'formula', 'group'])
    expect(paletteFor('guard').flatMap((g) => g.checks)).toContain('volume')
    expect(newMonitorCondition('fact')).toEqual({ check: 'fact', path: '$claimResponse.outcome', op: 'anyOf', value: [] })
    expect(newMonitorCondition('formula')).toEqual({ check: 'formula', formula: '' })
  })

  it('a use can be turned off, but not the last one', () => {
    const r = newMonitorRule('M-001')
    const one = toggleUse(r, 'claim')
    expect(one.uses).toEqual(['preauthorization'])
    expect(toggleUse(one, 'preauthorization')).toBe(one)
    expect(toggleUse(one, 'claim').uses).toEqual(['preauthorization', 'claim'])
  })
})

describe('$previous and the reissue reason', () => {
  it('a monitor is offered $previous keys for its scope, message and line', () => {
    const offered = keys(catalogFor(CATALOG, 'monitor'))
    expect(offered).toContain('$previous.claimResponse.outcome')
    expect(offered).toContain('$previous.line.claimResponse.approvedQuantity')
    expect(offered).toContain('$claimResponse.reissue.reason')
    expect(offered).toContain('$line.claimResponse.approvedQuantity')
  })

  it('a guard is never offered a $previous key or the reissue reason, and keeps its catalog', () => {
    const offered = keys(catalogFor(CATALOG, 'guard'))
    expect(offered.some((k) => k.includes('previous'))).toBe(false)
    expect(offered).not.toContain('$claimResponse.reissue.reason')
    expect(offered).toEqual(keys(FHIR_CATALOG as unknown as FhirCatalogRow[]))
  })

  it('a monitor is offered no other message, and no previous reissue reason', () => {
    const rows = catalogFor(CATALOG, 'monitor')
    expect(rows.every((r) => r.moment === 'claimResponse')).toBe(true)
    expect(keys(rows)).not.toContain('$previous.claimResponse.reissue.reason')
  })

  it('previous keys sit in their own catalog group', () => {
    const groups = groupCatalog(catalogFor(CATALOG, 'monitor')).map((g) => g.message)
    expect(groups).toEqual(['claimResponse', 'previous'])
  })

  it('a $previous key reads with the answer field it repeats', () => {
    expect(isFhirPath('$previous.line.claimResponse.approvedQuantity')).toBe(true)
    expect(rowOfPath(CATALOG, '$previous.line.claimResponse.approvedQuantity')?.key).toBe('approvedQuantity')
    const shape = factShapeOf({ check: 'fact', path: '$previous.claimResponse.errors', op: 'anyOf', value: [] }, CATALOG, [])
    expect(shape).toMatchObject({ type: 'code', cardinality: 'list', known: true })
  })

  it('the ƒx helper offers the scope and $previous, no list and no date', () => {
    const fields = monitorFxFields(CATALOG, 'en')
    const by = (p: string) => fields.find((f) => f.code === p)
    expect(by('line.claimResponse.approvedQuantity')).toMatchObject({ group: 'claimResponse', type: 'number', label: 'Approved quantity' })
    expect(by('previous.line.claimResponse.approvedQuantity')).toMatchObject({ group: 'previous', type: 'number' })
    expect(by('claimResponse.reissue.reason')).toMatchObject({ group: 'claimResponse', type: 'text' })
    expect(by('claimResponse.errors')).toBeUndefined()
    expect(fields.some((f) => f.group !== 'claimResponse' && f.group !== 'previous')).toBe(false)
  })
})

describe('a monitor on the wire', () => {
  const wire = {
    id: 'M-001',
    kind: 'monitor',
    scope: 'claimResponse',
    uses: ['preauthorization'],
    name: { en: 'Cut', ar: 'خفض' },
    folder: 'Reissues',
    state: 'draft',
    when: [
      { check: 'formula', expr: ['<', '$line.claimResponse.approvedQuantity', '$previous.line.claimResponse.approvedQuantity'] },
      { check: 'claimResponse', field: 'reissue.reason', anyOf: ['correction'] },
      { check: 'previous', field: 'claimResponse.outcome', anyOf: ['approved'] },
    ],
    then: [{ effect: 'reviewItem', severity: 'action', says: { en: 'Cut', ar: 'خفض' } }],
  }

  it('reads into the builder and goes back unchanged, and a guard is untouched', () => {
    const rule = guardRuleIn(wire)
    expect(rule.when[0]).toMatchObject({ check: 'formula', formula: 'line.claimResponse.approvedQuantity < previous.line.claimResponse.approvedQuantity' })
    expect(rule.when[1]).toEqual({ check: 'fact', path: '$claimResponse.reissue.reason', op: 'anyOf', value: ['correction'] })
    expect(rule.when[2]).toEqual({ check: 'fact', path: '$previous.claimResponse.outcome', op: 'anyOf', value: ['approved'] })
    expect(guardRuleOut(rule)).toEqual(wire)
    expect(Object.keys(guardRuleOut(newGuardRule('G-001')))).not.toContain('kind')
  })

  it('whatever came in, a monitor never goes out with a till effect', () => {
    const dirty = {
      ...wire,
      onUnknown: 'warn',
      audience: { channels: ['nphies'] },
      then: [{ effect: 'guard', severity: 'REFUSE', says: { en: 'x', ar: 'س' }, codes: { nphies: 'CV-4-8' }, suggest: { maxQuantity: 1 }, acknowledge: true }],
    }
    const rule = guardRuleIn(dirty)
    expect(rule.onUnknown).toBe('none')
    const out = guardRuleOut({ ...rule, onUnknown: 'warn' }) as Record<string, unknown>
    expect(out.then).toEqual([{ effect: 'reviewItem', severity: 'info', says: { en: 'x', ar: 'س' } }])
    expect(out).not.toHaveProperty('onUnknown')
    expect(out).not.toHaveProperty('audience')
  })

  it('a ruleset holding guards and monitors keeps each its own kind', () => {
    const doc = documentIn({ kind: 'guard', schema: 1, revision: 1, lists: [], rules: [wire, guardRuleOut(newGuardRule('G-001'))] }) as GuardRuleset
    expect(doc.rules.map(isMonitor)).toEqual([true, false])
  })
})

describe('a monitor read and drawn', () => {
  const rule: GuardRule = { ...newMonitorRule('M-001'), uses: ['claim'] }

  it('severity ranks below every guard severity, action over info, and the guard order stands', () => {
    expect(GUARD_SEVERITIES).toEqual(['REFUSE', 'OVERRIDE', 'WARN'])
    expect(severityRank('WARN')).toBeLessThan(severityRank('action'))
    expect(severityRank('action')).toBeLessThan(severityRank('info'))
    expect(ruleSeverity({ then: [{ effect: 'reviewItem', severity: 'info', says: { en: '', ar: '' } }] })).toBe('info')
  })

  it('has its own tones', () => {
    expect(guardSeverityTone('action')).not.toEqual(guardSeverityTone('nonsense'))
    expect(guardSeverityTone('REFUSE')).toBe(GUARD_SEVERITY_TONE.REFUSE)
  })

  it('reads the answers it watches and a review item, no channel, no pharmacist, no codes', () => {
    const s = guardSentence(rule, [])
    expect(s.when).toHaveLength(1)
    expect(s.when[0].key).toBe('sentence.when.monitor')
    expect(s.then[0]).toMatchObject({ severity: 'action', codes: [], suggest: [] })
    expect(s.then[0].does.key).toBe('sentence.then.action')
    expect(s.onUnknown.key).toBe('sentence.onUnknown.none')
  })

  it('a $previous fact says it is the answer before, and this answer\'s does not', () => {
    const read = (path: string) =>
      guardSentence({ ...rule, when: [{ check: 'fact', path, op: 'atLeast', value: 1 }] }, [], undefined, CATALOG).conditions[0]
    const value = (n: ReturnType<typeof read>) => (n as unknown as { sentence: { values: { fact: { kind: string; sentence?: { key: string } } } } }).sentence.values.fact
    expect(value(read('$previous.line.claimResponse.approvedQuantity'))).toMatchObject({ kind: 'phrase', sentence: { key: 'sentence.fact.previous' } })
    expect(value(read('$line.claimResponse.approvedQuantity')).kind).toBe('says')
  })

  it('every word is in both languages', () => {
    for (const rules of [rulesEn, rulesAr]) {
      expect(rules.severity.info).toBeTruthy()
      expect(rules.severity.action).toBeTruthy()
      expect(rules.kind.monitor).toBeTruthy()
      expect(rules.kind.guard).toBeTruthy()
      expect(rules.sentence.then.info).toBeTruthy()
      expect(rules.sentence.then.action).toBeTruthy()
      expect(rules.sentence.when.monitor).toBeTruthy()
      expect(rules.sentence.when.use.claim).toBeTruthy()
      expect(rules.sentence.when.use.preauthorization).toBeTruthy()
      expect(rules.catalog.message.previous).toBeTruthy()
    }
    for (const guards of [guardsEn, guardsAr]) {
      expect(guards.list.newMonitor).toBeTruthy()
      expect(guards.monitor.neverTouches).toBeTruthy()
      expect(guards.editor.titleNewMonitor).toBeTruthy()
      expect(guards.editor.titleEditMonitor).toBeTruthy()
      expect(guards.fx.group.previous).toBeTruthy()
      expect(guards.fx.recipe.cutQuantity.title).toBeTruthy()
    }
  })
})
