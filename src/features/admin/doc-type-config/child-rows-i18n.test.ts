/**
 * Ticket 3151 — every key the child-row tables and their dialog build (a table's title, a column's label, a mode's
 * dialog title) exists in English and Arabic. The en/ar mirror itself is `i18n-keys.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { ITEM_CATEGORY_ASSIGNMENT, PLANT_NETWORK } from './child-rows'

describe('doc-type-config — the child-row keys exist', () => {
  it.each([en, ar])('every table, column and dialog title has words', (locale) => {
    const keys: string[] = ['add', 'edit', 'remove', 'actions', 'loading', 'failed', 'none', 'saved', 'removed', 'confirmRemove', 'removeNote', 'keyLockedHint', 'missing'].map(
      (k) => `childRows.${k}`,
    )
    for (const spec of [ITEM_CATEGORY_ASSIGNMENT, PLANT_NETWORK] as const) {
      keys.push(...['title', 'empty', 'duplicate', 'addTitle', 'editTitle', 'removeTitle'].map((k) => `childRows.${spec.id}.${k}`))
      keys.push(...[...spec.keyFields, ...spec.valueFields].map((c) => `childRows.${spec.id}.columns.${c.field}`))
    }
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
