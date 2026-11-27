/**
 * Ticket 966 (BackOffice spec 4354 §5, 4281 decision 26): the stock per line — for one line, every store the run read
 * and each mode it worked the stock for: on hand, less open demand, times the confidence, less the buffer, equals
 * offered, against the quantity needed, and the expected stock at pick time beside it. Every figure is the record's
 * (`inputs.storeLines[]`, per store and item, with its `working[]` per mode: BackOffice 4375 / 4379); nothing is worked
 * out again here. Fed a reply in the server's shape.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { stockPerLine } from './stock-per-line-model'

const reply = fixture as unknown as AdviseReply
const recommended = reply.plans.find((p) => p.goal === 'BALANCED')!
const cheapest = reply.plans.find((p) => p.goal === 'CHEAPEST')!
const pickUp = reply.plans.find((p) => p.goal === 'PICK_UP')!

describe('the stock per line', () => {
  it('offers every cart line to pick, with its item and quantity', () => {
    expect(stockPerLine(reply, 1, recommended)!.lines).toEqual([
      { lineNo: 1, item: '100234', quantity: 2 },
      { lineNo: 2, item: '100871', quantity: 1 },
      { lineNo: 3, item: '104410', quantity: 1 },
    ])
  })

  it('works one line through every store the run read, a row per mode it worked, in the record’s figures', () => {
    const s = stockPerLine(reply, 1, recommended)!
    expect(s.line).toEqual({ lineNo: 1, item: '100234', quantity: 2 })
    expect(s.rows.map((r) => `${r.store} ${r.mode}`)).toEqual(['1055 SLOT', '1055 DAWAA_NOW', '1090 DAWAA_NOW', '1090 PICK_UP', '1090 SLOT', '1061 DAWAA_NOW'])
    expect(s.rows.find((r) => r.store === '1061')).toEqual({
      store: '1061',
      storeName: 'Store 1061',
      mode: 'DAWAA_NOW',
      onHand: 5,
      sapStock: 5,
      heldByOrders: 2,
      heldByDeliveries: 0,
      afterDemand: 3,
      confidence: 0.8,
      buffer: 1,
      offered: 1,
      expected: 2,
      covers: false,
      shortBy: 1,
      chosen: false,
    })
  })

  it('a store whose offered stock reaches the quantity can serve the line; each mode keeps its own buffer', () => {
    const rows = stockPerLine(reply, 1, recommended)!.rows.filter((r) => r.store === '1090')
    expect(rows.find((r) => r.mode === 'DAWAA_NOW')).toMatchObject({ onHand: 6, heldByOrders: 1, heldByDeliveries: 1, afterDemand: 4, confidence: 1, buffer: 1, offered: 3, covers: true, shortBy: 0 })
    expect(rows.find((r) => r.mode === 'PICK_UP')).toMatchObject({ buffer: 0, offered: 4, covers: true })
  })

  it('marks the store and mode the selected plan sends the line by', () => {
    const chosen = (plan: typeof recommended) =>
      stockPerLine(reply, 3, plan)!
        .rows.filter((r) => r.chosen)
        .map((r) => `${r.store} ${r.mode}`)
    expect(chosen(recommended)).toEqual(['1090 DAWAA_NOW'])
    expect(chosen(cheapest)).toEqual(['1055 SLOT'])
    expect(chosen(pickUp)).toEqual(['1090 PICK_UP'])
  })

  it('a chosen store that is short of the quantity still shows short (the plan carries a figure-short mark)', () => {
    const row = stockPerLine(reply, 3, cheapest)!.rows.find((r) => r.store === '1055' && r.mode === 'SLOT')!
    expect(row).toMatchObject({ offered: 0, expected: 0, covers: false, shortBy: 1, chosen: true })
  })

  it('a stock read that could not split what it held leaves both held figures empty', () => {
    const lines = reply.inputs!.storeLines!.map((l) => (l.store === '1061' && l.item === '100234' ? { ...l, heldByOrders: undefined, heldByDeliveries: undefined } : l))
    const row = stockPerLine({ ...reply, inputs: { ...reply.inputs, storeLines: lines } }, 1, recommended)!.rows.find((r) => r.store === '1061')!
    expect(row).toMatchObject({ heldByOrders: null, heldByDeliveries: null, afterDemand: 3 })
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
