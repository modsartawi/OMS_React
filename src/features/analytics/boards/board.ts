import type { AnalyticsBoardDefinition, AnalyticsBoardPanel, BoardFilters } from '@/core/models/analytics'

/**
 * The board page's pure pieces (ticket 771): the filters a board opens on, its panels' logical order,
 * and the filter strip's "Updating… n of N panels" wave.
 */

/** The auto-refresh intervals a board may save as its default, in seconds (766 §F; 0 is Off). */
export const BOARD_REFRESH_SECONDS = [0, 30, 60, 300, 900] as const

/** What a board opens on when neither it nor the URL names a filter. */
export const BASE_FILTERS: BoardFilters = {
  period: { kind: 'relative', token: 'last-30-days' },
  city: [],
  region: [],
  store: [],
  channel: [],
  country: [],
}

/** The board's own saved filters over the base: the strip's defaults, which the URL overrides. */
export function boardDefaults(def: AnalyticsBoardDefinition): BoardFilters {
  return { ...BASE_FILTERS, ...(def.filters ?? {}) }
}

/** Row by row, then column by column — the reading order of the 12-column grid (mirrors under RTL). */
export function inLogicalOrder<P extends AnalyticsBoardPanel>(panels: readonly P[]): P[] {
  return [...panels].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
}

/**
 * One wave of re-asks: every panel that has fetched since the board was last idle. `done` of `total`
 * is the strip's n of N. A panel that starts fetching mid-wave joins it; the wave ends when none fetches.
 */
export interface StreamWave {
  members: readonly string[]
  done: number
  total: number
}

export const NO_WAVE: StreamWave = { members: [], done: 0, total: 0 }

export function streamProgress(prev: StreamWave, fetching: readonly string[]): StreamWave {
  if (fetching.length === 0) return NO_WAVE
  const members = [...new Set([...prev.members, ...fetching])]
  return { members, done: members.length - fetching.length, total: members.length }
}
