import { describe, expect, it } from 'vitest'
import { COUNTER_FLAGS, TX_KIND_FILTERS, TX_STATUS_FILTERS } from '@/core/models/sync-console'
import { FSI, PDI } from '@/core/util/bidi'
import {
  DEFAULT_TRANSACTIONS_FILTER,
  TRANSACTIONS_PAGE_SIZE,
  TRANSACTIONS_POLL_MS,
  TRANSACTIONS_WINDOW_DAYS,
  counterBadge,
  counterTip,
  localToday,
  pollsToday,
  prettyJson,
  snapshotRefusal,
  snapshotSections,
  transactionDays,
  transactionsPollInterval,
  transactionsQuery,
  txKindLabel,
  txStatusLabel,
} from './transactions-helpers'
import en from '@/locales/en/sync-console.json'

/** Read a dotted key out of the en bundle, so a label key that renders raw fails here. */
const label = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

describe('counterBadge', () => {
  it('gives every flag a label that exists and its token', () => {
    expect(counterBadge('arrived')).toEqual({ labelKey: 'transactionsTab.counter.flags.arrived', sev: 'go' })
    expect(counterBadge('notYet')).toEqual({ labelKey: 'transactionsTab.counter.flags.notYet', sev: 'warn' })
    expect(counterBadge('mismatch')).toEqual({ labelKey: 'transactionsTab.counter.flags.mismatch', sev: 'bad' })
    for (const flag of COUNTER_FLAGS) expect(label(counterBadge(flag).labelKey as string)).toEqual(expect.any(String))
  })

  it('shows an unknown flag neutral, with no key, so its raw code shows', () => {
    expect(counterBadge('melted')).toEqual({ labelKey: null, sev: 'mute' })
    expect(counterBadge('toString')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('counterTip', () => {
  it('names the counter total to 3 decimals, isolated once', () => {
    const tip = counterTip({ counter: 'mismatch', counterTotal: -12.5 })
    expect(tip).toEqual({ key: 'transactionsTab.counter.tip', total: `${FSI}-12.500${PDI}` })
    expect(label(tip.key)).toEqual(expect.stringContaining('{{total}}'))
  })

  it('gives a receipt not yet on the counter rail its own words, never 0.000', () => {
    const tip = counterTip({ counter: 'notYet', counterTotal: null })
    expect(tip).toEqual({ key: 'transactionsTab.counter.tipNotYet' })
    expect(label(tip.key)).toEqual(expect.any(String))
    expect(label(tip.key)).not.toMatch(/0\.000/)
  })

  it('reads a null total as not yet whatever the flag says', () => {
    expect(counterTip({ counter: 'arrived', counterTotal: null }).key).toBe('transactionsTab.counter.tipNotYet')
    // A door that drops a null member.
    expect(counterTip({ counter: 'notYet' } as never).key).toBe('transactionsTab.counter.tipNotYet')
  })
})

describe('localToday', () => {
  it("is the browser's LOCAL calendar date, not UTC", () => {
    // 01:30 local on the 11th: a UTC date (toISOString) would name the 10th east of Greenwich.
    expect(localToday(new Date(2026, 9, 11, 1, 30))).toBe('2026-10-11')
    expect(localToday(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-11')
    expect(localToday(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01')
  })
})

describe('transactionDays', () => {
  it('offers today and the window of days before it, newest first, from the local date', () => {
    expect(transactionDays(new Date(2026, 9, 11, 2, 0))).toEqual([
      '2026-10-11',
      '2026-10-10',
      '2026-10-09',
      '2026-10-08',
      '2026-10-07',
      '2026-10-06',
      '2026-10-05',
      '2026-10-04',
    ])
  })

  it('is today plus the window', () => {
    expect(transactionDays(new Date(2026, 9, 11))).toHaveLength(TRANSACTIONS_WINDOW_DAYS + 1)
  })

  it('crosses a month and a year by the calendar', () => {
    expect(transactionDays(new Date(2026, 0, 3)).slice(-2)).toEqual(['2025-12-28', '2025-12-27'])
    expect(transactionDays(new Date(2024, 2, 2)).slice(2, 4)).toEqual(['2024-02-29', '2024-02-28'])
  })
})

describe('pollsToday', () => {
  it('is true only for today', () => {
    expect(pollsToday('2026-10-11', '2026-10-11')).toBe(true)
    expect(pollsToday('2026-10-10', '2026-10-11')).toBe(false)
    expect(pollsToday('2026-10-04', '2026-10-11')).toBe(false)
  })

  it('stops once midnight has made the picked day a past one', () => {
    expect(pollsToday('2026-10-11', '2026-10-12')).toBe(false)
  })
})

describe('transactionsPollInterval', () => {
  it('polls at 60 s on today, and never on a past day', () => {
    expect(TRANSACTIONS_POLL_MS).toBe(60_000)
    expect(transactionsPollInterval('2026-10-11', new Date(2026, 9, 11, 9))).toBe(60_000)
    expect(transactionsPollInterval('2026-10-10', new Date(2026, 9, 11, 9))).toBe(false)
  })

  it('stops after local midnight', () => {
    expect(transactionsPollInterval('2026-10-11', new Date(2026, 9, 12, 0, 1))).toBe(false)
  })
})

describe('transactionsQuery', () => {
  it('sends the code, the day and the paging, and omits every default', () => {
    expect(transactionsQuery('P237', '2026-10-11', DEFAULT_TRANSACTIONS_FILTER, 1)).toEqual({
      code: 'P237',
      day: '2026-10-11',
      page: 1,
      pageSize: TRANSACTIONS_PAGE_SIZE,
    })
    expect(TRANSACTIONS_PAGE_SIZE).toBe(50)
  })

  it('defaults to COMPLETED, every kind, no counter flag and no receipt', () => {
    expect(DEFAULT_TRANSACTIONS_FILTER).toEqual({ status: 'COMPLETED', kind: 'all', counter: null, receipt: '' })
  })

  it('always sends the day, today included', () => {
    expect(transactionsQuery('P237', '2026-10-04', DEFAULT_TRANSACTIONS_FILTER, 1)).toHaveProperty('day', '2026-10-04')
  })

  it("sends status=all, since the door's default is COMPLETED", () => {
    expect(transactionsQuery('P237', '2026-10-11', { ...DEFAULT_TRANSACTIONS_FILTER, status: 'all' }, 1)).toHaveProperty('status', 'all')
    expect(transactionsQuery('P237', '2026-10-11', { ...DEFAULT_TRANSACTIONS_FILTER, status: 'VOIDED' }, 1)).toHaveProperty('status', 'VOIDED')
    expect(transactionsQuery('P237', '2026-10-11', DEFAULT_TRANSACTIONS_FILTER, 1)).not.toHaveProperty('status')
  })

  it('sends a kind other than all, and a counter flag', () => {
    const q = transactionsQuery('P237', '2026-10-11', { ...DEFAULT_TRANSACTIONS_FILTER, kind: 'return', counter: 'notYet' }, 2)
    expect(q).toEqual({ code: 'P237', day: '2026-10-11', kind: 'return', counter: 'notYet', page: 2, pageSize: 50 })
  })

  it('sends the receipt trimmed, and omits a blank one', () => {
    expect(transactionsQuery('P237', '2026-10-11', { ...DEFAULT_TRANSACTIONS_FILTER, receipt: '  0042-0008-118812 ' }, 1)).toHaveProperty(
      'receipt',
      '0042-0008-118812',
    )
    expect(transactionsQuery('P237', '2026-10-11', { ...DEFAULT_TRANSACTIONS_FILTER, receipt: '   ' }, 1)).not.toHaveProperty('receipt')
  })

  it('never asks for a page below 1', () => {
    expect(transactionsQuery('P237', '2026-10-11', DEFAULT_TRANSACTIONS_FILTER, 0).page).toBe(1)
    expect(transactionsQuery('P237', '2026-10-11', DEFAULT_TRANSACTIONS_FILTER, 2.7).page).toBe(2)
  })
})

describe('the filter words', () => {
  it('labels every status filter, every kind filter and every counter filter', () => {
    for (const s of TX_STATUS_FILTERS) expect(label(`transactionsTab.filters.statuses.${s}`)).toEqual(expect.any(String))
    for (const k of TX_KIND_FILTERS) expect(label(`transactionsTab.filters.kinds.${k}`)).toEqual(expect.any(String))
    expect(label('transactionsTab.filters.allFlags')).toEqual(expect.any(String))
  })
})

describe('txStatusLabel', () => {
  it("words a receipt's stored status, and leaves an unknown one raw", () => {
    expect(txStatusLabel('COMPLETED').labelKey).toBe('transactionsTab.statuses.COMPLETED')
    expect(txStatusLabel('VOIDED').labelKey).toBe('transactionsTab.statuses.VOIDED')
    for (const s of ['COMPLETED', 'VOIDED']) expect(label(txStatusLabel(s).labelKey as string)).toEqual(expect.any(String))
    expect(txStatusLabel('PARKED').labelKey).toBeNull()
  })
})

describe('txKindLabel', () => {
  it('reads isReturn as a sale or a return', () => {
    expect(txKindLabel(false)).toBe('transactionsTab.kinds.sale')
    expect(txKindLabel(true)).toBe('transactionsTab.kinds.return')
    expect(label(txKindLabel(false))).toEqual(expect.any(String))
    expect(label(txKindLabel(true))).toEqual(expect.any(String))
  })
})

describe('snapshotSections', () => {
  it('splits the top-level keys in their insertion order, each pretty-printed at 2 spaces', () => {
    const json = { header: { receiptNumber: 'TEST-0001', total: 12.5 }, lines: [{ sku: 'FAKE-1' }], tenders: [], customer: null }
    const sections = snapshotSections(json)
    expect(sections.map((s) => s.key)).toEqual(['header', 'lines', 'tenders', 'customer'])
    expect(sections[0].json).toBe('{\n  "receiptNumber": "TEST-0001",\n  "total": 12.5\n}')
    expect(sections[1].json).toBe(JSON.stringify([{ sku: 'FAKE-1' }], null, 2))
    expect(sections[2].json).toBe('[]')
    expect(sections[3].json).toBe('null')
  })

  it("follows the parsed object's own key order, not an alphabetical one", () => {
    // What the door sent is what JSON.parse built; the sections follow that object's own order.
    const parsed = JSON.parse('{"z":1,"a":2}') as unknown
    expect(snapshotSections(parsed).map((s) => s.key)).toEqual(['z', 'a'])
  })

  it('gives a non-object back as one unnamed section', () => {
    expect(snapshotSections([1, 2])).toEqual([{ key: null, json: '[\n  1,\n  2\n]' }])
    expect(snapshotSections(null)).toEqual([{ key: null, json: 'null' }])
    expect(snapshotSections('text')).toEqual([{ key: null, json: '"text"' }])
    expect(snapshotSections(42)).toEqual([{ key: null, json: '42' }])
    expect(snapshotSections(true)).toEqual([{ key: null, json: 'true' }])
  })

  it('gives an empty object, or a missing snapshot, back as one unnamed section rather than nothing', () => {
    expect(snapshotSections({})).toEqual([{ key: null, json: '{}' }])
    expect(snapshotSections(undefined)).toEqual([{ key: null, json: 'null' }])
  })
})

describe('prettyJson', () => {
  it('is the whole snapshot at a 2-space indent, as Copy JSON copies it', () => {
    expect(prettyJson({ a: { b: 1 } })).toBe('{\n  "a": {\n    "b": 1\n  }\n}')
    expect(prettyJson(undefined)).toBe('null')
  })
})

describe('snapshotRefusal', () => {
  it("gives NOT_FOUND its own words, and the code is not repeated", () => {
    expect(snapshotRefusal('NOT_FOUND')).toEqual({ labelKey: 'transactionsTab.snapshot.notFound', showCode: false })
    expect(label('transactionsTab.snapshot.notFound')).toBe('This receipt is no longer on the mirror for this store')
  })

  it("reads the store doors' shared failure words for any other code, beside the code", () => {
    expect(snapshotRefusal('NO_STORE')).toEqual({ labelKey: 'failures.NO_STORE', showCode: true })
    expect(label('failures.NO_STORE')).toEqual(expect.any(String))
  })

  it('leaves a code with no shared words (BAD_REQUEST, an unknown one) to show raw, and no code at all (a bare 500) to the message', () => {
    expect(snapshotRefusal('BAD_REQUEST')).toEqual({ labelKey: null, showCode: true })
    expect(snapshotRefusal('MELTED')).toEqual({ labelKey: null, showCode: true })
    expect(snapshotRefusal(null)).toEqual({ labelKey: null, showCode: false })
  })
})
