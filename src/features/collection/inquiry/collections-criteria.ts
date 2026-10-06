/**
 * Cash Collections' criteria → `GET CollectionWeb/Collections` query (ticket 254).
 *
 * The tested seam of the screen, and **the template 255 and 256 copy**: the
 * toolbar owns a *draft*, this module owns the *query*, and only Search/Reset
 * promote one to the other. Splitting them is what makes a half-typed store code
 * unable to fire a request.
 *
 * Pure — no React, no i18n, no network, and **no `new Date()`**. Since spec 2423
 * the landing holds no date at all, so nothing here needs today; the landing state
 * stays testable rather than only observable.
 *
 * ⚠️ **Copied, not extracted.** BBY Inquiry's `list-params.ts` is the shape this
 * follows; it is not imported, and nothing here graduates to `core/` — a feature
 * may not import a feature, and the shared inquiry shell would be an abstraction
 * designed before the four screens exist to prove it (spec 249, 244 §1).
 */
import { GRID_LIMIT } from './cap'
import {
  buildServedByParams,
  defaultSelection,
  type AssignmentOptions,
  type ServedBySelection,
} from './served-by'

/**
 * The toolbar draft. All strings so the fields map 1:1 onto their inputs; the
 * four dates are `yyyy-MM-dd`, which is what a native date input speaks and what
 * the endpoint's `DateTime?` binds from.
 *
 * The filters are `CollectionInquiryOptions`' own, minus `Limit` — deleted as a
 * user-facing field (244 §3) — and minus `AcrId`, which is not a filter a user
 * types but the `?acr=` drill-down ticket 257 owns.
 *
 * 🚩 **Two ranges, named by what they mean** (BackOffice 1992 / spec 1976's
 * four-filter contract, which 316 copies onto the other three screens):
 *
 * - **Business date** — the SALES day, the row's `businessDay`. A settlement
 *   receipt covers no day, so any business end excludes it (the server's rule).
 * - **Collection date** — the collected-at instant, the row's `collectedAt`. This
 *   is the period the screen has always filtered on; only its wire name changed.
 */
export interface CollectionsCriteria {
  businessDateFrom: string
  businessDateTo: string
  collectionDateFrom: string
  collectionDateTo: string
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
  /**
   * Type — the base kinds, OR'd (BackOffice 2424). Empty is "any type", and sends
   * nothing. The values are the wire's own spellings, never translated.
   */
  collectionTypes: CollectionTypeFilter[]
  /** "has Surplus": ANDs the settlement-deduction flag onto the result (2424). */
  hasSurplus: boolean
  /** "has Stolen": ANDs the approved-theft flag onto the result (2424). */
  hasStolen: boolean
  /**
   * Amount From/To on the row's `amount`, inclusive, either one optional. Strings
   * as typed: a From above its To goes to the door, which refuses it with the
   * inquiry's usual criterion refusal — the client does not re-implement that rule.
   */
  amountFrom: string
  amountTo: string
  /** A contains match on the branch's profit center, case-insensitive, server-side. */
  profitCenter: string
}

/**
 * The base types the Type filter offers, in the toolbar's order — the wire values
 * of 2424's `CollectionTypes`. `Regular+Surplus` is not one of them: a surplus or
 * a theft is a tick ANDed onto a base type, which is how a `Regular+Surplus` row is
 * found by both "Regular" and "has Surplus" (spec 2423 story 12).
 */
