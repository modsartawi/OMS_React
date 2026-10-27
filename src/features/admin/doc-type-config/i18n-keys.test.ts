/**
 * Ticket 3149 — the `doc-type-config` namespace ships English and Arabic together; the Arabic file mirrors the English
 * keys exactly, and every key the code builds (a field's label, a group's title) exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { ALL_FIELDS, FIELD_GROUPS } from './fields'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe('doc-type-config — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })
})

describe('doc-type-config — the keys the code builds exist', () => {
  it.each([en, ar])('every field and every group has words', (locale) => {
    const keys = [...ALL_FIELDS.map((f) => `fields.${f.field}`), ...FIELD_GROUPS.map((g) => `groups.${g.group}`)]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the ScreenGate, reason dialog and access sentences exist', (locale) => {
    const keys = [
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((k) => `access.${k}`),
      ...['label', 'hint', 'tooLong'].map((k) => `reason.${k}`),
      ...['cancel', 'sending', 'failed', 'failedHint'].map((k) => `dialog.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
