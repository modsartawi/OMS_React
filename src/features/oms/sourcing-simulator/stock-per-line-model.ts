/**
 * The stock per line (ticket 966, BackOffice spec 4354 §5): for one cart line, every store the run read and each mode
 * it worked the stock for — on hand, less open demand (held by orders, held by deliveries), times the stock confidence,
 * less the buffer, equals the offered stock the solver planned on — against the quantity needed, with the expected
 * stock at pick time beside it, shown only. Pure. Every figure is the record's: `inputs.storeLines[]` is per store and
 * ITEM, as the stock read gave it, with its `working[]` per mode (BackOffice 4375 / 4379); a row per working. No figure
 * is worked out again here. "Short by" is the gap between the quantity (in the stock read's unit) and the offered
 * stock, said in words, never planned on.
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
  /** The mode the stock was worked for: the buffer and the confidence are a mode's. */
  mode: string
  /** The till's figure: on hand (the figure after open demand where the read gave no till figure). */
  onHand: number
  /** The book's figure, beside it; null when not read. */
  sapStock: number | null
  /** Null both when the stock read could not split what it held. */
  heldByOrders: number | null
  heldByDeliveries: number | null
  /** The figure after open demand, floored at zero (the working's `netted`). */
  afterDemand: number
  confidence: number
  buffer: number
  offered: number
  /** The expected stock at the pick end: shown only. */
  expected: number
  /** The offered stock reaches the quantity. */
  covers: boolean
  shortBy: number
  /** The selected plan sends this line from this store by this mode. */
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
  // The offered stock is in the stock read's unit: a part-pack line is set against its quantity in that unit.
  const need = reply.lines.find((l) => l.lineNo === line.lineNo)?.stockQuantity ?? line.quantity
  const chosen = new Set((plan?.shipments ?? []).filter((s) => s.lines.includes(line.lineNo)).map((s) => `${s.store} ${s.mode}`))
  const names = storeNames(reply)
  const rows: StockRow[] = storeLines
    .filter((r) => r.item === line.item)
    .flatMap((r) =>
      (r.working ?? []).map((w) => ({
        store: r.store,
        storeName: names.get(r.store) ?? null,
        mode: w.mode,
        onHand: r.tillStock ?? r.afterOpenDemand,
        sapStock: r.sapStock ?? null,
        heldByOrders: r.heldByOrders ?? null,
        heldByDeliveries: r.heldByDeliveries ?? null,
        afterDemand: w.netted,
        confidence: w.confidence,
        buffer: w.buffer,
        offered: w.offered,
        expected: w.expectedAtPickEnd,
        covers: w.offered >= need,
        shortBy: Math.max(0, need - w.offered),
        chosen: chosen.has(`${r.store} ${w.mode}`),
      })),
    )
  return { lines, line, rows }
}
