import { api } from '@/core/api'
import type {
  DeliverectHoursRow,
  DeliverectMoveBody,
  DeliverectOnboardBody,
  DeliverectStoreRow,
  DeliverectStoreStatusBody,
  DeliverectStoreStatusHistoryRow,
  DeliverectStoresQuery,
  DeliverectSyncActiveBody,
  DeliverectSyncLogRow,
} from '@/core/models/deliverect'

// The Deliverect stores doors (BackOffice 2616; contract § Stores) and the stock sync doors
// (BackOffice 2624; contract § Stock sync) and the store status doors (BackOffice 2625; contract
// § Store status). The area's shared reads —
// the access probe and the account list — live in `@/core/deliverect/api`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every store-list query, whatever its filters — the page keys each list under it, and a write
 *  refreshes them all. */
export const STORES_KEY = ['deliverect', 'stores'] as const

/** One store's sync log, keyed by its store code — a pause or resume refreshes it. */
export const syncLogsKey = (storeCode: string) => ['deliverect', 'sync-logs', storeCode] as const

/** The log drawer reads the contract's default page: the last 50 runs. */
export const SYNC_LOGS_TAKE = 50

/** The status history drawer reads the most recent changes — the contract names no default `take`. */
export const STATUS_HISTORY_TAKE = 50

/** One store's status history, keyed by its store code — a status change or an hours push refreshes it. */
export const statusHistoryKey = (storeCode: string) => ['deliverect', 'status-history', storeCode] as const

const syncPath = (storeCode: string) => `DeliverectWeb/Sync/${encodeURIComponent(storeCode)}`

const statusPath = (storeCode: string) => `DeliverectWeb/StoreStatus/${encodeURIComponent(storeCode)}`

const storePath = (storeCode: string) => `DeliverectWeb/Stores/${encodeURIComponent(storeCode)}`

export const storesApi = {
  /** GET DeliverectWeb/Stores?account=&linked=&q= — `linked=any` is the default and is left off. */
  list(query: DeliverectStoresQuery): Promise<DeliverectStoreRow[]> {
    return api.get<DeliverectStoreRow[]>('DeliverectWeb/Stores', {
      account: query.account,
      linked: query.linked === 'any' ? null : query.linked,
      q: query.q,
    })
  },

  /**
   * POST DeliverectWeb/Stores — onboard. The envelope is kept: a store on the direct HungerStation
   * rail comes back onboarded WITH a warning in `message`, which is not a refusal.
   * Refusals: DLV-00001, DLV-00002, DLV-00003 (and DLV-00009 for the reason).
   */
  async onboard(body: DeliverectOnboardBody): Promise<{ row: DeliverectStoreRow | null; message: string }> {
    const answer = await api.postEnvelope<DeliverectStoreRow | null>('DeliverectWeb/Stores', body)
    // `null`-safe: the store IS onboarded once the door says success, row or no row — a screen
    // that threw here would leave the dialog open on a write that already happened.
    return { row: answer.data ?? null, message: answer.message ?? '' }
  },

  /** PUT DeliverectWeb/Stores/{storeCode} — move to another account; the link is cleared. */
  move(storeCode: string, body: DeliverectMoveBody): Promise<unknown> {
    return api.put<unknown>(storePath(storeCode), body)
  },

  /** DELETE DeliverectWeb/Stores/{storeCode}?reason= — remove onboarding; sync stops, link cleared. */
  remove(storeCode: string, reason: string): Promise<unknown> {
    return api.del<unknown>(storePath(storeCode), { reason })
  },

  /**
   * PUT DeliverectWeb/Sync/{storeCode}/Active — pause (`active: false`) or resume the store's stock
   * sync. It stops or restarts the stock pushes only: the store stays listed and still receives
   * orders. Its answer is unspecified, so nothing is read from it (the list is refetched).
   */
  setSyncActive(storeCode: string, body: DeliverectSyncActiveBody): Promise<unknown> {
    return api.put<unknown>(`${syncPath(storeCode)}/Active`, body)
  },

  /** GET DeliverectWeb/Sync/{storeCode}/Logs?take= — the most recent runs. */
  syncLogs(storeCode: string, take: number = SYNC_LOGS_TAKE): Promise<DeliverectSyncLogRow[]> {
    return api.get<DeliverectSyncLogRow[]>(`${syncPath(storeCode)}/Logs`, { take })
  },

  /**
   * POST DeliverectWeb/StoreStatus/{storeCode} — busy (with `delayMinutes`), close or reopen, with
   * a reason. Its answer is unspecified, so nothing is read from it (the list is refetched).
   * Refusals: DLV-00010 (not linked), DLV-00011 (Deliverect's answer in `message`).
   */
  setStatus(storeCode: string, body: DeliverectStoreStatusBody): Promise<unknown> {
    return api.post<unknown>(statusPath(storeCode), body)
  },

  /**
   * POST DeliverectWeb/StoreStatus/{storeCode}/Hours — re-push the store's opening hours from the
   * duty roster now. The contract names no body (and no reason): an empty JSON object is sent, as
   * every body-less POST in the app does. It returns the hours that were sent.
   */
  async pushHours(storeCode: string): Promise<DeliverectHoursRow[]> {
    return (await api.post<DeliverectHoursRow[] | null>(`${statusPath(storeCode)}/Hours`, {})) ?? []
  },

  /** GET DeliverectWeb/StoreStatus/{storeCode}/History?take= — the most recent changes. */
  statusHistory(storeCode: string, take: number = STATUS_HISTORY_TAKE): Promise<DeliverectStoreStatusHistoryRow[]> {
    return api.get<DeliverectStoreStatusHistoryRow[]>(`${statusPath(storeCode)}/History`, { take })
  },
}
