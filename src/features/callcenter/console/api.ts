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
 * Not here on purpose: the `SESSION_BUSY` retry/backoff (§6.1) belongs in this
 * file and nowhere else, but it arrives with the collision slice
 * ([164](.issues/164-busy-collision-and-staleness.md)) along with the verbs that
 * can actually collide.
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
import { api } from '@/core/api'
import type { CallCenterAccessResult, OpenResult, SessionState } from '@/core/models/callcenter'

/**
 * The ONE cache key the nav leaf and the route guard share, so a gated console
 * costs one network call and not two (134 §6, ticket 125's pattern). Exported
 * rather than re-spelled at each site: a typo in a string literal would not fail
 * a build, it would silently split the cache entry.
 */
export const CALLCENTER_ACCESS_KEY = ['callcenter', 'access'] as const

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
   * `GET CallCenterWeb/State` — refresh, recovery, reload and second tab only
   * (law 2). Never a way to "sync": a mutating verb has already returned the
   * whole state.
   */
  getState(transactionId: string): Promise<SessionState> {
    return api.get<SessionState>('CallCenterWeb/State', { transactionId })
  },
}
