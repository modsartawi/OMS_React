import type { BoardFilters, BoardPeriod } from '@/core/models/analytics'
import { CATEGORY_FILTERS, periodToken, type CrossFilter } from './effective-query'
import { isPeriodToken } from './periods'

/**
 * The board's permalink (spec 766 §F, ticket 771) — the board filters live in the query string, and
 * that string IS the permalink. Pure. A relative period stays relative (`period=last-30-days`), a fixed
 * range is `period=2026-10-01..2026-10-31`, and each member of a category filter is its own param
 * (`store=P001&store=P002`), so no member value needs escaping.
 *
 * Only the board filters' params are touched by `writeBoardFilters`: the cross-filter (`writeCrossFilter`) and 780's `tv` / `refresh` keep theirs.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function readPeriod(raw: string | null | undefined): BoardPeriod | null {
  if (!raw) return null
  if (isPeriodToken(raw)) return { kind: 'relative', token: raw }
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

/**
 * The cross-filter in the permalink (772): `cross=<dimension>:<member>` plus `crossFrom=<panel id>`, the
 * panel it was clicked on (which does not re-run). Split at the FIRST colon: dimension keys hold none.
 */
export function readCrossFilter(params: URLSearchParams): CrossFilter | null {
  const raw = params.get('cross')
  const source = params.get('crossFrom')
  if (!raw || !source) return null
  const at = raw.indexOf(':')
  if (at <= 0 || at === raw.length - 1) return null
  return { source, dimension: raw.slice(0, at), member: raw.slice(at + 1) }
}

/** `params` with the cross-filter written over it, or removed when `null` (a new object; the rest kept). */
export function writeCrossFilter(params: URLSearchParams, cross: CrossFilter | null): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete('cross')
  next.delete('crossFrom')
  if (cross) {
    next.set('cross', `${cross.dimension}:${cross.member}`)
    next.set('crossFrom', cross.source)
  }
  return next
}
