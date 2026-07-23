import { notificationsApi } from './api'
import { useNcStore } from './store'

// Read actions for the Notification Center (ticket 034). Reading is the act of
// reading — clicking a row (or "Mark all as read") posts a per-id Read receipt
// and optimistically flips the store so the row mutes and the badge drops
// immediately. On failure the optimistic flip reverts (a delta poll won't
// re-deliver the item, so without a revert a failed read would look read until
// reload). These live outside the store so the store never calls the network.

/** Mark one item read: optimistic flip, POST Read, revert on failure. */
export async function markNotificationRead(id: string): Promise<void> {
  const { items, setRead } = useNcStore.getState()
  const item = items[id]
  if (!item || item.isRead) return
  setRead(id, true)
  try {
    await notificationsApi.markRead(id)
  } catch {
    // Revert the optimistic flip — the read didn't take.
    useNcStore.getState().setRead(id, false)
  }
}

/**
 * Mark every given id read by looping the per-id Read (there is no bulk
 * endpoint, 024 §gap 4). Runs concurrently; each id reverts independently on
 * failure via {@link markNotificationRead}.
 */
export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => markNotificationRead(id)))
}
