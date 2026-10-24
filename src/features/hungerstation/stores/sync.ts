import { HUNGERSTATION_ERRORS, type HungerStationStoreRow, type HungerStationSyncLogRow } from '@/core/models/hungerstation'
import { formatFigure as figure } from '@/core/util/number-format'

// Pausing / resuming a HungerStation store's stock sync, and pushing its stock now (ticket 553;
// contract § Stock sync, `PUT …/Sync/{storeCode}/Active` and `POST …/Sync/{storeCode}/Now`).
// Pure: no React, no `t`, no `@/core/api`.

export const syncPath = (storeCode: string) => `HungerStationWeb/Sync/${encodeURIComponent(storeCode)}`

/** `PUT HungerStationWeb/Sync/{storeCode}/Active` — body `{ active, reason }`, answers the store row. */
export const syncActivePath = (storeCode: string) => `${syncPath(storeCode)}/Active`

/** `POST HungerStationWeb/Sync/{storeCode}/Now` — body `{ reason }`, answers the push's log row. */
export const syncNowPath = (storeCode: string) => `${syncPath(storeCode)}/Now`

/**
 * The line a finished push reads: the materials sent (grouped, for an `<n>` slot) and its status,
 * as the key `syncNow.result.S` / `syncNow.result.E`.
 */
export function syncNowResult(log: Pick<HungerStationSyncLogRow, 'rows' | 'status'>): {
  key: `syncNow.result.${HungerStationSyncLogRow['status']}`
  rows: string
  status: HungerStationSyncLogRow['status']
} {
  return { key: `syncNow.result.${log.status}`, rows: figure(log.rows), status: log.status }
}

/**
 * The refusals of sync now the dialog reads in its own words (`syncNow.refusal.<kind>` and its
 * `…Hint`), each beside the server's sentence and code:
 * - `paused` — DHS-00013 (409): the store's stock sync is paused;
 * - `hungerStationFailed` — DHS-00014 (502): HungerStation refused or was unreachable; its answer
 *   is the envelope's `message`, and the push WAS recorded as failed (it shows in the logs, 554);
 * - `busy` — 409 `HungerStationSyncBusy`: another push of the store is running. Not an error:
 *   nothing was pushed or recorded, try again shortly;
 * - `gone` — DHS-00007: the store was removed meanwhile; the list is read again.
 */
export const SYNC_NOW_REFUSALS = ['paused', 'hungerStationFailed', 'busy', 'gone'] as const

export type SyncNowRefusal = (typeof SYNC_NOW_REFUSALS)[number]

const E = HUNGERSTATION_ERRORS
const BY_CODE: Record<string, SyncNowRefusal> = {
  [E.syncPaused]: 'paused',
  [E.hungerStationFailed]: 'hungerStationFailed',
  [E.syncBusy]: 'busy',
  [E.notOnboarded]: 'gone',
}

/** The refusal a sync-now error code is, or `null` when it is not one of sync now's own. */
export function syncNowRefusal(code: string | null): SyncNowRefusal | null {
  return (code !== null && BY_CODE[code]) || null
}

/** The codes sync now shows in its own words — so the dialog does not show them twice. */
export const SYNC_NOW_CODES = Object.keys(BY_CODE)

/**
 * The store row after a push now: the push is a FULL one, so its start is the last full run and
 * the last run in 24 h; its status and error are the row's; and the health follows the push —
 * failing on an error, else ok. Nothing outside the sync block changes.
 */
export function applyPush(row: HungerStationStoreRow, log: HungerStationSyncLogRow): HungerStationStoreRow {
  return {
    ...row,
    sync: {
      ...row.sync,
      lastFullRun: log.syncType === 'F' ? log.startTime : row.sync.lastFullRun,
      lastDeltaRun: log.syncType === 'D' ? log.startTime : row.sync.lastDeltaRun,
      lastRun: log.startTime,
      lastStatus: log.status,
      lastError: log.error,
      health: log.status === 'E' ? 'failing' : 'ok',
    },
  }
}

/** A cached store list with the store's row swapped where it stands (pause / resume answer the row). */
export function replaceRow<T extends HungerStationStoreRow[] | undefined>(rows: T, next: HungerStationStoreRow): T {
  if (!rows || !rows.some((r) => r.storeCode === next.storeCode)) return rows
  return rows.map((r) => (r.storeCode === next.storeCode ? next : r)) as T
}
