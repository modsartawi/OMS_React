import type { PeriodToken } from '@/core/models/analytics'

/**
 * The relative periods (766 §F / story 21), in ONE table — the editor's picker, the board's filter strip, the
 * permalink reader, the editor's 407 "shorten the window" offer and the drill to detail all read it. Pure.
 *
 * Each row is a token, its words (`nameKey` for a picker, "Last 30 days"; `phraseKey` inside a sentence, "last
 * 30 days"), its length when it is a rolling window, and its range as two civil days from today's — Sunday
 * weeks, ending today, as the server resolves it (§C).
 */

/** A civil day as UTC midnight: day arithmetic on it never meets a zone or a daylight-saving change. */
type Day = Date

const day = (y: number, m: number, d: number): Day => new Date(Date.UTC(y, m, d))
const plus = (t: Day, n: number): Day => day(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + n)
const sundayOf = (t: Day): Day => plus(t, -t.getUTCDay())
const isoDay = (t: Day): string => t.toISOString().slice(0, 10)

export interface PeriodDef {
  token: PeriodToken
  /** Its length in days when it is a rolling window ending today; `null` otherwise. */
  rollingDays: number | null
  /** From and to, both inclusive, given today's civil day. */
  range: (today: Day) => readonly [Day, Day]
}

const rolling = (token: PeriodToken, days: number): PeriodDef => ({ token, rollingDays: days, range: (t) => [plus(t, 1 - days), t] })
const fixedTo = (token: PeriodToken, range: PeriodDef['range']): PeriodDef => ({ token, rollingDays: null, range })

/** In the picker's order. */
export const PERIOD_TABLE: readonly PeriodDef[] = [
  fixedTo('today', (t) => [t, t]),
  fixedTo('yesterday', (t) => [plus(t, -1), plus(t, -1)]),
  fixedTo('this-week', (t) => [sundayOf(t), t]),
  fixedTo('last-week', (t) => [plus(sundayOf(t), -7), plus(sundayOf(t), -1)]),
  rolling('last-7-days', 7),
  rolling('last-28-days', 28),
  rolling('last-30-days', 30),
  fixedTo('this-month', (t) => [day(t.getUTCFullYear(), t.getUTCMonth(), 1), t]),
  fixedTo('last-month', (t) => [day(t.getUTCFullYear(), t.getUTCMonth() - 1, 1), day(t.getUTCFullYear(), t.getUTCMonth(), 0)]),
  fixedTo('year-to-date', (t) => [day(t.getUTCFullYear(), 0, 1), t]),
]

export const PERIODS: readonly PeriodToken[] = PERIOD_TABLE.map((p) => p.token)
export const DEFAULT_PERIOD: PeriodToken = 'last-30-days'

export const isPeriodToken = (v: unknown): v is PeriodToken => typeof v === 'string' && (PERIODS as readonly string[]).includes(v)

/** A period's name in a picker ("Last 30 days"), a `boards` key. */
export const periodNameKey = (token: PeriodToken): string => `editor.periodName.${token}`
/** A period inside a sentence ("Orders, last 30 days"), a `boards` key. */
export const periodPhraseKey = (token: string): string => `editor.period.${token}`

/** The rolling windows, longest first, with their length in days (the 407 offer's choices). */
export const ROLLING_PERIODS: readonly { token: PeriodToken; days: number }[] = PERIOD_TABLE.filter((p) => p.rollingDays !== null)
  .map((p) => ({ token: p.token, days: p.rollingDays! }))
  .sort((a, b) => b.days - a.days)

/** Today's civil day at `now`, on the browser's clock. */
const todayOf = (now: Date): Day => day(now.getFullYear(), now.getMonth(), now.getDate())

/** A relative token as two ISO days against `now`. */
export function resolvePeriod(token: PeriodToken, now: Date): { from: string; to: string } {
  const def = PERIOD_TABLE.find((p) => p.token === token)!
  const [from, to] = def.range(todayOf(now))
  return { from: isoDay(from), to: isoDay(to) }
}
