/** Ticket 710 — the `insurance-inspector` namespace mirrors en and ar, and has words for every state the screen builds. */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-inspector.json'
import ar from '@/locales/ar/insurance-inspector.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import simEn from '@/locales/en/insurance-simulator.json'
import simAr from '@/locales/ar/insurance-simulator.json'
import reviewEn from '@/locales/en/insurance-review.json'
import reviewAr from '@/locales/ar/insurance-review.json'
import { hasLocaleKey } from '@/core/test/locale'
import { GUARD_LINE_OUTCOMES } from '@/core/insurance-rules/guard-check'
import { MESSAGE_WORDS } from './decision'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-inspector', () => {
  it('en and ar hold the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('every state the code builds has words', (locale) => {
    const keys = [
      ...MESSAGE_WORDS.map((w) => `message.check.${w}`),
      ...['yes', 'no', 'unknown', 'unparsed'].map((s) => `fact.${s}`),
      ...['same', 'different', 'none'].map((s) => `replay.${s}`),
      ...GUARD_LINE_OUTCOMES.map((o) => `outcome.${o}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it.each([
    [areaEn, simEn, reviewEn],
    [areaAr, simAr, reviewAr],
  ])('the keys it adds to its neighbours exist', (area, sim, review) => {
    expect(hasLocaleKey(area, 'menu.inspector')).toBe(true)
    for (const k of ['limit', 'noWindow', 'limitFailed']) expect(hasLocaleKey(sim, `backtest.${k}`)).toBe(true)
    expect(hasLocaleKey(review, 'columns.inspect')).toBe(true)
    expect(hasLocaleKey(review, 'mark.inspect')).toBe(true)
  })
})
