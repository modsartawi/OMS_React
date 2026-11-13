/**
 * Oms 896 — the `insurance-payer-month` namespace ships English and Arabic together and mirrors exactly: an English
 * plural (`_one` / `_other`) is all SIX Arabic forms (the deliverect precedent; ticket 433 was SERIOUS for two).
 * Every key the page BUILDS exists in both, and the menu leaf's label lives in the area's namespace.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-payer-month.json'
import ar from '@/locales/ar/insurance-payer-month.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { ApiError } from '@/core/api'
import { INSURANCE_RULES_AR, INSURANCE_RULES_EN, INSURANCE_RULES_NS } from '@/core/insurance-rules/locales'
import { REFUSAL_CODES, historyLines, refusalKey } from './payer-month-rules'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const valueOf = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)
const has = (locale: unknown, key: string) => valueOf(locale, key) !== undefined
const hasPlural = (locale: unknown, key: string) => has(locale, `${key}_other`)

const pluralBase = (key: string, forms: string[]) =>
  forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null
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

describe('insurance-payer-month — en and ar mirror each other', () => {
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
      const value = valueOf(ar, key) as string
      expect([key, value.trim() === '']).toEqual([key, false])
      expect([key, value === valueOf(en, key)]).toEqual([key, false])
    }
  })

  it('is registered with the area', () => {
    expect(INSURANCE_RULES_NS).toContain('insurance-payer-month')
    expect(INSURANCE_RULES_EN['insurance-payer-month']).toBe(en)
    expect(INSURANCE_RULES_AR['insurance-payer-month']).toBe(ar)
  })
})

describe('insurance-payer-month — the keys the code builds exist', () => {
  const coded = (code: string) => new ApiError('business', '', 400, [{ errorCode: code, errorMessage: '' } as never])

  it.each([en, ar])('the gate, states, refusals, history acts and directions', (locale) => {
    const keys = [
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
      ...['closed', 'reopened', 'open'].map((s) => `state.${s}`),
      ...REFUSAL_CODES.map((c) => refusalKey(coded(c))!),
      refusalKey(new ApiError('business', '', 403))!,
      ...(['Close', 'Reopen', 'Purge'] as const).map((action) => historyLines([{ action } as never])[0].key),
      'correction.direction.Collect',
      'correction.direction.Refund',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the plurals the page counts with', (locale) => {
    for (const key of ['list.count', 'closeAll.button', 'dialog.closeAllBody', 'dialog.alreadyClosed', 'dialog.corrections', 'row.correctionsOnClose', 'done.closedAll'])
      expect([key, hasPlural(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the menu leaf label', (locale) => {
    expect(has(locale, 'menu.payerMonths')).toBe(true)
  })
})
