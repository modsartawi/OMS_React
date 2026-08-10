/**
 * Retail invoice rail models (spec 261).
 *
 * The wire vocabulary of `RetailInvoice/*`, and it is **not this repo's to
 * invent**: the shapes are settled by the BackOffice contract
 * `.issues/assets/988-search-download-contract.md` (map 984), whose §2 exists to
 * be pasted here verbatim so the row shape cannot drift between the two repos.
 * A field renamed or a type softened for local convenience produces a screen
 * that fails silently the day it meets the real endpoint — on exactly the fields
 * that were changed.
 *
 * `api-envelope` puts wire types in `core/models/` rather than in the feature.
 *
 * ⚠️ Ticket 263 lands **only the access probe's shape**. `InvoiceCandidate`,
 * `InvoiceSearchResult` and `RetailInvoiceKey` are contract §2's and are pasted
 * by ticket 264, the slice that first has a caller for them — 263 owns the area,
 * the namespace and the gate, and a model with no consumer is a screen finished
 * early.
 */

/**
 * `GET RetailInvoice/Access` — the nav-visibility probe (contract §1, §6.7).
 *
 * **One boolean, and that is the whole shape.** Distinguishing a
 * search-permission from a download-permission would be BackOffice 989's to
 * settle and this type's to grow a field; the spec puts it out of scope.
 *
 * 🚩 **Cookie-only and deliberately NOT grant-gated**: it must be able to answer
 * a session that holds nothing, so a denial arrives as `200 { screenAllowed:
 * false }` — a boolean to read, never an error to catch.
 *
 * ⚠️ **The probe only hides the menu.** `Search` and `Download` re-check the
 * grant server-side and refuse a session that lacks it with a **bare 403 carrying
 * no body at all** — no envelope, no `errorCode`. So this answer is nav hygiene,
 * and the endpoint's grant filter is the boundary. Neither substitutes for the
 * other.
 */
export interface RetailInvoiceAccessResult {
  screenAllowed: boolean
}
