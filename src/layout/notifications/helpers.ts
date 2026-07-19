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

/**
 * The panel list: non-expired items, newest-first by `createdAt` (024 §ordering —
 * no SLA/soonest-deadline sort in v1). Expired items are excluded the same way
 * the badge excludes them. Pure over the accumulated set (input not mutated).
 */
export function visibleItems(items: NotificationItem[], now: number): NotificationItem[] {
  return items
    .filter((i) => notExpired(i.expiresAt, now))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

/** A relative-time result: an i18n key under `relative.*` + its `count` param. */
export interface RelativeTime {
  key: 'justNow' | 'minutes' | 'hours' | 'days'
  count: number
}

/**
 * Bucket an elapsed duration into a relative-time key + count ("{{count}}m ago",
 * …). Returns a key/param pair, not a string, so the wording stays in the
 * translation layer (zero-literal). `now` is injected to keep it pure; a blank or
 * future stamp reads as "just now". Mirrors the Active Sessions relative-time rule.
 */
export function relativeTime(iso: string, now: number): RelativeTime {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return { key: 'justNow', count: 0 }
  const minutes = Math.floor(Math.max(0, now - then) / 60_000)
  if (minutes < 1) return { key: 'justNow', count: 0 }
  if (minutes < 60) return { key: 'minutes', count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'hours', count: hours }
  return { key: 'days', count: Math.floor(hours / 24) }
}
