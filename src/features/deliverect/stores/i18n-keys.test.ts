/**
 * Ticket 477 — the `deliverect-stores` namespace ships English and Arabic together, and the Arabic
 * file mirrors the English keys exactly. An English plural (`_one` / `_other`) is all SIX Arabic
 * forms (`_zero _one _two _few _many _other`) — ticket 433 was reviewed SERIOUS for shipping two.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/deliverect-stores.json'
import ar from '@/locales/ar/deliverect-stores.json'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const pluralBase = (key: string, forms: string[]) =>
  forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null

/** The keys with each plural family folded to its base, plus the set of plural bases. */
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

describe('deliverect-stores — en and ar mirror each other', () => {
  const enShape = shape(leaves(en), EN_PLURAL)
  const arShape = shape(leaves(ar), AR_PLURAL)

  it('the same non-plural keys', () => {
    expect([...arShape.plain].sort()).toEqual([...enShape.plain].sort())
  })

  it('the same plural families', () => {
    expect([...arShape.plurals.keys()].sort()).toEqual([...enShape.plurals.keys()].sort())
  })

  it('every English plural has exactly _one and _other', () => {
    for (const [base, forms] of enShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
  })

  it('every Arabic plural has all six forms', () => {
    for (const [base, forms] of arShape.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
  })
})

describe('deliverect-stores — the keys the code builds exist', () => {
  it.each([en, ar])('the menu group and ALL FOUR leaf labels (478, 479, 482 add only their leaf)', (locale) => {
    for (const key of ['menu.deliverect', 'menu.stores', 'menu.orders', 'menu.catalog', 'menu.terms'])
      expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('each link state, store status and sync label', (locale) => {
    for (const key of ['state.linked', 'state.notLinked', 'status.open', 'status.busy', 'status.closed', 'sync.active', 'sync.paused'])
      expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('480: each sync health, run type, and the pause / resume dialog keys the code builds', (locale) => {
    const keys = [
      ...['ok', 'failed', 'overdue', 'paused', 'notRun'].map((h) => `syncHealth.${h}`),
      'syncHealth.fullOverdue',
      'syncHealth.deltaOverdue_other',
      'logs.type.full',
      'logs.type.delta',
      ...['pause', 'resume'].flatMap((v) => ['title', 'note', 'confirm', 'done', 'doneDetail', 'button'].map((k) => `${v}.${k}`)),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('481: the status dialog, hours and history keys the code builds', (locale) => {
    const keys = [
      ...['none', 'busy', 'close', 'reopen'].flatMap((a) => [`statusAction.notes.${a}`, `statusAction.confirm.${a}`]),
      ...['busy', 'close', 'reopen'].flatMap((a) => [`statusAction.actions.${a}`, `statusAction.doneDetail.${a}`]),
      'statusAction.notLinked',
      'statusAction.deliverectFailed',
      'hours.overnight',
      ...['action', 'delay', 'reason', 'by', 'at', 'answer'].map((c) => `history.columns.${c}`),
      'columns.statusSince',
      'columns.statusReason',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it('481: the overnight template keeps the range as ONE interpolated value', () => {
    for (const locale of [en, ar]) expect(locale.hours.overnight.match(/\{\{\w+\}\}/g)).toEqual(['{{range}}'])
  })

  it('480: the pause note says in words that pausing stops the stock pushes only, and orders still come', () => {
    expect(en.pause.note).toMatch(/stock pushes only/)
    expect(en.pause.note).toMatch(/stays listed/)
    expect(en.pause.note).toMatch(/still receive orders/)
  })

  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([key, has(locale, `access.${key}`)]).toEqual([key, true])
  })

  it('🚩 copy never says "chain" and never an unqualified "channel" (CONTEXT.md, Deliverect)', () => {
    const words = JSON.stringify(en).toLowerCase()
    expect(words).not.toMatch(/\bchain\b/)
    expect(words).not.toMatch(/\bchannel\b/)
  })
})
