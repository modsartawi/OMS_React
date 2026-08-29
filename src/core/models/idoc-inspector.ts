/**
 * IDoc Inspector wire models (spec 1386).
 *
 * The vocabulary of `IDocInspector/*`, and — exactly as for the retail-invoice
 * rail beside it — **not this repo's to invent**: the shapes are the BackOffice
 * spec's, and a field renamed or a type softened for local convenience produces
 * a screen that fails silently the day it meets the real endpoint.
 *
 * `api-envelope` puts wire types in `core/models/` rather than in the feature.
 *
 * Ticket 296 lands **only the access probe's shape**. The transaction graph —
 * the verdict, the attention block and the nested documents — is 297's and 298's
 * to paste when there is first a caller for it.
 */

/**
 * `GET IDocInspector/Access` — the nav-visibility probe (spec 1386 §"The read
 * surface", BackOffice ticket 1387).
 *
 * **One boolean, and that is the whole shape.** One grant covers the whole
 * screen; there is no per-route split to model.
 *
 * 🚩 **Cookie-only and deliberately NOT grant-gated**, so a denial arrives as
 * `200 { screenAllowed: false }` — a boolean to read, never an error to catch.
 * Gating the probe on the grant would leave a denied session unable to *learn*
 * it is denied: the call would fail, this client's fail-closed handling would
 * read a shut door as an outage, and the user would be told to try again in a
 * moment, forever.
 *
 * ⚠️ **The probe only hides the menu.** `Transaction`, `Download` and `Metadata`
 * re-evaluate the grant server-side through their own filter, fail-closed. That
 * filter is the boundary; this answer is nav hygiene. Neither substitutes for
 * the other.
 */
export interface IDocInspectorAccessResult {
  screenAllowed: boolean
}
