/**
 * An item at a store, written out (oms 943, BackOffice spec 4157 stories 52–55, BO 4161) — pure. The numbers all come
 * from `StockConsole/Stores/{store}/Items/{item}`: "the sums ready to be written out, each as its operands and its
 * result". This module reads them (`toItem`), puts them in BO 4161's order and says which words each line takes; it redoes
 * no arithmetic the server did. The components say them.
 *
 * The four sums: SAP counter to till-side; till-side to free (never floored); what the channels are answered now (and by
 * which rule); and the change feed's figure (never below zero).
 */
import type {
  StockConsoleAnsweredNow,
  StockConsoleItem,
  StockConsoleItemSums,
  StockConsoleOtherStock,
} from '@/core/models/stock-console'
import { freeLabel, reservedView, type ReservedView } from './figures'

// ── Reading the answer ──────────────────────────────────────────────────────────────────────────────

/** A figure as sent: a finite number, or none. Anything else (absent, null, text) is none — never NaN on screen. */
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** The item's answer as it may arrive: BO 4161's `sums`, or SV 078's operands flat beside the names [guess: either]. */
export type ItemWire = Partial<Omit<StockConsoleItem, 'sums'>> & {
  sums?: {
    tillSide?: Partial<StockConsoleItemSums['tillSide']> | null
    free?: Partial<StockConsoleItemSums['free']> | null
    answeredNow?: Partial<StockConsoleAnsweredNow> | null
    changeFeed?: Partial<StockConsoleItemSums['changeFeed']> | null
  } | null
  sapStock?: number
  tillStock?: number
  gap?: number
  heldStanding?: number
  heldSold?: number
  held?: number
  reserved?: number | null
  reservedState?: string
  reservedAt?: string | null
  reservedIncluded?: boolean
  free?: number
  answeredNow?: Partial<StockConsoleAnsweredNow> | null
  changeFeed?: number
}

function answeredNowOf(d: Partial<StockConsoleAnsweredNow> | null | undefined): StockConsoleAnsweredNow | null {
  const quantity = num(d?.quantity)
  if (!d || quantity === null) return null
  return { quantity, rule: text(d.rule) ?? '', liveOrders: num(d.liveOrders) }
}

/**
 * The item as drawn. The server's sums are kept as sent; an operand or result it left out is derived by the store list's
 * rules (`itemStoreFigures`): gap = SAP − till-side; held = standing + sold not applied; free = till-side − held −
 * reserved (reserved left out, and said so, when never computed); the change feed = that, floored at zero. Absent names
 * read as '', absent other stock types as 0 (not shown), no answer-now as null.
 */
export function toItem(d: ItemWire | null | undefined, store: string, item: string): StockConsoleItem {
  const s1 = d?.sums?.tillSide
  const s2 = d?.sums?.free
  const s4 = d?.sums?.changeFeed
  const sapStock = num(s1?.sapStock) ?? num(d?.sapStock) ?? 0
  const tillStock = num(s1?.result) ?? num(s2?.tillStock) ?? num(d?.tillStock) ?? 0
  const heldStanding = num(s2?.heldStanding) ?? num(d?.heldStanding) ?? 0
  const heldSold = num(s2?.heldSold) ?? num(d?.heldSold) ?? 0
  const held = num(s2?.held) ?? num(d?.held) ?? heldStanding + heldSold
  const reserved = s2 && 'reserved' in s2 ? num(s2.reserved) : num(d?.reserved)
  const computed = reserved !== null
  const taken = computed ? reserved : 0
  const freeResult = num(s2?.result) ?? num(d?.free) ?? tillStock - held - taken
  const other = (v: unknown) => num(v) ?? 0
  return {
    plant: text(d?.plant) ?? store,
    item: text(d?.item) ?? item,
    nameEn: text(d?.nameEn) ?? '',
    nameAr: text(d?.nameAr) ?? '',
    heldOnNoBatch: other(d?.heldOnNoBatch),
    lastUpdate: text(d?.lastUpdate),
    sums: {
      tillSide: { sapStock, gap: num(s1?.gap) ?? num(d?.gap) ?? sapStock - tillStock, result: tillStock },
      free: {
        tillStock,
        held,
        heldStanding,
        heldSold,
        reserved,
        reservedState: text(s2?.reservedState) ?? text(d?.reservedState) ?? (computed ? 'Computed' : 'NeverComputed'),
        reservedAt: text(s2?.reservedAt) ?? text(d?.reservedAt),
        reservedIncluded: s2?.reservedIncluded ?? d?.reservedIncluded ?? computed,
        result: freeResult,
      },
      answeredNow: answeredNowOf(d?.sums ? (d.sums.answeredNow ?? d.answeredNow) : d?.answeredNow),
      changeFeed: {
        tillStock: num(s4?.tillStock) ?? tillStock,
        held: num(s4?.held) ?? held,
        reserved: s4 && 'reserved' in s4 ? num(s4.reserved) : reserved,
        result: num(s4?.result) ?? num(d?.changeFeed) ?? Math.max(0, tillStock - held - taken),
      },
    },
    quality: other(d?.quality),
    blocked: other(d?.blocked),
    returnsBlocked: other(d?.returnsBlocked),
    restricted: other(d?.restricted),
    inTransit: other(d?.inTransit),
    inTransferPlant: other(d?.inTransferPlant),
    inTransferLocation: other(d?.inTransferLocation),
  }
}

// ── Writing it out ──────────────────────────────────────────────────────────────────────────────────

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
  const { tillSide, free } = item.sums
  const reserved = reservedView(free)
  return [
    { name: 'sapStock', op: 'start', value: tillSide.sapStock },
    { name: 'gap', op: 'less', value: tillSide.gap },
    { name: 'tillStock', op: 'equals', value: tillSide.result },
    {
      name: 'held',
      op: 'less',
      value: free.held,
      parts: { standing: free.heldStanding, sold: free.heldSold },
      onNoBatch: item.heldOnNoBatch > 0 ? item.heldOnNoBatch : null,
    },
    { name: 'reserved', op: 'less', value: reserved.kind === 'notComputed' ? null : reserved.value, reserved },
    { name: 'free', op: 'equals', value: free.result, note: freeLabel(free) },
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

/** Sum 3, what the channels are answered now: its rule, and the open orders only under live orders. Null = no answer. */
export function answeredNowView(item: StockConsoleItem): AnsweredNowView | null {
  const now = item.sums.answeredNow
  if (!now) return null
  const known = (ANSWER_RULES as readonly string[]).includes(now.rule)
  return {
    quantity: now.quantity,
    rule: known ? { key: `sum.rule.${now.rule}` } : { raw: now.rule },
    liveOrders: now.rule === 'LiveOrders' && typeof now.liveOrders === 'number' ? now.liveOrders : null,
  }
}

/** Sum 4, the change feed's figure: never below zero (the server floors it; drawn floored whatever it sends). */
export const changeFeedView = (item: StockConsoleItem): number => Math.max(0, item.sums.changeFeed.result)

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
