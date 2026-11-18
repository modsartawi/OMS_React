/**
 * The Live activity panel's view model (oms 917, BackOffice 4032 door `GET StoreDatabase/LiveActivity`). Pure — pinned
 * by `live-helpers.test.ts`. The look is taken on request only (Refresh), never polled: the agent takes two or three.
 */
import type { StoreDbLiveActivity } from '@/core/models/store-database'

/** The four result sets, in the door's order (spec D11). */
export const LIVE_SECTIONS = ['running', 'headBlockers', 'workerSessions', 'longTransactions'] as const

export type LiveSectionKey = (typeof LIVE_SECTIONS)[number]

export type LiveSection = {
  [K in LiveSectionKey]: { key: K; rows: StoreDbLiveActivity[K] }
}[LiveSectionKey]

/** The four tables to draw, in order, each with its rows. */
export const liveSections = (live: StoreDbLiveActivity): LiveSection[] =>
  LIVE_SECTIONS.map((key) => ({ key, rows: live[key] }) as LiveSection)

/** Tolerant read of the door: a result set it leaves out is empty. Fills a MISSING member only. */
export function liveActivityOf(data: Partial<StoreDbLiveActivity> | null): StoreDbLiveActivity {
  return {
    takenAt: data?.takenAt ?? null,
    running: data?.running ?? [],
    headBlockers: data?.headBlockers ?? [],
    workerSessions: data?.workerSessions ?? [],
    longTransactions: data?.longTransactions ?? [],
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The time of the look: the server's own when it sends one, else the moment the answer arrived (as local
 * wall-clock `yyyy-MM-ddTHH:mm:ss`, the shape every door time has); `null` before any answer.
 */
export function lookTime(live: StoreDbLiveActivity | undefined, answeredAt: number): string | null {
  if (!live) return null
  if (live.takenAt) return live.takenAt
  const d = new Date(answeredAt)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
