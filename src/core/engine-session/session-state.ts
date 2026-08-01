/**
 * The two rules that stand between the query cache and every response an engine
 * session receives: **is this state newer than what is on screen**, and **is it
 * a state this client can speak at all**.
 *
 * Contract law 2 makes the client a pure render-of-latest-state: every mutating
 * verb returns the whole session state, so there is no reducer and no delta
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
 *
 * 🚩 It lives in `core/` because it has a **second** engine session to serve
 * (ticket 210, spec 209 §3): the Nphies authorization form drives its own
 * transaction and its contract states the very same ordering rule, word for word
 * (`assets/209-nphies-contract/CONTRACT.md` §2.1). Features may not import
 * features, and the boundary rule's own remedy for logic shared by two of them
 * is to lift it here. Nothing about the rule changed in the move.
 */

/**
 * All this guard reads. A session state is anything the wire ORDERS by `version`
 * and IDENTIFIES by `etag` — which is both contracts' §2.1 and is why the rule
 * can be one module rather than one per feature. The state itself is returned
 * unchanged and unwidened, so a caller keeps its own full projection type.
 */
export interface VersionedSessionState {
  version: number
  etag: string
}

/**
 * Decide what the cache should hold after `incoming` arrives.
 *
 * - No current state (first response of a session) → `incoming`.
 * - A **higher** `version` → `incoming` applies.
 * - An **equal** `version` → idempotent: the current state is kept, by identity,
 *   so a replay (§4, `replayed: true`) costs no re-render. `version` is
 *   blind-incremented on every engine `SaveAsync`, so equal means same state —
 *   **unless the `etag` disagrees**, which is the case below.
 * - A **lower** `version` → **discarded**. This is the slow-response case.
 *
 * 🚩 **Equal version, different `etag` → `incoming` applies.** Version ORDERS
 * states; the etag IDENTIFIES one. A server that changed the order without
 * advancing its counter is disagreeing with itself, and of the two readings only
 * one is safe: the newly arrived state is the door's own answer to a verb the
 * agent just performed, and dropping it renders an order the server no longer
 * holds. That is not hypothetical — it is *"I chose the collection store and the
 * chip kept the old one until I reloaded the page"*, which is this guard
 * discarding a `setStore` response.
 *
 * It does not weaken the ordering rule it sits inside. A genuinely stale
 * response carries a LOWER version and is still discarded; equal-and-different
 * is two answers from the same save point, where the arrival order is the only
 * evidence there is. And a true replay is byte-identical, so it still costs no
 * re-render — the identity return below is kept for exactly that case.
 *
 * The function is deliberately blind to `transactionId`: the cache is keyed per
 * transaction (`sessionKey`), so two orders can never meet inside one entry, and
 * a guard that also arbitrated identity would be two rules wearing one name.
 */
export function applyState<S extends VersionedSessionState>(
  current: S | null | undefined,
  incoming: S,
  /**
   * Where `incoming` came from. A **verb**'s response is a projection built
   * alongside the act; a **read** is `getState` — the order's own account of
   * itself, and §6.1's universal recovery.
   *
   * 🚩 It changes exactly one case: an equal version. A verb's projection can be
   * wrong about a field it did not compute (`setAddress` answering the
   * placeholder plant `P000` while the district rule has already put the order
   * at a real branch), and the console's answer to that is to ask the order —
   * which is worth nothing if the guard then discards the answer for having the
   * same version as the bad one. A read at the same save point wins, because
   * between two accounts of one save point the persisted one is the true one.
   *
   * It cannot rewind the basket: a read that arrives with a LOWER version is
   * still discarded below, which is the race §2.1 is actually about.
   */
  source: 'verb' | 'read' = 'verb',
): S {
  if (!current) return incoming
  if (incoming.version > current.version) return incoming
  if (incoming.version < current.version) return current
  if (source === 'read') return incoming
  // Same save point, and a verb said it. Only an etag that BOTH sides named can
  // disagree — a server that sends none (or the same one) leaves the idempotent
  // reading standing, which is what keeps a replay (§4) free of a re-render.
  return incoming.etag && current.etag && incoming.etag !== current.etag ? incoming : current
}

/**
 * The contract this client was built against — the call centre's
 * (`.issues/assets/136-cc-contract/CONTRACT.md`, §10 Amendments); the Nphies one
 * is `.issues/assets/209-nphies-contract/CONTRACT.md` §9. Only the
 * **major** is load-bearing; the minor is here so a mismatch can say what it
 * expected in the words the amendment table uses.
 *
 * 🚩 One constant for both engine contracts, which holds only while they share a
 * major: the Nphies contract is v1.0 and this is v1.1, so the check reads the
 * same for both today. The day either goes to a 2.x, this becomes a per-consumer
 * expectation — a change for the ticket that finds it, not a speculative
 * parameter added here.
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
