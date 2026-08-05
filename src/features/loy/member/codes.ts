/**
 * The codes the Loy reads hand over untranslated (ticket 235, decision 229).
 *
 * **One rule: a code is data unless its value set is closed in server *source*.**
 * A code earns a `t()` map only when the complete set is fixed in C# we can read
 * and cite — not in a database table — and each map below names the file that
 * closes it. Everything else passes through as data, which
 * [i18n-zero-literal](../../../../.claude/rules/i18n-zero-literal.md) permits:
 * server-supplied text is not a literal.
 *
 * 🚩 **An unknown value returns `null`, and the caller renders the bare code.**
 * A `t()` call with no backing key renders the raw key to the agent, so a set
 * that is closed *today* must still degrade tomorrow. Not
 * `t(key, { defaultValue: code })` — same pixels, but the guard would live at
 * each call site as a convention to remember instead of here, in one module a
 * vitest suite enforces.
 *
 * Pure by construction: no React, no `t`, no network. It returns **keys**, never
 * sentences, so the words stay in `src/locales/en/loy.json` where the rule wants
 * them.
 *
 * Deliberately **not** here: `gender` (🚩 looks closed, is not — `ModelMapping`
 * assigns whatever sign-up wrote, unvalidated; `GenderConst` holds the *words*,
 * so citing it fails the test), `nationality`, `cityCode`, `storeCode`,
 * `branchId` (open, table-backed, and no endpoint on the door), and
 * `trxType`/`docType` (already .NET enum names, English as data).
 */

/** Look a code up in a closed map, tolerating the nulls and blanks every string
 *  on the member model can be. The one place the degrade rule is spelled. */
const lookup = (map: Record<string, string>, code: string | null | undefined): string | null =>
  (code && map[code]) || null

/**
 * Tier — closed by `LoyEndpoints.GetTiers` (`LoyEndpoints.cs:1349`), which
 * constructs three `LoyTierModel` literals inline. There is no table behind it,
 * which is also why the screen spends no call on `Loy/Tiers`: a round-trip for a
 * compile-time constant is strictly worse than the constant.
 */
const TIER_KEYS: Record<string, string> = {
  S: 'tier.silver',
  G: 'tier.gold',
  P: 'tier.platinum',
}

export const tierKey = (code: string | null | undefined): string | null => lookup(TIER_KEYS, code)

/**
 * Member type — closed by `LoyMemberTypeConstants` (230). `M` is an ordinary
 * member and earns no chip at all; the other three are the fact the header
 * exists to state. Mapped through by the `LoyWeb` projection (230's first
 * amendment), so a null here means a door that has not landed it yet.
 */
const MEMBER_TYPE_KEYS: Record<string, string> = {
  M: 'memberType.member',
  N: 'memberType.nonLoyalty',
  A: 'memberType.archived',
  F: 'memberType.family',
}

export const memberTypeKey = (code: string | null | undefined): string | null =>
  lookup(MEMBER_TYPE_KEYS, code)

/**
 * Activity status — closed by `LoyActivityStatusConstants`. Consumed by the
 * Activities tab (236); it lives here because the rule lives here, and a second
 * codes module is how the rule starts being decided per-field again.
 */
const ACTIVITY_STATUS_KEYS: Record<string, string> = {
  A: 'activityStatus.added',
  P: 'activityStatus.posted',
  N: 'activityStatus.pending',
  E: 'activityStatus.error',
}

export const activityStatusKey = (code: string | null | undefined): string | null =>
  lookup(ACTIVITY_STATUS_KEYS, code)

/**
 * Blocked reason — 🚩 a **named exception** to the enumeration above, argued in
 * 230 and not a breach of the rule. `LoyMemberBlockedReason` is a mapped master
 * table, so the set is **open** and this map does not claim otherwise. `CM` and
 * `IA` earn keys because they are *code-bearing*, not seed data: `IA` is the
 * whole definition of `LoyMemberExtensions.IsInactive()`, and `CM` is written by
 * `LoyMemberSignUpService`/`LoyMemberUpdateService` on the old member when
 * another takes over their mobile — which is why "blocked" most often means
 * *this number has moved on*, the thing an agent on the phone must not miss.
 *
 * Because the set is open, the degrade path is not a formality here: an unseeded
 * `XZ` renders as `XZ`.
 */
const BLOCKED_REASON_KEYS: Record<string, string> = {
  CM: 'blockedReason.mobileMoved',
  IA: 'blockedReason.inactive',
}

export const blockedReasonKey = (code: string | null | undefined): string | null =>
  lookup(BLOCKED_REASON_KEYS, code)
