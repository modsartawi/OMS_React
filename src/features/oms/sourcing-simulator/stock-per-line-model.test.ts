/**
 * Ticket 966 (BackOffice spec 4354 §5, 4281 decision 26): the stock per line — for one line, every store the run read:
 * on hand, less open demand, times the confidence, less the buffer, equals offered, against the quantity needed, and
 * the expected stock at pick time beside it. Every figure is the record's (`inputs.storeLines[]`); nothing is worked
 * out again here. Fed the door's worked example with the rest of its store lines put in.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { stockPerLine } from './stock-per-line-model'

const reply = fixture as unknown as AdviseReply
const recommended = reply.plans.find((p) => p.goal === 'BALANCED')!
const cheapest = reply.plans.find((p) => p.goal === 'CHEAPEST')!

describe('the stock per line', () => {
  it('offers every cart line to pick, with its item and quantity', () => {
    expect(stockPerLine(reply, 1, recommended)!.lines).toEqual([
      { lineNo: 1, item: '100234', quantity: 2 },
      { lineNo: 2, item: '100871', quantity: 1 },
      { lineNo: 3, item: '104410', quantity: 1 },
    ])
  })

  it('works one line through every store the run read, in the record’s figures', () => {
    const s = stockPerLine(reply, 1, recommended)!
    expect(s.line).toEqual({ lineNo: 1, item: '100234', quantity: 2 })
    expect(s.rows.map((r) => r.store)).toEqual(['1055', '1090', '1061'])
    expect(s.rows.find((r) => r.store === '1061')).toEqual({
      store: '1061',
      storeName: 'Store 1061',
      onHand: 5,
      sapStock: 5,
      heldByOrders: 2,
      heldByDeliveries: 0,
      afterDemand: 3,
      confidence: 0.8,
      buffer: 1,
      offered: 1,
      expected: 2,
      stockClass: 'COVERED',
      covers: false,
      shortBy: 1,
      chosen: false,
    })
  })

  it('a store whose offered stock reaches the quantity can serve the line', () => {
    const row = stockPerLine(reply, 1, recommended)!.rows.find((r) => r.store === '1090')!
    expect(row).toMatchObject({ onHand: 6, heldByOrders: 1, heldByDeliveries: 1, afterDemand: 4, confidence: 1, buffer: 1, offered: 3, covers: true, shortBy: 0 })
  })

  it('marks the store the selected plan sends the line from', () => {
    expect(stockPerLine(reply, 3, recommended)!.rows.filter((r) => r.chosen).map((r) => r.store)).toEqual(['1090'])
    expect(stockPerLine(reply, 3, cheapest)!.rows.filter((r) => r.chosen).map((r) => r.store)).toEqual(['1055'])
  })

  it('a chosen store that is short of the quantity still shows short (the plan carries a figure-short mark)', () => {
    const row = stockPerLine(reply, 3, cheapest)!.rows.find((r) => r.store === '1055')!
    expect(row).toMatchObject({ offered: 0, expected: 0, stockClass: 'BOOK_AT_ZERO', covers: false, shortBy: 1, chosen: true })
  })

  it('a line the record holds no store for has no rows; a line not in the cart falls back to the first', () => {
    const empty = stockPerLine({ ...reply, inputs: { ...reply.inputs, storeLines: [] } }, 2, recommended)!
    expect(empty.rows).toEqual([])
    expect(stockPerLine(reply, 99, recommended)!.line.lineNo).toBe(1)
  })

  it('a reply without the middle level’s inputs has no stock working', () => {
    expect(stockPerLine({ ...reply, inputs: undefined }, 1, recommended)).toBeNull()
  })
})
