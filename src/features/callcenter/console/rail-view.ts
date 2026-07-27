/**
 * The customer rail's two derivations — **what the compact card shows** and
 * **which address state the rail is in** — as one pure module, because they are
 * the same question asked about the same caller.
 *
 * 135's ruling, from Salesforce's compact-layout discipline: the rail is a card
 * of **six fields maximum**, pinned where it never moves and never scrolls away.
 * The cap is the design — the seventh field is what turns a rail into a form,
 * and a form is what the agent has to read instead of listen. So the cap lives
 * here, enforced by construction, rather than in a component that could quietly
 * grow a line.
 *
 * 🚩 **The address state is read off `capabilities`, never re-derived.** The five
 * `CustomerAddresses` routes are server-side scoped to the session's attached
 * customer (§6.3, BackOffice 801), so "is the address book reachable" is a fact
 * about the door, not about what the console can see. A client rule that said
 * *attached ⇒ reachable* would be right today and wrong under `PickInStore`,
 * where the order has no address at all and the same capability is false for a
 * second, independent reason — and the agent would be handed a control that
 * answers with a refusal.
 */
import type {
  LoyaltyMember,
  SessionCapabilities,
  SessionCustomer,
  SessionHeader,
} from '@/core/models/callcenter'

/** 135's compact-layout cap. Raising it is a design decision, not a tidy-up. */
export const MAX_RAIL_FIELDS = 6

export interface RailField {
  /** Stable id — the i18n key suffix for the label, and the drive's handle. */
  id: 'name' | 'mobile' | 'member' | 'tier' | 'points' | 'email'
  /** Server-supplied text, passed through as data — never a key. */
  value: string
}

/**
 * The compact card, in a **fixed order**: the three the order itself holds
 * first, then whatever the loyalty lookup adds, truncated at the cap.
 *
 * Fixed rather than "whatever is available" because the rail's whole value is
 * that the agent's eye lands in the same place at hour nine as at hour one. A
 * card that reordered itself when a tier appeared would cost that.
 *
 * Two rules about the two sources:
 *
 * - **Identity comes off the projection**, not the lookup. `SessionState` is what
 *   the order actually holds (law 2); the member record is only how the agent
 *   found them. Where they could disagree, the loose one must not be the one
 *   read out to the caller.
 * - 🚩 **A member for a different `customerId` decorates nothing.** The lookup is
 *   client-held and outlives one search, so a tier from the previous caller is a
 *   real hazard and not a hypothetical one.
 */
export function railFields(
  customer: SessionCustomer | null,
  member: LoyaltyMember | null,
): RailField[] {
  if (!customer) return []

  const enrich = member && member.loyId === customer.customerId ? member : null

  const candidates: Array<{ id: RailField['id']; value: string | null }> = [
    { id: 'name', value: customer.name },
    { id: 'mobile', value: customer.mobile },
    { id: 'member', value: customer.customerId },
    { id: 'tier', value: enrich?.tier ?? null },
    // Not money and never formatted as such — a points balance is a count. The
    // `??` is deliberate over a falsy check: nought points is a value the agent
    // may have to state, and an absent balance is not the same fact.
    { id: 'points', value: enrich?.pointsBalance != null ? String(enrich.pointsBalance) : null },
    { id: 'email', value: enrich?.email ?? null },
  ]

  return candidates
    .filter((f): f is { id: RailField['id']; value: string } => Boolean(f.value))
    .slice(0, MAX_RAIL_FIELDS)
}

/**
 * Which of the four address states the rail is in.
 *
 * - `set` — an address is on the order. It outranks the capability: an address
 *   already picked is a fact to show, whatever the book's door is doing now.
 * - `pick` — the server says the book will answer, and there is nothing yet. The
 *   empty dashed slot with its own *Pick an address* (US12) — the next step
 *   stated as a shape rather than as a message to read.
 * - `noCaller` — nothing is attached. **Not a disabled control**: the console
 *   shows what the next step is (attach the caller) instead of offering
 *   something to poke that would answer with a refusal.
 * - `unavailable` — a caller IS attached and the door still says no. Rare and
 *   real (v1.1 `PickInStore`), and the one state a client-side re-derivation
 *   would get wrong.
 */
export type AddressSlot = 'set' | 'pick' | 'noCaller' | 'unavailable'

export function addressSlot(
  header: SessionHeader,
  capabilities: SessionCapabilities,
): AddressSlot {
  if (header.address) return 'set'
  if (capabilities.canOpenAddressBook) return 'pick'
  return header.customer ? 'unavailable' : 'noCaller'
}
