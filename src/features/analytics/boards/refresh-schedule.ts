/**
 * A board's auto-refresh schedule (spec 766 §F, ticket 780). Pure: the board page's one loop asks it
 * which panels are due, and when to ask again.
 */
import type { RefreshInterval } from '@/core/models/analytics'

/** Each panel's offset into the interval: spread evenly in board order, so the panels never re-ask at once. */
export function panelOffsets(ids: readonly string[], everyMs: number): Record<string, number> {
  return Object.fromEntries(ids.map((id, i) => [id, Math.floor((i * everyMs) / ids.length)]))
}

/**
 * The loop's state: the interval, each panel's offset, and the last cycle each panel was asked in.
 * Cycles count on the wall clock (`k = ⌊(now − offset) / every⌋`), not from when the page opened, so
 * every screen showing a board asks one panel at the same moment — inside the server's 30 s result
 * cache, which coalesces them (spec 766 §C, story 70).
 */
export interface RefreshSchedule {
  /** The view panels in board order (kept apart from the records' keys, whose order JS may change). */
  ids: readonly string[]
  everyMs: number
  offsets: Readonly<Record<string, number>>
  asked: Readonly<Record<string, number>>
}

const cycleOf = (s: Pick<RefreshSchedule, 'everyMs' | 'offsets'>, id: string, now: number) => Math.floor((now - s.offsets[id]) / s.everyMs)

/** A schedule that starts now: nothing is due until each panel's next turn (the panels just asked). */
export function startSchedule(ids: readonly string[], everyMs: number, now: number): RefreshSchedule {
  const base = { ids: [...ids], everyMs, offsets: panelOffsets(ids, everyMs) }
  return { ...base, asked: Object.fromEntries(ids.map((id) => [id, cycleOf(base, id, now)])) }
}

/**
 * The panels due at `now`, in board order, and the schedule after asking them. Nothing while the tab is
 * `hidden`; on the first tick back, each panel that missed its turn (however many) is asked ONCE.
 */
export function tick(s: RefreshSchedule, now: number, hidden: boolean): { schedule: RefreshSchedule; due: string[] } {
  if (hidden) return { schedule: s, due: [] }
  const due = s.ids.filter((id) => cycleOf(s, id, now) > s.asked[id])
  if (due.length === 0) return { schedule: s, due }
  const asked = { ...s.asked }
  for (const id of due) asked[id] = cycleOf(s, id, now)
  return { schedule: { ...s, asked }, due }
}

/** When the next panel falls due (epoch ms); `Infinity` for a board with no view panels. */
export function nextDueAt(s: RefreshSchedule): number {
  return Math.min(...s.ids.map((id) => s.offsets[id] + (s.asked[id] + 1) * s.everyMs))
}

// ── The interval: the picker's choices, the permalink's `refresh=`, and the floor ─────────────────────

/** The picker's choices, in order (spec 766 §F). */
export const REFRESH_INTERVALS: readonly RefreshInterval[] = ['off', '30s', '1m', '5m', '15m']

const EVERY_MS: Record<Exclude<RefreshInterval, 'off'>, number> = { '30s': 30_000, '1m': 60_000, '5m': 300_000, '15m': 900_000 }

/** The interval in ms; `null` for Off. */
export const intervalMs = (choice: RefreshInterval): number | null => (choice === 'off' ? null : EVERY_MS[choice])

const DEFAULT_FLOOR_MS = 30_000

/**
 * The shortest interval offered, from config (`VITE_ANALYTICS_REFRESH_FLOOR_S`, whole seconds). 30 s
 * unless set — provisional on 750: if the replica can't carry it, the floor becomes 60 through config.
 */
export function refreshFloorMs(raw: string | undefined): number {
  const s = Number(raw)
  return raw && Number.isInteger(s) && s > 0 ? s * 1000 : DEFAULT_FLOOR_MS
}

/** Off, and every interval at or above the floor. */
export function refreshChoices(floorMs: number): RefreshInterval[] {
  return REFRESH_INTERVALS.filter((c) => (intervalMs(c) ?? Infinity) >= floorMs)
}

/** A `refresh=` value, or `null` when it names no interval. One under the floor runs at the floor's choice. */
export function readRefresh(raw: string | null | undefined, floorMs: number): RefreshInterval | null {
  if (!raw || !(REFRESH_INTERVALS as readonly string[]).includes(raw)) return null
  const choice = raw as RefreshInterval
  const allowed = refreshChoices(floorMs)
  return allowed.includes(choice) ? choice : (allowed[1] ?? 'off')
}

/**
 * The interval a board runs at: the permalink's `refresh=`, else the viewer's choice this session, else
 * the board's saved default, else Off.
 */
export function boardRefresh(from: { url: string | null; session: string | null; saved: string | undefined }, floorMs: number): RefreshInterval {
  return readRefresh(from.url, floorMs) ?? readRefresh(from.session, floorMs) ?? readRefresh(from.saved, floorMs) ?? 'off'
}
