/**
 * The slot picker's one derivation — **which day the picker opens on** — as a
 * pure module, because it is the only rule on that surface that can be silently
 * wrong.
 *
 * 🚩 Nothing here decides whether a window is legal. `status: false` is the
 * server's own *full*, `SlotIsActive` is its own endpoint, and `SLOT_UNAVAILABLE`
 * is a soft gate the door raises (§7). This module reads what the order already
 * holds and answers an index; it never filters a window, never sorts one, and
 * never re-words a server label.
 */
import type { SessionSlot } from '@/core/models/callcenter'
import type { TimeSlotModel } from '@/core/models/slots'

/**
 * The day the picker should open on: **the one holding the slot the order
 * already has**, or the first day offered.
 *
 * 🚩 Before the day row existed this was always `0`, and the cost was hidden: an
 * order with a Thursday window opened the picker on Monday, drew none of the
 * agent's own pick, and the *on this order* tick lived on a day nobody was
 * looking at. An agent checking what the caller had been promised would read the
 * first day's windows and answer from them.
 *
 * ⚠️ Falls back to `0` rather than to *no day* when the held slot is not in the
 * list at all — which is a real state, not a fault: the windows are read fresh
 * at the order's store, and a slot picked before a store move belongs to a
 * catalogue that is no longer on screen. The agent is then choosing again, and
 * the first day is where that starts.
 */
export function initialDayIndex(
  days: TimeSlotModel[] | null | undefined,
  current: SessionSlot | null | undefined,
): number {
  const slotId = (current?.slotId ?? '').trim()
  if (slotId === '') return 0

  const held = (days ?? []).findIndex((day) =>
    (day?.times ?? []).some((time) => time?.slotId === slotId),
  )
  return held === -1 ? 0 : held
}
