/**
 * An item at a store, written out (oms 943, BackOffice spec 4157 stories 52–55) — pure. The numbers all come from
 * `StockConsole/Stores/{store}/Items/{item}` (the sum's operands, flat); this module only puts them in order and says
 * which words each takes. The components say them.
 *
 * The three rules in use, side by side: the sum to free (never floored), what the channels are answered now (and by
 * which rule), and the change feed's figure (never below zero).
 */
import type { StockConsoleItem, StockConsoleOtherStock } from '@/core/models/stock-console'
import { freeLabel, reservedView, type ReservedView } from './figures'

/** The sum's lines, in order (`sum.line.<name>`). */
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
 * The sum, line by line: SAP counter, less sold at the till and not in SAP, equals till-side; less held (standing, sold
 * not applied), less reserved (with its state), equals free.
 */
export function sumLines(item: StockConsoleItem): SumLine[] {
  const reserved = reservedView(item)
  return [
    { name: 'sapStock', op: 'start', value: item.sapStock },
    { name: 'gap', op: 'less', value: item.gap },
    { name: 'tillStock', op: 'equals', value: item.tillStock },
    {
      name: 'held',
      op: 'less',
      value: item.held,
      parts: { standing: item.heldStanding, sold: item.heldSold },
      onNoBatch: item.heldOnNoBatch > 0 ? item.heldOnNoBatch : null,
    },
    { name: 'reserved', op: 'less', value: reserved.kind === 'notComputed' ? null : reserved.value, reserved },
    { name: 'free', op: 'equals', value: item.free, note: freeLabel(item) },
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

/** What the channels are answered now: its rule, and the open orders only under live orders. Null = no answer. */
export function answeredNowView(item: Pick<StockConsoleItem, 'answeredNow'>): AnsweredNowView | null {
  const now = item.answeredNow
  if (!now) return null
  const known = (ANSWER_RULES as readonly string[]).includes(now.rule)
  return {
    quantity: now.quantity,
    rule: known ? { key: `sum.rule.${now.rule}` } : { raw: now.rule },
    liveOrders: now.rule === 'LiveOrders' && typeof now.liveOrders === 'number' ? now.liveOrders : null,
  }
}

/** The change feed's figure: never below zero (the server floors it; drawn floored whatever it sends). */
export const changeFeedView = (item: Pick<StockConsoleItem, 'changeFeed'>): number => Math.max(0, item.changeFeed)

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
  return OTHER_STOCK.filter((type) => typeof item[type] === 'number' && item[type] !== 0).map((type) => ({
    type,
    value: item[type],
  }))
}
