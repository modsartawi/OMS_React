/**
 * The call-center console's server calls. Every one goes through `@/core/api`
 * (`.claude/rules/api-envelope.md`): the envelope, the error taxonomy and 401
 * are that module's, and 401 in particular is never caught here.
 *
 * The door is `CallCenterWeb/*` (CONTRACT.md §1) — cookie-session only, one tag,
 * one grant, one probe. **Neither endpoint exists server-side yet** (BackOffice
 * 800 carries the grant, 801 the route table), so slice 0 is verified against a
 * stubbed envelope — the approach tickets 051/052 and 152 already used.
 *
 * The `SESSION_BUSY` retry/backoff (§6.1) lives at the foot of this file and
 * **nowhere else** — 🚩 never in `src/core/api.ts`: lease semantics have no
 * business in the layer every back-office grid shares
 * ([164](.issues/164-busy-collision-and-staleness.md)).
 *
 * **Path note.** Spec 160 and CONTRACT.md §6.1 both write this file as
 * `features/callcenter/api.ts`; it lands one level down, at
 * `features/callcenter/console/api.ts`. `callcenter` is the AREA (its own
 * top-level nav group, 134 §7) and `console` is the feature inside it, which is
 * what `.claude/rules/feature-structure.md` asks for and what the boundary lint
 * mechanically requires — it classifies `features/<area>/<feature>/` and would
 * read two flat files under `features/callcenter/` as two different features
 * importing each other. Same file, one directory deeper; nothing else moves.
 */
import { api, apiErrorCode } from '@/core/api'
import type {
  AbandonResult,
  CallCenterAccessResult,
  CustomerAddressBookEntry,
  LoyaltyMember,
  OpenResult,
  SessionState,
} from '@/core/models/callcenter'

/**
 * The ONE cache key the nav leaf and the route guard share, so a gated console
 * costs one network call and not two (134 §6, ticket 125's pattern). Exported
 * rather than re-spelled at each site: a typo in a string literal would not fail
 * a build, it would silently split the cache entry.
 */
export const CALLCENTER_ACCESS_KEY = ['callcenter', 'access'] as const

/**
 * The key one `open` action's result lives under. Keyed by the action's own
 * `requestId`, which is what makes *abandon and start fresh* work: a genuinely
 * new open action is a new id and therefore a new key, and the refusal the old
 * one answered can never be mistaken for the new one's answer.
 *
 * Spelled here rather than at the call site because it is load-bearing and
 * mutable — a typo in an inline literal would not fail a build, it would split
 * the cache entry and re-open an order.
 */
export const openKey = (requestId: string) => ['callcenter', 'open', requestId] as const

/** The query key holding one order's `SessionState` — the store of record.
 *  Keyed per transaction, which is what makes `applyState` free to be blind to
 *  identity and arbitrate version alone. */
export const sessionKey = (transactionId: string) =>
  ['callcenter', 'session', transactionId] as const

/**
 * One caller's address book. Keyed by the **customer** rather than by the order,
 * because that is what the book belongs to — and because the key is what stops
 * the previous caller's addresses from being offered for this one. The door
 * scopes the read to whoever is attached (§6.3), so a key that did not change
 * with the customer would hold an answer the door would no longer give.
 */
export const addressBookKey = (customerId: string) =>
  ['callcenter', 'addresses', customerId] as const

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32

/**
 * A client-minted ULID for one user action (§4 / law 3). Timestamp-prefixed so
 * ids sort by mint order, which is what makes a server-side ledger of the last
 * 50 legible when something goes wrong.
 *
 * **One action = one id**, reused verbatim across every retry of that action
 * including the retry that carries a `confirmToken`. Slice 0 has exactly one
 * mutating action (`open`) and therefore one call site; the discipline that
 * threads an id through a retry lands with the verbs that retry.
 */
export function newRequestId(): string {
  let time = Date.now()
  const chars: string[] = new Array(26)
  for (let i = 9; i >= 0; i--) {
    chars[i] = ULID_ALPHABET[time % 32]
    time = Math.floor(time / 32)
  }
  const random = crypto.getRandomValues(new Uint8Array(16))
  for (let i = 0; i < 16; i++) chars[10 + i] = ULID_ALPHABET[random[i] % 32]
  return chars.join('')
}

