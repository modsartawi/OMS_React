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
}

/** `submitBlockers` entries the chip row answers for (CONTRACT.md §2). Anything
 *  else in the list belongs to another region and is ignored here. */
const BLOCKER_FOR: Record<string, HeaderChip['id']> = {
  MISSING_SLOT: 'slot',
  MISSING_SOURCE: 'source',
  MISSING_SOURCE_REFERENCE: 'reference',
  SOURCE_REFERENCE_REQUIRED: 'reference',
}

export function headerChips(header: SessionHeader, capabilities: SessionCapabilities): HeaderChip[] {
  const blocked = new Set(
    (capabilities.submitBlockers ?? []).map((code) => BLOCKER_FOR[code]).filter(Boolean),
  )

  const chip = (id: HeaderChip['id'], value: string | null, derived?: boolean): HeaderChip => ({
    id,
    // Attention beats settled: a chip the server says is blocking submit must
    // LOOK like it needs something, or the agent finds out at submit (US22).
    state: blocked.has(id) ? 'needsAttention' : value ? 'settled' : 'unset',
    value,
    ...(derived ? { derived: true } : {}),
  })

  const plant = header.plant ? [header.plant, header.plantName].filter(Boolean).join(' · ') : null

  return [
    chip('store', plant, header.plantSource === 'derivedFromAddress'),
    chip('slot', header.slot ? `${header.slot.from}–${header.slot.to}` : null),
    chip('source', header.documentSource),
    chip('reference', header.sourceReference),
  ]
}
