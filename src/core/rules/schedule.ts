import type { RuleCampaignSchedule } from '@/core/models/rule-campaign'

// A campaign's schedule between the wire and the Settings ▸ Schedule page (ticket 509). Pure, and
// shared from `core/rules` because the simulator (514) enters a local date and time the same way.
//
// 🚩 Local time only, and no `Date` is ever built: a day is the `yyyy-MM-dd` a date input gives and
// the wire takes, a time the `HH:mm` a time input gives. Going through a `Date` (or `toISOString`)
// is how a 00:30 start in Riyadh becomes the day before; strings cannot shift.

/** The page's fields, as the native date / time inputs hold them: `''` = not set. */
export interface ScheduleForm {
  from: string
  until: string
  /** Days of the week, 0 = Sunday; none = every day. */
  days: number[]
  hoursFrom: string
  hoursTo: string
}

/** A day, or anything that starts with one (a moment): its written day is read, never converted. */
const DAY = /^(\d{4}-\d{2}-\d{2})(?:$|T)/
const TIME = /^(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/

/**
 * The day of a wire value as written: a day, or a moment cut to its day — even one with a `Z` or an
 * offset the contract does not expect, so that a Save never erases a start it could not read.
 * `''` when absent or not a day at all.
 */
const dayOf = (value: string | null | undefined): string => (value ? (DAY.exec(value)?.[1] ?? '') : '')

/** The `HH:mm` of a wire time (seconds dropped); `''` when absent or malformed. */
const timeOf = (value: string | null | undefined): string => (value ? (TIME.exec(value)?.[1] ?? '') : '')

const weekdays = (days: readonly number[]): number[] =>
  [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort((a, b) => a - b)

/** The page's fields for a campaign's schedule. */
export function scheduleToForm(s: RuleCampaignSchedule): ScheduleForm {
  return { from: dayOf(s.from), until: dayOf(s.until), days: weekdays(s.days), hoursFrom: timeOf(s.hoursFrom), hoursTo: timeOf(s.hoursTo) }
}

/** The schedule the page saves: an empty field is null — no start is immediately, no end open-ended,
 *  no hours all day — and the weekdays go once each, in week order. */
export function formToSchedule(f: ScheduleForm): RuleCampaignSchedule {
  const orNull = (v: string) => v || null
  return {
    from: orNull(dayOf(f.from)),
    until: orNull(dayOf(f.until)),
    days: weekdays(f.days),
    hoursFrom: orNull(timeOf(f.hoursFrom)),
    hoursTo: orNull(timeOf(f.hoursTo)),
  }
}

/** Why the page cannot save the schedule yet, keyed to its locale message. */
export type ScheduleProblem = 'untilNotAfterFrom' | 'hoursToNotAfterFrom'

/**
 * What is wrong with the fields; empty = they can be saved. The end day is exclusive, so it must
 * come after the start. Daily hours end after they start (a window across midnight is two
 * campaigns, or none, until HQ says otherwise); one end alone is fine — the other is the day's edge.
 * Both compare as strings: `yyyy-MM-dd` and `HH:mm` sort as they read.
 */
export function scheduleProblems(f: ScheduleForm): ScheduleProblem[] {
  const problems: ScheduleProblem[] = []
  const from = dayOf(f.from)
  const until = dayOf(f.until)
  if (from && until && until <= from) problems.push('untilNotAfterFrom')
  const hFrom = timeOf(f.hoursFrom)
  const hTo = timeOf(f.hoursTo)
  if (hFrom && hTo && hTo <= hFrom) problems.push('hoursToNotAfterFrom')
  return problems
}
