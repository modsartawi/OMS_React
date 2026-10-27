/**
 * Ticket 3152 — every key the change-log screens build exists in English and Arabic: each kind of thing, each action,
 * the tabs, and the History / Config changes / diff sentences.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { CONFIG_CHANGE_ACTIONS, CONFIG_ENTITY_TYPES } from './change-log-types'
import { DOC_TYPE_TABS } from './doc-type-tab'

describe('doc-type-config — the change-log keys exist', () => {
  it.each([en, ar])('every kind, action and tab has words', (locale) => {
    const keys = [
      ...CONFIG_ENTITY_TYPES.map((k) => `entityTypes.${k}`),
      ...CONFIG_CHANGE_ACTIONS.map((a) => `actions.${a}`),
      ...DOC_TYPE_TABS.map((tab) => `tabs.${tab}`),
      'tabs.label',
      'menu.configChanges',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the History, Config changes and diff sentences', (locale) => {
    const keys = [
      ...['field', 'before', 'after', 'reason', 'copiedFrom', 'openType', 'noFields', 'unreadable'].map((k) => `change.${k}`),
      ...['loading', 'failed', 'denied', 'empty', 'newestFirst'].map((k) => `history.${k}`),
      ...['title', 'subtitle', 'filters', 'entityType', 'anyEntityType', 'entityKey', 'user', 'from', 'to', 'apply', 'clear', 'badRange', 'loading', 'failed', 'empty', 'noMatch', 'total'].map(
        (k) => `changes.${k}`,
      ),
      ...['button', 'done', 'failed', 'failedHint', 'fileName'].map((k) => `changes.export.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
