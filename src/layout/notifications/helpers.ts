// Pure, framework-free derivations for the Notification Center (spec 031). The
// badge and list are 100% CLIENT-derived — there is no server unread-count or
// list endpoint (024 §gap 3), so these replicate the POS presenter's rules over
// the polled active set. Kept export-only and injected with `now` so they are the
// highest, cheapest test seam (the runner drops on later).

import type { NotificationItem } from '@/core/models/notifications'

/**
 * Whether an item is still live at `now` (epoch ms). Expiry is a client-side
 * filter — the poll never announces it, so both badge and list must exclude
 * `expiresAt <= now`. A blank/unparseable stamp is treated as non-expiring
 * (keep it) rather than silently dropped.
 */
export function notExpired(expiresAt: string, now: number): boolean {
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return true
  return t > now
}

/** An item counts toward the badge when Active ∧ not-expired ∧ not-read. */
function isUnreadActive(item: NotificationItem, now: number): boolean {
  return item.status === 'Active' && notExpired(item.expiresAt, now) && !item.isRead
}

/**
 * The unread badge count: items where `status === 'Active'` ∧ `expiresAt > now`
 * ∧ `!isRead`. Zero ⇒ the caller hides the badge. Pure over the accumulated set.
 */
export function unreadCount(items: NotificationItem[], now: number): number {
  return items.filter((i) => isUnreadActive(i, now)).length
}
