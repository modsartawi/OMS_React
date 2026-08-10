/**
 * The Invoices toolbar's criteria → `GET RetailInvoice/Search` query (ticket 264).
 *
 * The tested seam of the screen: the toolbar owns a **draft**, this module owns
 * the **query**, and only Search promotes one to the other. Splitting them is
 * what makes a half-typed transaction number unable to fire a request.
 *
 * Pure — no React, no i18n, no network, no `new Date()`. ⚠️ **Copied, not
 * extracted**: `pricing/bonus-buy-inquiry/list-params.ts` and
 * `collection/inquiry/collections-criteria.ts` are the shape this follows, and
 * neither is imported — a feature may not import a feature
 * ([feature-structure](../../../../.claude/rules/feature-structure.md)), and the
 * shared inquiry shell stays ruled out (spec 249's 244 §1, which spec 261 does
 * not overturn).
 *
 * 🚩 **Three deliberate departures from the collection template.** There is no
 * landing query, no paging parameter and no export: this screen cannot guess a
 * transaction number, so it lands empty and fires nothing, and an exact-number
 * search returns essentially one row (contract §3 — the number encodes store,
 * till and a ~0.86 s timestamp, so it is near-unique by construction).
 */

/**
 * The toolbar draft. Both fields are strings so they map 1:1 onto their inputs.
 *
 * The whole of it: `trxNumber` and an optional `storeCode`. The endpoint takes
 * exactly these two (contract §1) — there is no date window, because the number
 * already carries the date, and no `Client`, because `RetailTrx`'s fourth key
 * part is a fixed `'000'` estate-wide and is not on the wire at all (§3).
 */
export interface InvoiceCriteria {
  /** Required. Exact, trimmed. */
  trxNumber: string
  /** Optional narrowing convenience — never required to make the answer correct. */
  storeCode: string
}

/**
 * The state the screen opens on, and the state Reset returns it to: **both
 * fields empty and no query issued at all**.
 *
 * 🚩 Deliberately not a `landingQuery`, and there is nothing here for the Page
 * to fire on mount. Collection's four screens land on today because a date
 * window is a question the screen can answer unasked; a transaction number is
 * not, so an auto-fired search would be a guaranteed empty grid pretending to be
 * a result (spec 261 §"The screen's shape"). "Untouched" and "no matches" are
 * two different states on this screen, and this function is the first of them.
 */
export function landingCriteria(): InvoiceCriteria {
  return { trxNumber: '', storeCode: '' }
}

/**
 * The **question** the screen asks the server — `RetailInvoice/Search`'s two
 * query parameters and nothing else (contract §1).
 *
 * Named rather than left as a bare `Record<string, unknown>` because it travels
 * through four places (built here, held as the Page's applied query, compared by
 * `sameQuery`, sent by `api.search`) and the optional `storeCode` is the rule
 * about dropping an empty one, said in the type.
 *
 * ⚠️ A `type`, not an `interface`, so it keeps the implicit index signature
 * `core/api.ts`'s `buildQuery` binds against.
 */
export type InvoiceSearchQuery = {
  trxNumber: string
  storeCode?: string
}

/**
 * Map the draft to the endpoint's query object — a plain `Record` that
 * `core/api.ts`'s `buildQuery` turns into the query string.
 *
 * 🔑 **Returns `null` when the number is blank**, rather than an object the
 * caller has to remember to check: the refusal and the query are one decision,
 * and making it impossible to *build* params for a blank number is stronger than
 * a validation flag beside them. `null` is the Page's cue to show the local
 * "enter a transaction number" and issue nothing — and it is the **only**
 * reading of that rule, deliberately, rather than a `canSearch` predicate
 * beside it that a later edit could let drift.
 *
 * It is also why the server's `400 TRX_NUMBER_REQUIRED` is unreachable from this
 * client: that arm stays a defence, and a screen that reached it would be a
 * client bug rather than a user error (contract §4).
 *
 * 🚩 **An empty `storeCode` is dropped, never sent as `''`.** `buildQuery` would
 * drop it anyway, but an explicit `storeCode=` on the wire reads as "the store
 * whose code is the empty string" to anyone debugging the door, and the dropping
 * is what the test pins.
 *
 * ⚠️ camelCase keys — `RetailInvoice/Search` binds `trxNumber`/`storeCode` as
 * plain query parameters (contract §1), not through a C# `[AsParameters]` options
 * object like `CollectionInquiryOptions`. Not a stylistic choice on either side.
 */
export function buildInvoiceSearchParams(
  criteria: Partial<InvoiceCriteria> = {},
): InvoiceSearchQuery | null {
  const trxNumber = (criteria.trxNumber ?? '').trim()
  if (trxNumber === '') return null

  const params: InvoiceSearchQuery = { trxNumber }
  const storeCode = (criteria.storeCode ?? '').trim()
  if (storeCode !== '') params.storeCode = storeCode
  return params
}

/**
 * Do two built queries ask the server the same question?
 *
 * 🚩 The Page needs this because **the query key IS the params**: pressing Search
 * again on unchanged criteria would otherwise be answered from the react-query
 * cache, and since this screen turns `retry` off (a refusal is an answer) and the
 * app turns `refetchOnWindowFocus` off, a search that failed would have no way
 * back — the button would look alive and do nothing until the number changed.
 * Same question ⇒ re-ask it; different question ⇒ a new key does that by itself.
 *
 * Compared key by key rather than by `JSON.stringify` so it does not depend on
 * the builder's insertion order — the point is the *question*, not the object.
 */
export function sameQuery(a: InvoiceSearchQuery, b: InvoiceSearchQuery): boolean {
  const keys = Object.keys(a) as (keyof InvoiceSearchQuery)[]
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}
