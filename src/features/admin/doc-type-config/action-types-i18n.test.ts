/**
 * Ticket 3155 — every key the action types page and dialog build exists in English and Arabic: the five options' and
 * the locked fields' labels, both affected-type kinds, the tabs, every description problem.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { ACTION_TYPE_EDITABLE_FIELDS } from './action-type-edit'
import { ACTION_TYPES_TABS } from './action-types-view'

describe('doc-type-config — the action types words', () => {
  it.each([en, ar])('exist for every key the code builds', (locale) => {
    const keys = [
      'menu.actionTypes',
      ...ACTION_TYPE_EDITABLE_FIELDS.map((f) => `fields.${f}`),
      'fields.actionType',
      'fields.documentCategory',
      ...ACTION_TYPES_TABS.map((tab) => `actionTypes.tabs.${tab}`),
      ...['DocumentType', 'DeliveryDocumentType'].map((k) => `actionTypes.affected.kinds.${k}`),
      ...['page', 'dialog'].map((w) => `actionTypes.affected.hint.${w}`),
      ...['empty', 'tooLong', 'notPlainText'].map((p) => `actionTypes.edit.description.${p}`),
      ...['title', 'note', 'saved', 'stale'].map((k) => `actionTypes.edit.${k}`),
      ...['title', 'subtitle', 'loading', 'failed', 'category', 'pickCategory', 'pickHint', 'empty', 'options'].map((k) => `actionTypes.${k}`),
      'actionTypes.affected.title',
      'actionTypes.affected.none',
      ...['D', 'O', 'T', 'X'].map((c) => `actionTypes.categories.${c}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
