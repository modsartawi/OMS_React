---
type: wayfinder-ticket
wayfinder: grilling
map: 222
status: done
blocked-by: 223
---

# 229 — A code the server did not translate

## Question

[What the four Loy reads actually return](223-what-the-four-loy-reads-actually-return.md) settled
which values arrive decoded and which do not. Three come with English attached — activity
`Description`, action `MainActionDescription`/`SubActionDescription`, and the action row's
`CityName`. Everything else is a bare code:

| Code | Where | Decoder available? |
|---|---|---|
| `Tier` (`S`/`G`/`P`) | member | `GET Loy/Tiers` — and the three tiers are **hardcoded in the endpoint itself** |
| `BlockedReason` | member | `GET Loy/MemberBlockedReasons` (see [230](230-a-member-who-is-blocked-or-archived.md)) |
| `Gender`, `Nationality`, `CityCode` | member | **none** — no endpoint at all |
| `ActivityStatus` (`A`/`P`/`N`/`E`) | activities | none — a four-value closed set |
| `ActivityType` | activities | already joined to `Description` |
| `StoreCode`, `BranchId` | sales, activities, actions | none on this screen |
| `TrxType`, `DocType` | sales | already .NET enum **names**, English, as data |

Decide, once, the rule this screen follows — because the answer differs per code and an ad-hoc
choice per field is how a screen ends up showing "S" next to "Silver" next to "Not blocked":

- **Pass through** the code as data (permitted by [i18n-zero-literal](../.claude/rules/i18n-zero-literal.md):
  server-supplied text is data, not a literal).
- **Translate in the app** — a `t()` key per known code. Legitimate for a closed set the server will
  not extend (`ActivityStatus`, and arguably `Tier`), a trap for an open one (city, nationality).
- **Fetch the lookup** — spend a call on `Loy/Tiers` / `Loy/MemberBlockedReasons` and join client-side.

Note the trap the rule names: a `t()` call with no backing key renders the raw key to the user, so
translating an open-ended code set is worse than passing it through. And note the divergence the
inventory found — `BlockedReason` is a **code** on the member payload and a **description** on the
action row, so the same-named field cannot share a decode path.

Standing preference: read-only and simple — the answer that ships the smaller phase 1 wins ties.

## Answer

**A code is data unless its value set is closed in server source.** One rule, six clauses, checkable
at review — settled by grilling, and no live SIS.Api was involved (nor could be: the door does not
exist; see [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md)).

### 1. No lookup calls — the third option was never a client-side choice

The ticket offered "spend a call on `Loy/Tiers` / `Loy/MemberBlockedReasons`". It dies, for a reason
the ticket could not see when it was written: **228 ruled the `LoyWeb/*` door carries the four reads
and nothing else.** Those two lookups are routes five and six, so "fetch the lookup" is not a
client-side decision at all — it is a request to widen a backend dependency that is already this
map's critical path and has not been minted yet.

It buys least where it costs least, too. `GET Loy/Tiers` is **not a query** — `LoyEndpoints.GetTiers`
(`LoyEndpoints.cs:1349`) constructs three `LoyTierModel` literals inline and returns them; there is no
table behind it. A round-trip to fetch a compile-time constant is strictly worse than the constant.

**Phase 1 spends no request on either lookup. The door stays at exactly the four reads.**

### 2. What earns a `t()` map: the set is closed in server *source*

A code may be translated in-app **only if its complete value set is fixed in C# source we can read and
cite** — not in a database table. A ticket claiming translation must **name the `.cs` file that closes
the set**; if it cannot, the code passes through. That makes the line checkable rather than a
per-field judgement, which is the ad-hoc drift this ticket was raised to prevent.

Admitted — exactly two:

| Code | Set | Closed by |
|---|---|---|
| `Tier` | `S` `G` `P` | `LoyEndpoints.GetTiers` literals (`LoyEndpoints.cs:1349`) |
| `ActivityStatus` | `A` added · `P` posted · `N` pending · `E` error | `LoyActivityStatusConstants` |

