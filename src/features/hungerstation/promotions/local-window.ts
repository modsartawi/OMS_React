import type { LocalDateTime } from '@/core/models/hungerstation'

/**
 * A promotion's start and end as the editor holds them (ticket 666, spec 3201 story 12/13): Saudi
 * local date + time, four boxes. Pure: no React, no `t`.
 *
 * 🚩 Never converted to UTC (`no-utc-time`): the value sent is the wall time typed,
 * `yyyy-MM-ddTHH:mm:00`, no offset. The server adds `+03:00` when it builds HungerStation's
 * request. "Now" is the Saudi wall clock whatever zone the browser runs in: Saudi Arabia keeps
 * +03:00 all year (no daylight saving), so it is a fixed shift of the instant.
 */

export interface LocalWindow {
  /** `yyyy-MM-dd` */
  startDate: string
  /** `HH:mm` */
  startTime: string
  endDate: string
  endTime: string
}

/** The end of a picked day. */
export const END_OF_DAY = '23:59'

const SAUDI_OFFSET_MS = 3 * 60 * 60 * 1000

/** The Saudi wall clock at `now`, as `yyyy-MM-ddTHH:mm`. */
function saudiWall(now: Date): string {
  return new Date(now.getTime() + SAUDI_OFFSET_MS).toISOString().slice(0, 16)
}

/** Start now; end at 23:59 of the same day. */
export function defaultWindow(now: Date): LocalWindow {
  const [date, time] = saudiWall(now).split('T')
  return { startDate: date, startTime: time, endDate: date, endTime: END_OF_DAY }
}

/** A day picked for the end: 23:59 of it (its time box can still be changed after). */
export function pickEndDay(w: LocalWindow, day: string): LocalWindow {
  return { ...w, endDate: day, endTime: END_OF_DAY }
}

/** What the body carries: the wall time typed. */
export function windowToLocal(w: LocalWindow): { startAt: LocalDateTime; endAt: LocalDateTime } {
  return { startAt: `${w.startDate}T${w.startTime}:00`, endAt: `${w.endDate}T${w.endTime}:00` }
}

/** A saved window back into the boxes. */
export function windowFromLocal(startAt: LocalDateTime, endAt: LocalDateTime): LocalWindow {
  return { startDate: startAt.slice(0, 10), startTime: startAt.slice(11, 16), endDate: endAt.slice(0, 10), endTime: endAt.slice(11, 16) }
}

export type WindowProblem = 'incomplete' | 'endNotAfterStart' | 'endPast'

/** What is wrong with the window as typed, or `null`. Local wall-clock text compares as time does. */
export function windowProblem(w: LocalWindow, now: Date): WindowProblem | null {
  if (!w.startDate || !w.startTime || !w.endDate || !w.endTime) return 'incomplete'
  const start = `${w.startDate}T${w.startTime}`
  const end = `${w.endDate}T${w.endTime}`
  if (end <= start) return 'endNotAfterStart'
  if (end <= saudiWall(now)) return 'endPast'
  return null
}
