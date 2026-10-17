import { RULE_WEEKDAYS, type RuleCampaignWindow, type RuleWeekday } from '@/core/models/rule-campaign'

// A campaign's window between the wire and the Settings ▸ Schedule page (ticket 509, schema 1 since
// 522). Pure, and shared from `core/rules` because the simulator (514) enters a local date and time
// the same way.
//
// 🚩 Local time only, and no `Date` is ever built: a day is the `yyyy-MM-dd` a date input gives and
// the wire takes, a time the `HH:mm` a time input gives. Going through a `Date` (or `toISOString`)
// is how a 00:30 start in Riyadh becomes the day before; strings cannot shift.

/** The page's fields, as the native date / time inputs hold them: `''` = not set. */
export interface ScheduleForm {
  from: string
  until: string
  /** Days of the week; none = every day. */
  days: RuleWeekday[]
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

/** Known weekdays, once each, in week order (Sunday first). */
const weekdays = (days: readonly string[] | undefined): RuleWeekday[] => RULE_WEEKDAYS.filter((d) => (days ?? []).includes(d))

/** The page's fields for a campaign's window (absent = immediately / open-ended / every day / all day). */
export function windowToForm(w: RuleCampaignWindow | null | undefined): ScheduleForm {
  return { from: dayOf(w?.from), until: dayOf(w?.until), days: weekdays(w?.days), hoursFrom: timeOf(w?.hours?.from), hoursTo: timeOf(w?.hours?.until) }
}

/**
 * The window the page saves: an empty field is left out — no start is immediately, no end
 * open-ended, no day every day, no hours all day — and the weekdays go once each, in week order.
 * Hours go only as a pair (one alone is a problem the page refuses first).
 */
export function formToWindow(f: ScheduleForm): RuleCampaignWindow {
  const w: RuleCampaignWindow = {}
  const from = dayOf(f.from)
  const until = dayOf(f.until)
  const days = weekdays(f.days)
  const hFrom = timeOf(f.hoursFrom)
  const hTo = timeOf(f.hoursTo)
  if (from) w.from = from
  if (until) w.until = until
  if (days.length && days.length < RULE_WEEKDAYS.length) w.days = days
  if (hFrom && hTo) w.hours = { from: hFrom, until: hTo }
  return w
}

/** Why the page cannot save the schedule yet, keyed to its locale message. */
export type ScheduleProblem = 'untilNotAfterFrom' | 'hoursIncomplete' | 'hoursSame'

/**
 * What is wrong with the fields; empty = they can be saved. The end day is exclusive, so it must
 * come after the start. Daily hours are a pair, and they MAY cross midnight (`22:00` until `02:00`,
 * the contract's own example) — but they end at another time than they start, as HQ's checker says.
 * Days compare as strings: `yyyy-MM-dd` sorts as it reads.
 */
export function scheduleProblems(f: ScheduleForm): ScheduleProblem[] {
  const problems: ScheduleProblem[] = []
  const from = dayOf(f.from)
  const until = dayOf(f.until)
  if (from && until && until <= from) problems.push('untilNotAfterFrom')
  const hFrom = timeOf(f.hoursFrom)
  const hTo = timeOf(f.hoursTo)
  if (!hFrom !== !hTo) problems.push('hoursIncomplete')
  else if (hFrom && hFrom === hTo) problems.push('hoursSame')
  return problems
}
