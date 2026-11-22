/**
 * An item at a store, written out (oms 943, BackOffice spec 4157 stories 52–55, BO 4161) — pure. The numbers all come
 * from `StockConsole/Stores/{store}/Items/{item}`: "the sums ready to be written out, each as its operands and its
 * result" (`StockConsoleItemAnswer`: `tillSide`, `free`, `answeredNow`, `changeFeed`). This module puts them in BO 4161's
 * order and says which words each line takes; it redoes no arithmetic the server did. The components say them.
 *
 * The four sums: SAP counter to till-side; till-side to free (never floored); what the channels are answered now (and by
 * which rule); and the change feed's figure (never below zero, Stock Visibility's own).
 */
import type { StockConsoleItem, StockConsoleOtherStock } from '@/core/models/stock-console'
import { freeLabel, reservedView, type ReservedView } from './figures'

/** The lines of sums 1 and 2, in order (`sum.line.<name>`). */
export const SUM_LINES = ['sapStock', 'gap', 'tillStock', 'held', 'reserved', 'free'] as const
export type SumLineName = (typeof SUM_LINES)[number]

/** How a line joins the one above it: the first figure, "less", or "equals". */
export type SumOp = 'start' | 'less' | 'equals'

export interface SumLine {
  name: SumLineName
  op: SumOp
  /** The line's figure; null only for reserved when it was never computed. */
  value: number | null
  /** Held's two parts. */
  parts?: { standing: number; sold: number }
  /** Held: units held on a blank or unknown batch, when any (null = none). */
  onNoBatch?: number | null
  /** Reserved in its three states. */
  reserved?: ReservedView
  /** Free: "reserved not included" whenever reserved is not in it. */
  note?: 'reservedNotIncluded' | null
}

/**
 * Sums 1 and 2, line by line, from their operands and results: SAP counter, less sold at the till and not in SAP, equals
 * till-side; less held (standing, sold not applied), less reserved (with its state), equals free.
 */
export function sumLines(item: StockConsoleItem): SumLine[] {
  const { tillSide, free } = item
  const reserved = reservedView(free)
  return [
    { name: 'sapStock', op: 'start', value: tillSide.sapStock },
    { name: 'gap', op: 'less', value: tillSide.soldNotInSap },
    { name: 'tillStock', op: 'equals', value: tillSide.tillStock },
    {
      name: 'held',
      op: 'less',
      value: free.held,
      parts: { standing: free.heldStanding, sold: free.heldSold },
      onNoBatch: item.heldOnNoBatch > 0 ? item.heldOnNoBatch : null,
    },
    { name: 'reserved', op: 'less', value: reserved.kind === 'notComputed' ? null : reserved.value, reserved },
    { name: 'free', op: 'equals', value: free.free, note: freeLabel(free) },
  ]
}

/** The rules the stock read answers by (`sum.rule.<rule>`). */
export const ANSWER_RULES = ['HeldServed', 'LiveOrders'] as const

export interface AnsweredNowView {
  /** Not floored. */
  quantity: number
  /** A known rule in its words; an unknown one as it came. */
  rule: { key: string } | { raw: string }
  /** The open orders taken off — only under the live-orders rule. */
  liveOrders: number | null
}

/**
 * Sum 3, what the channels are answered now: its rule, and the open orders only under live orders. No rule means Stock
 * Visibility's answer did not carry it (SIS.Api then sends a blank rule and a zero): no answer, never a zero.
 */
export function answeredNowView(item: StockConsoleItem): AnsweredNowView | null {
  const now = item.answeredNow
  if (now.rule === '') return null
  const known = (ANSWER_RULES as readonly string[]).includes(now.rule)
  return {
    quantity: now.quantity,
    rule: known ? { key: `sum.rule.${now.rule}` } : { raw: now.rule },
    liveOrders: now.rule === 'LiveOrders' ? now.liveOrders : null,
  }
}

/** Sum 4, the change feed's figure: Stock Visibility's own (never below zero), as sent. */
export const changeFeedView = (item: StockConsoleItem): number => item.changeFeed.quantity

/** The other stock types, in the spec's order (`sum.other.<type>`). */
export const OTHER_STOCK = [
  'quality',
  'blocked',
  'returnsBlocked',
  'restricted',
  'inTransit',
  'inTransferPlant',
  'inTransferLocation',
] as const satisfies readonly (keyof StockConsoleOtherStock)[]
export type OtherStockType = (typeof OTHER_STOCK)[number]

/** The stock that is not unrestricted, each type only when not zero. */
export function otherStock(item: StockConsoleOtherStock): { type: OtherStockType; value: number }[] {
  return OTHER_STOCK.filter((type) => item[type] !== 0).map((type) => ({ type, value: item[type] }))
}
