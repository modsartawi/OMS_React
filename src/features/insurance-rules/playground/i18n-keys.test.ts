/**
 * Ticket 677 — the `insurance-playground` namespace ships English and Arabic together, each mirroring the other's
 * keys; every key the page builds (the boxes' problems, trace values, outcome words, the no-access words) exists in
 * both, and the area's menu names the Playground leaf.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-playground.json'
import ar from '@/locales/ar/insurance-playground.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'
import { GUARD_LINE_OUTCOMES } from '@/core/insurance-rules/guard-check'
import { RESOLVED_SOURCES } from '@/core/insurance-rules/coverage-model'
import { PLAYGROUND_KINDS } from '@/core/insurance-rules/playground'
import { DATA_TABS, type ExperimentBox } from './experiment'
import { LINE_FIELDS, PATIENT_FIELDS, REQUEST_FIELDS } from './data-form'
import { COVERAGE_INVOICE_KEYS, COVERAGE_LINE_KEYS } from './verdict'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const BOXES: readonly ExperimentBox[] = ['data', 'document']

describe('insurance-playground — en and ar mirror each other', () => {
  it('the same keys, and no plural family', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(zero|one|two|few|many|other)$/.test(k))).toEqual([])
  })

  it('the same {{values}} in each pair', () => {
    const marks = (s: string) => [...s.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map((m) => m[0]).sort()
    for (const key of leaves(en)) expect([key, marks(String(localeAt(ar, key)))]).toEqual([key, marks(String(localeAt(en, key)))])
  })
})

describe('insurance-playground — the keys the code builds exist', () => {
  it.each([en, ar])('boxes, trace values, outcome, access', (locale) => {
    const keys = [
      'title',
      'lede',
      'access.deniedTitle',
      'access.deniedHint',
      'run.running',
      ...BOXES.map((b) => `json.problem.${b}`),
      // 684: the Data pane's tabs and the Raw experiment's intake report
      ...['tabs.label', 'rawHint', ...DATA_TABS.map((k) => `tabs.${k}`)].map((k) => `data.${k}`),
      ...['title', 'hint', 'ignored', 'didYouMean', 'refused', 'expected', 'read'].map((k) => `intake.${k}`),
      ...['true', 'false', 'unknown'].map((v) => `trace.value.${v}`),
      ...['title', 'empty', 'failed', 'refused', 'tabs.label', 'tabs.saw', 'nothingMatched', 'matchedLines', 'line', 'matched', 'notMatched', 'errors.title'].map((k) => `outcome.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('678: kind, as of, Tab B and every verdict word', (locale) => {
    const keys = [
      'kind.label',
      'kind.hint',
      ...PLAYGROUND_KINDS.map((k) => `kind.${k}`),
      'asOf.label',
      'asOf.hint',
      'asOf.sent',
      'outcome.tabs.live',
      'verdict.none',
      'verdict.percent',
      'verdict.outcome.label',
      ...[...GUARD_LINE_OUTCOMES, 'unknown'].map((o) => `verdict.outcome.${o}`),
      'verdict.fired.label',
      'verdict.fired.none',
      ...['field', 'invoice', 'value', 'source', 'yes', 'no', 'blank'].map((k) => `verdict.coverage.${k}`),
      ...[...COVERAGE_LINE_KEYS, ...COVERAGE_INVOICE_KEYS].map((k) => `verdict.coverage.values.${k}`),
      ...[...RESOLVED_SOURCES, 'unknown'].map((s) => `verdict.coverage.sources.${s}`),
      ...['line', 'category', 'group', 'source', 'rule', 'unknowns'].map((k) => `verdict.category.${k}`),
      ...['rule', 'default', 'none'].map((s) => `verdict.category.sources.${s}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('679: the Rule pane ruleset and the errors shown on their block', (locale) => {
    const keys = [
      'rule.hintEditors',
      ...['label', 'rule', 'add', 'up', 'down', 'remove', 'jsonOnly', 'broken', 'empty', 'readsAs'].map((k) => `ruleset.${k}`),
      'outcome.errors.onBlocks',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('682: the form, its sections, every field and its problems', (locale) => {
    const keys = [
      'formHint',
      ...['request', 'patient', 'lines', 'line', 'noLines', 'addLine', 'lineUp', 'lineDown', 'lineRemove', 'icdHint', 'more'].map((k) => `form.${k}`),
      ...['attributes', 'attributesHint', 'attributeKey', 'attributeValue', 'attributeRemove', 'addAttribute'].map((k) => `form.${k}`),
      ...['invalid', 'unshaped'].map((k) => `form.problem.${k}`),
      ...[...REQUEST_FIELDS, ...PATIENT_FIELDS, ...LINE_FIELDS].map((f) => `form.fields.${f}`),
    ].map((k) => `data.${k}`)
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the menu leaf', (locale) => {
    expect(hasLocaleKey(locale, 'menu.playground')).toBe(true)
  })
})
