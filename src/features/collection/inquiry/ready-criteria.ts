/**
 * Ready for collection's criteria → `GET CollectionWeb/Ready` query (ticket 317,
 * BackOffice 1994's `## Web contract`).
 *
 * A variation on the siblings' criteria modules — ⚠️ **copied, not extracted**
 * (244 §1) — with these filters:
 *
 * - **Collector** — the collector ASSIGNED to the row's store (`CollectorId`).
 *   Nothing here has been collected yet, so there is no "collected by": the
 *   question is whose round the store is on.
 * - **Served by** — the shared pair on the ASSIGNMENT reading (`SERVED_BY_SCREENS.ready`);
 *   `ACCOUNTANT` + id is the screen's accountant filter.
 * - **Business date** — the day's `businessDay`, inclusive by day on the server.
 *   🚩 A prepared receipt has no business day, so ANY bound hides every receipt.
 *
 * - **Type, Amount, Profit center** (spec 2423, BackOffice 2425) — `Kinds`
 *   (DAY / SETTLEMENT), `AmountFrom`/`AmountTo` on cash to hand over (inclusive),
 *   and a contains match on `ProfitCenter`. The server applies each to both the
 *   day rows and the receipt rows, before the cap.
 *
 * There is **no collection date**: nothing on this list has been collected.
 *
 * Pure — no React, no i18n, no network, and **no `new Date()`**: a list of what
 * still waits has no period, so nothing here is defaulted to today.
 */
import { GRID_LIMIT } from './cap'
import {
  buildServedByParams,
  defaultSelection,
  type AssignmentOptions,
  type ServedBySelection,
} from './served-by'

/**
 * The toolbar draft: Business date from/to · Collector · Served by · Type ·
 * Amount from/to · Profit center.
 */
export interface ReadyCriteria {
  businessDateFrom: string
  businessDateTo: string
  /** The ASSIGNED collector's staff id — free text, as the Attempts screen's box. */
  collectorId: string
  servedBy: ServedBySelection
  /**
   * Type — the kinds ticked, OR'd (BackOffice 2425). Empty is "any kind" and sends
   * nothing. The values are the wire's own spellings, never translated.
   */
  kinds: ReadyKindFilter[]
  /**
   * Amount From/To on the row's `cashToHandOver`, inclusive, either one optional.
   * Strings as typed: a From above its To goes to the door, which refuses it — the
   * client does not re-implement that rule.
   */
  amountFrom: string
  amountTo: string
  /** A contains match on the branch's profit center, case-insensitive, server-side. */
  profitCenter: string
}

/** The kinds the Type filter offers, in the toolbar's order — 2425's `Kinds` values. */
export const READY_KIND_FILTERS = ['DAY', 'SETTLEMENT'] as const
export type ReadyKindFilter = (typeof READY_KIND_FILTERS)[number]

/**
 * The DRAFT the screen opens on: **every box empty**, no date, scoped to
 * the caller's own branches when the roster knows them (default-to-mine, BackOffice
 * 1165 — the Done-when's "of their stores").
 *
 * 🚩 **No business date on the landing.** Any bound excludes every prepared
 * receipt, and pre-September days still pending belong on the list too; a
 * today-window would hide most of what the screen exists to show.
 *
 * ⚠️ This is the draft only. Since spec 2423 the screen issues **no request** on
 * landing: the applied criteria start as `null` (`readyParamsFor` answers `null`
 * for them, and the Page's query is enabled on that), and only Search promotes
 * this draft to a query (423's seam, copied).
 *
 * `options` is passed rather than read so this stays pure: undefined (the roster
 * has not arrived, was unreachable, or the caller is on no roster row — a collector
 * supervisor, say) lands on the estate.
 */
export function landingCriteria(options?: Partial<AssignmentOptions>): ReadyCriteria {
  return {
    businessDateFrom: '',
    businessDateTo: '',
    collectorId: '',
    servedBy: defaultSelection('ready', options),
    kinds: [],
    amountFrom: '',
    amountTo: '',
    profitCenter: '',
  }
}

/**
 * The query the Page issues for what has been applied — **`null` is "issue
 * nothing"**. The applied criteria are `null` until the first Search, and the
 * Page's `useQuery` is enabled on a non-null answer, so the open-blank landing
 * (spec 2423) costs no request.
 */
export function readyParamsFor(applied: ReadyCriteria | null): Record<string, unknown> | null {
  return applied === null ? null : buildReadyParams(applied)
}

/**
 * Map the draft to the endpoint's query object.
 *
 * ⚠️ **PascalCase keys**, `CollectionReadyOptions`' own spellings — the collector is
 * `CollectorId` here, not the other doors' `CollectorOperatorId`/`CollectorStaffId`.
 * A parameter the binder does not recognise is silently ignored.
 *
 * 🚩 An empty filter is **dropped, never sent as `''`**, and each date end travels
 * on its own (315's ruling). The day goes as typed — inclusive-by-day is the
 * server's rule. `Limit` is the siblings' system cap (the contract's ceiling is
 * 20000, its default 500).
 */
export function buildReadyParams(criteria: Partial<ReadyCriteria> = {}): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: GRID_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  put('BusinessDateFrom', criteria.businessDateFrom)
  put('BusinessDateTo', criteria.businessDateTo)
  put('CollectorId', criteria.collectorId)
  // BackOffice 2425's criteria. ⚠️ `Kinds` is an ARRAY and travels as a repeated
  // key (`Kinds=DAY&Kinds=SETTLEMENT`) — `core/api.ts`'s `buildQuery` repeats a key
  // per element; nothing here joins them. Sent in the toolbar's order, whatever
  // order they were ticked in, and only the known kinds.
  const kinds = READY_KIND_FILTERS.filter((kind) => criteria.kinds?.includes(kind))
  if (kinds.length > 0) params.Kinds = kinds
  put('AmountFrom', criteria.amountFrom)
  put('AmountTo', criteria.amountTo)
  put('ProfitCenter', criteria.profitCenter)
  // An empty or half-chosen selection sends neither key (`buildServedByParams`).
  Object.assign(params, buildServedByParams(criteria.servedBy))
  return params
}

/**
 * Does the ISSUED query hide every prepared receipt? True when either business
 * bound is on the wire — the contract's "any business-date bound excludes
 * receipts". The screen says so, because an absent receipt is otherwise
 * indistinguishable from one that was collected.
 */
export function hidesReceipts(params: Record<string, unknown>): boolean {
  return params.BusinessDateFrom !== undefined || params.BusinessDateTo !== undefined
}

/**
 * Is the query that has actually been **issued** still the landing one — the
 * empty draft, Searched as it stands? Reads the applied params, not the draft
 * (254's ruling), against the same roster the landing was built from. Before the
 * first Search nothing was issued and the Page shows no chip.
 */
export function isLandingQuery(
  params: Record<string, unknown>,
  options?: Partial<AssignmentOptions>,
): boolean {
  return sameQuery(params, buildReadyParams(landingCriteria(options)))
}

/**
 * Are two built queries the same request? Key by key, and an array value (2425's
 * `Kinds`) element by element — `buildReadyParams` makes a fresh array each time,
 * so a reference comparison would call two identical queries different. The Page
 * uses it to tell a repeated Search from a new one. (Cash Collections' own, copied.)
 */
export function sameQuery(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(b)
  if (Object.keys(a).length !== keys.length) return false
  return keys.every((key) => {
    const x = a[key]
    const y = b[key]
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => v === y[i])
    return x === y
  })
}
