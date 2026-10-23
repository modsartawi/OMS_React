import type { DispatchBoardFilter, DispatchBoardTiles } from '@/core/models/dispatch-board'
import { formatClock } from '@/core/dispatch/view'

// The dispatch board's own view logic (BackOffice spec 2952, ticket 541): the tile row and the filters
// kept in the URL. Pure, pinned by `board-view.test.ts`.

export type TileKey = 'onCalloutNow' | 'bidsAwaiting' | 'takenLastHour' | 'fellBack' | 'notCompeted' | 'withdrawn'

export interface BoardTile {
  key: TileKey
  value: number
  /** The line under the figure: a key in `dispatch-board` and its values (already formatted). */
  sub: { key: string; values: Record<string, string> }
  /** A fell-back callout is the one HQ may have to act on. */
  attention: boolean
}

const line = (key: string, values: Record<string, string> = {}) => ({ key, values })

/** The six tiles, in the fleet-board order the owner picked (2950 Answer, point 1). */
export function boardTiles(t: DispatchBoardTiles): BoardTile[] {
  return [
    {
      key: 'onCalloutNow',
      value: t.onCalloutNow,
      sub: t.oldestOpenAgeSeconds == null ? line('tiles.noneOpen') : line('tiles.oldest', { age: formatClock(t.oldestOpenAgeSeconds) }),
      attention: false,
    },
    { key: 'bidsAwaiting', value: t.bidsAwaiting, sub: line('tiles.atDark', { n: String(t.bidsAwaitingDark) }), attention: false },
    {
      key: 'takenLastHour',
      value: t.takenLastHour,
      sub: t.medianSecondsToTake == null ? line('tiles.noMedian') : line('tiles.medianToTake', { median: formatClock(t.medianSecondsToTake) }),
      attention: false,
    },
    { key: 'fellBack', value: t.fellBack, sub: line('tiles.fellBackHint'), attention: t.fellBack > 0 },
    { key: 'notCompeted', value: t.notCompeted, sub: line('tiles.notCompetedHint'), attention: false },
    { key: 'withdrawn', value: t.withdrawn, sub: line('tiles.withdrawnHint'), attention: false },
  ]
}

export const EMPTY_BOARD_FILTER: DispatchBoardFilter = { channel: '', city: '', store: '' }

/** The filter a URL describes; a missing name is blank. Module-level, so `useUrlQuery` gets a stable reader. */
export function boardFilterFromParams(params: URLSearchParams): DispatchBoardFilter {
  return {
    channel: (params.get('channel') ?? '').trim(),
    city: (params.get('city') ?? '').trim(),
    store: (params.get('store') ?? '').trim(),
  }
}

/** The filter as its URL, in the door's order (`channel`, `city`, `store`); blanks absent. */
export function boardFilterToParams(filter: DispatchBoardFilter): URLSearchParams {
  const qs = new URLSearchParams()
  for (const name of ['channel', 'city', 'store'] as const) {
    const value = filter[name].trim()
    if (value) qs.set(name, value)
  }
  return qs
}

/** `GET DispatchBoard/Board` parameters; `@/core/api` drops the blank ones. */
export function boardDoorParams(filter: DispatchBoardFilter): Record<string, string> {
  return { channel: filter.channel.trim(), city: filter.city.trim(), store: filter.store.trim() }
}

export function isFilteredBoard(filter: DispatchBoardFilter): boolean {
  return filter.channel.trim() !== '' || filter.city.trim() !== '' || filter.store.trim() !== ''
}
