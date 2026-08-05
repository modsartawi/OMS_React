/**
 * The Loy member feature's server calls (spec 231 §2).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the error taxonomy and 401 are that module's, and 401 in particular
 * is never caught here.
 *
 * ⚠️ **The door does not exist yet.** `LoyWeb/*` is a BackOffice dependency
 * built on a parallel track: four reads plus a probe, each `.AllowCookieSession()`
 * behind a `LoyMemberGrantEndpointFilter`, delegating to the existing
 * `LoyEndpoints` handlers. Until it lands this feature is verified against
 * stubbed envelopes (`tools/loy-member-drive.mjs`) taken from 223's field
 * inventory — the same code-complete / runtime-blocked posture the Nphies wave
 * shipped twelve tickets under. 🚩 Nothing here has been driven against a live
 * SIS.Api.
 *
 * 🚩 **`branchId` is never passed.** It does exactly one thing — restate
 * `PointsBalanceAmount` in a non-SAR plant currency — and all KSA branches are
 * SAR, so passing the acting store is a no-op that only widens the 45 s cache
 * key. Omitting it yields `SAR` at rate `1` (223 §1).
 */
import { api } from '@/core/api'
import type { LoyAccessResult, LoyMember, LoyMemberPayload } from '@/core/models/loy'
import type { MemberReads } from './resolve-member'

/**
 * The ONE cache key the Loyalty nav leaf and this screen's own in-page guard
 * share, so a gated area costs one network call and not one per consumer
 * (ticket 234). Exported rather than re-spelled at each site: a typo in a string
 * literal would not fail a build, it would silently split the cache entry and
 * let the nav and the screen disagree about whether the session is allowed in.
 */
export const LOY_ACCESS_KEY = ['loy', 'access'] as const

/**
 * Whether a probe answer admits the session. The predicate is a named export
 * because it is the ticket's pure Proof: `=== true` and nothing looser, so a
 * malformed answer (`{}`, `null`, a string `"true"`) is a denial and not an
 * accident of truthiness.
 */
export const canOpenLoyMember = (r: LoyAccessResult | null | undefined): boolean =>
  r?.canOpenLoyMember === true

export const loyAccessApi = {
  /**
   * `GET LoyWeb/Access` → `{ canOpenLoyMember }`.
   *
   * ⚠️ **Fails closed, and that is the point of ticket 234** — no 404-tolerant
   * catch, unlike the `Notifications/Access` and `Bby/Access` probes which
   * degrade to allowed while their endpoints are unbuilt. 224 ruled the
   * bonus-buy precedent (*unknown ⇒ shown*) does not transfer here: this screen
   * is a customer-PII surface, so an unseeded grant, a missing table or an
   * engine fault hides the nav item and denies the screen. The shell already
   * treats a pending or errored probe as hidden, so failing closed is the
   * *absence* of a catch rather than code.
   */
  access(): Promise<LoyAccessResult> {
    return api.get<LoyAccessResult>('LoyWeb/Access')
  },
}

/**
 * The one field the wire and the domain disagree about. `blockedReason` is the
 * reason **code** here and the joined **description** on an action row; the
 * rename is what stops a later screen reading one as the other (spec 231 §6).
 */
function toMember(payload: LoyMemberPayload): LoyMember {
  const { blockedReason, ...rest } = payload
  return { ...rest, blockedReasonCode: blockedReason }
}

/** The TanStack Query key for one member, shared by the route's read and the
 *  cache seed a resolve writes so the same member is never fetched twice. */
export const memberKey = (loyId: string) => ['loy', 'member', loyId] as const

export const loyApi: MemberReads = {
  /**
   * `GET LoyWeb/MemberByMobile/{typed}` — the first attempt at resolution.
   *
   * The browser sends what the agent typed (compacted); **mobile normalisation
   * is the door's job** (`LoyMobileNumbers.NormaliseTyped`), which is exactly
   * what BackOffice's half of this wave must not delegate past.
   *
   * A member who does not exist is a **400 business refusal** carrying
   * `LOY-00100` — not a 404 and not a null `data` — which is what
   * `resolveMember` cascades on.
   */
  async byMobile(key: string): Promise<LoyMember> {
    return toMember(
      await api.get<LoyMemberPayload>(`LoyWeb/MemberByMobile/${encodeURIComponent(key)}`),
    )
  },

  /**
   * `GET LoyWeb/Member/{typed}` — the second attempt, and the read behind
   * `/loy/members/:loyId`. Being the route's own data source is why a refresh
   * re-reads by key and does not replay the cascade.
   */
  async byLoyId(key: string): Promise<LoyMember> {
    return toMember(await api.get<LoyMemberPayload>(`LoyWeb/Member/${encodeURIComponent(key)}`))
  },
}
