/**
 * The `stock-console` namespace ships English and Arabic together (BackOffice spec 4157): the same keys (plural forms
 * aside, Arabic has six), and every key the code builds from data exists in both. Each console ticket appends the key
 * families it builds to `keys`.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/stock-console.json'
import ar from '@/locales/ar/stock-console.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { STOCK_CONSOLE_FLAGS } from '@/core/models/stock-console'
import { CONSOLE_PAGES } from './console-pages'
import { STORE_SORTS, STORE_TILES } from './stores'
import { BATCH_FILTERS, ITEM_FILTERS, ITEM_SORTS } from '@/core/models/stock-console'
import { EXPIRY_MARKS } from './batches'
import { HOW_BATCHES, HOW_ITEMS, HOW_STORE } from './how-sections'
import { REFUSAL_KEYS } from './refusals'
import { STORE_TABS } from './store-tabs'

const PLURAL = /_(zero|one|two|few|many|other)$/

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const base = (bundle: unknown) => [...new Set(leaves(bundle).map((k) => k.replace(PLURAL, '')))].sort()

describe('stock-console — en and ar mirror each other', () => {
  it('the same keys, plural forms aside', () => {
    expect(base(ar)).toEqual(base(en))
  })

  it('Arabic carries all six plural forms wherever English counts', () => {
    const counted = leaves(en).filter((k) => k.endsWith('_other')).map((k) => k.replace(PLURAL, ''))
    for (const key of counted)
      for (const form of ['zero', 'one', 'two', 'few', 'many', 'other'])
        expect([key, form, has(ar, `${key}_${form}`)]).toEqual([key, form, true])
  })
})

describe('stock-console — the keys the code builds exist', () => {
  it.each([en, ar])('every link, tile, sort, stage, status, flag and access sentence', (locale) => {
    const keys = [
      // 940
      ...CONSOLE_PAGES.map((p) => `nav.${p.key}`),
      ...STORE_TILES.map((k) => `tiles.${k}`),
      ...STORE_SORTS.map((k) => `stores.sorts.${k}`),
      ...['Shadow', 'Seeding', 'Seeded', 'Blocking'].map((s) => `stage.${s}`),
      ...['Ok', 'Watch', 'Problem'].map((s) => `status.${s}`),
      ...STOCK_CONSOLE_FLAGS.map((f) => `flag.${f}_other`),
      ...STOCK_CONSOLE_FLAGS.map((f) => `flagName.${f}`),
      'flag.unknown',
      'flag.limit',
      'flag.limitAny',
      'stores.count_other',
      'reserved.notComputed',
      'reserved.stale',
      'free.reservedNotIncluded',
      ...['title', 'p1', 'p2', 'p3', 'p4', 'p5'].map((k) => `how.stores.${k}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      'menu.stockConsole',
      'title',
      'subtitle',
      // 941
      ...STORE_TABS.map((k) => `tabs.${k}`),
      ...ITEM_FILTERS.map((k) => `items.filter.${k}`),
      ...ITEM_SORTS.map((k) => `items.sort.${k}`),
      ...BATCH_FILTERS.map((k) => `batches.filter.${k}`),
      ...REFUSAL_KEYS,
      ...EXPIRY_MARKS.map((k) => `batches.expiry.${k}`),
      'batches.placeholder',
      'search.count_other',
      'search.nothingYet',
      ...['title', ...HOW_STORE].map((k) => `how.store.${k}`),
      ...['title', ...HOW_ITEMS].map((k) => `how.items.${k}`),
      ...['title', ...HOW_BATCHES].map((k) => `how.batches.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
