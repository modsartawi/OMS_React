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
import { blockedChips } from './submit-blockers'

export type ChipState = 'settled' | 'needsAttention' | 'unset'

export interface HeaderChip {
  /** Stable id — the i18n key suffix and the drive's handle on the chip. */
  id: 'store' | 'slot' | 'source' | 'reference'
  state: ChipState
  /** Server-supplied text (a store name, a slot label). Null renders the chip's
   *  own "not set" wording, which is a key. */
  value: string | null
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
    extra?: Partial<Pick<HeaderChip, 'derived' | 'lapsed'>>,
  ): HeaderChip => ({
    id,
    // Attention beats settled: a chip the server says is blocking submit must
    // LOOK like it needs something, or the agent finds out at submit (US22).
    state: blocked.has(id) ? 'needsAttention' : value ? 'settled' : 'unset',
    value,
    ...(extra?.derived ? { derived: true } : {}),
    ...(extra?.lapsed ? { lapsed: true } : {}),
  })

  const plant = header.plant ? [header.plant, header.plantName].filter(Boolean).join(' · ') : null
  const slot = header.slot

  return [
    chip('store', plant, { derived: header.plantSource === 'derivedFromAddress' }),
    // 🚩 A lapsed slot still SHOWS its window and stays *settled*: the order
    // holds it, and hollowing the chip out would read as "no slot chosen" — the
    // one thing that is not true. The warning rides beside it (soft gate, §7).
    chip('slot', slot ? `${slot.from}–${slot.to}` : null, { lapsed: slot ? !slot.isActive : false }),
    chip('source', header.documentSource),
    chip('reference', header.sourceReference),
  ]
}
