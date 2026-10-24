/**
 * Ticket 545 — the HQ list's own code words (other-store reason, open item, flag): each known code
 * has a key in English AND Arabic; an unknown one reads as itself. Pure.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/prescription-session.json'
import ar from '@/locales/ar/prescription-session.json'
import { flagWord, openItemWord, otherStoreReasonWord, wordText } from './words'

const at = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)

describe('HQ code words', () => {
  it.each([
    ['DONOR', otherStoreReasonWord, 'Donor'],
    ['TRANSFER', otherStoreReasonWord, 'Transfer'],
    ['INVOICE_OWED', openItemWord, 'Invoice owed'],
    ['STALLED', openItemWord, 'Stalled'],
    ['LAPSE_WARNING', openItemWord, 'Lapse warning'],
    ['STALLED', flagWord, 'Stalled'],
    ['ABOUT_TO_LAPSE', flagWord, 'About to lapse'],
    ['OWED', flagWord, 'Owed'],
  ] as const)('%s reads in English and has an Arabic word', (code, word, english) => {
    const w = word(code)
    expect(w.key).not.toBeNull()
    expect(at(en, w.key!)).toBe(english)
    expect(typeof at(ar, w.key!)).toBe('string')
  })

  it('an unknown code is shown as itself', () => {
    const t = (k: string) => `T(${k})`
    expect(wordText(t, otherStoreReasonWord('LOAN'))).toBe('LOAN')
    expect(wordText(t, openItemWord('NUDGE'))).toBe('NUDGE')
    expect(wordText(t, flagWord(null))).toBe('')
  })
})
