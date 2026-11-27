/**
 * The pitch card's unit strip and its primary action (spec 995 D3, ticket 996).
 *
 * Progress is UNITS (`progress.unitsHave` / `unitsNeed`, C2), never the prerequisite counter
 * `have` / `need`, which stays on the wire for the guidance strip only. The strip is
 * `unitsNeed + getQty` slots: the units in the basket, the units still to add, and the free ones.
 *
 * With no `unitsHave` (a v1.13 server, a value threshold, several prerequisites) there is no
 * strip and no add: the card falls back to the old `have/need` meter.
 *
 * The figures here are unit counts, not money.
 */
import type { NearMiss, OfferDefinition } from '@/core/models/callcenter'

export type StripSlot = 'in' | 'add' | 'free'

export interface OfferStrip {
  slots: StripSlot[]
  /** Units of the offer in the basket (clamped to the buy side). */
  have: number
  /** Every unit of the completed offer, free ones included — the *4* of *1 of 4*. */
  total: number
}

export interface OfferAddQty {
  /** How many to add in ONE `addItem` of the offer's item. */
  qty: number
  /** How many of them come free — the get side, when it is the same item. */
  free: number
}

type Progress = NearMiss['progress']

export function offerStrip(progress: Progress, definition: OfferDefinition | null | undefined): OfferStrip | null {
  const units = unitsOf(progress)
  if (!units) return null
  const free = getQtyOf(definition)
  const slots: StripSlot[] = [
    ...Array.from({ length: units.need }, (_, i): StripSlot => (i < units.have ? 'in' : 'add')),
    ...Array.from({ length: free }, (): StripSlot => 'free'),
  ]
  return { slots, have: units.have, total: slots.length }
}

/** The missing quantity: the buy units still to add, plus the free ones when they are the same
 *  item (the engine gives them only once they are on the line). `null` with no units. */
export function offerAdd(progress: Progress, definition: OfferDefinition | null | undefined): OfferAddQty | null {
  const units = unitsOf(progress)
  if (!units) return null
  const free = definition?.getSameItem === true ? getQtyOf(definition) : 0
  const qty = units.need - units.have + free
  return qty > 0 ? { qty, free } : null
}

function unitsOf(progress: Progress): { have: number; need: number } | null {
  const need = count(progress?.unitsNeed)
  const have = count(progress?.unitsHave)
  if (need === null || need <= 0 || have === null) return null
  return { have: Math.min(have, need), need }
}

const getQtyOf = (definition: OfferDefinition | null | undefined): number => count(definition?.getQty) ?? 0

const count = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
