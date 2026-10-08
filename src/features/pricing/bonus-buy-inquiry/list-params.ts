// Pure params builder for GET Bby/List (spec 061, ticket 062; reshaped by spec 441, ticket 443).
// This is the tested seam: it maps the toolbar's criteria to the endpoint's query object and
// encodes the rules the client owns, since the endpoint is a pure function of its params.
// Kept pure (no i18n, no network) so it runs in vitest's node environment.
//
// "Active only" was one toggle meaning two things (status Activated AND valid today). Spec 441
// splits it into a **status filter** and **valid today** (CONTEXT "Active / current"); the
// default is still Activated + valid today, i.e. the active bonus buys.

import type { BbyStatusReading } from '@/core/bonus-buy/status'

/** A status the toolbar can ask for, in the order its chips render and the query sends them:
 *  SAP's lifecycle reading order. (Core's `BBY_STATUS_ORDER` sorts a column live-first instead.) */
export type BbyStatusWord = Exclude<BbyStatusReading, 'unknown'>
export const BBY_STATUS_WORDS: readonly BbyStatusWord[] = ['activated', 'planned', 'tested', 'deactivated']

/** Toolbar state, before it becomes a query. `validFrom`/`validTo` are raw `yyyyMMdd` (or ''). */
export interface BbyListCriteria {
  bbyNumber: string
  validFrom: string
  validTo: string
  /** `[]` = every status. */
  statuses: BbyStatusWord[]
  validToday: boolean
}

/** What the screen opens on, and what Reset restores: Activated + valid today. */
export const DEFAULT_CRITERIA: BbyListCriteria = {
  bbyNumber: '',
  validFrom: '',
  validTo: '',
  statuses: ['activated'],
  validToday: true,
}

/**
 * Which criteria a search ignores, the one place these rules live (the builder applies them; the
 * toolbar disables what they name). A number reaches any status and, unless dates are given, any
 * window (number + dates still AND server-side, as before 443); a date range replaces valid today.
 */
export function searchOverrides(criteria: Pick<BbyListCriteria, 'bbyNumber' | 'validFrom' | 'validTo'>): {
  status: boolean
  validToday: boolean
} {
  const hasNumber = criteria.bbyNumber.trim() !== ''
  const hasDates = criteria.validFrom.trim() !== '' || criteria.validTo.trim() !== ''
  return { status: hasNumber, validToday: hasNumber || hasDates }
}

/** The statuses as the query sends them: known words only, in `BBY_STATUS_WORDS` order. */
const orderedStatuses = (statuses: readonly BbyStatusWord[]): BbyStatusWord[] =>
  BBY_STATUS_WORDS.filter((w) => statuses.includes(w))

/**
 * Map toolbar criteria to the GET Bby/List query object (the query-builder idiom: a plain
 * `Record` that api.ts hands to buildQuery, which sends an array as a repeated key).
 *
 * - A **number** reaches any status and any window: only `bbyNumber` is sent.
 * - A **date range** replaces valid today ("valid during this range") and keeps the status filter.
 * - Otherwise the status filter and valid today both apply.
 * - `activeOnly` is always `false`: the server keeps that gate for older callers, and the
 *   two new criteria say what it used to say.
 * - No status chosen sends no `status`, which the server reads as every status.
 */
export function buildListParams(criteria: Partial<BbyListCriteria> = {}): Record<string, unknown> {
  const c = { ...DEFAULT_CRITERIA, ...criteria }
  const bbyNumber = c.bbyNumber.trim()
  const validFrom = c.validFrom.trim()
  const validTo = c.validTo.trim()

  const overrides = searchOverrides(c)

  const params: Record<string, unknown> = { activeOnly: false }
  if (bbyNumber) params.bbyNumber = bbyNumber
  if (validFrom) params.validFrom = validFrom
  if (validTo) params.validTo = validTo
  const status = orderedStatuses(c.statuses)
  if (!overrides.status && status.length > 0) params.status = status
  if (!overrides.validToday) params.validToday = c.validToday
  return params
}

/** True when the criteria ask for the default view: Activated + valid today, no number, no
 *  dates. Drives the "Filtered" chip. */
export function isDefaultCriteria(criteria: BbyListCriteria): boolean {
  const d = DEFAULT_CRITERIA
  return (
    criteria.bbyNumber.trim() === d.bbyNumber &&
    criteria.validFrom.trim() === d.validFrom &&
    criteria.validTo.trim() === d.validTo &&
    criteria.validToday === d.validToday &&
    orderedStatuses(criteria.statuses).join() === orderedStatuses(d.statuses).join()
  )
}
