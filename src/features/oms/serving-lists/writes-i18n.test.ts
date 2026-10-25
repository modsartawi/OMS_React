/**
 * Ticket 570 — the keys the write dialogs build exist in English and Arabic: each refusal label the map can
 * produce, and each mode's chrome (`writes.<mode>.title|confirm|done`, `writes.member.<write>Title|Effect|Done`).
 * The en/ar mirror itself is `i18n-keys.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/serving-lists.json'
import ar from '@/locales/ar/serving-lists.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { WRITE_REFUSAL_KEYS } from './write-refusal'

const BUILT = [
  ...WRITE_REFUSAL_KEYS,
  ...['create', 'rename', 'deactivate', 'reactivate'].flatMap((m) => ['button', 'title', 'confirm', 'done'].map((k) => `writes.${m}.${k}`)),
  ...['deactivate', 'reactivate'].flatMap((m) => [`writes.${m}.subject`, `writes.${m}.effect`]),
  ...['disable', 'enable', 'remove'].flatMap((w) => ['', 'Aria', 'Title', 'Effect', 'Done'].map((k) => `writes.member.${w}${k}`)),
  ...['required', 'tooLong'].map((p) => `writes.name.${p}`),
]

describe('serving-lists writes — the keys the code builds exist', () => {
  it('the refusal map labels five codes', () => {
    expect(WRITE_REFUSAL_KEYS).toHaveLength(5)
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s', (_name, locale) => {
    for (const key of BUILT) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
