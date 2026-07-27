/**
 * The two rules that stand between the query cache and every response the
 * console receives: **is this state newer than what is on screen**, and **is it
 * a state this client can speak at all**.
 *
 * Contract law 2 makes the client a pure render-of-latest-state: every mutating
 * verb returns the whole `SessionState`, so there is no reducer and no delta
 * protocol. What there IS, is an ordering hazard: two requests in flight, the
 * slow one lands second, and the basket goes backwards on screen. §2.1 rules it
 * out on the client side — *"the client stores the latest and never acts on an
 * older one"* — and this module is that sentence.
 *
 * Ticket 162 needed the version guard alone; 164 adds the `contractVersion`
 * hard stop beside it. They are one module because they are one question asked
 * twice — *may this response be rendered?* — and because the second is checked
 * at exactly the moment the first admits the session's first state. The
 * `SESSION_BUSY` backoff is deliberately NOT here: it lives in `api.ts`, where
 * the contract puts it (§6.1).
 */
import type { SessionState } from '@/core/models/callcenter'

/**
 * Decide what the cache should hold after `incoming` arrives.
 *
 * - No current state (first response of a session) → `incoming`.
 * - A **higher** `version` → `incoming` applies.
 * - An **equal** `version` → idempotent: the current state is kept, by identity,
 *   so a replay (§4, `replayed: true`) costs no re-render. `version` is
 *   blind-incremented on every engine `SaveAsync`, so equal means same state.
 * - A **lower** `version` → **discarded**. This is the slow-response case.
 *
 * The function is deliberately blind to `transactionId`: the cache is keyed per
 * transaction (`sessionKey`), so two orders can never meet inside one entry, and
 * a guard that also arbitrated identity would be two rules wearing one name.
 */
export function applyState(
  current: SessionState | null | undefined,
  incoming: SessionState,
): SessionState {
  if (!current) return incoming
  return incoming.version > current.version ? incoming : current
}

/**
 * The contract this client was built against
 * (`.issues/assets/136-cc-contract/CONTRACT.md`, §10 Amendments). Only the
 * **major** is load-bearing; the minor is here so a mismatch can say what it
 * expected in the words the amendment table uses.
 */
export const CLIENT_CONTRACT_VERSION = '1.1'

export type ContractCheck =
  | { ok: true }
  /** `received` is what the server said, verbatim — `null` when it said nothing
   *  a version could be read from. The screen shows both, because "update the
   *  console" is an instruction someone has to be able to act on. */
  | { ok: false; expected: string; received: string | null }

/**
 * Whether this client may render a response at all (law 10 / §9).
 *
 * - **Same major → yes**, whatever the minor. Additive changes bump the minor
 *   and ship server-first because clients ignore unknown fields by rule, so
 *   minor drift is a non-event **in either direction** — a client one minor
 *   ahead of its server is the same non-event seen from the other side.
 * - **A different major → hard stop.** A changed or re-meant field is exactly
 *   how a console mis-renders money, and refusing to run is the only honest
 *   answer to a projection whose meaning has moved underneath it.
 * - **Present but unreadable → hard stop.** The server named a version and this
 *   client cannot say whether it can speak it. That is not the same as silence.
 * - 🚩 **Absent → runs.** Law 10 says every response carries one, so a response
 *   with no version is a server defect — but it is not *evidence of a major
 *   change*, and the hard stop exists for evidence, not for the absence of it.
 *   Refusing here would brick the console against a server that simply has not
 *   added the field yet (BackOffice 804 is unbuilt), which is exactly the
 *   ship-server-first failure §9 designs against.
 */
export function checkContractVersion(received: string | null | undefined): ContractCheck {
  const expected = CLIENT_CONTRACT_VERSION
  if (received === null || received === undefined || received === '') return { ok: true }
  if (major(received) === major(expected)) return { ok: true }
  return { ok: false, expected, received }
}

/** The leading integer of a `major.minor` string, or `null` when there is none.
 *  Anything after the first dot is minor drift and is not read. */
function major(version: string | null | undefined): number | null {
  const head = /^(\d+)(\.|$)/.exec(version ?? '')
  return head ? Number(head[1]) : null
}
