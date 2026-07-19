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
  /** Merge a poll delta: upsert each item, adopt the returned watermark. */
  merge: (result: NotificationPollResult) => void
  /** Latch the feature-off state (a 404 poll). */
  setDisabled: () => void
}

export const useNcStore = create<NcState>((set) => ({
  items: {},
  watermark: 0,
  disabled: false,
  merge: (result) =>
    set((prev) => {
      const items = { ...prev.items }
      for (const item of result.items) items[item.notificationId] = item
      return { items, watermark: result.watermark }
    }),
  setDisabled: () => set({ disabled: true }),
}))

/** The accumulated items as a plain array (unordered — callers sort/filter). */
export function ncItems(state: NcState): NotificationItem[] {
  return Object.values(state.items)
}
