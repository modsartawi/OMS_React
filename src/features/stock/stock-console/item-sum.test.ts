import { describe, expect, it } from 'vitest'
import type { StockConsoleItem, StockConsoleItemSums } from '@/core/models/stock-console'
import { answeredNowView, changeFeedView, otherStock, sumLines, toItem } from './item-sum'

/** The sums on the console's first day: reserved never computed, answered by the live-orders rule. */
const sums = (over: Partial<StockConsoleItemSums> = {}): StockConsoleItemSums => ({
  tillSide: { sapStock: 1240, gap: 40, result: 1200 },
  free: {
    tillStock: 1200,
    held: 42,
    heldStanding: 30,
    heldSold: 12,
    reserved: null,
    reservedState: 'NeverComputed',
    reservedAt: null,
    reservedIncluded: false,
    result: 1158,
  },
  answeredNow: { quantity: 1150, rule: 'LiveOrders', liveOrders: 8 },
  changeFeed: { tillStock: 1200, held: 42, reserved: null, result: 1158 },
  ...over,
})

const item = (over: Partial<StockConsoleItem> = {}): StockConsoleItem => ({
  plant: 'P077',
  item: '1001',
  nameEn: 'Panadol 500',
  nameAr: 'بنادول ٥٠٠',
  heldOnNoBatch: 0,
  lastUpdate: '2026-11-22T10:00:00',
  sums: sums(),
  quality: 0,
  blocked: 0,
  returnsBlocked: 0,
  restricted: 0,
  inTransit: 0,
  inTransferPlant: 0,
  inTransferLocation: 0,
  ...over,
})

const free = (over: Partial<StockConsoleItemSums['free']>) => sums({ free: { ...sums().free, ...over } })

describe('the item’s sum, written out from the server’s operands and results', () => {
  it('runs SAP counter, less sold at the till not in SAP, equals till-side; less held, less reserved, equals free', () => {
    const lines = sumLines(item())
    expect(lines.map((l) => [l.op, l.name])).toEqual([
      ['start', 'sapStock'],
      ['less', 'gap'],
      ['equals', 'tillStock'],
      ['less', 'held'],
      ['less', 'reserved'],
      ['equals', 'free'],
    ])
    expect(lines.map((l) => l.value)).toEqual([1240, 40, 1200, 42, null, 1158])
  })

  it('each result is the server’s, as sent — the page does not redo the arithmetic', () => {
    const odd = item({ sums: sums({ tillSide: { sapStock: 10, gap: 1, result: 7 } }) })
    expect(sumLines(odd)[2].value).toBe(7)
  })

  it('names held’s two parts, and the units held on no batch when there are any', () => {
    const quiet = sumLines(item()).find((l) => l.name === 'held')
    expect(quiet?.parts).toEqual({ standing: 30, sold: 12 })
    expect(quiet?.onNoBatch).toBeNull()
    expect(sumLines(item({ heldOnNoBatch: 5 })).find((l) => l.name === 'held')?.onNoBatch).toBe(5)
  })

  it('never computed: reserved reads "not computed" — not a zero — and free says reserved is not included', () => {
    const lines = sumLines(item())
    expect(lines[4].reserved).toEqual({ kind: 'notComputed' })
    expect(lines[4].value).toBeNull()
    expect(lines[5].note).toBe('reservedNotIncluded')
  })

  it('stale: reserved is its figure, marked, with its time; free includes it', () => {
    const lines = sumLines(
      item({ sums: free({ reserved: 15, reservedState: 'Stale', reservedAt: '2026-11-22T09:10:00', reservedIncluded: true, result: 1143 }) }),
    )
    expect(lines[4].reserved).toEqual({ kind: 'stale', value: 15, at: '2026-11-22T09:10:00' })
    expect(lines[4].value).toBe(15)
    expect(lines[5]).toMatchObject({ value: 1143, note: null })
  })

  it('computed: reserved is its figure and its time', () => {
    const lines = sumLines(
      item({ sums: free({ reserved: 15, reservedState: 'Computed', reservedAt: '2026-11-22T09:58:00', reservedIncluded: true, result: 1143 }) }),
    )
    expect(lines[4].reserved).toEqual({ kind: 'value', value: 15, at: '2026-11-22T09:58:00' })
    expect(lines[5].note).toBeNull()
  })

  it('a free figure below zero is drawn as it came: free is never floored', () => {
    expect(sumLines(item({ sums: free({ tillStock: 10, held: 42, result: -32 }) }))[5].value).toBe(-32)
  })
})

