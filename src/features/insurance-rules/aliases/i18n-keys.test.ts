/**
 * Ticket 704 — the `insurance-aliases` namespace ships English and Arabic together, mirrored, and every key the code
 * builds from a state or a problem exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-aliases.json'
import ar from '@/locales/ar/insurance-aliases.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { ALIAS_PROBLEMS, ALIAS_STATES } from './alias-form'
import { REPIN_DECISIONS, REPIN_KINDS } from './repin'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-aliases locales', () => {
  it('en and ar hold the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })
  it.each([en, ar])('every state and problem has words', (locale) => {
    for (const key of [...ALIAS_STATES.map((s) => `state.${s}`), ...ALIAS_PROBLEMS.map((p) => `problem.${p}`)]) {
      expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    }
  })
  it.each([en, ar])('every re-pin kind and decision has words', (locale) => {
    for (const key of [...REPIN_KINDS.map((k) => `repin.kind.${k}`), ...REPIN_DECISIONS.map((d) => `repin.decision.${d}`), 'repin.labels.lang.en', 'repin.labels.lang.ar']) {
      expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
    }
  })
  it.each([areaEn, areaAr])('the menu leaf, in the area namespace', (locale) => {
    expect(hasLocaleKey(locale, 'menu.aliases')).toBe(true)
  })
})
