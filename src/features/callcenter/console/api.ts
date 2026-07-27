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