export const callCenterApi = {
  /**
   * `GET CallCenterWeb/Access` → `{ canOpenConsole }`. One boolean: open implies
   * act (134 §1), so there is no second capability to probe for.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch, unlike the
   * `Notifications/Access` and `Bby/Access` probes. What sits behind this one
   * mints real OMS orders, so an unreachable probe must draw the refusal rather
   * than the console; the endpoint ships with BackOffice 800, so there is no
   * window in which a tolerant catch would be doing anything useful.
   */
  access(): Promise<CallCenterAccessResult> {
    return api.get<CallCenterAccessResult>('CallCenterWeb/Access')
  },

  /**
   * `POST CallCenterWeb/Open` → `OpenResult`. Opens a real engine transaction:
   * from this moment everything the agent does is on one transaction the server
   * owns (law 8 — the transaction IS the draft, there is no save verb).
   *
   * `outcome: 'refusedExisting'` is a **success**, not a throw — one active order
   * per agent (law 9), and the choice between resume and abandon is the agent's
   * ([163](.issues/163-order-already-open.md)).
   */
  open(requestId: string): Promise<OpenResult> {
    return api.post<OpenResult>('CallCenterWeb/Open', { requestId })
  },

  /**
   * `POST CallCenterWeb/Abandon` → `AbandonResult` (§8.2). Voids the engine
   * transaction; the coupon reversal is server-side and rides
   * `CollectReversalContexts()`, so there is nothing to undo here.
   *
   * 🚩 **It returns no state, so the caller owes the agent a landing.** Abandon
   * is never the last thing that happens: on the already-open screen it is the
   * first half of *abandon-and-start-fresh* and is immediately followed by
   * `open`, in that order ([163](.issues/163-order-already-open.md)); from
   * inside a live order it is the same act and lands the same way. An abandon
   * with no follow-on leaves the agent holding nothing.
   *
   * `requestId` is the **abandon action's own** id, not the open's — two actions,
   * two ids (law 3), reused verbatim only across retries of the same one.
   */
  abandon(transactionId: string, requestId: string): Promise<AbandonResult> {
    return api.post<AbandonResult>('CallCenterWeb/Abandon', { transactionId, requestId })
  },

  /**
   * `GET CallCenterWeb/MemberByMobile/{mobile}` — how the agent FINDS the caller,
   * before there is a caller to scope anything to (BackOffice 801: the four
   * loyalty routes precede attach, so grant-only is their whole boundary).
   *
   * 🚩 **A miss is `null`, not a throw.** The service answers an absent member
   * with an empty payload, and that is an ordinary outcome of the first thing
   * that happens on a call — not a failure to draw a refusal for. What the
   * console does with a miss is deliberately nothing more than saying so:
   * loyalty *signup* is [159](.issues/159-coupon-and-loyalty-signup-drawn.md)'s
   * undrawn surface and this slice must not invent one.
   *
   * `branchId` is left unsent — the query param is optional on the original and
   * the console has no branch to scope a loyalty read by that the session does
   * not already imply.
   */
  memberByMobile(mobile: string): Promise<LoyaltyMember | null> {
    return api.get<LoyaltyMember | null>(`CallCenterWeb/MemberByMobile/${encodeURIComponent(mobile)}`)
  },

  /**
   * `POST CallCenterWeb/AttachCustomer` → the whole `SessionState` (law 2).
   *
   * It is also what **opens the address book**: the five `CustomerAddresses`
   * routes are server-side scoped to the session's attached customer (§6.3,
   * BackOffice 801), so before this call there is no address book to reach —
   * which the response says in `capabilities.canOpenAddressBook`, the only thing
   * the console is allowed to read that from.
   */
  attachCustomer(transactionId: string, requestId: string, customerId: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/AttachCustomer', { transactionId, requestId, customerId })
  },

  /**
   * `POST CallCenterWeb/RemoveCustomer` → the whole `SessionState`.
   *
   * 🚩 It **clears the address and keeps the derived plant** (§6.3) — and that is
   * the SERVER's doing, arriving in the projection. The console must not "help"
   * by clearing a store it did not derive: a subsequent `setAddress` re-derives
   * it through the normal confirm path, which is what stops re-attaching a caller
   * from silently re-pricing the basket.
   */
  removeCustomer(transactionId: string, requestId: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/RemoveCustomer', { transactionId, requestId })
  },

  /**
   * `GET CallCenterWeb/CustomerAddresses` — the attached caller's address book.
   *
   * 🚩 **It takes no customer id.** The original is unscoped (`:1412` reads a
   * client-supplied `customerId` off the query string), which on a per-agent
   * door would let any agent enumerate any customer's addresses; BackOffice 801
   * resolves the customer off the agent's own session row instead, and
   * browser-supplied identity is exactly what the cookie branch exists to
   * distrust. So there is nothing to pass — and nothing the console could pass
   * that would widen what it may read.
   *
   * Before `attachCustomer` it refuses `NO_CUSTOMER_ATTACHED` (§6.3), which is
   * why the picker is only ever opened off `capabilities.canOpenAddressBook`.
   */
  customerAddresses(): Promise<CustomerAddressBookEntry[]> {
    return api.get<CustomerAddressBookEntry[]>('CallCenterWeb/CustomerAddresses')
  },

  /**
   * `POST CallCenterWeb/SetAddress` → the whole `SessionState` (law 2).
   *
   * 🚩 **This is what decides where the order is fulfilled from**, and the
   * decision is the SERVER's: the district→store rule runs here and the answer
   * arrives as `header.plant` + `plantSource: 'derivedFromAddress'`. The console
   * derives nothing — a second client-side derivation is how the console and the
   * engine start disagreeing about which branch serves an address (spec 160).
   *
   * On an **empty basket** it applies inline: there is nothing to re-price, so
   * §5.1's confirmation is not raised at all. With lines it answers
   * `pendingConfirmation: storeChange` on the SUCCESS path, carrying the
   * unchanged state and a token to commit with — [167](.issues/167-store-move-shows-the-diff.md)'s
   * surface, which is why `confirmToken` is already in this signature.
   */
  setAddress(
    transactionId: string,
    requestId: string,
    addressNumber: string,
    confirmToken?: string,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetAddress', {
      transactionId,
      requestId,
      addressNumber,
      ...(confirmToken ? { confirmToken } : {}),
    })
  },

  /**
   * `GET CallCenterWeb/State` — refresh, recovery, reload and second tab only
   * (law 2). Never a way to "sync": a mutating verb has already returned the
   * whole state.
   *
   * It is also **the resume half of 163**: the agent who chooses to resume the
   * order they already have open is read back onto it through this call and
   * nothing else — there is no client-side memory of an order to restore from.
   */
  getState(transactionId: string): Promise<SessionState> {
    return api.get<SessionState>('CallCenterWeb/State', { transactionId })
  },
}

