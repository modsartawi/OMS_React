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
  LoyBlockedReasonPayload,
  LoyMember,
  LoyMemberActionsPage,
  LoyMemberPayload,
  LoySalesRow,
} from '@/core/models/loy'
import type { ContactRemoval } from './contact-removal'
import type { ProfileUpdateRequest } from './profile-form'
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

/**
 * Whether the session may **edit** the member on screen — spec 301's second tier
 * (ADR 0001). Identical rule to the one above, and deliberately a second
 * one-line predicate rather than a parameterised reader: the three flags are
 * three authorities, and a shared `has(flag)` helper would make it possible to
 * ask for a flag that does not exist and be told `false` by a typo.
 *
 * 🚩 `=== true` and nothing looser. A denial, an absent flag, a string `"true"`,
 * an empty object and a probe that never answered are all *no* — being wrong
 * here fails **open** on a customer-PII surface.
 */
export const canEditLoyMember = (r: LoyAccessResult | null | undefined): boolean =>
  r?.canEditLoyMember === true

/**
 * Whether the session may **remove the member's mobile** — the third tier, and
 * the narrowest: it destroys a login and one of the only two ways a member can
 * be found. Same fail-closed rule.
 */
export const canRemoveLoyMemberMobile = (r: LoyAccessResult | null | undefined): boolean =>
  r?.canRemoveLoyMemberMobile === true

/**
 * What one session may do on this screen, read off ONE probe answer.
 *
 * 🚩 **Every tier is anchored on *may look*.** A session that cannot open the
 * screen cannot edit it either, whatever the other two flags say — an editor who
 * cannot open the member is a matrix rather than a permission (ADR 0001), and
 * the anchoring means a door that answers `canEdit` to a refused session still
 * draws nothing.
 */
export interface MemberAuthority {
  mayLook: boolean
  mayEdit: boolean
  mayRemoveMobile: boolean
}

export function memberAuthority(r: LoyAccessResult | null | undefined): MemberAuthority {
  const mayLook = canOpenLoyMember(r)
  return {
    mayLook,
    mayEdit: mayLook && canEditLoyMember(r),
    mayRemoveMobile: mayLook && canRemoveLoyMemberMobile(r),
  }
}

