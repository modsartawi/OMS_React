/**
 * The case list's filters and page (oms 922; BackOffice 4053 `GET InsuranceRules/Patterns/Cases`): read from the URL, written
 * back to it, and turned into the query the door is asked. Pure; the page keeps them in the address (`useUrlQuery`), so
 * a filtered list can be shared and Back leaves the screen.
 *
 * The server orders the rows — score, then the last dispense — so no order is ever sent (ticket 922: "ordered by score").
 */
import type { PatternCasesQuery, PatternSeverity, PatternSignal, PatternStatus } from '@/core/models/insurance-patterns'
import { windowProblem } from '@/core/util/date-window'

/** Rows a page. */
export const PAGE_SIZE = 25

export const SIGNALS: readonly PatternSignal[] = ['travel', 'overlap', 'hopping']
export const STATUSES: readonly PatternStatus[] = ['open', 'watching', 'cleared', 'confirmed', 'closed']
export const SEVERITIES: readonly PatternSeverity[] = ['action', 'info']

export interface CaseFilters {
  /** A store code; a case touching it is listed. */
  store: string
  /** `yyyy-MM-dd`, local, inclusive; '' = open. */
  from: string
  to: string
  signal: PatternSignal | ''
  status: PatternStatus | ''
  severity: PatternSeverity | ''
  /** 1-based. */
  page: number
}

export const NO_FILTERS: CaseFilters = Object.freeze({ store: '', from: '', to: '', signal: '', status: '', severity: '', page: 1 })

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const oneOf = <T extends string>(values: readonly T[], v: string | null): T | '' => ((values as readonly string[]).includes(v ?? '') ? (v as T) : '')
/** A day the address names, kept only when the calendar has it (no 2026-02-30): it reads back as the same day. */
const day = (v: string | null) => (v && DAY.test(v) && windowProblem(v, v, { maxDays: 1 }) === null ? v : '')
const pageOf = (v: string | null) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

export function filtersFromParams(params: URLSearchParams): CaseFilters {
  return {
    store: (params.get('store') ?? '').trim(),
    from: day(params.get('from')),
    to: day(params.get('to')),
    signal: oneOf(SIGNALS, params.get('signal')),
    status: oneOf(STATUSES, params.get('status')),
    severity: oneOf(SEVERITIES, params.get('severity')),
    page: pageOf(params.get('page')),
  }
}

export function filtersToParams(f: CaseFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.store) p.set('store', f.store)
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.signal) p.set('signal', f.signal)
  if (f.status) p.set('status', f.status)
  if (f.severity) p.set('severity', f.severity)
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

/**
 * The door's query: every filter under the door's own name (`store`), and the 1-based page with its size. A blank filter is passed
 * through, not left out here: `@/core/api`'s `buildQuery` drops it (`.claude/rules/api-envelope.md`).
 */
export function casesQuery(f: CaseFilters): PatternCasesQuery {
  return {
    store: f.store,
    from: f.from,
    to: f.to,
    signal: f.signal || undefined,
    status: f.status || undefined,
    severity: f.severity || undefined,
    page: f.page,
    pageSize: PAGE_SIZE,
  }
}

/** A filter changed: the list starts again at page 1. */
export function changeFilter(f: CaseFilters, change: Partial<Omit<CaseFilters, 'page'>>): CaseFilters {
  return { ...f, ...change, page: 1 }
}

/** A period that ends before it starts: shown as a problem and never asked for. */
export function periodBackwards(f: CaseFilters): boolean {
  return f.from !== '' && f.to !== '' && f.from > f.to
}
