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
import type {
  LoyAccessResult,
  LoyActivityRow,
  LoyMember,
  LoyMemberActionsPage,
  LoyMemberPayload,
  LoySalesRow,
} from '@/core/models/loy'
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

/** The Activities tab's cache key — per member, so a tab fetched once is not
 *  fetched again while that member is on screen (ticket 236). */
export const activitiesKey = (loyId: string) => ['loy', 'activities', loyId] as const

/** The Sales tab's cache key — per member, same rule (ticket 237). */
export const salesKey = (loyId: string) => ['loy', 'sales', loyId] as const

/**
 * The Actions tab's cache key — per member **and per page**, because this is the
 * one tab that pages: page 2 is a different read, not a filtered view of page 1
 * (ticket 238).
 */
export const actionsKey = (loyId: string, page: number) =>
  ['loy', 'actions', loyId, page] as const

/**
 * Rows a page on the Actions tab — **25, the server's own default**, and
 * deliberately not the 50 Ua Users walks. The pager takes its size as a
 * parameter precisely so the two callers can differ (ticket 232).
 */
export const LOY_ACTIONS_PAGE_SIZE = 25

/**
 * The query string one page of actions is asked for — the pure half of this
 * read, and the ticket's own Proof seam.
 *
 * 🚩 **`loyId` is always sent, and a blank one is a throw rather than a call.**
 * A bare `LoyMemberActions` returns the first 25 actions of the **whole estate**,
 * newest first, across all members — a silent cross-member data leak, *not* an
 * error (223 §4). Two things make that unrepresentable here rather than merely
 * unlikely: the door refuses a call without a `LoyId` (BackOffice constraint 3),
 * and this guard stops the client ever making one. The guard is not paranoia
 * about the caller — `buildQuery` **drops an empty string**, so an accidental
 * `''` would not fail loudly, it would silently become the estate-wide call.
 *
 * The 401 rule is untouched: this throws a plain client-side `Error` for a bug in
 * the caller, never an `ApiError` shaped like a server outcome.
 */
export function actionsQuery(loyId: string, page: number): Record<string, unknown> {
  if (!loyId.trim()) throw new Error('LoyMemberActions requires a loyId')
  return {
    loyId: loyId.trim(),
    // The report coerces a page `<= 0` to 1 itself; the client sends a sane one
    // anyway so the page the pager thinks it is on and the page the server reads
    // are the same number.
    page: Math.max(1, Math.floor(page)),
    pageSize: LOY_ACTIONS_PAGE_SIZE,
  }
}

export const loyReportsApi = {
  /**
   * `GET LoyWeb/Reports/LastActivities/{loyId}` — the Activities tab's read.
   *
   * 🚩 **It has no existence check.** The underlying report is raw SQL keyed on
   * `LoyId`, so a member with no history and a member who does not exist both
   * answer `200 []`. That is not a problem here — by the time a tab fetches, the
   * member call has already resolved someone — and it is why an empty tab and a
   * failed tab are never conflated (226 §8).
   *
   * 🚩 The realistic failure is a **raw 500 with no envelope**: `ExecuteAsync`
   * rethrows anything that is not a `DomainException`. That is what earns the
   * tab its Retry, and why the fallback string is what an agent actually reads
   * there rather than a server sentence.
   *
   * `?? []` guards the one shape the envelope permits and the tab cannot render:
   * a `success: true` with a null `data`.
   */
  async activities(loyId: string): Promise<LoyActivityRow[]> {
    const rows = await api.get<LoyActivityRow[] | null>(
      `LoyWeb/Reports/LastActivities/${encodeURIComponent(loyId)}`,
    )
    return rows ?? []
  },

  /**
   * `GET LoyWeb/Reports/LoyaltySales/{loyId}` — the Sales tab's read (ticket
   * 237). `TOP (500)`, `ORDER BY TrxDate DESC`, one row per sales **line**.
   *
   * 🚩 **No existence check here either** — raw SQL keyed on `LoyId`, so a
   * member with no purchases and a member who does not exist both answer
   * `200 []`. By the time this fires the member has already resolved, so an
   * empty answer is a fact about the member and never a refusal.
   *
   * 🚩 **This is the tab that earned the scoped Retry.** Its likeliest real
   * failure is a **SQL timeout on a heavy member** — 500 lines over
   * `RetailTrxDetail` — which arrives as a **raw 500 with no envelope**, because
   * `ExecuteAsync` rethrows anything that is not a `DomainException`. Transient,
   * and often fine on a second attempt.
   */
  async sales(loyId: string): Promise<LoySalesRow[]> {
    const rows = await api.get<LoySalesRow[] | null>(
      `LoyWeb/Reports/LoyaltySales/${encodeURIComponent(loyId)}`,
    )
    return rows ?? []
  },

  /**
   * `GET LoyWeb/Reports/LoyMemberActions?loyId=&page=&pageSize=` — the Actions
   * tab's read (ticket 238), and the **only** one of the three that is genuinely
   * paged: `OFFSET/FETCH` on `ORDER BY ActionNo DESC` plus a second `COUNT(*)`
   * for a real `recordsCount`.
   *
   * 🚩 The `loyId` guard lives in `actionsQuery` and fires **before** the call,
   * so the estate-wide read cannot be made from here even by mistake.
   *
   * A member with no actions is `200` with an empty `records` — a fact about the
   * member, never a refusal — so the empty state is the tab's own sentence and
   * not an error. `?? []` guards the one shape the envelope permits and the grid
   * cannot render.
   */
  async actions(loyId: string, page: number): Promise<LoyMemberActionsPage> {
    const result = await api.get<LoyMemberActionsPage>(
      'LoyWeb/Reports/LoyMemberActions',
      actionsQuery(loyId, page),
    )
    return { ...result, records: result.records ?? [] }
  },
}
