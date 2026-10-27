/**
 * Ticket 617 — the `insurance-coverage` namespace ships English and Arabic together, the Arabic mirroring the
 * English keys exactly; every key the code builds (groups, effects, payer marks, settings problems, meanings)
 * exists in both; and the area's three menu labels exist.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-coverage.json'
import ar from '@/locales/ar/insurance-coverage.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import guardsEn from '@/locales/en/insurance-guards.json'
import guardsAr from '@/locales/ar/insurance-guards.json'
import { CATEGORY_GROUPS, COVERAGE_EFFECTS, COVERAGE_SEGMENTS } from '@/core/insurance-rules/coverage-model'
import { COVERAGE_RULE_PROBLEMS } from './ruleset-edit'
import { FIELD_SCOPES } from '@/core/insurance-rules/registry'
import { hasLocaleKey } from '@/core/test/locale'
import { BENEFIT_MEANINGS, BENEFIT_SOURCES, SETTINGS_FIELD_WORDS, SETTINGS_PROBLEMS } from './settings'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-coverage — en and ar mirror each other', () => {
  it('the same keys (no plurals)', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(one|other)$/.test(k))).toEqual([])
  })
})

describe('insurance-coverage — the keys the code builds exist', () => {
  it.each([en, ar])('groups, effects, marks, problems, meanings, scopes, kinds', (locale) => {
    const keys = [
      ...CATEGORY_GROUPS.map((g) => `group.${g}`),
      ...COVERAGE_EFFECTS.map((e) => `effect.${e}`),
      ...['covered', 'priorApproval', 'exceptionPrescriptions'].flatMap((e) => [`effect.yes.${e}`, `effect.no.${e}`, `reads.${e}.yes`, `reads.${e}.no`]),
      ...['priceCap', 'quantityCap', 'daysSupplyCap', 'segment'].map((e) => `reads.${e}`),
      ...['both', 'percent', 'max', 'none'].map((w) => `reads.deductible.${w}`),
      'unit.percentOf',
      ...['line', 'invoice'].map((l) => `effect.level.${l}`),
      ...COVERAGE_SEGMENTS.map((s) => `segment.${s}`),
      ...COVERAGE_RULE_PROBLEMS.map((p) => `ruleProblem.${p}`),
      ...BENEFIT_SOURCES.map((s) => `source.${s}`),
      ...['fills', 'overrides'].flatMap((m) => [`payerMark.${m}`, `payerMark.${m}Hint`]),
      ...SETTINGS_PROBLEMS.map((p) => `problem.${p}`),
      ...SETTINGS_FIELD_WORDS.map((f) => `log.field.${f}`),
      ...BENEFIT_MEANINGS.map((m) => `meaning.${m}`),
      ...FIELD_SCOPES.map((s) => `conditions.scope.${s}`),
      ...['category', 'coverage'].flatMap((k) => ['title', 'order', 'ifHint', 'thenHint'].map((w) => `${k}.${w}`)),
      ...['days', 'years', 'units', 'sar', 'percent'].map((u) => `unit.${u}`),
      ...['atLeast', 'below', 'anyOf', 'noneOf'].map((o) => `conditions.opName.${o}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([areaEn, areaAr])('the menu labels and the % unit of a fact sentence', (locale) => {
    for (const key of ['menu.insurers', 'menu.categories', 'menu.coverage', 'sentence.fact.unit.percent']) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([guardsEn, guardsAr])('the guard palette names each registry scope (608 reads facts from the registry)', (locale) => {
    for (const s of FIELD_SCOPES) expect(hasLocaleKey(locale, `editor.factScope.${s}`)).toBe(true)
  })
})