/**
 * The collision backoff, in milliseconds before each retry (§6.1 / law 7).
 *
 * Five retries after the first attempt — six attempts, ~6 s of waiting inside
 * the worst-case 15 s self-lockout, so the ceiling is reached while the agent is
 * still on the call. The first retry is immediate because the common collision
 * is two of the agent's OWN requests overlapping by milliseconds, and making
 * them all wait 400 ms would be a self-inflicted stutter.
 *
 * 🚩 The schedule is the **contract's**, not the server's hint. `SESSION_BUSY`
 * carries `retryAfterMs` and it is deliberately not honoured as a delay: a
 * bounded client ceiling is what guarantees the agent reaches the still-busy
 * state with an action in it, and a server hint could postpone that forever.
 */
export const BUSY_BACKOFF_MS = [0, 400, 800, 1600, 3200] as const

export interface BusyRetryHooks {
  /** Fired before each wait — `retry` is 1-based, so the strip can say which
   *  attempt it is on. It is never called when the first attempt succeeds. */
  onRetry?: (retry: number, delayMs: number) => void
  /** Injected by the pure test so the schedule is proved in microseconds. */
  sleep?: (ms: number) => Promise<void>
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Run one verb, riding out a routine claim collision.
 *
 * `SESSION_BUSY` is not a fault (law 7): the 15 s strict claim is the engine's
 * only mutual exclusion, so two requests on one order collide as a matter of
 * course — a second tab, or the agent's own two keystrokes. It is retried
 * automatically and **bounded**; after the ceiling the refusal is rethrown so
 * the console can draw the still-busy state with a manual retry in it. The agent
 * is never left without an action.
 *
 * 🚩 **Every other error is rethrown untouched, on the first attempt.** A
 * guardrail refusal (§7) is the server's considered answer to what was asked;
 * retrying it would turn one refusal into six and delay the banner the agent has
 * to read.
 *
 * It takes a thunk rather than a verb name so **every verb inherits it** without
 * this module knowing which verbs exist — which is why 164 is built before the
 * verbs that will collide most.
 */
export async function withBusyRetry<T>(
  verb: () => Promise<T>,
  { onRetry, sleep = wait }: BusyRetryHooks = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await verb()
    } catch (err) {
      if (apiErrorCode(err) !== 'SESSION_BUSY' || attempt >= BUSY_BACKOFF_MS.length) throw err
      const delayMs = BUSY_BACKOFF_MS[attempt]
      onRetry?.(attempt + 1, delayMs)
      await sleep(delayMs)
    }
  }
}
