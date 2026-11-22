/**
 * The `stock-console` namespace ships English and Arabic together (BackOffice spec 4157): the same keys (plural forms
 * aside, Arabic has six), and every key the code builds from data exists in both. Each console ticket appends the key
 * families it builds to `keys`.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/stock-console.json'
import { SCAN_CHIPS, SCAN_MARKS, SCAN_NOTES } from './scan'
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

// ── 942 ── (imported here so parallel tickets append their blocks without touching each other's lines)
import { HOLD_STATES, TAKE_OUTCOMES } from '@/core/models/stock-console'
import { FLEET_FACTS } from './fleet'
import { HOLD_COLUMNS } from './holds'
import { HOW_FEEDS, HOW_FLEET, HOW_HOLDS, HOW_STAGE, HOW_TAKES } from './how-sections'

describe('stock-console — the keys 942 builds exist', () => {
  it.each([en, ar])('holds, takes, feeds, stage, Feeds and switches, the fleet line and the flag links', (locale) => {
    const keys = [
      'nav.fleet',
      ...['age.justNow', 'age.minutes', 'age.hours', 'age.days'],
      ...HOLD_STATES.map((k) => `holds.filter.${k}`),
      ...['Held', 'Sold', 'Released'].map((k) => `holds.state.${k}`),
      ...['picking', 'till'].map((k) => `holds.document.${k}`),
      ...HOLD_COLUMNS.map((k) => `holds.column.${k}`),
      'holds.noBatch',
      'holds.empty',
      ...TAKE_OUTCOMES.map((k) => `takes.filter.${k}`),
      ...['granted', 'refused', 'failed'].map((k) => `takes.kind.${k}`),
      ...['at', 'kind', 'item', 'name', 'quantity', 'batches', 'reason', 'status'].map((k) => `takes.column.${k}`),
      'takes.status',
      'takes.day',
      'takes.failedLeftOut',
      'takes.empty',
      ...['loading', 'sap', 'till', 'place', 'lastAttempt'].map((k) => `feeds.${k}`),
      ...['title', 'notCounted', 'notYet', 'differs_other', 'matches', 'ranAt'].map((k) => `feeds.comparison.${k}`),
      ...['loading', 'since', 'readOnly', 'log', 'noMoves'].map((k) => `stageTab.${k}`),
      ...['movedAt', 'from', 'to', 'by', 'mover', 'why'].map((k) => `stageTab.column.${k}`),
      ...['title', 'none', 'state', 'kind', 'batchRows', 'askedAt', 'endedAt', 'reason'].map((k) => `stageTab.seed.${k}`),
      ...['title', 'noAnswer', 'toward', 'allHold', 'notAllHold', 'holds', 'doesNotHold', 'confirmed', 'notConfirmed'].map(
        (k) => `stageTab.gates.${k}`,
      ),
      ...FLEET_FACTS.map((k) => `fleet.fact.${k}`),
      ...['noAnswer', 'problem'].map((k) => `fleet.view.${k}`),
      ...['Sap', 'Pos'].map((k) => `fleet.feed.${k}`),
      ...['lead', 'loading', 'noAnswer', 'neverPassed', 'unknown', 'yes', 'no'].map((k) => `fleet.${k}`),
      ...['lastSuccess', 'neverSucceeded', 'lastStarted', 'lastFailure', 'failures', 'lastError'].map((k) => `fleet.reserved.${k}`),
      ...['served', 'on', 'off', 'changedAt', 'subtractsHeld', 'netting', 'fellBackAt'].map((k) => `fleet.held.${k}`),
      ...['lastPass', 'lag', 'readThrough'].map((k) => `fleet.reader.${k}`),
      ...['day', 'takes', 'failed', 'skipped'].map((k) => `fleet.takes.${k}`),
      ...['FeedLate', 'ReservedNeverRun', 'ReservedStale', 'ReaderBehind', 'TakesFailing', 'unknown'].map((k) => `fleetLine.${k}`),
      ...['lead', 'link', 'since'].map((k) => `fleetLine.${k}`),
      'flagLink.open',
      ...['title', ...HOW_HOLDS].map((k) => `how.holds.${k}`),
      ...['title', ...HOW_TAKES].map((k) => `how.takes.${k}`),
      ...['title', ...HOW_FEEDS].map((k) => `how.feeds.${k}`),
      ...['title', ...HOW_STAGE].map((k) => `how.stage.${k}`),
      ...['title', ...HOW_FLEET].map((k) => `how.fleet.${k}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})

// ── 944 ──
describe('stock-console — the GS1 box’s keys exist', () => {
  it.each([en, ar])('every chip, line and expiry mark', (locale) => {
    const keys = [
      ...SCAN_CHIPS.map((k) => `gs1.chip.${k}`),
      ...SCAN_NOTES.map((k) => `gs1.note.${k}`),
      ...SCAN_MARKS.map((k) => `gs1.mark.${k}`),
      'gs1.read',
      'gs1.column.mark',
      'search.gs1',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
