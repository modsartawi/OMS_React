/**
 * The stock per line (ticket 966, BackOffice spec 4354 §5): for one cart line, every store the run read — on hand, less
 * open demand (held by orders, held by deliveries), times the stock confidence, less the buffer, equals the offered
 * stock the solver planned on — against the quantity needed, with the expected stock at pick time beside it, shown
 * only. Pure. Every figure is the record's `inputs.storeLines[]` row, as sent: no figure is worked out again here.
 * "Short by" is the gap between the quantity and the offered stock, said in words, never planned on.
 */
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'

export interface StockLine {
  lineNo: number
  item: string
  quantity: number
}

export interface StockRow {
  store: string
  storeName: string | null
  /** The till's figure: on hand. */
  onHand: number
  /** The book's figure, beside it. */
  sapStock: number
  heldByOrders: number
  heldByDeliveries: number
  /** The figure after open demand, floored at zero (the record's `atp`). */
  afterDemand: number
  confidence: number
  buffer: number
  offered: number
  /** The expected stock at the pick end: shown only. */
  expected: number
  stockClass: string
  /** The offered stock reaches the quantity. */
  covers: boolean
  shortBy: number
  /** The selected plan sends this line from this store. */
  chosen: boolean
}

export interface StockPerLine {
  lines: StockLine[]
  line: StockLine
  rows: StockRow[]
}

type Reply = Pick<AdviseReply, 'lines' | 'inputs' | 'plans'>

/** A store's name: the stores read, else a plan's shipment from it. */
export function storeNames(reply: Pick<AdviseReply, 'inputs' | 'plans'>): Map<string, string> {
  const names = new Map<string, string>()
  for (const p of reply.plans) for (const s of p.shipments) names.set(s.store, s.storeName)
  for (const s of reply.inputs?.stores ?? []) if (s.name) names.set(s.store, s.name)
  return names
}

/** The working for `lineNo` (the first line when the cart has no such line); `null` without the middle level's inputs. */
export function stockPerLine(reply: Reply, lineNo: number, plan: AdvisePlan | undefined): StockPerLine | null {
  const storeLines = reply.inputs?.storeLines
  if (!storeLines || reply.lines.length === 0) return null
  const lines = reply.lines.map((l) => ({ lineNo: l.lineNo, item: l.item, quantity: l.quantity }))
  const line = lines.find((l) => l.lineNo === lineNo) ?? lines[0]
  const chosen = new Set((plan?.shipments ?? []).filter((s) => s.lines.includes(line.lineNo)).map((s) => s.store))
  const names = storeNames(reply)
  const rows = storeLines
    .filter((r) => r.lineNo === line.lineNo)
    .map((r) => ({
      store: r.store,
      storeName: names.get(r.store) ?? null,
      onHand: r.tillStock,
      sapStock: r.sapStock,
      heldByOrders: r.heldByOrders,
      heldByDeliveries: r.heldByDeliveries,
      afterDemand: r.atp,
      confidence: r.confidence,
      buffer: r.buffer,
      offered: r.offered,
      expected: r.expectedAtPickEnd,
      stockClass: r.stockClass,
      covers: r.offered >= line.quantity,
      shortBy: Math.max(0, line.quantity - r.offered),
      chosen: chosen.has(r.store),
    }))
  return { lines, line, rows }
}
