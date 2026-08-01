/**
 * The eligibility list's criteria and the query they become (ticket 212,
 * contract v1.0 §3.3).
 *
 * Pure: no React, no i18n, no network, no `Date.now()` — every function that
 * needs today takes it as an argument. This is the seam ticket 212's first three
 * Proof bullets are written against.
 *
 * The **window** itself — what it is, and what happens when the agent removes it
 * — moved to `@/core/nphies/list-window` when the authorization list (214) became
 * its second consumer. One rule, one place: the two lists must not be able to
 * disagree about what "last 7 days" means.
 */

import {
  NPHIES_PAGE_SIZE,
  lastSevenDays,
  putWindow,
  type NphiesListWindow,
} from '@/core/nphies/list-window'

/**
 * Everything the list is filtered by. Five filters (the ticket's own list, minus
 * one — see below) plus the window and the page.
 *
 * 🚩 **No `preAuthRef`.** The ticket names a preauth-reference filter, but §3.3's
 * eligibility query string has no such parameter: `preAuthRef` is on the
 * *authorization* list, and upstream `GetEligibilityResponses` has no field to
 * match it against — an eligibility check has no preauthorization reference,
 * because no authorization has been raised yet. Sending one would be inventing a
 * server shape. It belongs to 214, whose endpoint really does take it. Logged in
 * `.afk/HITL-212.md`.
 */
export interface EligibilityListCriteria {
  patientId: string
  payerCode: string
  /**
   * `''` = **all providers**, and that is the default (§3.3, spec 209 story 8) —
   * deliberately the opposite of the till, which is pinned to its own store. Note
   * what follows: the provider filter does *not* narrow the underlying read. The
   * window and the patient/status filters are what do.
   */
  providerCode: string
  /** `''` = any. Otherwise a `RequestState` (`@/core/nphies/status`). */
  request: string
  /** `''` = any. Otherwise an `EligibilityVerdict`. Independent of `request`. */
  verdict: string
  /** `null` = **the chip was removed** — no window at all, not a wider one. */
  window: NphiesListWindow | null
  /** 1-based. A field of the criteria rather than separate state, so a new filter
   *  necessarily builds a fresh query at page 1 (the Ua Users precedent, 148). */
  page: number
}

/** This list's page size. The shared constant under its old name, so the call
 *  sites that read it keep reading the size the server is actually asked for. */
export const ELIGIBILITY_PAGE_SIZE = NPHIES_PAGE_SIZE

/** The criteria the list opens on — the window, and nothing else narrowed. */
export function defaultEligibilityCriteria(today: Date): EligibilityListCriteria {
  return {
    patientId: '',
    payerCode: '',
    // All providers. There is no code anywhere that seeds this from the acting
    // store — that would be the till's rule on a back-office screen.
    providerCode: '',
    request: '',
    verdict: '',
    window: lastSevenDays(today),
    page: 1,
  }
}

/**
 * Criteria → the `GET Nphies/EligibilityResponses` query (§3.3).
 *
 * 🚩 **`showAll` is always `true`, and it is not a preference.** Upstream reads
 * `if (!showAll) query = query.Where(c => c.IsEligible)`
 * (`EligibilityService.cs:976`) — so without it a *not eligible* check, a *not in
 * force* one and every failed request are invisible, and the screen whose whole
 * subject is "what did the payer say" would only ever show the yeses. The
 * contract flags this trap on the authorization list; it is worse here, because
 * the eligibility filter is on the verdict itself.
 *
 * Empty strings are dropped rather than sent blank — matching `buildQuery`'s own
 * contract in `@/core/api`, which would drop them anyway; omitting them here
 * keeps the object honest for the test that asserts it.
 *
 * No `sort` is sent. §3.3 lists the parameter but names no vocabulary for its
 * value, this slice ships no sort control, and "newest first" is the re-modelled
 * endpoint's stated default — so inventing a token here would be inventing a
 * server shape for no behaviour.
 */
export function buildEligibilityListParams(
  criteria: EligibilityListCriteria,
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    showAll: true,
    page: Math.max(1, Math.floor(criteria.page) || 1),
    pageSize: ELIGIBILITY_PAGE_SIZE,
  }

  const put = (key: string, raw: string) => {
    const value = raw.trim()
    if (value !== '') params[key] = value
  }

  putWindow(params, criteria.window)
  put('patientId', criteria.patientId)
  put('payerCode', criteria.payerCode)
  put('providerCode', criteria.providerCode)
  // The two axes narrow independently: a Verdict filter with no Request filter is
  // a legal question ("show me everyone the payer refused"), and so is the
  // reverse ("show me what never got an answer").
  put('request', criteria.request)
  put('verdict', criteria.verdict)

  return params
}
