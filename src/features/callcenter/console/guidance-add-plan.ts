/**
 * Which verb an offer's Add is (spec 995 reconcile, BackOffice 4459).
 *
 * The console refuses a repeat `addItem` of an article the order already holds
 * (`ITEM_ALREADY_ON_ORDER`, any unit — the engine's `RefuseRepeatScan`), and the offer what-if
 * priced exactly that case as the line GROWING. So an Add for an item already on a line is that
 * line's ordinary `changeQty`, to its quantity plus the add's — the owner's case, 509366 × 1 in the
 * basket and *Add 3*, is one `changeQty` to 4, never an `addItem` of 3.
 *
 * 🚩 Only when the line is in the add's unit. The add counts the item's base unit; a line in
 * another unit (a BOX beside an EA add) has no quantity this console can work out — the server
 * converts, and the client never does — and an `addItem` would be refused. That case is said, not
 * sent (`otherUnit`).
 */

export type GuidanceAddPlan =
  | { kind: 'add'; itemNumber: string; qty: number; uom: string | null }
  | { kind: 'grow'; lineId: string; qty: number }
  | { kind: 'otherUnit'; lineId: string; lineUom: string }

export function guidanceAddPlan(
  add: { itemNumber: string; qty: number; uom?: string | null },
  basket: readonly { lineId: string; itemNumber: string; qty: number; uom: string }[],
): GuidanceAddPlan {
  const uom = add.uom?.trim() ? add.uom.trim() : null
  const line = basket.find((candidate) => candidate.itemNumber === add.itemNumber)
  if (!line) return { kind: 'add', itemNumber: add.itemNumber, qty: add.qty, uom }
  if (uom !== null && line.uom.trim().toUpperCase() !== uom.toUpperCase())
    return { kind: 'otherUnit', lineId: line.lineId, lineUom: line.uom }
  // Two counts of the same unit: a quantity, not a price (law 1 holds).
  return { kind: 'grow', lineId: line.lineId, qty: line.qty + add.qty }
}
