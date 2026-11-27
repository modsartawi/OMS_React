/**
 * The slot picker's derivations — **which day the picker opens on**, and (992) which
 * window *Next free slot* books — as a pure module, because they are the rules on
 * that surface that can be silently wrong.
 *
 * 🚩 Nothing here decides whether a window is legal. `status: false` is the
 * server's own *full*, `SlotIsActive` is its own endpoint, and `SLOT_UNAVAILABLE`
 * is a soft gate the door raises (§7). This module reads what the order already
 * holds and the server's own `status`; it never sorts a window and never re-words
 * a server label.
 */
import type { SessionSlot } from '@/core/models/callcenter'
import type { TimeSlotModel } from '@/core/models/slots'
import type { PickedSlot } from './api'

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

/**
 * 992 — the window *Next free slot* (Ctrl K) books: **the first window with room after
 * the one the order holds**, in the server's own order, or the first with room when the
 * order holds none (or holds one no longer in this store's list — a store move).
 *
 * 🚩 "With room" is the server's own `status`, read and never decided: a window the list
 * calls full is skipped exactly as the picker draws it unpressable, and one that filled
 * since the read still meets the door's soft `SLOT_UNAVAILABLE`. `null` means nothing
 * later has room — the page then opens the picker rather than guessing.
 */
export function nextFreeSlot(
  days: TimeSlotModel[] | null | undefined,
  current: SessionSlot | null | undefined,
): PickedSlot | null {
  const windows = (days ?? []).flatMap((day) => (day?.times ?? []).map((time) => ({ day, time })))
  const heldId = (current?.slotId ?? '').trim()
  const held = heldId === '' ? -1 : windows.findIndex(({ time }) => time?.slotId === heldId)
  const next = windows.slice(held + 1).find(({ time }) => time?.status !== false)
  if (!next) return null
  return {
    slotId: next.time.slotId,
    day: next.day.day,
    description: next.time.time,
    from: next.time.slotFrom,
    to: next.time.slotTo,
  }
}
