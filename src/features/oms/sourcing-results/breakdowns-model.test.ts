import { describe, expect, it } from 'vitest'
import type { ResultsBreakdownBy, ResultsBreakdownsReply } from '@/core/models/sourcing-results'
import stub from './stub-tabs.json'
import { BREAKDOWN_COLUMNS, breakdownsTable } from './breakdowns-model'

// The drive's stub: the results prototype's 14 days (39,870 orders compared), one reply per grouping.
const { byRows, ...rest } = stub.breakdowns
const reply = (by: ResultsBreakdownBy, over: Partial<ResultsBreakdownsReply> = {}): ResultsBreakdownsReply =>
  ({ by, rows: byRows[by].rows, ...rest, ...over }) as ResultsBreakdownsReply

describe('breakdownsTable — the rows and columns for each of the four groupings', () => {
  it('holds the same ten columns in every grouping, the decision\'s order', () => {
    expect(BREAKDOWN_COLUMNS).toEqual([
      'orders',
      'samePlanWhole',
      'samePlanStores',
      'estimateMiddle',
      'promiseKept',
      'late',
      'returned',
      'cancelled',
      'endedNoStock',
    ])
    for (const by of ['MODE', 'CITY', 'CHANNEL', 'DAY'] as const) expect(breakdownsTable(reply(by)).columns).toEqual(BREAKDOWN_COLUMNS)
  })

  it('mode: the order\'s modes in the spec\'s order, a mode with no promise yet reads null', () => {
    const shuffled = [...byRows.MODE.rows].reverse()
    const table = breakdownsTable(reply('MODE', { rows: shuffled }))
    expect(table.header).toBe('MODE')
    expect(table.rows.map((r) => r.key)).toEqual(['SLOT_ONLY', 'DAWAA_NOW_ONLY', 'SLOT_AND_DAWAA_NOW', 'BEYOND_BORDER'])
    expect(table.rows.map((r) => r.label.kind)).toEqual(['mode', 'mode', 'mode', 'mode'])
    const border = table.rows[3]
    expect(border.cells.orders).toBe(2910)
    expect(border.cells.promiseKept).toBeNull()
    expect(border.figure).toEqual({ kind: 'breakdown', by: 'MODE', key: 'BEYOND_BORDER' })
  })

  it('city: the cities as sent, a name as free text and "the other cities" in words', () => {
    const table = breakdownsTable(reply('CITY'))
    expect(table.rows.map((r) => [r.label.kind, r.key])).toEqual([
      ['text', 'Riyadh'],
      ['text', 'Jeddah'],
      ['text', 'الدمام والخبر'],
      ['text', 'Makkah'],
      ['text', 'Madinah'],
      ['otherCities', 'OTHER'],
    ])
    expect(table.rows[0].cells).toMatchObject({ orders: 15150, samePlanWhole: 70.2, samePlanStores: 78.9, promiseKept: 91.9 })
  })

  it('channel: the channel codes, named by the page', () => {
    const table = breakdownsTable(reply('CHANNEL'))
    expect(table.rows.map((r) => [r.label.kind, r.key, r.cells.orders])).toEqual([
      ['channel', 'IOS', 18740],
      ['channel', 'ROID', 12360],
      ['channel', 'WEB', 3850],
      ['channel', 'CALL_CENTRE', 4920],
    ])
  })

  it('day: one row per local day, oldest first — the page\'s only trend', () => {
    const shuffled = [...byRows.DAY.rows].sort((a, b) => (a.orders % 7) - (b.orders % 7))
    const table = breakdownsTable(reply('DAY', { rows: shuffled }))
    expect(table.rows).toHaveLength(14)
    expect(table.rows[0].key).toBe('2026-11-12')
    expect(table.rows.at(-1)?.key).toBe('2026-11-25')
    expect(table.rows.every((r) => r.label.kind === 'date')).toBe(true)
  })

  it('the total row is the reply\'s as sent, and says when the rows add up to it', () => {
    for (const by of ['MODE', 'CITY', 'CHANNEL', 'DAY'] as const) {
      const table = breakdownsTable(reply(by))
      expect(table.total.cells).toMatchObject({ orders: 39870, samePlanWhole: 68.8, samePlanStores: 77.6, estimateMiddle: 14 })
      expect(table.addsUp).toBe(true)
    }
    expect(breakdownsTable(reply('MODE', { total: { ...rest.total, orders: 40000 } })).addsUp).toBe(false)
  })

  it('a line the stock figure could not cover: by stock class and mode, each opening its orders', () => {
    const { stockShort } = breakdownsTable(reply('MODE'))
    expect(stockShort.map((r) => r.key)).toEqual([
      'BOOK_BELOW_ZERO:SLOT',
      'BOOK_AT_ZERO:SLOT',
      'BOOK_SHORT:SLOT',
      'HELD_BY_DELIVERIES:SLOT',
      'BOOK_BELOW_ZERO:PICK_UP',
      'BOOK_AT_ZERO:PICK_UP',
    ])
    expect(stockShort[1].label).toEqual({ kind: 'stockShort', stockClass: 'BOOK_AT_ZERO', mode: 'SLOT' })
    expect(stockShort[1].cells.endedNoStock).toBe(14.2)
    expect(stockShort[1].figure).toEqual({ kind: 'stockShort', stockClass: 'BOOK_AT_ZERO', mode: 'SLOT' })
  })

  it('the channel\'s own split: its three parts in order, whatever order they come in', () => {
    const { channelSplit } = breakdownsTable(reply('CITY', { channelSplit: [...rest.channelSplit].reverse() as ResultsBreakdownsReply['channelSplit'] }))
    expect(channelSplit.map((r) => [r.key, r.cells.orders])).toEqual([
      ['ONE_DAWAA_NOW', 410],
      ['ONE_SLOT', 520],
      ['OTHER', 134],
    ])
    expect(channelSplit[1].cells.estimateMiddle).toBe(-95)
  })

  it('draws no row from an empty grouping and says nothing adds up wrong', () => {
    const empty = breakdownsTable(reply('DAY', { rows: [], total: { ...rest.total, orders: 0 } }))
    expect(empty.rows).toEqual([])
    expect(empty.addsUp).toBe(true)
  })
})

describe('breakdownsTable — one more column under "Set beside it" (ticket 973)', () => {
  const beside = (percent: number) => ({ samePlan: { count: 100, percent } })
  const withBeside = (): ResultsBreakdownsReply => {
    const r = reply('MODE')
    return {
      ...r,
      rows: r.rows.map((row, i) => (i === 0 ? { ...row, beside: beside(64.2) } : i === 1 ? { ...row, beside: null } : { ...row, beside: beside(70.1) })),
      total: { ...r.total, beside: beside(65.3) },
    }
  }

  it('adds the set beside it after the two same-plan columns, only when the rows carry it', () => {
    expect(breakdownsTable(withBeside()).columns).toEqual([
      'orders',
      'samePlanWhole',
      'samePlanStores',
      'besideSamePlan',
      'estimateMiddle',
      'promiseKept',
      'late',
      'returned',
      'cancelled',
      'endedNoStock',
    ])
    expect(breakdownsTable(reply('MODE')).columns).not.toContain('besideSamePlan')
  })

  it('reads each row\'s same-plan share under the set beside it as sent; a row with none reads null', () => {
    const table = breakdownsTable(withBeside())
    expect(table.rows.map((r) => r.cells.besideSamePlan)).toEqual([64.2, null, 70.1, 70.1])
    expect(table.total.cells.besideSamePlan).toBe(65.3)
  })
})