export const COLLECTION_TYPE_FILTERS = ['Regular', 'Short', 'OutsideSystem'] as const
export type CollectionTypeFilter = (typeof COLLECTION_TYPE_FILTERS)[number]

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
 * The draft the screen opens on: **every box empty**, Served by on the caller's
 * own scope.
 *
 * 🚩 **No dates** (spec 2423, BackOffice 2424). Until then the collection range
 * defaulted to today..today; finance hunting for last week's collection first had
 * to clear a filter they never asked for. The date goes, the scope stays (the
 * owner's ruling) — so this is the WPF's own landing now, empty and unloaded.
 *
 * ⚠️ This is the DRAFT only. The screen issues **no request** on landing: the
 * applied criteria start as `null` (`collectionsParamsFor` answers `null` for
 * them, and the Page's query is enabled on that), and only Search promotes this
 * draft to a query.
 */
export function landingCriteria(options?: Partial<AssignmentOptions>): CollectionsCriteria {
  return {
    businessDateFrom: '',
    businessDateTo: '',
    collectionDateFrom: '',
    collectionDateTo: '',
    storeId: '',
    collectorOperatorId: '',
    // 🚩 **Default-to-mine** (BackOffice 1165). The screen opens already scoped to
    // the caller's own branches and their reports' — and `options` is passed rather
    // than read here, so this stays pure and the landing state is testable rather
    // than only observable. Undefined (the payload has not arrived, the sink was
    // unreachable, or the caller is on no roster row) lands on the estate, which is
    // exactly how this screen behaved before the control existed.
    servedBy: defaultSelection('collections', options),
    collectionTypes: [],
    hasSurplus: false,
    hasStolen: false,
    amountFrom: '',
    amountTo: '',
    profitCenter: '',
  }
}

/**
 * Is the query that has actually been **issued** still the landing one — the
 * empty draft, Searched as it stands?
 *
 * 🚩 It takes the applied params, **not the draft**. The chip's sentence is about
 * what the grid is showing, and the grid is showing the result of the last
 * *Search* — so a chip measured against the draft would light the moment someone
 * typed a store code into a grid still showing the unfiltered result, and go dark
 * when they cleared the box over a grid still filtered to one store. Both are the
 * chip saying the opposite of the truth. (BBY Inquiry compares the applied query
 * to its own default for the same reason.)
 *
 * Before the first Search there is no issued query at all, and the Page shows no
 * chip; this is only ever asked about a query that went out.
 */
export function isLandingQuery(
  params: Record<string, unknown>,
  options?: Partial<AssignmentOptions>,
): boolean {
  // 🚩 The landing query CARRIES A SCOPE for most finance users (1165), so the
  // comparison has to be made against the same default the screen actually opened
  // on — the caller's, not "no scope". Measured against an unscoped landing, the
  // chip would light on the first Search for every scoped user and its ✕ (Reset)
  // would put the scope straight back, which is the chip saying the opposite of
  // the truth.
  return sameQuery(params, buildCollectionsParams(landingCriteria(options)))
}

/**
 * Are two built queries the same request? Key by key, and an array value (2424's
 * `CollectionTypes`) element by element — `buildCollectionsParams` makes a fresh
 * array each time, so a reference comparison would call two identical queries
 * different. The Page uses it to tell a repeated Search from a new one.
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
 * 🚩 **Each date end travels on its own** (BackOffice 1992). Before 315 the one
 * `FromDate`/`ToDate` pair travelled as a pair or not at all, because a half-open
 * window on it was unbounded. The contract now makes every end optional and an
 * open-ended range a real question ("sales days from the 1st on"), and asking
 * about sales days alone means leaving the collection range off entirely — so an
 * end is sent when it is filled and dropped when it is not, like every other
 * filter here. An unbounded answer is still bounded by the cap and said out loud
 * by its banner.
 *
 * ⚠️ **`FromDate`/`ToDate` are never sent.** The door still honours the legacy
 * pair and intersects it with `CollectionDate*`; the contract tells the web to
 * switch, and sending both would be one period spelt twice.
 *
 * The day goes as typed. Inclusive-by-day is the server's rule
 * (`[From 00:00, (To + 1 day) 00:00)`), so the client adds no time part.
 */
export function buildCollectionsParams(
  criteria: Partial<CollectionsCriteria> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { Limit: COLLECTIONS_LIMIT }
  const put = (key: string, value: string | undefined) => {
    const trimmed = (value ?? '').trim()
    if (trimmed !== '') params[key] = trimmed
  }
  put('BusinessDateFrom', criteria.businessDateFrom)
  put('BusinessDateTo', criteria.businessDateTo)
  put('CollectionDateFrom', criteria.collectionDateFrom)
  put('CollectionDateTo', criteria.collectionDateTo)
  put('StoreId', criteria.storeId)
  put('CollectorOperatorId', criteria.collectorOperatorId)
  // BackOffice 2424's criteria. ⚠️ `CollectionTypes` is an ARRAY and travels as a
  // repeated key (`CollectionTypes=Regular&CollectionTypes=Short`) — `core/api.ts`'s
  // `buildQuery` repeats a key per element; nothing here joins them into one value.
  const types = COLLECTION_TYPE_FILTERS.filter((type) => criteria.collectionTypes?.includes(type))
  if (types.length > 0) params.CollectionTypes = types
  // A tick is sent only when ticked: an unticked box is "don't care", not `false`.
  if (criteria.hasSurplus) params.HasSurplus = true
  if (criteria.hasStolen) params.HasStolen = true
  put('AmountFrom', criteria.amountFrom)
  put('AmountTo', criteria.amountTo)
  put('ProfitCenter', criteria.profitCenter)
  // 🚩 The scope ANDs with the store filter, EVEN TO NOTHING, and both chips stay
  // lit. A store outside the selected person's branches must return an honest empty
  // grid — a filter that silently un-sets another is how a grid ends up showing rows
  // the toolbar says it excluded. (The `?acr=` drill-down is the one case where the
  // toolbar is switched off entirely; the server discards this one too there.)
  Object.assign(params, buildServedByParams(criteria.servedBy))
  return params
}