describe('what the channels are answered now', () => {
  it('names the live-orders rule and shows the open orders it took off', () => {
    expect(answeredNowView(item())).toEqual({ quantity: 1150, rule: { key: 'sum.rule.LiveOrders' }, liveOrders: 8 })
  })

  it('names the held-served rule, and shows no open orders under it — even if the answer carries some', () => {
    const view = answeredNowView(item({ sums: sums({ answeredNow: { quantity: 1158, rule: 'HeldServed', liveOrders: 3 } }) }))
    expect(view).toEqual({ quantity: 1158, rule: { key: 'sum.rule.HeldServed' }, liveOrders: null })
  })

  it('an unknown rule is drawn as it came, and shows no open orders', () => {
    const view = answeredNowView(item({ sums: sums({ answeredNow: { quantity: 5, rule: 'Lottery', liveOrders: 3 } }) }))
    expect(view).toEqual({ quantity: 5, rule: { raw: 'Lottery' }, liveOrders: null })
  })

  it('an answer without it is no answer, not a zero', () => {
    expect(answeredNowView(item({ sums: sums({ answeredNow: null }) }))).toBeNull()
  })

  it('the quantity is not floored', () => {
    const view = answeredNowView(item({ sums: sums({ answeredNow: { quantity: -4, rule: 'HeldServed', liveOrders: null } }) }))
    expect(view?.quantity).toBe(-4)
  })
})

describe('the change feed’s figure', () => {
  it('is never below zero', () => {
    expect(changeFeedView(item())).toBe(1158)
    expect(changeFeedView(item({ sums: sums({ changeFeed: { tillStock: 10, held: 42, reserved: null, result: -32 } }) }))).toBe(0)
  })
})

describe('the other stock types', () => {
  it('are listed only when not zero, in the spec’s order', () => {
    expect(otherStock(item())).toEqual([])
    expect(otherStock(item({ inTransit: 6, quality: 2, inTransferLocation: -1 }))).toEqual([
      { type: 'quality', value: 2 },
      { type: 'inTransit', value: 6 },
      { type: 'inTransferLocation', value: -1 },
    ])
  })
})

describe('the item as read', () => {
  it('the server’s sums, operands and results, are kept as sent', () => {
    const read = toItem({ plant: 'P077', item: '1001', nameEn: 'Panadol 500', sums: sums() }, 'P077', '1001')
    expect(read.sums).toEqual(sums())
  })

  it('an answer that carries the operands flat (SV 078’s shape) reads into the same four sums', () => {
    const read = toItem(
      {
        sapStock: 1240,
        tillStock: 1200,
        gap: 40,
        heldStanding: 30,
        heldSold: 12,
        held: 42,
        reserved: 15,
        reservedState: 'Computed',
        reservedAt: '2026-11-22T09:58:00',
        reservedIncluded: true,
        free: 1143,
        answeredNow: { quantity: 1150, rule: 'LiveOrders', liveOrders: 8 },
        changeFeed: 1143,
      },
      'P077',
      '1001',
    )
    expect(read.sums).toEqual({
      tillSide: { sapStock: 1240, gap: 40, result: 1200 },
      free: {
        tillStock: 1200,
        held: 42,
        heldStanding: 30,
        heldSold: 12,
        reserved: 15,
        reservedState: 'Computed',
        reservedAt: '2026-11-22T09:58:00',
        reservedIncluded: true,
        result: 1143,
      },
      answeredNow: { quantity: 1150, rule: 'LiveOrders', liveOrders: 8 },
      changeFeed: { tillStock: 1200, held: 42, reserved: 15, result: 1143 },
    })
  })

  it('operands left out are derived by the store list’s rules — never NaN — and reserved left out is never computed', () => {
    const read = toItem({ sapStock: 1240, tillStock: 1200, heldStanding: 30, heldSold: 12 }, 'P077', '1001')
    expect(read.sums.tillSide).toEqual({ sapStock: 1240, gap: 40, result: 1200 })
    expect(read.sums.free).toMatchObject({ held: 42, reserved: null, reservedState: 'NeverComputed', reservedIncluded: false, result: 1158 })
    expect(read.sums.changeFeed).toEqual({ tillStock: 1200, held: 42, reserved: null, result: 1158 })
    expect(read.sums.answeredNow).toBeNull()
    expect(changeFeedView(read)).toBe(1158)
  })

  it('a figure that is not a number is left out and derived, not drawn', () => {
    const read = toItem({ sapStock: 100, tillStock: 90, gap: 'x' as never, heldStanding: 0, heldSold: 0, changeFeed: null as never }, 'P077', '1')
    expect(read.sums.tillSide.gap).toBe(10)
    expect(read.sums.changeFeed.result).toBe(90)
  })

  it('names and the other stock types left out read as blank and none; the store and item as asked', () => {
    const read = toItem(null, 'P077', '1001')
    expect([read.plant, read.item, read.nameEn, read.nameAr, read.heldOnNoBatch, read.quality]).toEqual(['P077', '1001', '', '', 0, 0])
  })
})
