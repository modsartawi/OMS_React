/**
 * Ready for collection's criteria → `GET CollectionWeb/Ready` query (ticket 317,
 * BackOffice 1994's `## Web contract`).
 *
 * A variation on the siblings' criteria modules — ⚠️ **copied, not extracted**
 * (244 §1) — with three filters where they have four:
 *
 * - **Collector** — the collector ASSIGNED to the row's store (`CollectorId`).
 *   Nothing here has been collected yet, so there is no "collected by": the
 *   question is whose round the store is on.
 * - **Served by** — the shared pair on the ASSIGNMENT reading (`SERVED_BY_SCREENS.ready`);
 *   `ACCOUNTANT` + id is the screen's accountant filter.
 * - **Business date** — the day's `businessDay`, inclusive by day on the server.
 *   🚩 A prepared receipt has no business day, so ANY bound hides every receipt.
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

/** The toolbar draft: Business date from/to · Collector · Served by. */
export interface ReadyCriteria {
  businessDateFrom: string
  businessDateTo: string
  /** The ASSIGNED collector's staff id — free text, as the Attempts screen's box. */
  collectorId: string
  servedBy: ServedBySelection
}

/**
 * The state the screen opens on: **everything still waiting**, no date, scoped to
 * the caller's own branches when the roster knows them (default-to-mine, BackOffice
 * 1165 — the Done-when's "of their stores").
 *
 * 🚩 **No business date on the landing.** Any bound excludes every prepared
 * receipt, and pre-September days still pending belong on the list too; a
 * today-window would hide most of what the screen exists to show.
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
  }
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
 * Is the query that has actually been **issued** still the landing one? Reads the
 * applied params, not the draft (254's ruling), against the same roster the
 * landing was built from.
 */
export function isLandingQuery(
  params: Record<string, unknown>,
  options?: Partial<AssignmentOptions>,
): boolean {
  const landing = buildReadyParams(landingCriteria(options))
  const keys = Object.keys(landing)
  if (Object.keys(params).length !== keys.length) return false
  return keys.every((key) => params[key] === landing[key])
}
