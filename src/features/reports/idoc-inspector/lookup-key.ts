/**
 * The IDoc Inspector lookup's criteria → the transaction key it asks about
 * (ticket 296).
 *
 * The tested seam of the screen's input: the toolbar owns a **draft**, this
 * module owns the **key**, and only Look up promotes one to the other. Splitting
 * them is what makes a half-typed transaction number unable to fire a request.
 *
 * Pure — no React, no i18n, no network, no `new Date()`. ⚠️ **Copied, not
 * extracted**, from `reports/retail-invoice/invoice-criteria.ts`, which the spec
 * names as the rail this feature follows: a feature may not import a feature
 * ([feature-structure](../../../../.claude/rules/feature-structure.md)).
 *
 * 🚩 **The one departure from that template: the store is REQUIRED here.** On
 * the invoices screen a store code is an optional narrowing convenience, because
 * a transaction number is near-unique estate-wide by construction. The inspector
 * keys the IDoc tables on store **and** transaction number together (spec 1386
 * §"The read surface"), so a lookup missing either half is not a wider search —
 * it is not a question at all. The server keeps a blank store or transaction
 * number as the envelope's 400 branch; this module makes that arm unreachable
 * from the client, the way the invoices screen does for its one field.
 */

/**
 * The toolbar draft. Both fields are strings so they map 1:1 onto their inputs.
 *
 * The whole of it — the spec's entry point is a single keyed lookup and there is
 * deliberately no browsable list, so there is no date window, no status filter
 * and nothing else to narrow by.
 */
export interface LookupCriteria {
  /** Required. Exact, trimmed. A transaction number is only unique per store. */
  store: string
  /** Required. Exact, trimmed. */
  trxNumber: string
}

/**
 * The state the screen opens on, and the state Reset returns it to: **both
 * fields empty and no lookup issued at all**.
 *
 * 🚩 There is nothing here for the Page to fire on mount. A transaction is not a
 * question the screen can answer unasked, so an auto-fired lookup would be a
 * guaranteed empty result pretending to be a verdict — and on this screen a
 * verdict is the *answer*, which makes faking one worse here than anywhere else.
 */
export function landingCriteria(): LookupCriteria {
  return { store: '', trxNumber: '' }
}

/**
 * The **question** the screen asks the server — `IDocInspector/Transaction`'s
 * two query parameters and nothing else.
 *
 * ⚠️ A `type`, not an `interface`, so it keeps the implicit index signature
 * `core/api.ts`'s `buildQuery` binds against.
 *
 * ⚠️ camelCase `storeCode`/`trxNumber`, the names the retail-invoice rail binds
 * on the same key space (`RetailTrx`). 297 is the slice that first puts them on
 * a wire and confirms them against the built door.
 */
export type LookupKey = {
  storeCode: string
  trxNumber: string
}

/**
 * Map the draft to the key — a plain `Record` that `core/api.ts`'s `buildQuery`
 * turns into a query string.
 *
 * 🔑 **Returns `null` when either half is blank**, rather than an object the
 * caller has to remember to check: the refusal and the key are one decision, and
 * making it impossible to *build* a key for a blank field is stronger than a
 * validation flag beside it. `null` is the Page's cue to say what to type and
 * issue nothing — and it is the **only** reading of that rule, deliberately,
 * rather than a `canLookUp` predicate beside it that a later edit could let
 * drift.
 */
export function buildLookupKey(criteria: Partial<LookupCriteria> = {}): LookupKey | null {
  const storeCode = (criteria.store ?? '').trim()
  const trxNumber = (criteria.trxNumber ?? '').trim()
  if (storeCode === '' || trxNumber === '') return null
  return { storeCode, trxNumber }
}

/**
 * Which halves of the draft are missing — one named type rather than the same
 * two booleans spelled inline at the Page, the toolbar and here.
 */
export interface MissingParts {
  store: boolean
  trxNumber: boolean
}

/**
 * Which halves of the draft are missing, for the toolbar to mark.
 *
 * 🚩 Separate from `buildLookupKey` on purpose: the builder answers *may this be
 * sent*, which is one bit; the form has to mark **which** field is empty, and
 * deriving that from a `null` key would be the second reading of the same rule.
 * Both read the same trimming, spelled once below, and a test pins them to each
 * other so the two answers cannot drift.
 */
export function missingParts(criteria: Partial<LookupCriteria> = {}): MissingParts {
  return {
    store: (criteria.store ?? '').trim() === '',
    trxNumber: (criteria.trxNumber ?? '').trim() === '',
  }
}

// 🚩 There is deliberately no `sameLookup` here yet. The re-ask rule — pressing
// Look up twice on unchanged criteria must RE-ASK rather than be answered from
// the react-query cache — belongs to the slice that first hangs a query off this
// key (297). Writing it now would be a function with no caller and no way to be
// wrong, which is how a forward-built helper ships subtly mismatched to the
// query it was written for.
