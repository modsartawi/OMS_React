/**
 * Ticket 3156 — every key the document sources page and dialogs build exists in English and Arabic: both categories,
 * the tabs, the fields (also the History diff's column labels), every copy blocker.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { DOCUMENT_SOURCES_TABS, SOURCE_CATEGORIES, SOURCE_EDITABLE_FIELDS, type SourceCopyBlocker } from './document-source-edit'

const COPY_BLOCKERS: Exclude<SourceCopyBlocker, 'reason'>[] = ['codeRequired', 'codeTooLong', 'codeExists', 'description']

describe('doc-type-config — the document sources words', () => {
  it.each([en, ar])('exist for every key the code builds', (locale) => {
    const keys = [
      'menu.documentSources',
      'fields.documentSource',
      ...SOURCE_EDITABLE_FIELDS.map((f) => `fields.${f}`),
      ...SOURCE_CATEGORIES.map((c) => `documentSources.categories.${c || '_blank'}`),
      ...DOCUMENT_SOURCES_TABS.map((tab) => `documentSources.tabs.${tab}`),
      'documentSources.tabs.label',
      ...['title', 'subtitle', 'loading', 'failed', 'notFound', 'categoryHint'].map((k) => `documentSources.${k}`),
      ...['title', 'note', 'saved', 'stale'].map((k) => `documentSources.edit.${k}`),
      ...['title', 'note', 'newCode', 'warningTitle', 'saved'].map((k) => `documentSources.copy.${k}`),
      ...COPY_BLOCKERS.map((b) => `documentSources.copy.blockers.${b}`),
      'entityTypes.DocumentSource',
      'copy.warningNote',
      'copy.confirm',
      'copy.failed',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
