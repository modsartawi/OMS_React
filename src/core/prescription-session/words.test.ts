/**
 * Ticket 544 — the prescription session's code words: every code SIS.Api sends for a state, an
 * owner, a route, a source, a badge and an after-close kind maps to a key that exists in English
 * AND Arabic; an unknown code is shown as itself, never as a raw key. Pure.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/prescription-session.json'
import ar from '@/locales/ar/prescription-session.json'
import {
  afterCloseKindWord,
  badgeWord,
  ownerWord,
  routeWord,
  sourceWord,
  stateWord,
  wordText,
} from './words'

const has = (locale: unknown, key: string) =>
  typeof key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) === 'string'

const STATES = [
  'DRAFT',
  'VALIDATING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'AWAITING_ORDER',
  'PICKING',
  'AWAITING_DELIVERY',
  'DISPENSED',
  'INVOICED',
  'CLOSED',
  'ABANDONED',
  'WRITTEN_OFF',
]
const OWNERS = ['HOLDING_STORE', 'PAYER', 'CUSTOMER', 'DONOR_STORE', 'SYSTEM', 'NONE']

describe('prescription-session words — every known code has a key in en and ar', () => {
  const cases: [string, (code: string) => { key: string | null }, string[]][] = [
    ['state', stateWord, STATES],
    ['owner', ownerWord, OWNERS],
    ['route', routeWord, ['COUNTER', 'DELIVERY']],
    ['source', sourceWord, ['NPHS', 'WSFT']],
    ['badge', badgeWord, ['EXPIRES_TOMORROW']],
    ['after-close kind', afterCloseKindWord, ['RETURN', 'CORRECTION', 'RESALE']],
  ]
  it.each(cases)('%s', (_name, word, codes) => {
    const keys = codes.map((c) => word(c).key)
    expect(keys.every((k) => k !== null)).toBe(true)
    expect(new Set(keys).size).toBe(codes.length)
    for (const key of keys) {
      expect([key, has(en, key!)]).toEqual([key, true])
      expect([key, has(ar, key!)]).toEqual([key, true])
    }
  })

  it('the words read as English sentences, not codes', () => {
    const t = (k: string) => k.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown>)[p], en) as string
    expect(wordText(t, stateWord('AWAITING_APPROVAL'))).toBe('Awaiting approval')
    expect(wordText(t, ownerWord('HOLDING_STORE'))).toBe('Holding store')
    expect(wordText(t, sourceWord('WSFT'))).toBe('Wasfaty')
    expect(wordText(t, badgeWord('EXPIRES_TOMORROW'))).toBe('Expires tomorrow')
  })
})

describe('prescription-session namespace — en and ar mirror each other', () => {
  const leaves = (node: unknown, prefix = ''): string[] =>
    typeof node !== 'object' || node === null
      ? [prefix]
      : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
  it('the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })
})

describe('prescription-session words — what is not known', () => {
  const t = (k: string) => `KEY:${k}`

  it('an unknown code renders itself, never a key', () => {
    for (const word of [stateWord, ownerWord, routeWord, sourceWord, badgeWord, afterCloseKindWord]) {
      const w = word('SOMETHING_NEW')
      expect(w.key).toBeNull()
      expect(wordText(t, w)).toBe('SOMETHING_NEW')
    }
  })

  it('a code that only looks like a key path is still unknown', () => {
    expect(stateWord('toString').key).toBeNull()
    expect(stateWord('__proto__').key).toBeNull()
  })

  it('a null route reads "not chosen"', () => {
    expect(routeWord(null).key).toBe('route.notChosen')
    expect(routeWord('').key).toBe('route.notChosen')
    expect(en.route.notChosen).toBe('Route not chosen')
    expect(has(ar, 'route.notChosen')).toBe(true)
  })
})
