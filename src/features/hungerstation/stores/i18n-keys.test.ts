/**
 * Ticket 551 — the `hungerstation-stores` namespace ships English and Arabic together, and the
 * Arabic file mirrors the English keys exactly. An English plural (`_one` / `_other`) is all SIX
 * Arabic forms — ticket 433 was reviewed SERIOUS for shipping two.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-stores.json'
import ar from '@/locales/ar/hungerstation-stores.json'
import { HEALTH_FILTERS, SYNC_FILTERS } from './store-state'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const pluralBase = (key: string, forms: string[]) =>
  forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null

function shape(keys: string[], forms: string[]) {
  const plain = new Set<string>()
  const plurals = new Map<string, Set<string>>()
  for (const key of keys) {
    const base = pluralBase(key, forms)
    if (base === null) plain.add(key)
    else plurals.set(base, (plurals.get(base) ?? new Set()).add(key.slice(base.length)))
  }
  return { plain, plurals }
}

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

describe('hungerstation-stores — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
  })

  it('the same plural families, English two forms and Arabic six', () => {
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('hungerstation-stores — the keys the code builds exist', () => {
  it.each([en, ar])('the menu group and all three leaf labels', (locale) => {
    for (const key of ['menu.hungerstation', 'menu.stores', 'menu.materials', 'menu.orders']) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('every health reading, sync state, push status and filter option', (locale) => {
    const keys = [
      ...['ok', 'failing', 'silent', 'paused', 'unknown'].map((h) => `health.${h}`),
      'sync.active',
      'sync.paused',
      'pushStatus.S',
      'pushStatus.E',
      ...SYNC_FILTERS.map((s) => `filters.sync${cap(s)}`),
      ...HEALTH_FILTERS.map((h) => `filters.health${cap(h)}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('the five ScreenGate sentences, for the page and each placeholder', (locale) => {
    for (const prefix of ['access', 'placeholder.materials.access', 'placeholder.orders.access'])
      for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
        expect([`${prefix}.${key}`, has(locale, `${prefix}.${key}`)]).toEqual([`${prefix}.${key}`, true])
  })

  it.each([en, ar])('the reason dialog’s chrome (the core dialog reads it in this namespace)', (locale) => {
    for (const key of ['reason.label', 'reason.hint', 'reason.tooLong', 'dialog.cancel', 'dialog.sending', 'dialog.failed', 'dialog.failedHint'])
      expect([key, has(locale, key)]).toEqual([key, true])
  })

  it('the edit note isolates the store as a slot, never a bare value', () => {
    for (const locale of [en, ar]) expect(locale.edit.note).toMatch(/<store>\{\{store\}\}<\/store>/)
  })

  it('the onboard note says a removed store comes back (552’s revive needs nothing extra)', () => {
    expect(en.onboard.note).toMatch(/removed comes back/)
  })

  it('🚩 glossary: chain and vendor id are the words; a removed store is never "deleted" or "offboarded"', () => {
    const words = JSON.stringify(en).toLowerCase()
    expect(words).toMatch(/\bchain\b/)
    expect(words).toMatch(/\bvendor id\b/)
    expect(words).not.toMatch(/\bdeleted\b|\boffboard/)
    expect(words).not.toMatch(/deliverect/)
  })
})
