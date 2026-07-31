/**
 * The three steps an order that cannot take items yet is waiting on — 175's
 * variant-4 sequence card, derived once, in one place.
 *
 * 🚩 **Why the card exists at all.** 175 shut the item gate: nothing enters an
 * order with no caller and no chosen store. v3's answer to a shut gate was a chip
 * row over a void — a screen that says what is *settled* and nothing about what
 * to do next. v1's answer was a permanent ladder, which is furniture the agent
 * stops reading by hour two. Variant 4's answer, and this module's contract, is
 * the third thing: **a sequence that RETIRES.** It is drawn only while the gate
 * is shut, and the moment the door will accept an item it is gone for the rest
 * of the call.
 *
 * 🚩 **Nothing here re-implements "what does this order need".** That predicate
 * is the door's — `capabilities.submitBlockers`, the same list the receipt words
 * and the chip row tints (`submit-blockers.ts`). The steps are that list, read in
 * the order the agent works in. A second client-side rule about completeness
 * would eventually disagree with the door that enforces it, which is the failure
 * US22 exists to close, and it would disagree *here* — on the one surface whose
 * whole job is telling the agent what to do next.
 *
 * 🚩 **The gate is the SERVER's too** (`canAddItem`, §3.4 rule 5, tightened by
 * 175). The card appears and retires on the door's own boolean, never on a count
 * of unfinished steps: an order the server will accept an item onto has nothing
 * left for this card to say, whatever the blockers list still holds.
 */
import type { SessionCapabilities, SessionHeader, SessionStatus } from '@/core/models/callcenter'
import { isPickup } from './fulfilment-view'

export interface OpeningStep {
  /** Stable id — the drive's handle on the row. */
  id: 'caller' | 'where' | 'items'
  done: boolean
  /**
   * The step's own key prefix under `steps.*`. Two rows are fixed and one is
   * the MODE's: *pick their delivery address* and *choose the collection store*
   * are different acts on different lists (175's two-list correction), and a
   * card that worded them alike would send the agent to the wrong surface.
   */
  key: 'caller' | 'address' | 'store' | 'items'
}

/**
 * The steps, or an empty list where there is nothing to sequence.
 *
 * Empty means one of two things and the card draws neither: the door will take
 * an item (the gate is open — the card has retired), or the order is no longer
 * open (a placed order is not waiting for anything).
 */
export function openingSteps(
  header: SessionHeader,
  capabilities: SessionCapabilities,
  status: SessionStatus,
): OpeningStep[] {
  // 🚩 `!== false`, not `=== true`: absent on a pre-v1.6 server means *the
  // console cannot see a shut gate*, and §9's rule is to degrade to what it can
  // see rather than to assume the worst. A card telling an agent to attach a
  // caller they have already attached is worse than no card.
  if (capabilities.canAddItem !== false) return []
  if (status !== 'open') return []

  const blocked = new Set(capabilities.submitBlockers ?? [])
  const pickup = isPickup(header)

  return [
    // The rail's, at the start edge — where the call actually opens (165).
    { id: 'caller', done: !blocked.has('NO_CUSTOMER'), key: 'caller' },
    // 🚩 Under delivery the ADDRESS is what chooses the store (166), so the step
    // names the address and is done only when both facts the door lists are
    // settled. Under collection the agent chooses the store themselves and the
    // address decides nothing, so `NO_ADDRESS` — which such an order will never
    // carry — is not consulted at all.
    {
      id: 'where',
      done: pickup
        ? !blocked.has('STORE_NOT_CHOSEN')
        : !blocked.has('STORE_NOT_CHOSEN') && !blocked.has('NO_ADDRESS'),
      key: pickup ? 'store' : 'address',
    },
    // 🚩 Never done. The gate being shut is exactly what this card is, so the
    // third row is the consequence of the two above it rather than a state of
    // its own — and the instant it WOULD be done, the whole card is gone.
    { id: 'items', done: false, key: 'items' },
  ]
}
