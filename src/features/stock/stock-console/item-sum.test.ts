import { describe, expect, it } from 'vitest'
import type { StockConsoleItem } from '@/core/models/stock-console'
import { answeredNowView, changeFeedView, otherStock, sumLines } from './item-sum'

/**
 * `GET StockConsole/Stores/{store}/Items/{item}` as SIS.Api answers it (BO 4161, `StockConsoleItemAnswer`) on the
 * console's first day: reserved never computed, answered by the live-orders rule.
 */
const item = (over: Partial<StockConsoleItem> = {}): StockConsoleItem => ({
  readAt: '2026-11-22T10:00:05',
  store: 'P077',
  item: '1001',
  nameEn: 'Panadol 500',
  nameAr: 'بنادول ٥٠٠',
  lastUpdate: '2026-11-22T10:00:00',
  tillSide: { sapStock: 1240, soldNotInSap: 40, tillStock: 1200 },
  free: {
    tillStock: 1200,
    heldStanding: 30,
    heldSold: 12,
    held: 42,
    reserved: null,
    reservedState: 'NeverComputed',
    reservedAt: null,
    reservedIncluded: false,
    free: 1158,
  },
  answeredNow: { rule: 'LiveOrders', tillStock: 1200, liveOrders: 8, held: null, reserved: null, quantity: 1150 },
  changeFeed: { tillStock: 1200, held: 42, reserved: 0, unfloored: 1158, quantity: 1158 },
  heldOnNoBatch: 0,
  reservedComputedAt: null,
  quality: 0,
  blocked: 0,
  returnsBlocked: 0,
  restricted: 0,
  inTransit: 0,
  inTransferPlant: 0,
  inTransferLocation: 0,
  ...over,
})

const free = (over: Partial<StockConsoleItem['free']>) => item({ free: { ...item().free, ...over } })

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
    expect(sumLines(item({ tillSide: { sapStock: 10, soldNotInSap: 1, tillStock: 7 } }))[2].value).toBe(7)
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
    const lines = sumLines(free({ reserved: 15, reservedState: 'Stale', reservedAt: '2026-11-22T09:10:00', reservedIncluded: true, free: 1143 }))
    expect(lines[4].reserved).toEqual({ kind: 'stale', value: 15, at: '2026-11-22T09:10:00' })
    expect(lines[4].value).toBe(15)
    expect(lines[5]).toMatchObject({ value: 1143, note: null })
  })

  it('computed: reserved is its figure and its time', () => {
    const lines = sumLines(free({ reserved: 15, reservedState: 'Computed', reservedAt: '2026-11-22T09:58:00', reservedIncluded: true, free: 1143 }))
    expect(lines[4].reserved).toEqual({ kind: 'value', value: 15, at: '2026-11-22T09:58:00' })
    expect(lines[5].note).toBeNull()
  })

  it('a free figure below zero is drawn as it came: free is never floored', () => {
    expect(sumLines(free({ tillStock: 10, held: 42, free: -32 }))[5].value).toBe(-32)
  })
})

describe('what the channels are answered now', () => {
  it('names the live-orders rule and shows the open orders it took off', () => {
    expect(answeredNowView(item())).toEqual({ quantity: 1150, rule: { key: 'sum.rule.LiveOrders' }, liveOrders: 8 })
  })

  it('names the held-served rule, and shows no open orders under it', () => {
    const view = answeredNowView(
      item({ answeredNow: { rule: 'HeldServed', tillStock: 1200, liveOrders: null, held: 42, reserved: 0, quantity: 1158 } }),
    )
    expect(view).toEqual({ quantity: 1158, rule: { key: 'sum.rule.HeldServed' }, liveOrders: null })
  })

  it('an unknown rule is drawn as it came, and shows no open orders', () => {
    const view = answeredNowView(item({ answeredNow: { ...item().answeredNow, rule: 'Lottery', quantity: 5 } }))
    expect(view).toEqual({ quantity: 5, rule: { raw: 'Lottery' }, liveOrders: null })
  })

  it('an answer that did not carry it (no rule) is no answer, not a zero', () => {
    const none = { rule: '', tillStock: 1200, liveOrders: 0, held: null, reserved: null, quantity: 0 }
    expect(answeredNowView(item({ answeredNow: none }))).toBeNull()
  })

  it('the quantity is not floored', () => {
    expect(answeredNowView(item({ answeredNow: { ...item().answeredNow, quantity: -4 } }))?.quantity).toBe(-4)
  })
})

describe('the change feed’s figure', () => {
  it('is Stock Visibility’s own, as sent', () => {
    expect(changeFeedView(item())).toBe(1158)
    expect(changeFeedView(item({ changeFeed: { tillStock: 10, held: 42, reserved: 0, unfloored: -32, quantity: 0 } }))).toBe(0)
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
