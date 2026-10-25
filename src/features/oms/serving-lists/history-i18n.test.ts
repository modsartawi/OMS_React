/**
 * Ticket 571 — the keys the History tab builds exist in English and Arabic: every change action's words,
 * the names sentences, the columns, the filters, Show more and the export's chrome. (The en/ar mirror and
 * the six Arabic plural forms are `i18n-keys.test.ts`'s.)
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/serving-lists.json'
import ar from '@/locales/ar/serving-lists.json'
import { SERVING_LIST_CHANGE_ACTIONS } from '@/core/models/serving-list'
import { changeActionKey } from './change-row'

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

describe('serving-lists History — the keys the code builds exist', () => {
  it.each([en, ar])('every change action has words', (locale) => {
    for (const action of SERVING_LIST_CHANGE_ACTIONS) {
      const key = changeActionKey(action)
      expect([action, key !== null && has(locale, key)]).toEqual([action, true])
    }
  })

  it.each([en, ar])('the tab chrome', (locale) => {
    const keys = [
      'history.loading',
      'history.failed',
      'history.empty',
      'history.noMatch',
      'history.readOnly',
      'history.count_other',
      'history.matching_other',
      'history.showMore',
      'history.atMax',
      ...['changedAt', 'changedBy', 'action', 'storeCode', 'names', 'note'].map((c) => `history.columns.${c}`),
      'history.names.create',
      'history.names.rename',
      ...['action', 'store', 'storePlaceholder', 'any', 'clear'].map((f) => `history.filters.${f}`),
      ...['button', 'sheet', 'fileName', 'done', 'doneDetail_other', 'failed', 'failedDetail'].map((k) => `history.export.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the names sentences keep a slot for each name', (locale) => {
    const create = (locale as { history: { names: { create: string; rename: string } } }).history.names
    for (const v of ['{{en}}', '{{ar}}']) expect(create.create).toContain(`<v>${v}</v>`)
    for (const v of ['{{fromEn}}', '{{fromAr}}', '{{toEn}}', '{{toAr}}']) expect(create.rename).toContain(`<v>${v}</v>`)
  })
})