### 3. Everything else passes through as data

Permitted by [i18n-zero-literal](../.claude/rules/i18n-zero-literal.md) — server-supplied text is
data, not a literal.

- **Open / table-backed, no endpoint anywhere:** `Nationality`, `CityCode`, `StoreCode`, `BranchId`.
- **Table-backed with an endpoint we are not calling:** `BlockedReason` on the member (clause 1).
- **Already English, untouched:** activity `Description`, `MainActionDescription`,
  `SubActionDescription`, action-row `CityName`, and `TrxType`/`DocType` (already .NET enum *names*).
- 🚩 **`Gender` passes through, despite being two values in practice.** It looks like a closed set and
  is not one: `ModelMapping.cs:22` assigns `Gender = member.Gender` raw, and the only mapping in the
  codebase (`"F" ? Female : Male`, `LoyFamilyProfileService.cs:647`) lives in the *family-profile*
  service, which this screen does not call. `LoyMember.Gender` is whatever sign-up wrote, unvalidated.
  `GenderConst` holds the words `"Male"`/`"Female"`, not codes — so citing it would fail clause 2's
  test. This is the clause that proves the rule bites.

### 4. An unknown value degrades to the code itself, never a raw key

The trap the ticket named. A closed set is closed until the server extends it, so the translation path
must be a **pure module** that maps known values to a key and returns `null` otherwise; the component
renders `t(key)` when there is one and the **bare code** when there isn't:

```ts
// src/features/loy/member/codes.ts — pure, unit-tested
const TIER_KEYS = { S: 'tier.silver', G: 'tier.gold', P: 'tier.platinum' } as const
export const tierKey = (c: string | null) => (c && TIER_KEYS[c]) ?? null
// Tier 'X' → renders "X", never "loy:tier.X"
```

Two properties matter. The fallback **is** the default rule, so an unknown code is never worse than an
untranslated one. And a pure module is provable by a vitest suite — the proof standard this map
accepts, since nothing here can be driven live. Not `t(key, { defaultValue: code })`: same pixels, but
the guard lives at each call site as a convention to remember instead of in one module a test enforces.

### 5. A passed-through code is labelled as a code

WPF's Account view labels `CityCode` **"City"** and shows `0021` — a label promising a decoded name it
does not have. This screen writes **"City code"**, **"Nationality code"**, **"Store code"**. Costs
nothing and closes a misread that would otherwise reach the spec unowned by any ticket.

This clause governs *wording of the code's own label only*. Whether and where a field appears stays
with [What each tab puts in a row](226-what-each-tab-puts-in-a-row.md) and
[The shape of the member screen](227-the-shape-of-the-member-screen.md).

### 6. `BlockedReason` gets two names, because it is two fields

The divergence 223 found: **code** on `LoyMemberModel`, **joined description** on the action row —
same server field name, different content. Both pass through under clause 3, so display is settled;
the risk is a typing trap. The model layer therefore names them apart, each citing the divergence:

```ts
// src/core/models/loy.ts
interface LoyMember          { blockedReasonCode: string | null }        // the CODE (no lookup — clause 1)
interface LoyMemberActionRow { blockedReasonDescription: string | null } // already joined English (223)
```

Structural, so it holds even if [A member who is blocked, or archived](230-a-member-who-is-blocked-or-archived.md)
decides not to surface the reason at all. 230 keeps the whole question of *whether and how loudly*
blocked status is stated; 229 only guarantees no single decode path can be written for both.

### What this hands the spec

No new backend ask (the door is unchanged at four routes), one small pure module with a vitest suite,
two `t()` key groups in `src/locales/en/loy.json` (`tier.*`, `activityStatus.*`), and a review test any
future ticket can be held to: **name the `.cs` that closes the set, or pass it through.**
