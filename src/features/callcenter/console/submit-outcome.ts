/**
 * The last thirty seconds of the call, as a closed set of outcomes — and the one
 * module on this screen whose job is to make two things **indistinguishable**.
 *
 * 🚩 **`submitted` and `alreadySubmitted` are the same news.** Once-only is keyed
 * on the transaction id (§8.3), so a second submit of the same order answers with
 * the FIRST order number and the server still completes the local tail. The
 * contract says the client treats them identically; a comment saying so is a
 * convention that a later branch quietly breaks. So the outcome word and
 * `replayed` **do not survive this function**: there is no field downstream that
 * could carry the difference, and the pure test asserts the two results EQUAL
 * rather than asserting each separately.
 *
 * 🚩 **A transient outage is retryable, never "unexpected".** `SUBMIT_UNAVAILABLE`
 * arrives as a 503 *carrying the envelope*, which `core/api.ts` keeps as
 * `kind:'business'` because it is coded — the order is Open and safe, and the
 * only honest thing to tell an agent mid-call is to try again. A refusal is the
 * other shape entirely: something on the order needs fixing first, and pressing
 * again unchanged would be refused again.
 *
 * 🚩 **There is deliberately no fifth state here.** §7 is explicit that there is
 * no `unknown` submit outcome — 133's in-process ruling removed the in-flight gap
 * that would produce one — and §8.3 carries a `documentNo` on both successes. A
 * client state for *a success with no number in it* would be that unknown outcome
 * under another name, and it could only be paid for by pressing a verb the door
 * has just said no to. The frozen contract is conformance-tested on the server
 * side (`CcContractFixtureTests`, §9); this console renders it.
 */
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import type { SubmitResult } from '@/core/models/callcenter'
import type { HeaderChip } from './header-chips'

/**
 * The order is placed, and has a number the agent can read to the caller. 🚩 ONE
 * shape, whichever success produced it — nothing here records which, which is
 * what makes *the two are the same news* structural rather than a promise.
 */
export interface SubmitOutcome {
  documentNo: string
}

/**
 * §8.3, read once — the console renders this and never `outcome` or `replayed`.
 *
 * 🚩 It answers the NEWS and not the projection. `SubmitResult.state` is written
 * to the cache through `applyState` like every other verb's, on the one write
 * path the whole console shares; carrying it through here would make the two
 * successes comparable by something other than what the agent is told, which is
 * the one property this module exists to hold.
 */
export function readSubmitResult(result: SubmitResult): SubmitOutcome {
  return { documentNo: result.documentNo }
}

export interface SubmitFailure {
  /** `refused` — fix something and submit again. `unavailable` — press again as
   *  it is. `failed` — anything else, still not a lost basket. */
  kind: 'refused' | 'unavailable' | 'failed'
  /** The server's own sentence (§7), passed through as data. */
  message: string
  /** Whether pressing again UNCHANGED is worth doing. Only the outage is. */
  retryable: boolean
  /** 🚩 Always true: §7 is explicit that only submitted/alreadySubmitted close
   *  the transaction. It is a FIELD rather than an assumption because "the
   *  refusal is a correction, not a lost basket" is the ticket's whole point,
   *  and a surface that has to remember it is a surface that will forget. */
  orderOpen: boolean
  /** What `SUBMIT_REFUSED` named, verbatim off the envelope's `data` — `null`
   *  on every other outcome and on a refusal that named nothing. */
  field: string | null
}

/**
 * A thrown submit, classified. `fallback` is the caller's words for a failure
 * that carried none of its own — an `ApiError` always has a sentence, and
 * anything that is not one has to say something.
 */
export function readSubmitFailure(err: unknown, fallback: string): SubmitFailure {
  const code = apiErrorCode(err)
  const message = apiErrorMessage(err, fallback)
  // The transaction stays Open on every one of these. There is no failure of
  // submit that closes an order — the ones that close it are the successes.
  const open = { message, orderOpen: true as const }
  if (code === 'SUBMIT_UNAVAILABLE') return { kind: 'unavailable', retryable: true, field: null, ...open }
  if (code === 'SUBMIT_REFUSED')
    return { kind: 'refused', retryable: false, field: refusedField(err), ...open }
  return { kind: 'failed', retryable: false, field: null, ...open }
}

/** The `field` off a `SUBMIT_REFUSED` envelope's `data`, or `null`. Loose on
 *  purpose: `data` is `unknown` by design in `core/api.ts` (what a refusal's body
 *  MEANS is the refusing feature's to know), and a body that does not carry a
 *  usable field must not stop the refusal being drawn. */
function refusedField(err: unknown): string | null {
  const data = err instanceof ApiError ? err.data : null
  if (!data || typeof data !== 'object') return null
  const field = (data as { field?: unknown }).field
  return typeof field === 'string' && field.trim() ? field.trim() : null
}

/**
 * Which chip fixes the field a refusal named — so *the field to fix* is
 * something the agent can look at rather than a word in a sentence.
 *
 * 🚩 It answers `null` freely. The refusal's own message already names the
 * field in the server's words; this table only adds a highlight, so a field
 * arriving tomorrow that no chip owns costs nothing (§9 ships server-first).
 * It is deliberately NOT `submit-blockers.ts`'s table: those are `submitBlockers`
 * CODES on the projection, these are `field` names on one verb's refusal, and
 * merging two vocabularies under one name is how they start lying to each other.
 */
const REFUSED_FIELD_CHIPS: Record<string, HeaderChip['id']> = {
  slot: 'slot',
  documentsource: 'source',
  sourcereference: 'reference',
  store: 'store',
  plant: 'store',
}

export function submitRefusalChip(field: string | null | undefined): HeaderChip['id'] | null {
  return REFUSED_FIELD_CHIPS[(field ?? '').toLowerCase()] ?? null
}
