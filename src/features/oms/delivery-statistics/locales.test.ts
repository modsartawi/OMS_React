/**
 * Spec 811 review: the `delivery-statistics` namespace ships English and Arabic together, and each Arabic
 * file mirrors the English keys exactly — an English plural (`_one` / `_other`) being all six Arabic forms,
 * and a key that is an object in one (`chart.label.{hour,day}`) never a string in the other.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/delivery-statistics.json'
import ar from '@/locales/ar/delivery-statistics.json'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

/** Each leaf key with a plural suffix folded to its base; every plural carries all its locale's forms. */
function shape(keys: string[], forms: string[]): { plain: string[]; plurals: string[] } {
  const plain = new Set<string>()
  const plurals = new Map<string, string[]>()
  for (const key of keys) {
    const form = forms.find((f) => key.endsWith(f))
    if (!form) plain.add(key)
    else {
      const base = key.slice(0, -form.length)
      plurals.set(base, [...(plurals.get(base) ?? []), form])
    }
  }
  for (const [base, found] of plurals) expect([...found].sort(), `plural forms of ${base}`).toEqual([...forms].sort())
  return { plain: [...plain].sort(), plurals: [...plurals.keys()].sort() }
}

describe('the delivery-statistics locales', () => {
  it('Arabic mirrors the English keys exactly, plurals in all six forms', () => {
    const e = shape(leaves(en), EN_PLURAL)
    const a = shape(leaves(ar), AR_PLURAL)
    expect(a.plain).toEqual(e.plain)
    expect(a.plurals).toEqual(e.plurals)
  })

  it('the chart label is one per granularity in both, and the old hover readout is gone', () => {
    for (const chart of [en.chart, ar.chart] as unknown[]) {
      expect(typeof (chart as { label: unknown }).label).toBe('object')
      expect(Object.keys((chart as { label: object }).label).sort()).toEqual(['day', 'hour'])
      expect(chart).not.toHaveProperty('hint')
      expect(chart).not.toHaveProperty('readout')
    }
  })
})
