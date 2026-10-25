/**
 * Ticket 568 — the `serving-lists` namespace ships English and Arabic together; the Arabic file mirrors the
 * English keys exactly, an English plural (`_one` / `_other`) being all SIX Arabic forms. And the keys the
 * code builds (duty labels, filter options) exist in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/serving-lists.json'
import ar from '@/locales/ar/serving-lists.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { dutyCell } from './duty-cell'
import { MEMBER_DUTY_OPTIONS, MEMBER_ENABLED_OPTIONS } from './members-filter'
import { LIST_TABS } from './tab'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

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

describe('serving-lists — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
  })

  it('the same plural families, English two forms and Arabic six', () => {
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('serving-lists — the keys the code builds exist', () => {
  it.each([en, ar])('every known duty state\'s label', (locale) => {
    const keys = [
      ...['OnDuty', 'NoRoster'].map((duty) => dutyCell({ duty, todayShifts: [] }).labelKey),
      dutyCell({ duty: 'OffDuty', todayShifts: [] }).labelKey,
      dutyCell({ duty: 'OffDuty', todayShifts: [{ open: '09:00', close: '17:00', overnight: false }] }).labelKey,
      'duty.nextMorning',
      'duty.noRosterHint',
    ]
    for (const key of keys) expect([key, has(locale, key!)]).toEqual([key, true])
  })

  it.each([en, ar])('every filter option and tab', (locale) => {
    const keys = [
      ...MEMBER_DUTY_OPTIONS.map((o) => `members.filters.dutyOption.${o}`),
      ...MEMBER_ENABLED_OPTIONS.map((o) => `member.${o}`),
      ...LIST_TABS.map((tab) => `tabs.${tab}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([`access.${key}`, has(locale, `access.${key}`)]).toEqual([`access.${key}`, true])
  })
})
