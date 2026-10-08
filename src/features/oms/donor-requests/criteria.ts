/**
 * What the donor request list asks the server for (ticket 431, spec 430 D3/D9). Pure.
 *
 * The filter bar edits a **draft** of these; only Search promotes it to the query, so a half-typed
 * store code never fires a request.
 */
import type { DonorRequestState } from '@/core/models/sd-document'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The four states the door filters on, in the order a request moves through them. */
export const DONOR_REQUEST_STATES = ['OPEN', 'FULFILLED', 'TRANSFERRED', 'CANCELLED'] as const satisfies readonly DonorRequestState[]

export interface DonorRequestCriteria {
  /** Any of these; `[]` is every state. */
  states: DonorRequestState[]
  donorStore: string
  orderStore: string
  /** Raised from this day, `yyyy-MM-dd`; `''` leaves that end open. */
  from: string
  /** Raised up to and including this day, `yyyy-MM-dd`; `''` leaves that end open. */
  to: string
  /** One request by its number — set only by the `?request=` link (ticket 434's). */
  requestNo: string
}

/** The landing question: raised today, every state, every store. The live day, not a history. */
export function defaultCriteria(today: Date = new Date()): DonorRequestCriteria {
  const day = toIsoDate(today)
  return { states: [], donorStore: '', orderStore: '', from: day, to: day, requestNo: '' }
}

/**
 * One request and nothing else — no date bound, so the row is found whatever day it was raised.
 * What a failed donor transfer's link (`/oms/donor-requests?request=<no>`) opens on.
 */
export function requestCriteria(requestNo: string): DonorRequestCriteria {
  return { states: [], donorStore: '', orderStore: '', from: '', to: '', requestNo: requestNo.trim() }
}

/** The criteria a page opens on: the `?request=` param when there is one, read once; today otherwise. */
export function initialCriteria(requestParam: string | null, today: Date = new Date()): DonorRequestCriteria {
  return requestParam?.trim() ? requestCriteria(requestParam) : defaultCriteria(today)
}

/** Why the draft cannot be searched, or `null`: an end that is not a date, or a reversed range. */
export function criteriaProblem(c: DonorRequestCriteria): 'badDate' | 'reversed' | null {
  if ((c.from && !fromIsoDate(c.from)) || (c.to && !fromIsoDate(c.to))) return 'badDate'
  // `yyyy-MM-dd` sorts as it reads.
  if (c.from && c.to && c.to < c.from) return 'reversed'
  return null
}

/**
 * The query parameters, named as the door binds them.
 *
 * - `state` is an array, which `@/core/api` sends as a **repeated** key (`state=OPEN&state=…`);
 *   every state picked is the same question as none, so it is then left off.
 * - `toDate` is the last day itself: the server reads it inclusively.
 * - Blank values are left for `buildQuery` to drop (`api-envelope`); store codes are trimmed
 *   because the server compares them exactly.
 * - Neither `store` nor `limit` is sent: the bar offers neither, so the server's default limit
 *   applies and `limited` says when it cut the list.
 */
export function criteriaToParams(c: DonorRequestCriteria): Record<string, string | string[]> {
  const states = DONOR_REQUEST_STATES.filter((s) => c.states.includes(s))
  const params: Record<string, string | string[]> = {}
  if (states.length > 0 && states.length < DONOR_REQUEST_STATES.length) params.state = states
  const put = (key: string, value: string) => {
    if (value.trim()) params[key] = value.trim()
  }
  put('donorStore', c.donorStore)
  put('orderStore', c.orderStore)
  put('fromDate', c.from)
  put('toDate', c.to)
  put('requestNo', c.requestNo)
  return params
}
