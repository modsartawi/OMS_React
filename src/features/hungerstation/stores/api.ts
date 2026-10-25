import { api } from '@/core/api'
import type {
  HungerStationEditBody,
  HungerStationMaterialLine,
  HungerStationOnboardBody,
  HungerStationStoreRow,
  HungerStationStoresQuery,
  HungerStationSyncActiveBody,
  HungerStationSyncLinesPage,
  HungerStationSyncLinesQuery,
  HungerStationSyncLogRow,
  HungerStationSyncNowBody,
} from '@/core/models/hungerstation'
import { removePath } from './remove'
import { syncActivePath, syncNowPath } from './sync'
import { LOGS_TAKE, logsPath, materialLinesPath, syncLinesPath } from './sync-history'

// The HungerStation stores doors (BackOffice 3030; contract § Stores). The area's shared reads —
// the access probe and the chain list — live in `@/core/hungerstation/api`. 552 (remove), 553
// (pause / resume, sync now) and 554 (logs, lines, material history) add their doors here; every
// shape is already typed in `@/core/models/hungerstation`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every store-list query, whatever its filters — the page keys each list under it, and a write
 *  refreshes them all. */
export const STORES_KEY = ['hungerstation', 'stores'] as const

export const storePath = (storeCode: string) => `HungerStationWeb/Stores/${encodeURIComponent(storeCode)}`

export const storesApi = {
  /** GET HungerStationWeb/Stores?chain=&sync=&health=&q= — `any` is each filter's default and is left off. */
  async list(query: HungerStationStoresQuery): Promise<HungerStationStoreRow[]> {
    return (
      (await api.get<HungerStationStoreRow[] | null>('HungerStationWeb/Stores', {
        chain: query.chain,
        sync: query.sync === 'any' ? null : query.sync,
        health: query.health === 'any' ? null : query.health,
        q: query.q,
      })) ?? []
    )
  },

  /**
   * POST HungerStationWeb/Stores — onboard; a removed store is revived on the body's chain and
   * vendor id. Returns the store row.
   * Refusals: DHS-00001, 00002, 00003, 00004, 00005, 00006, 00008.
   */
  onboard(body: HungerStationOnboardBody): Promise<HungerStationStoreRow> {
    return api.post<HungerStationStoreRow>('HungerStationWeb/Stores', body)
  },

  /**
   * PUT HungerStationWeb/Stores/{storeCode} — edit the vendor id or chain. Returns the store row.
   * Refusals: DHS-00001, 00005, 00006, 00007, 00008.
   */
  edit(storeCode: string, body: HungerStationEditBody): Promise<HungerStationStoreRow> {
    return api.put<HungerStationStoreRow>(storePath(storeCode), body)
  },

  /**
   * DELETE HungerStationWeb/Stores/{storeCode}?reason= — remove onboarding (ticket 552). The reason
   * rides the query string (`removePath`). Answers `data: null`; a removed store is never listed.
   * Refusals: DHS-00007, 00008.
   */
  async remove(storeCode: string, reason: string): Promise<void> {
    await api.del<null>(removePath(storeCode, reason))
  },

  /**
   * PUT HungerStationWeb/Sync/{storeCode}/Active — pause (`active: false`) or resume the store's
   * stock sync (ticket 553). Returns the store row, patched into the list in place.
   * Refusals: DHS-00007, 00008.
   */
  setActive(storeCode: string, body: HungerStationSyncActiveBody): Promise<HungerStationStoreRow> {
    return api.put<HungerStationStoreRow>(syncActivePath(storeCode), body)
  },

  /**
   * POST HungerStationWeb/Sync/{storeCode}/Now — push the store's stock to HungerStation IN FULL,
   * now (ticket 553). Returns the push's log row.
   * Refusals: DHS-00007, 00008, 00013 (paused), 00014 (502 — HungerStation refused or unreachable;
   * the push is still recorded as `E`), and 409 `HungerStationSyncBusy` (nothing recorded).
   */
  syncNow(storeCode: string, body: HungerStationSyncNowBody): Promise<HungerStationSyncLogRow> {
    return api.post<HungerStationSyncLogRow>(syncNowPath(storeCode), body)
  },

  /**
   * GET HungerStationWeb/Sync/{storeCode}/Logs?take= — the store's pushes, newest first, at most 15
   * days back (ticket 554). A removed store's logs stay readable.
   * Refusal: DHS-00007, only when the code has no onboarded store AND no logs.
   */
  async syncLogs(storeCode: string): Promise<HungerStationSyncLogRow[]> {
    return (await api.get<HungerStationSyncLogRow[] | null>(logsPath(storeCode), { take: LOGS_TAKE })) ?? []
  },

  /**
   * GET …/Sync/{storeCode}/Logs/{logId}/Lines?material=&skip=&take= — one push's lines, ordered by
   * material number; `material` matches exactly; `total` counts the matching lines (ticket 554).
   * Refusals: DHS-00007 (as for Logs), DHS-00015 (no such push, or older than the 15 days kept).
   */
  async syncLines(storeCode: string, logId: string, query: HungerStationSyncLinesQuery): Promise<HungerStationSyncLinesPage> {
    const page = await api.get<HungerStationSyncLinesPage | null>(syncLinesPath(storeCode, logId), {
      material: query.material,
      skip: query.skip,
      take: query.take,
    })
    return page ?? { logId, total: 0, lines: [] }
  },

  /**
   * GET …/Sync/{storeCode}/Lines?material= — every line sent for one material at the store in the
   * 15 days, newest first, at most the newest 200 (ticket 554). `material` is required.
   * Refusal: DHS-00007 (as for Logs).
   */
  async materialLines(storeCode: string, material: string): Promise<HungerStationMaterialLine[]> {
    return (await api.get<HungerStationMaterialLine[] | null>(materialLinesPath(storeCode), { material })) ?? []
  },
}

/** The mutation key of one store's sync now — the actions cell reads it to show the push running. */
export const syncNowKey = (storeCode: string) => ['hungerstation', 'syncNow', storeCode] as const

/** One store's pushes. */
export const syncLogsKey = (storeCode: string) => ['hungerstation', 'syncLogs', storeCode] as const

/** One page of one push's lines, under one filter. */
export const syncLinesKey = (storeCode: string, logId: string, query: HungerStationSyncLinesQuery) =>
  ['hungerstation', 'syncLines', storeCode, logId, query] as const

/** One material's history at one store. */
export const materialLinesKey = (storeCode: string, material: string) => ['hungerstation', 'materialLines', storeCode, material] as const
