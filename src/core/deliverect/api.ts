import { api } from '@/core/api'
import type { DeliverectAccessResult, DeliverectAccount, DeliverectPlatform } from '@/core/models/deliverect'

// The Deliverect area's shared reads (BackOffice spec 2615, ticket 477). They live in `@/core/`
// rather than with a feature because several features read each one, and a feature may never
// import another (.claude/rules/feature-structure.md):
//
// - the access probe — every Deliverect leaf and page (477–482): ONE key, ONE call, and a
//   per-leaf predicate per flag in `./access` (the Materials shape);
// - `Accounts` — the stores page's onboard / move field and its account filter (477), and 482;
// - `Platforms` — the catalog's exclusion editor (479), and 482.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** The ONE cache key the menu leaves and every Deliverect page share. Exported rather than
 *  re-spelled: a typo in a literal would silently split the cache entry. */
export const DELIVERECT_ACCESS_KEY = ['deliverect', 'access'] as const

export const DELIVERECT_ACCOUNTS_KEY = ['deliverect', 'accounts'] as const
export const DELIVERECT_PLATFORMS_KEY = ['deliverect', 'platforms'] as const

export const deliverectApi = {
  /**
   * GET DeliverectWeb/Access → the four flags.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch (the Materials precedent):
   * the door (BackOffice 2616) is deployed nowhere yet, and a probe that degraded to *shown* while
   * its endpoint was missing would advertise screens nobody can hold the grant for. A rejected
   * promise leaves every Deliverect leaf hidden and each page on its denied card.
   */
  access(): Promise<DeliverectAccessResult> {
    return api.get<DeliverectAccessResult>('DeliverectWeb/Access')
  },

  /**
   * GET DeliverectWeb/Accounts.
   *
   * ⚠️ The contract's grant table puts this door behind `canManageTerms`, so a user who manages
   * stores without the terms grant gets a **403** here. A caller treats any failure as "the list
   * is unavailable" — never as "there are no accounts" (contract gap, HITL-477).
   */
  accounts(): Promise<DeliverectAccount[]> {
    return api.get<DeliverectAccount[]>('DeliverectWeb/Accounts')
  },

  /** GET DeliverectWeb/Platforms. ⚠️ Behind `canManageTerms` too — the same caveat as `accounts`. */
  platforms(): Promise<DeliverectPlatform[]> {
    return api.get<DeliverectPlatform[]>('DeliverectWeb/Platforms')
  },
}

/**
 * The probe's query options, passed WHOLE by every page gate (react-query merges concurrent
 * observers' options, so one that dropped `retry: false` would retry a refusal). `staleTime:
 * Infinity` because a grant does not change inside a page life.
 */
export function deliverectAccessQuery() {
  return {
    queryKey: DELIVERECT_ACCESS_KEY,
    queryFn: () => deliverectApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The account list's query options. `retry: false`: a 403 is an answer, not an outage. */
export function deliverectAccountsQuery() {
  return {
    queryKey: DELIVERECT_ACCOUNTS_KEY,
    queryFn: () => deliverectApi.accounts(),
    staleTime: 5 * 60_000,
    retry: false,
  } as const
}

/** The platform list's query options, for the same reason. */
export function deliverectPlatformsQuery() {
  return {
    queryKey: DELIVERECT_PLATFORMS_KEY,
    queryFn: () => deliverectApi.platforms(),
    staleTime: 5 * 60_000,
    retry: false,
  } as const
}
