/**
 * Ticket 612 — the `insurance-simulator` namespace ships English and Arabic together, each mirroring the other's
 * keys; every key the screen builds (tabs, outcomes, trace values, problems, back-test statuses) exists in both,
 * and the area's menu names the Simulator leaf.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-simulator.json'
import ar from '@/locales/ar/insurance-simulator.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'
import { BACKTEST_STATUSES } from '@/core/insurance-rules/backtest'
import { GUARD_LINE_OUTCOMES } from '@/core/insurance-rules/guard-check'
import { SIMULATOR_TABS } from './query'
import { SIM_CHANNELS } from './simulate'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-simulator — en and ar mirror each other', () => {
  it('the same keys, and no plural family (no count is ever interpolated)', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(one|other)$/.test(k))).toEqual([])
  })

  it('the same {{values}} in each pair', () => {
    const marks = (s: string) => [...s.matchAll(/\{\{\w+\}\}|<\/?\w+>/g)].map((m) => m[0]).sort()
    for (const key of leaves(en)) expect([key, marks(String(localeAt(ar, key)))]).toEqual([key, marks(String(localeAt(en, key)))])
  })
})

describe('insurance-simulator — the keys the code builds exist', () => {
  it.each([en, ar])('tabs, outcomes, trace values, problems, statuses, form fields', (locale) => {
    const keys = [
      ...SIMULATOR_TABS.map((k) => `tabs.${k}`),
      ...GUARD_LINE_OUTCOMES.map((k) => `outcome.${k}`),
      ...['true', 'false', 'unknown', 'unread'].map((k) => `trace.value.${k}`),
      ...['required', 'positive', 'wholeNumber', 'amount'].map((k) => `form.problem.${k}`),
      ...BACKTEST_STATUSES.map((k) => `backtest.status.${k}`),
      ...['store', 'payer', 'policy', 'class', 'patientKey', 'item', 'qty', 'unit', 'daysSupply', 'icd', 'price'].map((k) => `form.${k}`),
      ...['maxQuantity', 'maxDaysSupply'].map((k) => `result.suggestion.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([areaEn, areaAr])('the menu leaf and every channel', (locale) => {
    expect(hasLocaleKey(locale, 'menu.simulator')).toBe(true)
    for (const c of SIM_CHANNELS) expect(hasLocaleKey(locale, `sentence.channel.${c}`)).toBe(true)
  })
})
