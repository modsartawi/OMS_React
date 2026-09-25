/**
 * Collection Attempts' criteria → `GET CollectionWeb/Attempts` query (ticket 255).
 *
 * The plainest of the four. A variation on 254's template — ⚠️ **copied, not
 * extracted** (244 §1).
 *
 * Pure, and **no `new Date()`**: today arrives as an argument.
 *
 * 🚩 **Two ranges, named by what they mean on THIS screen** (ticket 316, BackOffice
 * 1993 — 1992's four-filter contract with spec 1976's per-screen meanings):
 *
 * - **Business date** — the attempted business day (`BusinessDay`): the day the
 *   collector came for, never the visit time.
 * - **Collection date** — the attempt time (`AttemptTime`), **the device clock** —
 *   the moment the collector stood in the pharmacy. A visit at 00:20 that belongs
 *   to the previous business day answers to the day it physically happened here,
 *   and to the day it came for under the business range.
 */
import { toIsoDate } from '@/core/util/date-format'
import { GRID_LIMIT } from './cap'
import { NO_SERVED_BY, buildServedByParams, type ServedBySelection } from './served-by'

/**
 * The toolbar draft: Business date from/to · Collection date from/to · Store ·
 * Collector · Reason code · Served by (244 §5, ticket 316).
 *
 * All three code filters are free text, matching the WPF — its Reason box is a
 * `TextEdit`, not a picker, and neither the door nor this wave carries a reason
 * list to populate one with.
 */
export interface AttemptsCriteria {
  businessDateFrom: string
  businessDateTo: string
  collectionDateFrom: string
  collectionDateTo: string
  storeCode: string
  /** The ATTEMPTING collector — this screen's collector filter, kept as shipped. */
  collectorStaffId: string
  reasonCode: string
  /**
   * The shared *Served by* selection (ticket 316, BackOffice 1993) — **the
   * accountant responsible**, read as the store's CURRENT assignment exactly as on
   * Cash Collections (`SERVED_BY_SCREENS.attempts`). No history.
   *
   * ⚠️ It does **not** replace `collectorStaffId`. The two ask different questions —
   * who *came* (off the attempt itself) and who is *assigned* the store (off the
   * pairing table) — so both stay lit and they AND, as on Cash Collections (1166).
   */
  servedBy: ServedBySelection
}

/**
 * The state the screen opens on: **attempted today, on both ends, nothing else
 * set** — the business range open.
 *
 * 🚩 The attempt-time window is the one the screen has always landed on; ticket
 * 316 renamed it on the wire and did not move it.
 *
 * ⚠️ **No default-to-mine.** The landing stays the estate, as it was before the
 * control arrived: the ticket gave this screen the picker, not a landing scope, and
 * a screen that silently opened narrower than it used to would be a change nobody
 * asked for. The caller's own scope is one pick away in the control.
 */
export function landingCriteria(today: Date): AttemptsCriteria {
  const day = toIsoDate(today)
  return {
    businessDateFrom: '',
    businessDateTo: '',
    collectionDateFrom: day,
    collectionDateTo: day,
    storeCode: '',
    collectorStaffId: '',
    reasonCode: '',
    servedBy: NO_SERVED_BY,
  }
}

/**
 * Is the query that has actually been **issued** still the landing one? Reads the
 * applied params, not the draft (254's ruling).
 */
export function isLandingQuery(params: Record<string, unknown>, today: Date): boolean {
  const landing = buildAttemptsParams(landingCriteria(today))
  const keys = Object.keys(landing)
  if (Object.keys(params).length !== keys.length) return false
  return keys.every((key) => params[key] === landing[key])
}

/**
 * Map the draft to the endpoint's query object.
 *
 * ⚠️ **PascalCase keys**, and they are `CollectionAttemptInquiryOptions`' own
 * spellings rather than the other screens' — the collector is `CollectorStaffId`
 * here (not `CollectorOperatorId`) and the store is `StoreCode` (not `StoreId`).
 * Two surfaces of the same estate that name the same thing differently; the wire
 * names win, because a parameter the binder does not recognise is silently
 * ignored and the grid comes back unfiltered.
 *
 * 🚩 An empty filter is **dropped, never sent as `''`** — and an unset reason code
 * in particular has to be, since `''` reads as "the reason whose code is the empty
 * string" to anyone debugging the door.
 *
 * 🚩 **Each date end travels on its own** (ticket 316, 315's ruling): the contract
 * makes every end optional and an open-ended range a real question. The day goes as
 * typed — inclusive-by-day is the server's rule, so the client adds no time part.
 *
 * ⚠️ **`FromDate`/`ToDate` are never sent.** The door still honours the legacy pair
 * and intersects it with `CollectionDate*`; the contract tells the web to switch,
 * and sending both would be one period spelt twice.
 */
export function buildAttemptsParams(
  criteria: Partial<AttemptsCriteria> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: GRID_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  put('BusinessDateFrom', criteria.businessDateFrom)
  put('BusinessDateTo', criteria.businessDateTo)
  put('CollectionDateFrom', criteria.collectionDateFrom)
  put('CollectionDateTo', criteria.collectionDateTo)
  put('StoreCode', criteria.storeCode)
  put('CollectorStaffId', criteria.collectorStaffId)
  put('ReasonCode', criteria.reasonCode)
  // An empty or half-chosen selection sends neither key (`buildServedByParams`).
  Object.assign(params, buildServedByParams(criteria.servedBy))
  return params
}
