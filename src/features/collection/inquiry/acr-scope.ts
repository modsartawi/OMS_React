/**
 * The addresses this wave introduces, and the one scope that rides in a URL
 * (ticket 257).
 *
 * Three of the four Collections screens can point at something: a collection
 * receipt, an ACR form, or Cash Collections narrowed to one ACR. All three are
 * **addresses** rather than overlays, which is the whole ruling of 257 — the grid
 * keeps its search, scroll and selection, and a document can be pasted into a
 * ticket or sent to a colleague. The WPF opens a second window to the same effect.
 *
 * ⚠️ Spelled **once**, here, and never as a string literal in a cell renderer. A
 * screen that wrote `'/collection/receipt/' + id` into its own JSX would be
 * writing an import the router cannot check — exactly the reason
 * `core/bonus-buy/deep-link.ts` exists, whose `?bby=` idiom this follows. It stays
 * in the feature rather than graduating to `core/` because both ends of every one
 * of these links are inside this feature; nothing outside it links here yet.
 *
 * Pure — no React, no i18n, no network, no `new Date()`. The screen state that
 * uses it is `CashCollectionsPage`'s; the rules are this module's.
 */
import {
  COLLECTIONS_LIMIT,
  buildCollectionsParams,
  type CollectionsCriteria,
} from './collections-criteria'

/** Cash Collections' route — the router's entry, spelled once. */
export const COLLECTIONS_PATH = '/collection/collections'
/** The collection receipt document's route (ticket 251), keyed by ULID. */
export const RECEIPT_PATH = '/collection/receipt'
/** The ACR form document's route (ticket 252), keyed by ULID. */
export const ACR_FORM_PATH = '/collection/acr'
/** The query parameter Cash Collections scopes itself from. */
export const ACR_SCOPE_PARAM = 'acr'

/**
 * A blank id has no address, and that is a real state rather than a defensive
 * check — `bbyDetailHref`'s ruling, arrived at here for a sharper reason.
 * `CollectionReceiptId` is a **server change still in flight** (BackOffice 1089):
 * until it lands on the projection the field can genuinely arrive empty, and a
 * link built on `''` would land on `/collection/receipt/` — a route that does not
 * match, i.e. a 404 dressed as a working action. Returning `null` is what lets a
 * cell draw nothing instead.
 */
function href(base: string, id: string | null | undefined): string | null {
  const key = (id ?? '').trim()
  if (!key) return null
  return `${base}/${encodeURIComponent(key)}`
}

/** Where a collection receipt prints — opened in a NEW TAB by its row action. */
export function receiptHref(collectionReceiptId: string | null | undefined): string | null {
  return href(RECEIPT_PATH, collectionReceiptId)
}

/** Where an ACR form prints — opened in a NEW TAB by its row action. */
export function acrFormHref(acrId: string | null | undefined): string | null {
  return href(ACR_FORM_PATH, acrId)
}

/**
 * Cash Collections scoped to one ACR — the **same-tab** drill-down, and the one
 * shareable URL a supervisor can send a colleague.
 */
export function collectionsForAcrHref(acrId: string | null | undefined): string | null {
  const key = (acrId ?? '').trim()
  if (!key) return null
  return `${COLLECTIONS_PATH}?${ACR_SCOPE_PARAM}=${encodeURIComponent(key)}`
}

/**
 * The ACR this view is scoped to, or `''` when it is the ordinary screen.
 *
 * `''` rather than `null` so that every caller compares the same way, and so that
 * `?acr=` with nothing after it — a hand-edited URL — reads as *not scoped*
 * instead of as *scoped to the ACR whose id is the empty string*.
 */
export function readAcrScope(search: string | URLSearchParams): string {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  return (params.get(ACR_SCOPE_PARAM) ?? '').trim()
}

/** Is this view scoped to one ACR? */
export function isAcrScoped(acrId: string | null | undefined): boolean {
  return (acrId ?? '').trim() !== ''
}

/**
 * The same URL with the scope dropped — what the chip's ✕ navigates to. Every
 * other parameter is preserved: this drops *the scope*, not *the query string*.
 */
export function withoutAcrScope(search: string | URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(
    typeof search === 'string' ? search : search.toString(),
  )
  params.delete(ACR_SCOPE_PARAM)
  return params
}

/**
 * The criteria the chip **overrides and disables** — all of them.
 *
 * ⚠️ **The disabling is honesty, not decoration.** The server treats `AcrId` as an
 * *exclusive* filter: `PosCollectionInquiryService` ignores store, collector and
 * period entirely when one is set. Leaving those inputs live would let a
 * supervisor set a date range that silently does nothing, and then read the
 * result as if the range had applied.
 *
 * 🚩 `servedBy` joined the list when the shared control landed (BackOffice 1163),
 * and the door discards it under a scope exactly like the other four. Note this is
 * NOT the same ruling as *Served by* ANDing with the store filter: that is about two
 * live toolbar filters, and this is the one case where the toolbar is switched off
 * entirely.
 */
export const SCOPE_DISABLED_FIELDS = [
  'fromDate',
  'toDate',
  'storeId',
  'collectorOperatorId',
  'servedBy',
] as const satisfies readonly (keyof CollectionsCriteria)[]

/**
 * The scoped query: the ACR and the system cap, and **nothing else on the wire**.
 *
 * 🚩 The omission is the point, and it is what the test pins. Sending
 * `FromDate`/`ToDate` alongside `AcrId` would not narrow anything — the door
 * discards them — but it would leave a query string that reads as a period filter
 * to whoever debugs it next, and it would make the disabled inputs above look like
 * a UI quirk rather than the contract they are.
 */
export function buildAcrScopedParams(acrId: string): Record<string, unknown> {
  return { Limit: COLLECTIONS_LIMIT, AcrId: acrId.trim() }
}

/**
 * The query Cash Collections actually issues: the scoped one when the URL carries
 * an ACR, the ordinary criteria-built one when it does not.
 *
 * One function so that "clearing the chip restores the ordinary screen" is a
 * *branch this module owns* rather than an effect the Page has to remember to
 * run — the criteria are never mutated by the scope, so dropping the param
 * restores them intact.
 */
export function collectionsParamsFor(
  acrId: string | null | undefined,
  criteria: CollectionsCriteria,
): Record<string, unknown> {
  return isAcrScoped(acrId) ? buildAcrScopedParams(acrId as string) : buildCollectionsParams(criteria)
}
