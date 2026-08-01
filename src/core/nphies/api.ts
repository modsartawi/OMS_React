import { api } from '@/core/api'
import type {
  NphiesAccessResult,
  NphiesCodeSystemEntry,
  NphiesLookup,
  NphiesProvider,
} from '@/core/models/nphies'

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

/**
 * The lookups' rows, however the door wraps them.
 *
 * 🚩 SIS.Api answers `NphiesLookupResponse<T>` — `{ contractVersion, items }` —
 * because law 10 puts the contract version on the payload model and a bare JSON
 * array has nowhere to hang it. The contract's §1.1 rows say only "lookup" and do
 * not freeze the envelope's `data` shape, and the server track logs the wrapping
 * as a wanted §3.8 clarification, so **both readings are live** until the
 * conformance fixtures settle it.
 *
 * Reading exactly one of them would fail in the worst possible way: an empty
 * picker with no error, on the day the endpoint lands. So the two shapes are
 * unwrapped **here, once**, and when §3.8 freezes one this is the single line that
 * changes. It is not a tolerant parse of an unknown shape — it is two known ones,
 * named in two repositories.
 */
function unwrapLookup<TRow>(answer: NphiesLookup<TRow> | TRow[]): TRow[] {
  return Array.isArray(answer) ? answer : (answer?.items ?? [])
}

/** The value set of the cancellation reasons (`ValueSetConstants.TaskReasonCode`),
 *  which is what a cancel task's `reasonCode` coding carries to NPHIES. Named
 *  rather than spelled at the call site: a typo would fetch an empty list and the
 *  cancel dialog would offer no reason at all. */
export const TASK_REASON_CODE_VALUE_SET = 'TaskReasonCode'

/** One cache entry per value set — the selection reasons (218) and the
 *  cancellation reasons (215) are different reads of the same endpoint. */
export const codeSystemKey = (valueSet: string) => ['nphies', 'codeSystem', valueSet] as const

export const nphiesLookupApi = {
  /**
   * `GET Nphies/Providers` (§1.1 #12) → the providers the agent may act for.
   *
   * 🚩 **Already filtered to unblocked upstream** (`CoreService.GetProviders`
   * filters `IsBlocked == false`), so nothing here re-filters — and WPF's
   * disabled-combo-holding-a-null-provider trap cannot occur, because a blocked
   * provider is never in the list to begin with.
   */
  async providers(): Promise<NphiesProvider[]> {
    return unwrapLookup(await api.get<NphiesLookup<NphiesProvider> | NphiesProvider[]>(
      'Nphies/Providers',
    ))
  },

  /**
   * `GET Nphies/CodeSystem?valueSet=…` (§1.1 #13, §3.8) — a straight passthrough
   * of one NPHIES code system.
   *
   * The value set is the **caller's**: the same door serves 215's cancellation
   * reasons (`TaskReasonCode`) and 218's per-line selection reasons
   * (`SelectionReason`). It sits in `core/` beside the providers lookup for the
   * same reason — two features read it and a feature may never import a feature.
   */
  async codeSystem(valueSet: string): Promise<NphiesCodeSystemEntry[]> {
    return unwrapLookup(
      await api.get<NphiesLookup<NphiesCodeSystemEntry> | NphiesCodeSystemEntry[]>(
        'Nphies/CodeSystem',
        { valueSet },
      ),
    )
  },
}
