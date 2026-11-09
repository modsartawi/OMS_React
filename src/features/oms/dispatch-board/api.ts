/**
 * The dispatch board's server calls (BackOffice spec 2952; door 2964, oms ticket 541).
 *
 * The board read lives here. The probe (`GET DispatchBoard/Access`) and the lock's write
 * (`POST DispatchBoard/ReleaseLock`) live in `@/core/dispatch/access`, because Delivery details (542)
 * offers the same Release lock and a feature may not import another.
 *
 * ⚠️ BackOffice 2959 / 2964 are merged on `pricing2` but not deployed: nothing here has met a real
 * door. `tools/dispatch-board-drive.mjs` stubs every call in the shapes of `DispatchBoardModels.cs`.
 */
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { DispatchBoard, DispatchBoardFilter, RoadShadowQuery, RoadShadowReport } from '@/core/models/dispatch-board'
import { boardDoorParams } from './board-view'

export const dispatchBoardApi = {
  /** `GET DispatchBoard/Board?channel=&city=&store=` — Display. */
  board(filter: DispatchBoardFilter): Promise<DispatchBoard> {
    return api.get<DispatchBoard>('DispatchBoard/Board', boardDoorParams(filter))
  },

  /**
   * `GET DispatchBoard/RoadShadow?from=&to=&type=` — Display (BackOffice 3470, ticket 859). Counts only. A blank type
   * is dropped by `buildQuery` and the door reads an absent type as every type. A long or reversed range is refused
   * with `CALLOUT-301` / `302`, in the server's own words.
   */
  roadShadow(query: Required<RoadShadowQuery>): Promise<RoadShadowReport> {
    return api.get<RoadShadowReport>('DispatchBoard/RoadShadow', { ...query })
  },
}

/** The Shadow report's query: a past range does not change under the reader, so no polling. */
export function roadShadowQuery(query: Required<RoadShadowQuery> | null) {
  return queryOptions({
    queryKey: ['oms', 'dispatch-board', 'road-shadow', query] as const,
    // `enabled` keeps a null query from ever reaching here; the guard says so rather than asserting it.
    queryFn: () => (query ? dispatchBoardApi.roadShadow(query) : Promise.reject(new Error('road shadow read without a range'))),
    enabled: query !== null,
    retry: false,
  })
}

export const BOARD_KEY = ['oms', 'dispatch-board', 'board'] as const

/** The board polls every 30 s (spec 2952 hand-off); the 1 s clock moves the countdowns between reads. */
export const BOARD_REFETCH_MS = 30_000

/**
 * A board read and the client time it arrived (the countdowns' origin). The time travels WITH the data,
 * so the previous filter's board shown as placeholder while a new filter loads keeps its own receipt
 * time (the query's `dataUpdatedAt` is 0 then, and every countdown would read 0:00).
 */
export type BoardRead = DispatchBoard & { receivedAt: number }

/**
 * The board's query. `refetchIntervalInBackground` stays at its default `false`, so a hidden tab stops
 * polling (the sync console's pattern) and refetches when it is shown again.
 */
export function boardQuery(filter: DispatchBoardFilter) {
  return {
    queryKey: [...BOARD_KEY, filter] as const,
    queryFn: async (): Promise<BoardRead> => ({ ...(await dispatchBoardApi.board(filter)), receivedAt: Date.now() }),
    placeholderData: keepPreviousData,
    refetchInterval: BOARD_REFETCH_MS,
    retry: false,
  }
}
