import type { DeliverectOrderOutcome, DeliverectOrdersQuery, LocalDate } from '@/core/models/deliverect'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

// The Deliverect orders monitor's search (spec 2615, ticket 478): the URL ⇄ query mapping and the
// date window rule. Pure: no React, no `t`.

/**
 * The longest window the door serves (contract § Orders monitor: "a span of at most 31 days").
 * 🚩 Read INCLUSIVELY — `from` and `to` both count, so 2026-10-01..2026-10-31 is 31 days and
 * 2026-10-01..2026-11-01 is 32 (HITL-478 contract gap; the server stays authoritative).
 */
export const ORDERS_MAX_WINDOW_DAYS = 31

/** One page of the list. The contract names no default or ceiling for `take`. */
export const ORDERS_PAGE_SIZE = 200

/** The contract's five outcomes, in the order the filter offers them. */
export const ORDER_OUTCOMES: readonly DeliverectOrderOutcome[] = ['created', 'refused', 'droppedLines', 'cancelled', 'statusFailed']

/**
 * Today as the browser's LOCAL calendar date, built from its parts (`toIsoDate` reads
 * getFullYear / getMonth / getDate) — never `toISOString()`, which would hand back yesterday
 * after midnight in Riyadh.
 */
export function localToday(now: Date = new Date()): LocalDate {
  return toIsoDate(now)
}

/** A strict `yyyy-MM-dd` that names a real day (no 2026-02-30), else `null`. */
function validDate(value: string | null): LocalDate | null {
  const date = fromIsoDate(value)
  return date && toIsoDate(date) === value?.trim() ? toIsoDate(date) : null
}

/** The window's day count, both ends included; `null` when either end is not a date. */
export function windowDays(from: LocalDate, to: LocalDate): number | null {
  const a = fromIsoDate(from)
  const b = fromIsoDate(to)
  if (!a || !b) return null
  // Calendar days from the date parts, so no clock change can make a day 23 or 25 hours long.
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  return day(b) - day(a) + 1
}

/** Why a window may not be sent, or `null` when it may. */
export type WindowProblem = 'invalid' | 'reversed' | 'tooLong'

/** The window rule, checked before any call: both dates real, `from` ≤ `to`, at most 31 days. */
export function windowProblem(from: LocalDate, to: LocalDate): WindowProblem | null {
  const days = windowDays(from, to)
  if (days === null || validDate(from) === null || validDate(to) === null) return 'invalid'
  if (days < 1) return 'reversed'
  return days > ORDERS_MAX_WINDOW_DAYS ? 'tooLong' : null
}

/**
 * The page's query, read from its URL.
 *
 * - `from` / `to`: kept AS WRITTEN when present — an over-long window stays in the URL and is
 *   refused on screen, never silently clipped, and a cleared date input stays empty (refused as
 *   `invalid`) rather than jumping back to today. Only a MISSING key is `today`.
 * - `platform` and `outcome` are repeated keys (`platform=JAHEZ&platform=KEETA`), de-duplicated;
 *   an outcome the contract does not name is dropped.
 * - `skip` is a whole number ≥ 0; anything else reads as 0.
 */
export function ordersFromParams(params: URLSearchParams, today: LocalDate): DeliverectOrdersQuery {
  const text = (key: string) => {
    const v = params.get(key)?.trim()
    return v ? v : null
  }
  const many = (key: string) => [...new Set(params.getAll(key).map((v) => v.trim()).filter(Boolean))]
  const skip = Number(params.get('skip'))
  const day = (key: string) => (params.has(key) ? (params.get(key) ?? '').trim() : today)
  return {
    from: day('from'),
    to: day('to'),
    platform: many('platform'),
    store: text('store'),
    outcome: many('outcome').filter((o): o is DeliverectOrderOutcome => ORDER_OUTCOMES.includes(o as DeliverectOrderOutcome)),
    q: text('q'),
    skip: Number.isInteger(skip) && skip > 0 ? skip : 0,
    take: ORDERS_PAGE_SIZE,
  }
}

/**
 * The query as URL params. `from` and `to` are ALWAYS written (the door requires both); the
 * repeatable filters as repeated keys; `skip` only past the first page; `take` never (it is the
 * page's constant, not the user's choice).
 */
export function ordersToParams(query: DeliverectOrdersQuery): URLSearchParams {
  const out = new URLSearchParams()
  out.set('from', query.from)
  out.set('to', query.to)
  for (const p of query.platform) out.append('platform', p)
  if (query.store) out.set('store', query.store)
  for (const o of query.outcome) out.append('outcome', o)
  if (query.q) out.set('q', query.q)
  if (query.skip > 0) out.set('skip', String(query.skip))
  return out
}

/** A repeatable filter's value with one key switched on or off. */
export function toggled<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

/**
 * The platform keys the filter offers, sorted and distinct: the `Platforms` read's keys when it
 * answered, else the keys seen on the rows (the contract puts that read behind `canManageTerms`,
 * so an orders user is likely refused it — HITL-478). The selected keys are always kept, so a
 * filtered list never hides the value it is filtered by.
 */
export function platformChoices(
  platforms: readonly { platformKey: string }[] | undefined,
  rowKeys: readonly string[],
  selected: readonly string[],
): string[] {
  const keys = platforms ? platforms.map((p) => p.platformKey) : rowKeys
  return [...new Set([...keys, ...selected].filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
