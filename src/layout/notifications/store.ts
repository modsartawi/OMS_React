import { create } from 'zustand'
import type { NotificationItem, NotificationPollResult } from '@/core/models/notifications'

// In-memory Notification Center store. The poll returns a DELTA since the last
// watermark, so the client accumulates items here keyed by id and adopts the
// server watermark verbatim (024 §Watermark). Held in memory only — a reload
// resets the watermark to 0 and cold-starts the full active set. The badge/list
// derive from `items` via the pure helpers; nothing server-side counts for us.

interface NcState {
  /** Accumulated active items, keyed by notificationId (newest poll wins). */
  items: Record<string, NotificationItem>
  /** Last rowversion the server handed back; sent as the next poll's watermark. */
  watermark: number
  /** A 404 poll ⇒ NotificationCenter:Enabled is off ⇒ hide the bell entirely. */
  disabled: boolean
  /** Whether the dropdown panel is open. Lifted here so a toast's "View" action
   *  (035) can open it without reaching into the bell's local state. */
  panelOpen: boolean
  /** Merge a poll delta: upsert each item, adopt the returned watermark. */
  merge: (result: NotificationPollResult) => void
  /** Latch the feature-off state (a 404 poll). */
  setDisabled: () => void
  /**
   * Optimistically flip an item's read state (034). The badge/list re-derive
   * immediately; the authoritative `isRead` rehydrates on the next cold-start
   * poll (a Read receipt doesn't bump the notification rowversion, so a delta
   * poll never re-delivers the item — the optimistic flip stands until reload).
   * A failed Read reverts by calling this with the prior value.
   */
  setRead: (id: string, value: boolean) => void
  /** Open/close the dropdown panel. */
  setPanelOpen: (open: boolean) => void
}

export const useNcStore = create<NcState>((set) => ({
  items: {},
  watermark: 0,
  disabled: false,
  panelOpen: false,
  merge: (result) =>
    set((prev) => {
      const items = { ...prev.items }
      for (const item of result.items) items[item.notificationId] = item
      return { items, watermark: result.watermark }
    }),
  setDisabled: () => set({ disabled: true }),
  setRead: (id, value) =>
    set((prev) => {
      const item = prev.items[id]
      if (!item || item.isRead === value) return prev
      return { items: { ...prev.items, [id]: { ...item, isRead: value } } }
    }),
  setPanelOpen: (open) => set({ panelOpen: open }),
}))

/** The accumulated items as a plain array (unordered — callers sort/filter). Builds a
 *  NEW array each call, so a hook consumer MUST wrap it in `useShallow`
 *  (`useNcStore(useShallow(ncItems))`) — a raw `useNcStore(ncItems)` returns a fresh
 *  reference every render and loops `useSyncExternalStore` ("maximum update depth"). */
export function ncItems(state: NcState): NotificationItem[] {
  return Object.values(state.items)
}
