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
import type { LoyMember, LoyMemberPayload } from '@/core/models/loy'
import type { MemberReads } from './resolve-member'

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
