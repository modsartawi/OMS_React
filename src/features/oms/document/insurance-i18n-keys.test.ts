/**
 * Ticket 787 — the Insurance section's words ship in English and Arabic together: `document:insurance.*`
 * mirrors key for key, and every key the model builds from data (a money source, a figure) has words in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/document.json'
import ar from '@/locales/ar/document.json'
import { hasLocaleKey } from '@/core/test/locale'
import { MONEY_FIGURES, moneySourceBadge } from './insurance-section'
import { PLAN_FIELDS } from './insurance-plan'
import { KNOWN_ACTS } from './insurance-timeline'
import { receivedView } from './received-section'

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('document:insurance — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar.insurance).sort()).toEqual(leaves(en.insurance).sort())
  })
})

describe('document:insurance — the keys the model builds exist', () => {
  it.each([en, ar])('every money source, its meaning, and every figure', (locale) => {
    const keys = [
      ...['CHANNEL', 'ENGINE', 'SOMETHING_NEW'].flatMap((s) => [moneySourceBadge(s).labelKey, moneySourceBadge(s).meaningKey]),
      ...MONEY_FIGURES.map((f) => `insurance.money.figures.${f}`),
      ...['channel', 'current', 'engine'].map((c) => `insurance.money.columns.${c}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

describe('document:insurance — the keys 788 builds exist (Plan, Changes, Received)', () => {
  it.each([en, ar])('every plan field, every known act, both not-kept sentences', (locale) => {
    const keys = [
      ...PLAN_FIELDS.map(([f]) => `insurance.plan.fields.${f}`),
      ...KNOWN_ACTS.map((a) => `insurance.changes.acts.${a}`),
      receivedView({ kept: false, keptSince: '2026-11-04' }),
      receivedView({ kept: false, keptSince: null }),
    ].map((k) => (typeof k === 'string' ? k : k.kind === 'notKept' ? k.textKey : ''))
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
