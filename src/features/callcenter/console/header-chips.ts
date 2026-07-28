/**
 * The header chip row's state, derived once, in one place.
 *
 * 135's progressive collapse: store · slot · source · ref sit as chips above the
 * basket, each carrying one of three states — *settled*, *needs attention*,
 * *derived*. Spec 160 rules the derivation a **pure module, not JSX**, and rules
 * where the attention state comes from: `capabilities.submitBlockers`, the
 * server's own list, never a second client-side rule about what an order needs.
 * A console that re-implemented that predicate would eventually disagree with
 * the door that enforces it.
 *
 * Slice 0 renders the row unset. The chips become interactive — re-opening the
 * section they collapsed — with the tickets that build those sections.
 */
import type { SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import { isPickup, paymentWordKey } from './fulfilment-view'
import { blockedChips } from './submit-blockers'

export type ChipState = 'settled' | 'needsAttention' | 'unset'

export interface HeaderChip {
  /** Stable id — the i18n key suffix and the drive's handle on the chip. */
  id: 'fulfilment' | 'store' | 'slot' | 'source' | 'reference' | 'payment'
  state: ChipState
  /**
   * Server-supplied text (a store name, a slot label). Null renders the chip's
   * own "not set" wording, which is a key.
   *
   * 🚩 Two chips carry a **key** instead (`valueKey`): fulfilment and payment are
   * closed enumerations the console words itself — the wire says
   * `"PickInStore"` and `"CashOnDelivery"`, which are not sentences an agent
   * reads out to a caller.
   */
  value: string | null
  /** An i18n key under `chips.value.*`, for the two enumerated chips. Set
   *  instead of `value`, never beside it. */
  valueKey?: string
  /** True only when the plant came from the address — the parenthetical that
   *  makes a store the agent did not choose read as explained (135). */
  derived?: boolean
  /**
   * 🚩 The slot the order holds is no longer active — `slot.isActive: false`.
   *
   * It is a **warning, not an attention state**, and the difference is the
   * ticket's whole point: on a CLCN order the slot is a SOFT gate (§7 —
   * `SLOT_UNAVAILABLE` is "a warning path, not a submit blocker"), so a lapsed
   * slot is something the agent should see and may act on, never something that
   * stops the order being placed. Only the server's `submitBlockers` can make a
   * chip *needsAttention*; nothing here promotes a lapse into one.
   */
  lapsed?: boolean
}

export function headerChips(header: SessionHeader, capabilities: SessionCapabilities): HeaderChip[] {
  // 🚩 The SAME table the receipt words its blockers from (`submit-blockers.ts`,
  // ticket 173). Two tables would eventually disagree about which section a
  // blocker belongs to, and the agent would meet the difference at submit —
  // which is the whole failure US22 exists to close.
  const blocked = blockedChips(capabilities.submitBlockers)

  const chip = (
    id: HeaderChip['id'],
    value: string | null,
    extra?: Partial<Pick<HeaderChip, 'derived' | 'lapsed' | 'valueKey'>>,
  ): HeaderChip => ({
    id,
    // Attention beats settled: a chip the server says is blocking submit must
    // LOOK like it needs something, or the agent finds out at submit (US22).
    state:
      blocked.has(id) ? 'needsAttention' : value || extra?.valueKey ? 'settled' : 'unset',
    value,
    ...(extra?.valueKey ? { valueKey: extra.valueKey } : {}),
    ...(extra?.derived ? { derived: true } : {}),
    ...(extra?.lapsed ? { lapsed: true } : {}),
  })

  const plant = header.plant ? [header.plant, header.plantName].filter(Boolean).join(' · ') : null
  const slot = header.slot
  const pickup = isPickup(header)
  const payment = paymentWordKey(header)

  return [
    // 🚩 **First, and always settled** (176). The mode is the question the agent
    // asks at the top of the call — *"delivering, or collecting?"* — and it is
    // the one chip that is never empty, because the order always holds a mode.
    // Its position is load-bearing: everything to its right is a consequence of
    // it, and two of them (slot, delivery fee) stop existing when it flips.
    chip('fulfilment', null, { valueKey: pickup ? 'pickInStore' : 'delivery' }),
    // 🚩 Under pickup the plant is what the agent CHOSE, so the *(derived)*
    // parenthetical must not survive the flip: capture 09 keeps
    // `plantSource: derivedFromAddress` across a flip whose response also carries
    // `address: null`, and a chip reading *from the address* on an order that has
    // no address points at something the console cannot show.
    chip('store', plant, { derived: !pickup && header.plantSource === 'derivedFromAddress' }),
    // 🚩 A lapsed slot still SHOWS its window and stays *settled*: the order
    // holds it, and hollowing the chip out would read as "no slot chosen" — the
    // one thing that is not true. The warning rides beside it (soft gate, §7).
    chip('slot', slot ? `${slot.from}–${slot.to}` : null, { lapsed: slot ? !slot.isActive : false }),
    chip('source', header.documentSource),
    chip('reference', header.sourceReference),
    // 155 — settled and collapsed. It has a real default and no `submitBlocker`,
    // so it is a fact the agent confirms in one spoken question, not an
    // outstanding field. Its WORD follows the mode; its value never does.
    chip('payment', null, { valueKey: payment ?? undefined }),
  ].filter((entry) => {
    // 🚩 **Absent, not disabled** — the posture 175 chose for the item command
    // line and 156 for the fee region, applied to the one chip a pickup order
    // genuinely does not have. `RequiresSlot(bool isDelivery) => isDelivery`, and
    // the server drops `MISSING_SLOT` from `submitBlockers` in the same response
    // (capture 09), so a slot chip here would be the console asking for
    // something nothing will ever wait on.
    if (entry.id === 'slot' && pickup) return false
    // A `paymentType` the client cannot word (a future `Receivable`) draws no
    // chip rather than a chip saying nothing — degrade, never throw (§9).
    if (entry.id === 'payment' && !payment) return false
    return true
  })
}
