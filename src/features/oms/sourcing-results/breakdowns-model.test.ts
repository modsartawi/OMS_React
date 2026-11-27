import { describe, expect, it } from 'vitest'
import type { ResultsBreakdownBy, ResultsBreakdownReply } from '@/core/models/sourcing-results'
import stub from './stub-tabs.json'
import { BREAKDOWN_COLUMNS, breakdownsTable } from './breakdowns-model'

// `GET SourcingAdvisor/Results/Breakdown?by=` (BO 4393), one reply per grouping; every figure a count of the row's orders.
const replyBy = (by: ResultsBreakdownBy) => stub.breakdowns[by] as unknown as ResultsBreakdownReply

describe('breakdownsTable — the rows and columns for each grouping', () => {
  it('draws the same eleven columns in every grouping', () => {
    expect(BREAKDOWN_COLUMNS).toEqual([
      'orders',
      'samePlanWhole',
      'samePlanStores',
      'middleEstimate',
      'promiseKept',
      'late',
      'returned',
      'cancelled',
      'customerCancelled',
      'noStock',
      'pairsCut',
    ])
  })

  it('keeps the rows in the order sent, by orders, and names a mode row by its mode mix', () => {
    const table = breakdownsTable(replyBy('MODE'))
    expect(table.rows.map((r) => [r.key, r.cells.orders])).toEqual([
      ['SLOT_ONLY', 21300],
      ['PICK_UP_ONLY', 8100],
      ['DAWAA_NOW_ONLY', 7640],
      ['SLOT_AND_DAWAA_NOW', 1890],
      ['BEYOND_BORDER', 640],
      ['OTHER', 300],
    ])
    expect(table.rows[0].label).toEqual({ kind: 'modeMix', code: 'SLOT_ONLY' })
  })

  it('carries every cell as sent, a row with no estimate as null', () => {
    const [slot, pickUp] = breakdownsTable(replyBy('MODE')).rows
    expect(slot.cells).toEqual({
      orders: 21300,
      samePlanWhole: 14654,
      samePlanStores: 16508,
      middleEstimate: -1,
      promiseKept: 17807,
      late: 1512,
      returned: 1065,
      cancelled: 575,
      customerCancelled: 341,
      noStock: 256,
      pairsCut: 660,
    })
    expect(pickUp.cells.middleEstimate).toBeNull()
  })

  it('names a city as free text, a channel by its code, a day as a date', () => {
    expect(breakdownsTable(replyBy('CITY')).rows[0].label).toEqual({ kind: 'text', text: 'Riyadh' })
    expect(breakdownsTable(replyBy('CHANNEL')).rows[0].label).toEqual({ kind: 'channel', code: 'IOS' })
    expect(breakdownsTable(replyBy('DAY')).rows.map((r) => r.label)).toContainEqual({ kind: 'date', day: '2026-11-20' })
  })

  it('names who made the run: the channel, or OMS by why no checkout run was used', () => {
    expect(breakdownsTable(replyBy('MADE_BY')).rows.map((r) => r.label)).toEqual([
      { kind: 'madeBy', code: 'CHANNEL' },
      { kind: 'madeBy', code: 'NO_CHECKOUT_RUN' },
      { kind: 'madeBy', code: 'CART_CHANGED' },
      { kind: 'madeBy', code: 'RUN_HAD_PINS' },
    ])
  })

  it('names the channel\'s own split by its part, and the short-figure rows by mode mix', () => {
    expect(breakdownsTable(replyBy('OWN_SPLIT')).rows.map((r) => r.label)).toEqual([
      { kind: 'ownSplit', code: 'ONE_DAWAA_NOW' },
      { kind: 'ownSplit', code: 'ONE_SLOT' },
      { kind: 'ownSplit', code: 'OTHER' },
    ])
    expect(breakdownsTable(replyBy('SHORT_FIGURE')).rows[0].label).toEqual({ kind: 'modeMix', code: 'SLOT_ONLY' })
  })

  it('opens each row\'s orders by its grouping and key, and the total row opens none', () => {
    const table = breakdownsTable(replyBy('CITY'))
    expect(table.rows[1].figure).toEqual({ kind: 'breakdown', by: 'CITY', key: 'Jeddah' })
    expect(table.total.figure).toBeNull()
  })

  it('takes the total row as sent and says whether the rows reach it', () => {
    const reply = replyBy('MODE')
    expect(breakdownsTable(reply).total.cells.orders).toBe(39870)
    expect(breakdownsTable(reply).addsUp).toBe(true)
    expect(breakdownsTable({ ...reply, total: { ...reply.total, orders: 40000 } }).addsUp).toBe(false)
  })
})
