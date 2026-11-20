/**
 * Oms 922 — the `insurance-patterns` namespace ships English and Arabic together and mirrors exactly: an English plural
 * (`_one` / `_other`) is all SIX Arabic forms. It is registered, and every key the screens BUILD (a status, a signal, a
 * severity, a duration, a mark's problem) has words in both.
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import en from '@/locales/en/insurance-patterns.json'
import ar from '@/locales/ar/insurance-patterns.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'
import { SEVERITIES, SIGNALS, STATUSES } from './filter'
import type { MarkProblem } from './mark'
import type { DurationWords } from './units'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const pluralBase = (key: string, forms: string[]) => forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null
function shape(keys: string[], forms: string[]) {
  const plain = new Set<string>()
  const plurals = new Map<string, Set<string>>()
  for (const key of keys) {
    const base = pluralBase(key, forms)
    if (base === null) plain.add(key)
    else plurals.set(base, (plurals.get(base) ?? new Set()).add(key.slice(base.length)))
  }
  return { plain, plurals }
}

describe('insurance-patterns — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys and plural families', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
  })

  it('English plurals have _one and _other; Arabic ones all six', () => {
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })

  it('no Arabic value is blank or copied from English', () => {
    for (const key of leaves(ar)) {
      const value = localeAt(ar, key) as string
      expect([key, value.trim() === '']).toEqual([key, false])
      expect([key, value === localeAt(en, key)]).toEqual([key, false])
    }
  })
})

describe('insurance-patterns — registered', () => {
  it('in both languages', () => {
    expect(i18n.options.ns).toContain('insurance-patterns')
    expect(i18n.getResourceBundle('en', 'insurance-patterns')).toEqual(en)
    expect(i18n.getResourceBundle('ar', 'insurance-patterns')).toEqual(ar)
  })
})

describe('insurance-patterns — the keys the screens build exist', () => {
  const DURATIONS: DurationWords['key'][] = ['minutes', 'hours', 'hoursMinutes', 'days', 'daysHours']
  const PROBLEMS: MarkProblem[] = ['status', 'note', 'tooLong']

  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s: the gate, the menu, every status, signal, severity, duration and mark problem', (_lang, locale) => {
    const keys = [
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
      'menu.group',
      'menu.cases',
      ...STATUSES.map((s) => `status.${s}`),
      'status.unknown',
      ...SIGNALS.map((s) => `signal.${s}`),
      'signal.unknown',
      ...SEVERITIES.map((s) => `severity.${s}`),
      'severity.unknown',
      ...DURATIONS.map((d) => `duration.${d}`),
      ...PROBLEMS.map((p) => `case.marks.problem.${p}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s: the plurals the screens count with', (_lang, locale) => {
    for (const key of ['list.count', 'case.timeline.count']) expect([key, hasLocaleKey(locale, `${key}_other`)]).toEqual([key, true])
  })
})

describe('insurance-patterns — a case with no legs says only what the legs need', () => {
  // The server joins consecutive COUNTER dispenses into legs (4053, each marked `counter`), so no leg means fewer than two of them.
  // "The counter dispenses were all at one store" named a cause the screen cannot know, and was often false (review 13).
  it('in English and Arabic, with no cause the screen cannot know', () => {
    expect(localeAt(en, 'case.route.legs.none')).toBe('No legs: fewer than two counter dispenses.')
    expect(localeAt(ar, 'case.route.legs.none')).toBe('لا مقاطع: أقل من عمليتي صرف من الصيدلية.')
  })
})
