/**
 * What the caller's compact card shows — the customer rail's derivation, and since
 * 409 the caller bar's (`caller-bar.ts` re-seats these fields on one line; the rail's
 * address block retired with the rail, and the sentence's address word owns it).
 *
 * 135's ruling, from Salesforce's compact-layout discipline: the card holds **six
 * fields maximum**. The cap is the design — the seventh field is what turns a card
 * into a form, and a form is what the agent has to read instead of listen. So the
 * cap lives here, enforced by construction, rather than in a component that could
 * quietly grow a line.
 */
import type { LoyaltyMember, SessionCustomer } from '@/core/models/callcenter'

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
 * Fixed rather than "whatever is available" because the card's whole value is
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
