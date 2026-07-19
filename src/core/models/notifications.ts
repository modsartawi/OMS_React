// Wire shapes for the Notification Center poll (map 023, spec 031). Field casing
// is the camelCase ASP.NET Core emits. A back-office (no-registerid) caller only
// ever receives All- and User-audience items, so v1 surfaces BROADCAST +
// JOB_DONE (+ NC_TEST for smoke). The full contract (Claim, deep-link, presence)
// is documented in 024-nc-backend-contract-for-web.RESEARCH.md; the fields below
// are the SUBSET v1 consumes — DeadlineAt/NavRoute/EntityId/ClaimedBy* are in the
// contract but unused here.

/** The v1 notification type codes a back-office caller sees (024 §Constants). */
export type NcTypeCode = 'BROADCAST' | 'JOB_DONE' | 'NC_TEST'

/** Denormalized from the type registry — drives the arrival treatment (035). */
export type NcDisplayStyle = 'Badge' | 'Toast' | 'Banner'

/** Lifecycle state; `Active` is the only "needs attention" state (024 §Statuses). */
export type NcStatus = 'Active' | 'Claimed' | 'Resolved' | 'Cancelled'

/**
 * One polled notification, the v1 subset. `isRead` is a per-device receipt (for a
 * BO caller the device IS the user), so a read broadcast rehydrates on reload.
 * `expiresAt` is a client-side render/count filter — the poll never announces
 * expiry (the rowversion doesn't bump), so both badge and list drop expired items.
 */
export interface NotificationItem {
  notificationId: string
  typeCode: NcTypeCode | string
  title: string
  body: string
  createdAt: string
  expiresAt: string
  status: NcStatus | string
  isRead: boolean
  displayStyle: NcDisplayStyle | string
  readScope: string // 'Device' | 'Claim' — v1 types are all Device-scope
}

/**
 * GET Notifications/Poll?watermark= result. The watermark is a SQL rowversion
 * read as a bigint — the client adopts the returned value verbatim (even if it
 * heals lower) and sends it back next poll. `items` is a DELTA since the last
 * watermark, not the full set — the client accumulates them in-memory (a reload,
 * i.e. watermark=0, cold-starts the full active set). See 024 §Watermark.
 */
export interface NotificationPollResult {
  items: NotificationItem[]
  watermark: number
}
