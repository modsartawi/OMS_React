/**
 * The authorization list's criteria and the query they become (ticket 214,
 * contract v1.0 §3.3).
 *
 * Pure: no React, no i18n, no network, no `Date.now()`. This is the seam ticket
 * 214's `refusedRowsAreRequested` Proof bullet is written against, and it is
 * where this screen's one genuinely dangerous rule lives.
 *
 * The **window** and the pager are `@/core/nphies/list-window`'s — the same
 * seven days, the same removable chip and the same paging arithmetic the
 * eligibility list (212) opens on, so an agent learns one screen and not two.
 */

import {
  NPHIES_PAGE_SIZE,
  lastSevenDays,
  putWindow,
  type NphiesListWindow,
} from '@/core/nphies/list-window'

/**
 * Everything the list is filtered by: §3.3's authorization query minus the two
 * parameters the browser does not own, plus the two status axes.
 *
 * `claimType` is **not here and never sent** — §3.3 pins it to `0` in SIS.Api,
 * and v1 has one claim type. A client that sent one would be re-introducing the
 * mode dropdown the whole spec exists to delete.
 */
export interface AuthListCriteria {
  patientId: string
  payerCode: string
  /**
   * `''` = **all providers**, and that is the default (§3.3) — deliberately the
   * opposite of the till, which is pinned to its own store. The provider filter
   * therefore does *not* narrow the underlying read; the window and the
   * patient/reference filters are what do.
   */
  providerCode: string
  /**
   * The payer's own reference. Unlike the eligibility list this filter is real:
   * §3.3 puts `preAuthRef` on the authorization query, and upstream matches it
   * exactly (`AuthService.cs:1374`).
   */
  preAuthRef: string
  /** `''` = any. Otherwise a `RequestState` (`@/core/nphies/status`). All four
   *  are reachable here, unlike on a stored eligibility row. */
  request: string
  /** `''` = any. Otherwise an `AuthVerdict`. Independent of `request`. */
  verdict: string
  /** `null` = **the chip was removed** — no window at all, not a wider one. */
  window: NphiesListWindow | null
  /** 1-based. A field of the criteria rather than separate state, so a new filter
   *  necessarily builds a fresh query at page 1. */
  page: number
}

/** This list's page size — the shared one. */
export const AUTH_PAGE_SIZE = NPHIES_PAGE_SIZE

/** The criteria the list opens on — the window, and nothing else narrowed. */
export function defaultAuthCriteria(today: Date): AuthListCriteria {
  return {
    patientId: '',
    payerCode: '',
    providerCode: '',
    preAuthRef: '',
    request: '',
    verdict: '',
    window: lastSevenDays(today),
    page: 1,
  }
}

/**
 * Criteria → the `GET Nphies/AuthResponses` query (§3.3).
 *
 * 🚩 **`showAll` is always `true`, and this is the single easiest thing in the
 * effort to get silently wrong.** Upstream reads
 * `if (!showAll) query = query.Where(c => !c.Error)` (`AuthService.cs:1377`), so
 * without it **a refused authorization never appears at all** — and the rows that
 * most need an agent's attention would be exactly the ones hidden from them
 * (spec 209 story 70). It also makes 221's reopen affordance worthless: an act on
 * a row nobody can see. It is a constant here rather than a filter for that
 * reason — there is no state in which this screen wants the refusals gone, so
 * there is nothing to toggle and nothing that can be left off.
 *
 * No `claimType`: SIS.Api pins it (§3.3). No `sort`: §3.3 lists the parameter but
 * names no vocabulary for its value, this slice ships no sort control, and
 * "newest first" is the re-modelled endpoint's stated default — inventing a token
 * would be inventing a server shape for no behaviour.
 */
export function buildAuthListParams(criteria: AuthListCriteria): Record<string, unknown> {
  const params: Record<string, unknown> = {
    showAll: true,
    page: Math.max(1, Math.floor(criteria.page) || 1),
    pageSize: AUTH_PAGE_SIZE,
  }

  const put = (key: string, raw: string) => {
    const value = raw.trim()
    if (value !== '') params[key] = value
  }

  putWindow(params, criteria.window)
  put('patientId', criteria.patientId)
  put('payerCode', criteria.payerCode)
  put('providerCode', criteria.providerCode)
  put('preAuthRef', criteria.preAuthRef)
  // The two axes narrow independently: a Verdict filter with no Request filter is
  // a legal question ("show me everything the payer rejected"), and so is the
  // reverse ("show me what never got an answer").
  put('request', criteria.request)
  put('verdict', criteria.verdict)

  return params
}
