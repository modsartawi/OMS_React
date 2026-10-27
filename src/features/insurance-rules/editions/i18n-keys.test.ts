/**
 * Ticket 613 — the `insurance-editions` namespace ships English and Arabic together, the Arabic mirroring the
 * English keys exactly; and every key the code builds (list names, states, gap kinds, publish refusals,
 * read-only notes) exists in both, with the area's Editions menu label.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-editions.json'
import ar from '@/locales/ar/insurance-editions.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { EDITION_LISTS, EDITION_STATES, GAP_KINDS } from './editions'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-editions — en and ar mirror each other', () => {
  it('the same keys (no plurals)', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    expect(leaves(en).filter((k) => /_(one|other)$/.test(k))).toEqual([])
  })
})

describe('insurance-editions — the keys the code builds exist', () => {
  it.each([en, ar])('lists, states, gap kinds, publish refusals, read-only notes', (locale) => {
    const keys = [
      ...EDITION_LISTS.map((l) => `listName.${l}`),
      ...EDITION_STATES.map((s) => `state.${s}`),
      ...GAP_KINDS.map((k) => `gapKind.${k}`),
      ...['uploader', 'readOnly'].map((w) => `publish.why.${w}`),
      ...['live', 'retired'].map((s) => `edition.readOnly.${s}`),
      ...['added', 'dropped', 'changed', 'newlyUnmatched'].map((k) => `diff.${k}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([areaEn, areaAr])('the menu label', (locale) => {
    expect(hasLocaleKey(locale, 'menu.editions')).toBe(true)
  })
})
