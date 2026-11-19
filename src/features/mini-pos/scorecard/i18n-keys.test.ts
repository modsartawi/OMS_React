/**
 * oms 918 — `mini-pos-scorecard` ships English and Arabic together, the Arabic mirroring the English keys exactly, and every
 * key the screen builds from data (a band, a verdict, a failure kind, a weekly flag) and the gate's sentences exist in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/mini-pos-scorecard.json'
import ar from '@/locales/ar/mini-pos-scorecard.json'
import { hasLocaleKey } from '@/core/test/locale'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

describe('mini-pos-scorecard — en and ar', () => {
  it('mirror each other', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the screen builds', (locale) => {
    const verdicts = ['go', 'panel', 'no-go', 'no-cost', 'no-base', 'unknown']
    const keys = [
      ...['go', 'panel', 'no-go'].map((b) => `band.${b}`),
      ...verdicts.map((v) => `verdict.${v}`),
      ...verdicts.map((v) => `verdictHint.${v}`),
      ...['invalid', 'denied', 'failed'].map((k) => `failure.${k}Title`),
      ...['underHalf', 'pause'].map((k) => `weekly.paid.${k}`),
      ...['trial', 'control', 'sales', 'lastYear', 'growth', 'upliftSales', 'marginRate', 'grossMargin', 'countedCost', 'fullCost'].map(
        (k) => `money.${k}`,
      ),
      ...['trial', 'control', 'other'].map((k) => `pharmacies.roles.${k}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
