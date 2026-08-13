/**
 * Cash Collections' criteria → `GET CollectionWeb/Collections` query (ticket 254).
 *
 * The tested seam of the screen, and **the template 255 and 256 copy**: the
 * toolbar owns a *draft*, this module owns the *query*, and only Search/Reset
 * promote one to the other. Splitting them is what makes a half-typed store code
 * unable to fire a request.
 *
 * Pure — no React, no i18n, no network, and **no `new Date()`**: every function
 * that needs today takes it as an argument, so the landing state is testable
 * rather than only observable (the `core/nphies/list-window.ts` precedent).
 *
 * ⚠️ **Copied, not extracted.** BBY Inquiry's `list-params.ts` is the shape this
 * follows; it is not imported, and nothing here graduates to `core/` — a feature
 * may not import a feature, and the shared inquiry shell would be an abstraction
 * designed before the four screens exist to prove it (spec 249, 244 §1).
 */
import { toIsoDate } from '@/core/util/date-format'
import { GRID_LIMIT } from './cap'
import {
  NO_SERVED_BY,
  buildServedByParams,
  type ServedBySelection,
} from './served-by'

/**
 * The toolbar draft. All strings so the fields map 1:1 onto their inputs; the two
 * dates are `yyyy-MM-dd`, which is what a native date input speaks and what the
 * endpoint's `DateTime?` binds from.
 *
 * The four filters are `CollectionInquiryOptions`' own, minus `Limit` — deleted
 * as a user-facing field (244 §3) — and minus `AcrId`, which is not a filter a
 * user types but the `?acr=` drill-down ticket 257 owns.
 */
export interface CollectionsCriteria {
  fromDate: string
  toDate: string
  storeId: string
  /**
   * ⚠️ **"Collected by", not "Served by"** — and it survives the arrival of the new
   * control rather than being replaced by it (BackOffice 1163). This is the
   * endpoint's shipped `CollectorOperatorId`: *who actually collected*. The new
   * control beside it asks *who is assigned to the branch*. They are two different
   * questions and a stand-in covering somebody's route is exactly when they
   * diverge, so both boxes stay and they **AND**.
   */
  collectorOperatorId: string
  /**
   * The shared *Served by* selection (BackOffice spec 1162). On this screen it
   * reads as *who is ASSIGNED to the receipt's branch*.
   *
   * Nothing picked is the landing state, and `buildServedByParams` then sends
   * neither key — so the query is byte-for-byte the one this screen sent before
   * the control existed.
   */
  servedBy: ServedBySelection
}

/**
 * The system cap, and the whole of what became of the WPF's `Limit` box.
 *
 * The WPF defaulted it to **200** client-side and the scope of this screen is
 * HQ-wide, so an ordinary day across the chain was cut off with nothing said. The
 * web asks for a generous cap instead and pages the answer in the browser, which
 * keeps sort, per-column filter and export operating over the whole result set
 * (244 §3). It is surfaced only by the amber banner in `cap.ts`, and only when a
 * result actually reached it.
 *
 * 🚩 An **alias** of `cap.ts`'s `GRID_LIMIT` since ticket 255, not a literal of
 * its own: the number the query asks for and the number the banner measures the
 * answer against have to be one number on all four screens, or the banner is
 * measuring a cap the door never applied.
 */
export const COLLECTIONS_LIMIT = GRID_LIMIT

/**
 * The state the screen opens on: **today, on both ends, nothing else set**.
 *
 * Dates travel as a pair, per the server contract — the window is applied to
 * `PosCollectionReceipt.CollectedAt` — and the pair is what makes "what has come
 * in today" answerable before anyone touches a control (244 §4).
 *
 * 🚩 The WPF loads nothing until `Load` and defaults no dates. This follows its
 * own `CloseActionInquiry`/`DocumentPayment` instead, which do default to today.
 * Known cost, accepted: at 9am today is nearly empty, and yesterday's closures are
 * one date edit away.
 */
export function landingCriteria(today: Date): CollectionsCriteria {
  const day = toIsoDate(today)
  return {
    fromDate: day,
    toDate: day,
    storeId: '',
    collectorOperatorId: '',
    servedBy: NO_SERVED_BY,
  }
}

/**
 * Is the query that has actually been **issued** still the landing one?
 *
 * 🚩 It takes the applied params, **not the draft**. The chip's sentence is about
 * what the grid is showing, and the grid is showing the result of the last
 * *Search* — so a chip measured against the draft would light the moment someone
 * typed a store code into a grid still showing all of today, and go dark when they
 * cleared the box over a grid still filtered to one store. Both are the chip
 * saying the opposite of the truth. (BBY Inquiry compares the applied query to its
 * own default for the same reason.)
 */
export function isLandingQuery(params: Record<string, unknown>, today: Date): boolean {
  const landing = buildCollectionsParams(landingCriteria(today))
  const keys = Object.keys(landing)
  if (Object.keys(params).length !== keys.length) return false
  return keys.every((key) => params[key] === landing[key])
}

/**
 * Map the draft to the endpoint's query object — a plain `Record` that
 * `core/api.ts`'s `buildQuery` turns into the query string.
 *
 * ⚠️ **PascalCase keys.** `CollectionInquiryOptions` binds via `[AsParameters]`,
 * so the parameter names are the C# property names (the house 101 idiom, and what
 * `deliveries/filter.ts` already does). Not a stylistic choice.
 *
 * 🚩 **An empty filter is dropped, never sent as `''`.** `buildQuery` would drop
 * it anyway, but an explicit `StoreId=` on the wire reads as "the store whose code
 * is the empty string" to anyone debugging the door, and the dropping is what the
 * test pins.
 *
 * ⚠️ **The dates travel as a PAIR or not at all** — `deliveries/filter.ts`'s own
 * guard, and for a sharper reason here. A half-open window is not a narrower
 * query, it is an *unbounded* one: the service's `(@FromDate IS NULL OR …)` branch
 * would then return the chain's whole history, truncated at the 2,000 cap, under a
 * toolbar still showing one date the supervisor typed. The toolbar marks both
 * inputs `required` so the pair cannot normally be broken; this is the backstop
 * that makes the query honest if it is.
 */
export function buildCollectionsParams(
  criteria: Partial<CollectionsCriteria> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: COLLECTIONS_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  if ((criteria.fromDate ?? '').trim() !== '' && (criteria.toDate ?? '').trim() !== '') {
    put('FromDate', criteria.fromDate)
    put('ToDate', criteria.toDate)
  }
  put('StoreId', criteria.storeId)
  put('CollectorOperatorId', criteria.collectorOperatorId)
  // 🚩 The scope ANDs with the store filter, EVEN TO NOTHING, and both chips stay
  // lit. A store outside the selected person's branches must return an honest empty
  // grid — a filter that silently un-sets another is how a grid ends up showing rows
  // the toolbar says it excluded. (The `?acr=` drill-down is the one case where the
  // toolbar is switched off entirely; the server discards this one too there.)
  Object.assign(params, buildServedByParams(criteria.servedBy))
  return params
}
