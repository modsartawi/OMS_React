// Pure params builder for GET Bby/List (spec 061, ticket 062). This is the tested
// seam: it maps the toolbar's criteria to the endpoint's query object and encodes
// the one UX rule the client owns (contract 057 §1): the endpoint is a pure function
// of its params, so the *client* decides that "any search — a number or a validity
// date — clears Active only". Kept pure and dependency-free (no `@/` imports, no
// i18n, no network) so it runs in an in-memory node/tsx harness, the sim `promoView`
// precedent (ticket 045).
//
// Slice 062 lands the empty-criteria + search-clears-activeOnly branches; ticket 064
// wires the toolbar that produces richer criteria on top of the same builder.

/** Toolbar state, before it becomes a query. All strings so the fields map 1:1 to
 *  inputs; `validFrom`/`validTo` are raw `yyyyMMdd` (or '' when unset). */
export interface BbyListCriteria {
  bbyNumber: string
  validFrom: string
  validTo: string
  /** The "Active only" toggle (default on). Any non-empty search overrides it. */
  activeOnly: boolean
}

/**
 * Map toolbar criteria to the GET Bby/List query object (the query-builder idiom:
 * a plain `Record` that api.ts hands to buildQuery, mirroring `buildSessionsQuery` /
 * `buildDeliveryQuery`). Empty-string fields are omitted — buildQuery would drop them
 * anyway, but omitting keeps the object (and the harness assertion) honest.
 *
 * - Empty criteria ⇒ `{ activeOnly: true }` and nothing else (the default active view).
 * - A non-empty **number** or **date range** forces `activeOnly: false` — a keyed or
 *   period lookup must reach inactive/deleted BBYs and any validity window (057 §1).
 * - With no search, `activeOnly` follows the toggle (default on).
 */
export function buildListParams(criteria: Partial<BbyListCriteria> = {}): Record<string, unknown> {
  const bbyNumber = (criteria.bbyNumber ?? '').trim()
  const validFrom = (criteria.validFrom ?? '').trim()
  const validTo = (criteria.validTo ?? '').trim()

  const hasSearch = bbyNumber !== '' || validFrom !== '' || validTo !== ''
  const activeOnly = hasSearch ? false : (criteria.activeOnly ?? true)

  const params: Record<string, unknown> = { activeOnly }
  if (bbyNumber) params.bbyNumber = bbyNumber
  if (validFrom) params.validFrom = validFrom
  if (validTo) params.validTo = validTo
  return params
}
