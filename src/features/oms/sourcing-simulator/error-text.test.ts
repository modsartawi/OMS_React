/**
 * Ticket 962 (BackOffice spec 4354 §11; 4281 decision 51): the door's messages are English for developers and nobody is
 * shown one, so the screen writes its own text for every error code, in English and in Arabic. The codes below are
 * 4281's table, copied by hand — not read from the code under test.
 */
import { describe, expect, it } from 'vitest'
import { ADVISE_ERROR_CODES } from '@/core/models/sourcing-run'
import en from '@/locales/en/sourcing-simulator.json'
import ar from '@/locales/ar/sourcing-simulator.json'
import { errorText } from './error-text'

const DOOR_TABLE = [
  'ADVISE-400',
  'ADVISE-401',
  'ADVISE-403',
  'ADVISE-404',
  'ADVISE-421',
  'ADVISE-422',
  'ADVISE-423',
  'ADVISE-424',
  'ADVISE-429',
  'ADVISE-500',
  'ADVISE-503',
  'ADVISE-504',
  'ADVISE-511',
  'ADVISE-512',
  'ADVISE-513',
]

/** A locale value at a dotted key. */
const at = (bundle: unknown, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), bundle)
const ARABIC = /[؀-ۿ]/

describe('every door error code has text in both languages', () => {
  it('the model knows exactly the codes of the door’s table', () => {
    expect([...ADVISE_ERROR_CODES].sort()).toEqual([...DOOR_TABLE].sort())
  })

  it.each(DOOR_TABLE)('%s has an English title and text, and an Arabic title and text in Arabic script', (code) => {
    const text = errorText(code, false)
    expect(text.code).toBe(code)
    for (const key of [text.titleKey, text.bodyKey]) {
      const english = at(en, key)
      const arabic = at(ar, key)
      expect(typeof english === 'string' && english.trim().length > 0, `en ${key}`).toBe(true)
      expect(typeof arabic === 'string' && ARABIC.test(arabic), `ar ${key}`).toBe(true)
    }
  })
})

describe('what the screen offers on an error', () => {
  it('“The stock figures could not be read” offers try again', () => {
    expect(errorText('ADVISE-512', false).retry).toBe(true)
    expect(at(en, errorText('ADVISE-512', false).titleKey)).toBe('The stock figures could not be read')
  })

  it('a refusal of the request itself does not offer try again', () => {
    for (const code of ['ADVISE-400', 'ADVISE-403', 'ADVISE-404', 'ADVISE-421', 'ADVISE-422', 'ADVISE-423', 'ADVISE-424']) {
      expect(errorText(code, false).retry, code).toBe(false)
    }
  })

  it('a bare 403 (the grant filter, no code) reads as the missing run grant', () => {
    const text = errorText(null, true)
    expect(text.code).toBeNull()
    expect(text.titleKey).toBe('errors.denied.title')
  })

  it('a code the door does not list, or none at all, reads as an unexpected failure that may be tried again, showing what code came', () => {
    expect(errorText('ADVISE-999', false)).toEqual({ code: 'ADVISE-999', titleKey: 'errors.unknown.title', bodyKey: 'errors.unknown.body', retry: true })
    expect(errorText(null, false)).toEqual({ code: null, titleKey: 'errors.unknown.title', bodyKey: 'errors.unknown.body', retry: true })
    for (const key of ['errors.unknown.title', 'errors.unknown.body', 'errors.denied.title', 'errors.denied.body']) {
      expect(typeof at(en, key)).toBe('string')
      expect(ARABIC.test(String(at(ar, key)))).toBe(true)
    }
  })
})
