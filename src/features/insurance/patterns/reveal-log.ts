/**
 * The reveal log's filters and page (oms 924; BackOffice 4055 `GET Insurance/Patterns/Reveals`, GUESSED): read from the
 * URL, written back to it, and turned into the query the door is asked. Pure; the page keeps them in the address
 * (`useUrlQuery`), so a filtered log can be shared and Back leaves the screen. The server orders the rows (newest
 * first), so no order is sent.
 *
 * BackOffice 4055 filters by period, user and case. The case is set from a row of the log (or a shared link), so the
 * address holds its id (`?case=`), as the door asks it (`caseId`).
 */
import type { PatternRevealsQuery } from '@/core/models/insurance-pattern-manager'
import { skipForPage } from '@/core/ui/pager'
import { windowProblem } from '@/core/util/date-window'

/** Rows a page. */
export const REVEALS_PAGE_SIZE = 25

export interface RevealFilters {
  /** `yyyy-MM-dd`, local, inclusive; '' = open. */
  from: string
  to: string
  /** The user who revealed; '' = anyone. */
  user: string
  /** One case's reveals; '' = every case. */
  caseId: string
  /** 1-based. */
  page: number
}

export const NO_REVEAL_FILTERS: RevealFilters = Object.freeze({ from: '', to: '', user: '', caseId: '', page: 1 })

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
/** A day the address names, kept only when the calendar has it (no 2026-02-30): it reads back as the same day. */
const day = (v: string | null) => (v && DAY.test(v) && windowProblem(v, v, { maxDays: 1 }) === null ? v : '')
const pageOf = (v: string | null) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function revealFiltersFromParams(params: URLSearchParams): RevealFilters {
  return {
    from: day(params.get('from')),
    to: day(params.get('to')),
    user: (params.get('user') ?? '').trim(),
    caseId: (params.get('case') ?? '').trim(),
    page: pageOf(params.get('page')),
  }
}

export function revealFiltersToParams(f: RevealFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.user) p.set('user', f.user)
  if (f.caseId) p.set('case', f.caseId)
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

/**
 * The door's query: every filter under the door's own name, and the page as skip/take. A blank filter is passed
 * through, not left out here: `@/core/api`'s `buildQuery` drops it (`.claude/rules/api-envelope.md`).
 */
export function revealsQuery(f: RevealFilters): PatternRevealsQuery {
  return {
    from: f.from,
    to: f.to,
    user: f.user,
    caseId: f.caseId,
    skip: skipForPage(f.page, REVEALS_PAGE_SIZE),
    take: REVEALS_PAGE_SIZE,
  }
}

/** A filter changed: the log starts again at page 1. */
export function changeRevealFilter(f: RevealFilters, change: Partial<Omit<RevealFilters, 'page'>>): RevealFilters {
  return { ...f, ...change, page: 1 }
}

/** A period that ends before it starts: shown as a problem and never asked for. */
export function revealPeriodBackwards(f: RevealFilters): boolean {
  return f.from !== '' && f.to !== '' && f.from > f.to
}
