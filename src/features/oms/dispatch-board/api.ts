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
import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { DispatchBoard, DispatchBoardFilter } from '@/core/models/dispatch-board'
import { boardDoorParams } from './board-view'

export const dispatchBoardApi = {
  /** `GET DispatchBoard/Board?channel=&city=&store=` — Display. */
  board(filter: DispatchBoardFilter): Promise<DispatchBoard> {
    return api.get<DispatchBoard>('DispatchBoard/Board', boardDoorParams(filter))
  },
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
