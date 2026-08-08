/**
 * Collection Attempts' criteria → `GET CollectionWeb/Attempts` query (ticket 255).
 *
 * The plainest of the four: **every filter the endpoint has already exists**, so
 * unlike ACRs this module invents nothing and owes the backend nothing. A
 * variation on 254's template — ⚠️ **copied, not extracted** (244 §1).
 *
 * Pure, and **no `new Date()`**: today arrives as an argument.
 *
 * ⚠️ The window applies to `AttemptTime`, **the device clock** — the moment the
 * collector stood in the pharmacy — not to `BusinessDay`. A visit at 00:20 that
 * belongs to the previous business day answers to the day it physically happened,
 * which is the right reading for "which stores did this collector visit, and
 * when, and find no cash".
 */
import { toIsoDate } from '@/core/util/date-format'
import { GRID_LIMIT } from './cap'

/**
 * The toolbar draft: From · To · Store · Collector · Reason code (244 §5).
 *
 * All three code filters are free text, matching the WPF — its Reason box is a
 * `TextEdit`, not a picker, and neither the door nor this wave carries a reason
 * list to populate one with.
 */
export interface AttemptsCriteria {
  fromDate: string
  toDate: string
  storeCode: string
  collectorStaffId: string
  reasonCode: string
}

/** The state the screen opens on: **today, on both ends, nothing else set**. */
export function landingCriteria(today: Date): AttemptsCriteria {
  const day = toIsoDate(today)
  return { fromDate: day, toDate: day, storeCode: '', collectorStaffId: '', reasonCode: '' }
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
 * ⚠️ **The dates travel as a PAIR or not at all** — 254's guard.
 */
export function buildAttemptsParams(
  criteria: Partial<AttemptsCriteria> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: GRID_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  if ((criteria.fromDate ?? '').trim() !== '' && (criteria.toDate ?? '').trim() !== '') {
    put('FromDate', criteria.fromDate)
    put('ToDate', criteria.toDate)
  }
  put('StoreCode', criteria.storeCode)
  put('CollectorStaffId', criteria.collectorStaffId)
  put('ReasonCode', criteria.reasonCode)
  return params
}
