import { api } from '@/core/api'
import type {
  NphiesAccessResult,
  NphiesCodeSystemEntry,
  NphiesDiagnosisLookup,
  NphiesLookup,
  NphiesMorphLookup,
  NphiesPayer,
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

/** The payers lookup's own key, keyed by nothing for the reason the providers key
 *  is — one list for every agent, so one cached call for every screen. */
export const PAYERS_KEY = ['nphies', 'payers'] as const

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

/** The value set of the per-line selection reasons
 *  (`ValueSetConstants.SelectionReason`, contract §3.8: "`codeSystem` carries the
 *  selection reasons"), which reach NPHIES as the line's
 *  `extension-pharmacist-Selection-Reason`. Named for the cancellation reasons'
 *  own reason: a typo would fetch an empty list and the picker would offer
 *  nothing, with no error to say why. */
export const SELECTION_REASON_VALUE_SET = 'SelectionReason'

/** The patient's occupation, which reaches NPHIES as the FHIR Patient's
 *  `extension-occupation` coding against
 *  `http://nphies.sa/terminology/CodeSystem/occupation`
 *  (`PatientEntry.cs:32-34`). A coded field, never free text: a value the code
 *  system does not contain is refused by the exchange, not by this screen. */
export const OCCUPATION_VALUE_SET = 'Occupation'

/** The patient's marital status, which reaches NPHIES as the FHIR Patient's
 *  `maritalStatus` coding against `…/v3-MaritalStatus` (`PatientEntry.cs:95-101`).
 *  Coded for the same reason as the occupation above — and the codes are single
 *  letters (`D`, `L`, `M`, `S`, `U`), which nobody types correctly by hand. */
export const MARITAL_STATUS_VALUE_SET = 'MaritalStatus'

/** One cache entry per value set — the selection reasons (218) and the
 *  cancellation reasons (215) are different reads of the same endpoint. */
export const codeSystemKey = (valueSet: string) => ['nphies', 'codeSystem', valueSet] as const

export const nphiesLookupApi = {
  /**
   * `GET Nphies/Payers` (§1.1 #11) → the payers a check or a request may be
   * addressed to.
   *
   * Keyed by nothing, like the providers lookup: the service scopes it to
   * distribution channel `20` server-side, so every agent sees the same list and
   * every screen that needs it shares ONE cached call.
   */
  async payers(): Promise<NphiesPayer[]> {
    return unwrapLookup(await api.get<NphiesLookup<NphiesPayer> | NphiesPayer[]>('Nphies/Payers'))
  },

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

  /**
   * `GET Nphies/Diagnoses?query=…` (§1.1 #14) — the diagnosis code lookup the
   * request form's diagnosis row searches against (ticket 219).
   *
   * 🚩 **It is a search, not a catalogue.** `CoreService.GetDiagnosesAsync`
   * answers `[]` for an empty query and `Take(500)` otherwise, so the caller
   * types and this door answers; nothing here fetches "all diagnoses" and
   * nothing caches one.
   *
   * 🚩 The row it answers carries **`isNeedMorph`**, which is the *service's own*
   * statement that a diagnosis requires a morphology. That flag — not a code
   * range spelled into the browser — is what makes the morphology field appear
   * with its cause (story 44).
   */
  async diagnoses(query: string): Promise<NphiesDiagnosisLookup[]> {
    return unwrapLookup(
      await api.get<NphiesLookup<NphiesDiagnosisLookup> | NphiesDiagnosisLookup[]>(
        'Nphies/Diagnoses',
        { query },
      ),
    )
  },

  /** `GET Nphies/Morphs?query=…` (§1.1 #15) — the morphology codes, searched the
   *  same way and read only while a neoplasm principal is on the request. */
  async morphs(query: string): Promise<NphiesMorphLookup[]> {
    return unwrapLookup(
      await api.get<NphiesLookup<NphiesMorphLookup> | NphiesMorphLookup[]>('Nphies/Morphs', {
        query,
      }),
    )
  },
}

/** One cache entry per typed query — the two search doors above are read on every
 *  keystroke the debounce lets through, and a shared key would make the answers
 *  overwrite each other. */
export const diagnosesKey = (query: string) => ['nphies', 'diagnoses', query] as const
export const morphsKey = (query: string) => ['nphies', 'morphs', query] as const
