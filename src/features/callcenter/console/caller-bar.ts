/**
 * The caller bar's derivations (ticket 409, spec 380 C7/C8; 379's variant C).
 *
 * The customer rail collapsed into one bar at the top of the centre column, and it
 * took the rail's card with it: **the fields are still `railFields`'s**, so 135's
 * six-field cap and its rule about where each field comes from (identity off the
 * order, tier, points and email only off this session's lookup member) hold in the
 * bar by construction. What the bar changes is only the seating: one line, in the
 * order 379's approved capture draws — who, then their standing, then the numbers
 * the agent reads back.
 */
import type { LoyaltyMember, SessionCustomer } from '@/core/models/callcenter'
import type { LinkedCard, RequestOffer } from './linked-request'
import { railFields, type RailField } from './rail-view'

/** The bar's fixed order. Fixed for the rail's reason: the agent's eye lands in the
 *  same place at hour nine as at hour one, whatever the lookup happened to add. */
export const BAR_ORDER: RailField['id'][] = ['name', 'tier', 'points', 'mobile', 'member', 'email']

/** `railFields`, re-seated in `BAR_ORDER`. Never a field the rail would not show. */
export function barFields(customer: SessionCustomer | null, member: LoyaltyMember | null): RailField[] {
  const fields = railFields(customer, member)
  return BAR_ORDER.flatMap((id) => fields.filter((field) => field.id === id))
}

/**
 * The one requests chip the bar carries (194, 379 §2):
 *
 * - `linked` — *Converting request ‹no› ↗*, once this order converts one. It
 *   **replaces** the count: one order converts at most one request.
 * - `offer` — *N open requests · View*, the caller's count on attention ground.
 * - `null` — silence. A plain order gains no furniture.
 *
 * Both inputs are the page's derivations (`requestOffer`, `linkedCard`), read once
 * off the same state the picker reads, so the chip cannot disagree with it.
 */
export type RequestsChip = { kind: 'linked'; card: LinkedCard } | { kind: 'offer'; count: number } | null

export function requestsChip(offer: RequestOffer | null, card: LinkedCard | null): RequestsChip {
  if (card) return { kind: 'linked', card }
  if (offer) return { kind: 'offer', count: offer.count }
  return null
}

/** The count's short form — the rail's whole sentence wrapped the bar at 1280 (379).
 *  A plural key whose count sits in its own `<n>` slot, so it is isolated whole. */
export const OPEN_REQUESTS_SHORT = 'requests.openShort'