export const loyAccessApi = {
  /**
   * `GET LoyWeb/Access` → the area's three authority flags: `canOpenLoyMember`
   * (spec 231) plus `canEditLoyMember` and `canRemoveLoyMemberMobile` (spec 301,
   * ADR 0001). 🚩 **One route, one answer, one cache key** — the nav leaf, the
   * in-page guard and the Profile tab all read this call, so the menu and the
   * screen cannot disagree about the same session.
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

/**
 * Every member entry, as a **prefix** — what a **member command** invalidates.
 *
 * 🚩 It is deliberately not `memberKey(member.loyId)`. The route reads under the
 * key it took from the **URL**, and a command only holds the id off the
 * **payload**; the two agree on every ordinary path (a resolve navigates to
 * `resolution.member.loyId`) but a hand-typed link that differs by case or
 * padding would have the command invalidate an entry nobody is reading, and the
 * header would silently not move — the one failure the whole refresh rule exists
 * to prevent. The prefix cannot miss, and the cost is nil: the screen holds one
 * member at a time, so exactly one entry is active and refetched. The rest are
 * only marked stale, which after a write is true of them anyway.
 */
export const MEMBER_SCOPE_KEY = ['loy', 'member'] as const

/**
 * The mutation key ONE of a member's **member commands** runs under.
 *
 * 🚩 It exists so the in-flight guard outlives the control that started it. The
 * tab shell mounts only the OPEN tab, so a control that held "a write is in
 * flight" in its own state would forget it the moment an analyst clicked Actions
 * and came back — and, with no server-side idempotency anywhere in the module, a
 * second press would write a second **member update snapshot** and a second trail
 * row. The mutation cache lives on the query client, so a remounted control reads
 * the same fact (`useIsMutating`).
 *
 * 🚩 **Keyed per command, not per member.** The guard is against pressing the
 * SAME command twice; the commands are unrelated writes, and one key for all of
 * them would have a profile save spin the Block button and a block in flight
 * disable all nine profile controls — a screen reporting a write that is not
 * happening, on a tab where the analyst is meant to be able to read what each
 * control is doing.
 */
export const memberCommandKey = (
  loyId: string,
  command: 'status' | 'profile' | 'mobile' | 'remove-email' | 'remove-mobile',
) => ['loy', 'member-command', loyId, command] as const

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

/**
 * The blocked reasons an agent may pick (ticket 303). One key for the whole
 * area — the list is seed data shared by every member, not a fact about the one
 * on screen, so a second member does not re-fetch it.
 */
export const BLOCKED_REASONS_KEY = ['loy', 'blocked-reasons'] as const

/**
 * The **member commands** (spec 301) — the writes. Every one goes through
 * `@/core/api` like the reads, and every one can be refused as a *business*
 * outcome that the screen explains rather than throws
 * (`.claude/rules/api-envelope.md`).
 *
 * ⚠️ **None of these routes exists.** The backend half of spec 301 is unwritten
 * and unnumbered; the shapes below are this client's design intent and the
 * BackOffice spec that eventually owns them is normative. Everything here is
 * verified against stubbed envelopes in `tools/loy-member-admin-drive.mjs`.
 * 🚩 Nothing here has met a live SIS.Api.
 *
 * 🚩 **No correlation id is sent, and that is a decision.** Spec 301 records
 * that the id every command carries is *pass-through only* — no dedup check
 * exists anywhere in the module and the trail service mints its own when the
 * caller sends none. A client-minted id would therefore buy no idempotency, only
 * a field on a contract nobody has written yet. The guard against a double
 * submit is the control disabling itself while in flight, and it is the only
 * one there is.
 *
 * 🚩 **The acting store is never sent.** It is derived server-side from the
 * session, because it is an audit stamp and a client that can choose it can
 * forge it (spec 301, "Writing safely").
 */
export const loyCommandApi = {
  /**
   * `GET LoyWeb/BlockedReasons` — the reasons a **person** may choose, filtered
   * server-side to exclude **system reasons**. `selectableBlockedReasons`
   * filters again on the way to the picker: the door's filter is the first line
   * and the projection is the second, because a system reason offered by hand
   * writes an audit trail that lies (ticket 303).
   *
   * `?? []` guards the one shape the envelope permits and the picker cannot
   * render: a `success: true` with a null `data`. An empty list is seed data,
   * never a failure.
   */
  async blockedReasons(): Promise<LoyBlockedReasonPayload[]> {
    const rows = await api.get<LoyBlockedReasonPayload[] | null>('LoyWeb/BlockedReasons')
    return rows ?? []
  },

  /**
   * `POST LoyWeb/Member/{loyId}/Profile` — the profile **member command**
   * (ticket 304): the nine editable fields written as one snapshot.
   *
   * 🚩 **A NEW admin-side handler, not the till's.** The existing one's
   * validator makes gender and preferred language **mandatory** and constructs
   * itself inside the handler, so it cannot be swapped from outside; members are
   * frequently sparse, and delegating verbatim would force an analyst to invent
   * a gender to fix a name. Spec 301 rules the departure is made by **adding
   * beside, never by editing the shared path** — editing it would change
   * behaviour for the WPF till, POS and e-commerce callers, the exact drift the
   * `LoyWeb` door exists to avoid.
   *
   * 🚩 The body carries the member's **last-update echo**, and the door refuses
   * with `LOY-00103` when the member has moved on. That refusal is not an error:
   * it says the member changed underneath you, and the screen offers a reload.
   * The narrow commands carry no such token — they write one dimension and the
   * server reads the member fresh.
   *
   * Refusable by name with **member does not exist**, **invalid nationality**,
   * **invalid city** and **member changed**; refused for authority with a 403,
   * which is a grant refusal and not an outage.
   */
  async updateProfile(loyId: string, body: ProfileUpdateRequest): Promise<void> {
    await api.post<unknown>(`LoyWeb/Member/${encodeURIComponent(loyId)}/Profile`, body)
  },

  /**
   * `POST LoyWeb/Member/{loyId}/Mobile` — the mobile **member command** (ticket
   * 305): the member's login credential changed on its own, never as part of a
   * profile save.
   *
   * 🚩 **It delegates to the existing no-OTP change handler**, which **refuses**
   * a number already held by another member rather than taking it from its
   * current holder — the wipe-the-other-member path exists only on the
   * customer-driven OTP flow and is deliberately out of reach here (spec 301).
   * A refusal therefore changes nothing at all: the member is never left
   * half-edited.
   *
   * ⚠️ **It also marks the new number verified with NO OTP** — the analyst
   * asserts verification on the customer's behalf. That is existing server
   * behaviour, deliberately unchanged by spec 301 and flagged for an owner
   * ruling (301 → Further Notes #1). The screen says so out loud rather than
   * implying a confirmation that never happens; nothing here quietly improves
   * it.
   *
   * The number is sent as the reads send one — compacted, not normalised
   * (`mobileChangeVerdict`); the door owns `LoyMobileNumbers.NormaliseTyped`.
   *
   * ⚠️ **`mobileCountry` is the door's to derive, and this client never sends
   * it.** The model carries the column beside the number, and normalisation is
   * what decides it — a client that sent one would be guessing at a value the
   * door computes anyway. Spec 301 rules on the column only for *removal*
   * ("removing a mobile clears the country code with it"), so what a CHANGE does
   * to it is a question for the BackOffice spec that owns these routes, and this
   * is the note that has to be read before it is answered.
   *
   * Refusable by name with **member does not exist**, **mobile already used**,
   * **same mobile as now** and **invalid mobile**; refused for authority with a
   * 403, which is a grant refusal and not an outage. It carries no last-update
   * echo: it writes one dimension and the server reads the member fresh.
   */
  async changeMobile(loyId: string, mobile: string): Promise<void> {
    await api.post<unknown>(`LoyWeb/Member/${encodeURIComponent(loyId)}/Mobile`, { mobile })
  },

  /**
   * `POST LoyWeb/Member/{loyId}/RemoveEmail` — the email **contact removal**
   * (ticket 306): a customer has asked to stop being emailed, and the address is
   * cleared because **a person asked**.
   *
   * 🚩 **The body is the case reference and nothing else.** No removed address
   * rides with it, and none ever will: ADR 0002 rules that a removal records the
   * loyalty id, the acting user, the time and the reference, and records the
   * removed value nowhere new — the Actions tab renders free-form command data
   * verbatim to anyone holding the read grant, so sending the old address would
   * republish the very thing the customer asked to have taken away. The
   * `ContactRemoval` is taken whole rather than as a bare string so the call
   * cannot be made from a reference the precondition never saw
   * (`contact-removal.ts`).
   *
   * 🚩 **The reference goes in the trail slot the Actions tab DRAWS** — the
   * door's job, and named here because it is the half of ADR 0002 a client
   * cannot enforce: hiding it in the slot the tab does not draw would be exactly
   * the kind of promise the decision rejects.
   *
   * 🚩 **Gated on *may edit*, not on the removal grant** (ADR 0001). An editor
   * can blank the Email field through the profile command anyway, so gating this
   * higher would be an authority that looks enforced and is not. The corollary
   * is stated in spec 301 and worth repeating where the call lives: **removal
   * counts undercount**, because an ordinary profile update can end the same
   * contact channel and records as a profile update. Anything counting removal
   * requests reads this command's own trail and must accept a floor rather than
   * a total.
   *
   * It clears the address and **nothing else** — no block, no country code, no
   * points, no history — so the member keeps their login, their balance and
   * their purchases. It carries no last-update echo: it writes one dimension and
   * the server reads the member fresh.
   *
   * Refusable by name with **member does not exist**; refused for authority with
   * a 403, which is a grant refusal and not an outage.
   */
  async removeEmail(loyId: string, removal: ContactRemoval): Promise<void> {
    await api.post<unknown>(`LoyWeb/Member/${encodeURIComponent(loyId)}/RemoveEmail`, {
      caseReference: removal.caseReference,
    })
  },

  /**
   * `POST LoyWeb/Member/{loyId}/RemoveMobile` — the mobile **contact removal**
   * (ticket 307), and the command this whole wave was requested for.
   *
   * 🚩 **The only route gated on *may remove a mobile*** — ADR 0001's third and
   * narrowest tier, best read as *may destroy a login*. Every other command on
   * this screen sits under *may edit*.
   *
   * It clears the number **and its country code**, clears both verified marks,
   * and **blocks the member under a system reason** — the reason 303 proved
   * unofferable by hand, so that *"this person asked to be removed"* is a
   * recorded state rather than an emergent side effect of an empty column. 🚩 An
   * already-blocked member's reason is **overwritten** with it: the module's
   * existing blank-the-mobile path preserves instead, and spec 301 departs
   * deliberately, because inactivity and collision markers can be re-derived and
   * this one cannot.
   *
   * 🚩 **The body is the case reference and nothing else** — ADR 0002, exactly as
   * the email removal: the number is recorded nowhere new, and survives only in
   * the *preceding* **member update snapshot**, which no portal read exposes.
   * Recovery is a support task and not a button, and is not a simple restore
   * anyway: reattaching a mobile has to re-run the collision check, because
   * someone else may hold that number by now.
   *
   * ⚠️ **The optional email-in-the-same-command is NOT sent.** Spec 301 designs
   * the removal so it *may* clear the email too; this client draws no control for
   * it, so it never asks for it — an analyst who needs both runs both commands,
   * and each is recorded as itself. Whether the door takes the flag at all is the
   * BackOffice spec's (map 1396); this is the note to read before answering it.
   *
   * Refusable by name with **member does not exist**; refused for authority with
   * a 403, which for this command reads as *you do not hold this authority* and
   * offers no retry.
   */
  async removeMobile(loyId: string, removal: ContactRemoval): Promise<void> {
    await api.post<unknown>(`LoyWeb/Member/${encodeURIComponent(loyId)}/RemoveMobile`, {
      caseReference: removal.caseReference,
    })
  },

  /**
   * `POST LoyWeb/Member/{loyId}/Block` — block the member under a reason.
   *
   * Refusable by name with **member does not exist** and **invalid blocked
   * reason**; refused for authority with a 403, which is a grant refusal and not
   * an outage. The reason code is the one the picker offered, sent verbatim.
   */
  async block(loyId: string, blockedReason: string): Promise<void> {
    await api.post<unknown>(`LoyWeb/Member/${encodeURIComponent(loyId)}/Block`, {
      blockedReason,
    })
  },

  /**
   * `POST LoyWeb/Member/{loyId}/Unblock` — clear the reason. It takes nothing
   * beyond the member: unblocking is the absence of a reason, so there is no
   * second question to ask.
   */
  async unblock(loyId: string): Promise<void> {
    await api.post<unknown>(`LoyWeb/Member/${encodeURIComponent(loyId)}/Unblock`, {})
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
 * Every page of one member's Actions cache, as a **prefix**. This is what a
 * member command invalidates (spec 301): the Actions tab is where a command
 * becomes visible, and a write that does not refresh it looks like it did not
 * happen. Exported as a key rather than left to each command to spell, so a
 * later command cannot invalidate page 1 and leave the analyst reading page 2 of
 * a trail that has moved on.
 */
export const memberActionsScopeKey = (loyId: string) => ['loy', 'actions', loyId] as const

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
