/**
 * A bundle offer (BackOffice 4462, found on the 2026-11-28 walk) — no buy side, and a get side of
 * several items that must ALL be on the order: OMS000004508 is *50% off 106429 and 50% off 103436,
 * bought together*. Before this the card described the first arm only (*and get 1 of the offer's
 * item at 50% off*) and named nothing to add, so the agent could not tell the caller what was missing.
 *
 * Read off `definition.getItems` / `getAll` (server facts). The client compares counts it was given
 * (`have` against `qty`) and never computes money.
 */
import type { OfferDefinition } from '@/core/models/callcenter'

export interface BundleItem {
  itemNumber: string
  /** The catalogue name the server sent; `null` when it had none (the row shows the number). */
  name: string | null
  qty: number
  uom: string | null
  /** The order already holds the whole quantity. */
  held: boolean
  /** What is still to add, in the condition's unit (0 when held). */
  missing: number
}

export interface OfferBundle {
  items: BundleItem[]
  /** The shared percentage when every arm is the same percent off; `null` otherwise. */
  value: number | null
}

/** The bundle, or `null` for any other shape (a buy side, one get item, OR-linked, or an arm with
 *  no single item to name). */
export function offerBundle(definition: OfferDefinition | null | undefined): OfferBundle | null {
  if (!definition || definition.getAll !== true) return null
  if (positive(definition.buyQty) !== null) return null
  const raw = definition.getItems ?? []
  if (raw.length < 2 || raw.some((item) => !item?.itemNumber)) return null

  const items = raw.map((item): BundleItem => {
    const qty = positive(item.qty) ?? 1
    const have = typeof item.have === 'number' && item.have > 0 ? item.have : 0
    return {
      itemNumber: item.itemNumber as string,
      name: item.description?.trim() || null,
      qty,
      uom: item.uom ?? null,
      held: have >= qty,
      missing: have >= qty ? 0 : qty - have,
    }
  })
  const percents = raw.map((item) => (item.discountType === 'percent' ? positive(item.discountValue) : null))
  const value = percents.every((p) => p !== null && p === percents[0]) ? percents[0] : null
  return { items, value }
}

/** The next item to add: the first one the order does not hold in full. */
export function bundleNext(bundle: OfferBundle | null): BundleItem | null {
  return bundle?.items.find((item) => !item.held) ?? null
}

const positive = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
