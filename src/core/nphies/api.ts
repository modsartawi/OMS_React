import { api } from '@/core/api'
import type { NphiesAccessResult, NphiesProvider } from '@/core/models/nphies'

/**
 * The Nphies area's screen-access probe (spec 209, contract §1 / §1.1 #16).
 *
 * It lives in `@/core/` rather than with the eligibility feature because the
 * whole area is behind **one** grant with **one** probe (§1: "no read/write
 * split, no per-audience matrix"), and its consumers are the menu group's leaf
 * plus every screen in both `features/nphies/*` features — the same
 * three-consumer situation that put the OMS (125) and bonus-buy (118) probes
 * here. A feature may never import another feature.
 *
 * Every call goes through `@/core/api` (`.claude/rules/api-envelope.md`).
 */

/** The ONE cache key the nav leaf and every screen guard share, so a gated area
 *  costs one network call and not one per screen. Exported rather than re-spelled
 *  at each site: a typo in a string literal would not fail a build, it would
 *  silently split the cache entry. */
export const NPHIES_ACCESS_KEY = ['nphies', 'access'] as const

export const nphiesAccessApi = {
  /**
   * `GET Nphies/Access` → `{ canOpenNphies }`. SIS.Api's own endpoint — the one
   * entry in the passthrough table with no upstream call behind it.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch, unlike the
   * `Notifications/Access` and `Bby/Access` probes which degrade to allowed while
   * their endpoints are unbuilt. Ticket 211 asks for exactly this: a pending or
   * errored probe hides the leaf rather than revealing it. What is behind this
   * one talks to the national exchange, and the grant filter over
   * `Nphies/CheckEligibility` is the hole this slice closes rather than inherits.
   */
  access(): Promise<NphiesAccessResult> {
    return api.get<NphiesAccessResult>('Nphies/Access')
  },
}

/**
 * The providers lookup, keyed by nothing: it is the same list for every agent
 * (the service scopes it to distribution channel `20` server-side).
 *
 * It joined the probe in `core/` at ticket 214, when the authorization list
 * became its third consumer — the check form (211) and the eligibility list (212)
 * are the other two, and a feature may never import another feature's `api.ts`.
 * The key is unchanged, so all three screens still share ONE cached call.
 */
export const PROVIDERS_KEY = ['nphies', 'providers'] as const

export const nphiesLookupApi = {
  /**
   * `GET Nphies/Providers` (§1.1 #12) → the providers the agent may act for.
   *
   * 🚩 **Already filtered to unblocked upstream** (`CoreService.GetProviders`
   * filters `IsBlocked == false`), so nothing here re-filters — and WPF's
   * disabled-combo-holding-a-null-provider trap cannot occur, because a blocked
   * provider is never in the list to begin with.
   */
  providers(): Promise<NphiesProvider[]> {
    return api.get<NphiesProvider[]>('Nphies/Providers')
  },
}
