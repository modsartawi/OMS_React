/**
 * Ticket 706 — the `insurance-labels` namespace ships English and Arabic mirrored, every key the code builds
 * exists in both, and the area's menu names the leaf.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-labels.json'
import ar from '@/locales/ar/insurance-labels.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { LABEL_CHANGES, WORKBOOK_KINDS } from './labels'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('insurance-labels', () => {
  it('en and ar hold the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })
  it.each([en, ar])('the workbook names and the diff groups exist', (locale) => {
    const keys = [...WORKBOOK_KINDS.map((k) => `workbook.${k}`), ...LABEL_CHANGES.map((c) => `diff.${c}`)]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
  it.each([areaEn, areaAr])('the menu label', (locale) => {
    expect(hasLocaleKey(locale, 'menu.codeLabels')).toBe(true)
  })
})
