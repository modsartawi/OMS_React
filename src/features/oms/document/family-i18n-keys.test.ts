/**
 * Ticket 906 — the Family section's words ship in English and Arabic together: `document:family.*`
 * mirrors key for key (Arabic carrying its six plural forms where a key takes a count), and every key the panel builds (the title, "You are here", each category's
 * name) has words in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/document.json'
import ar from '@/locales/ar/document.json'
import { hasLocaleKey } from '@/core/test/locale'
import { familyCategoryKey } from './family-tree'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const PLURAL = /_(zero|one|two|few|many|other)$/
const EN_FORMS = ['one', 'other']
const AR_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other']
/** The keys with their plural suffix dropped, each once. */
const bases = (keys: string[]) => [...new Set(keys.map((k) => k.replace(PLURAL, '')))].sort()
/** The plural forms a base key carries. */
const forms = (keys: string[], base: string) =>
  keys.filter((k) => k.replace(PLURAL, '') === base && PLURAL.test(k)).map((k) => k.match(PLURAL)![1]).sort()

/** The keys the panel passes a `count` to. */
const COUNTED = ['heading', 'moreBillings']

describe('document:family — en and ar mirror each other', () => {
  it('the same keys, plural forms aside', () => {
    expect(bases(leaves(ar.family))).toEqual(bases(leaves(en.family)))
  })

  it('every counted key has the two English plural forms and the six Arabic ones, and no other key is plural', () => {
    for (const base of COUNTED) {
      expect([base, forms(leaves(en.family), base)]).toEqual([base, [...EN_FORMS].sort()])
      expect([base, forms(leaves(ar.family), base)]).toEqual([base, [...AR_FORMS].sort()])
    }
    const plural = (keys: string[]) => bases(keys.filter((k) => PLURAL.test(k)))
    expect(plural(leaves(en.family))).toEqual([...COUNTED].sort())
    expect(plural(leaves(ar.family))).toEqual([...COUNTED].sort())
  })

  it.each([en, ar])('every key the panel uses has words', (locale) => {
    const categories = ['Q', 'O', 'X', 'D', 'T', 'R', 'E', 'B', 'C', 'V', 'Z'].map(familyCategoryKey)
    const keys = [
      'family.heading_other',
      'family.youAreHere',
      'family.ariaLabel',
      ...categories,
      // ticket 907
      'family.noPage.billing',
      'family.tillInvoice',
      'family.tillInvoiceTitle',
      'family.partnerReference',
      'family.moreBillings_other',
      'family.truncated',
      'family.title',
      'family.failed',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('an unlisted category reads as the unknown one, never a raw key', () => {
    expect(familyCategoryKey('Z')).toBe('family.categories.unknown')
    expect(familyCategoryKey(' O ')).toBe('family.categories.O')
  })
})
