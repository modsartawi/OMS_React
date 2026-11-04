import type { BoardFilters, BoardPeriod, PeriodToken } from '@/core/models/analytics'
import { CATEGORY_FILTERS, periodToken } from './effective-query'

/**
 * The board's permalink (spec 766 §F, ticket 771) — the board filters live in the query string, and
 * that string IS the permalink. Pure. A relative period stays relative (`period=last-30-days`), a fixed
 * range is `period=2026-10-01..2026-10-31`, and each member of a category filter is its own param
 * (`store=P001&store=P002`), so no member value needs escaping.
 *
 * Only the board filters' params are touched: 772's cross-filter and 780's `tv` / `refresh` keep theirs.
 */

export const PERIOD_TOKENS: readonly PeriodToken[] = [
  'today',
  'yesterday',
  'this-week',
  'last-week',
  'last-7-days',
  'last-28-days',
  'last-30-days',
  'this-month',
  'last-month',
  'year-to-date',
]

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function readPeriod(raw: string | null | undefined): BoardPeriod | null {
  if (!raw) return null
  if ((PERIOD_TOKENS as readonly string[]).includes(raw)) return { kind: 'relative', token: raw as PeriodToken }
  const [from, to, extra] = raw.split('..')
  if (extra === undefined && DAY.test(from ?? '') && DAY.test(to ?? '') && from <= to) return { kind: 'fixed', from, to }
  return null
}

/** The filters the URL names, each falling back to the board's own when the URL names none. */
export function readBoardFilters(params: URLSearchParams, defaults: BoardFilters): BoardFilters {
  const out: BoardFilters = { ...defaults, period: readPeriod(params.get('period')) ?? defaults.period }
  for (const f of CATEGORY_FILTERS) {
    // A bare `region=` is "none" — a board default the viewer cleared — so it does not fall back.
    out[f] = params.has(f) ? [...new Set(params.getAll(f).filter(Boolean))] : defaults[f]
  }
  return out
}

/**
 * `params` with the board filters written over it (a new object; the other params kept). A filter left
 * empty where the board's `defaults` hold members is written bare (`region=`), so it reads back cleared.
 */
export function writeBoardFilters(params: URLSearchParams, filters: BoardFilters, defaults?: BoardFilters): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('period', periodToken(filters.period))
  for (const f of CATEGORY_FILTERS) {
    next.delete(f)
    for (const v of filters[f]) next.append(f, v)
    if (filters[f].length === 0 && defaults && defaults[f].length > 0) next.set(f, '')
  }
  return next
}
