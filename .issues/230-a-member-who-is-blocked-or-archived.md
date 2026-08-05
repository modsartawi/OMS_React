---
type: wayfinder-ticket
wayfinder: grilling
map: 222
status: done
blocked-by: 223
---

# 230 — A member who is blocked, or archived

## Question

The field inventory is in ([What the four Loy reads actually return](223-what-the-four-loy-reads-actually-return.md)),
and member status turns out to be two separate problems, not one.

**Blocked.** `LoyMemberModel.BlockedReason` is a **reason code**, empty when the member is not
blocked. WPF derives its whole status field from exactly that
(`BlockedReason.IsNullOrEmpty() ? "Active" : "Blocked"`). Decide:

- Does phase 1 state member status at all, and how loudly — a quiet field in the header, a badge, or
  a banner that colours the whole screen? The screen has no act, so a blocked member changes nothing
  an agent can *do* here; the case for prominence is that it changes what the agent *says* on the
  phone.
- Does the screen decode the reason code? That costs a second call to `Loy/MemberBlockedReasons`
  (`ReasonCode` + `Description`), which WPF loads once and caches statically. Or does phase 1 show
  the bare code, or nothing but "Blocked"?

**Archived — the divergence.** `GET Loy/Member/{loyId}` **refuses** an archived member with
`LOY-00101`; `GET Loy/MemberByMobile/{mobile}` has **no archived check at all** and returns them
normally. So the same member is found or refused depending on which key the agent typed. Decide what
the portal does with that: normalize to the stricter reading (refuse both ways), the looser one
(show, marked archived — but the LoyId path *cannot*, without a server change), or accept the
asymmetry and say so. Whatever lands here constrains
[One field that resolves a member](225-one-field-that-resolves-a-member.md) — an archived member
found by mobile and then re-read by LoyId would refuse.

**Inactive** is a third status the error codes know about (`LOY-00011 CustomerIsInactive`) that
**no read on this screen ever surfaces** — it is raised by the act endpoints, not the lookups. Rule
on whether that means phase 1 simply has no notion of inactive.

Standing preference for this effort is read-only and simple: the smaller phase 1 wins ties.

## Answer

**Two chips in the member header, and one amendment to the door.** Nothing was driven against a live
SIS.Api — this is a source-read decision, per the map's verification standard.

### The ticket's premise was wrong in one place, and it changes the shape of the answer

`LoyMemberExtensions` (`Sartawi.Retail.Data/Modules/Loy/Extensions/LoyMemberExtensions.cs`) defines
status in two lines:

```csharp
public static bool IsBlocked(this LoyMember m)  => m.BlockedReason.IsNullOrEmpty() == false;
public static bool IsInactive(this LoyMember m) => m.BlockedReason == LoyMemberBlockedReasonConstants.Inactive;
```

So **inactive is not a third status — it is a blocked *reason*** (`IA`), and inactive ⊂ blocked. The
member read *does* surface it. `LOY-00011 CustomerIsInactive` is raised only by
`LoyMemberSignInService` (an act), which is why it never reaches this screen — but the *state* it
names arrives here through `BlockedReason` like any other block. Phase 1 therefore has a notion of
inactive and builds nothing extra for it.

`LoyMemberBlockedReasonConstants` holds exactly two codes: `CM` = ChangeMobile, `IA` = Inactive.
**`CM` is machine-set**, by `LoyMemberSignUpService:565` and `LoyMemberUpdateService:749`, on the
*old* member when another member takes over their mobile. So the commonest meaning of "blocked" on
this screen is *this is a stale account whose number has moved on* — which is precisely the thing an
agent on the phone must not miss, and settles the prominence question against a quiet field.

### Blocked — a chip, decoded client-side

- **A chip beside the member name, rendered only when `BlockedReason` is non-empty.** An ordinary
  unblocked member gets **no chip at all**: silence is the Active state. (This refines the first cut
  of an always-present neutral "Active" chip — the user's chosen shape has no such chip.)
- **The screen decodes the code with `t()` over the closed set**, not with a call:
  `CM` → "Mobile moved to another account", `IA` → "Inactive", **anything else falls back to the bare
  code**. Keys land in `src/locales/en/loy.json` per
  [i18n-zero-literal](../.claude/rules/i18n-zero-literal.md).
- **`Loy/MemberBlockedReasons` is not called and does not go on the door** — the same conclusion
  [A code the server did not translate](229-a-code-the-server-did-not-translate.md) reached
  independently, where it is route six. The door stays at the four reads
  [228](228-whether-phase-1-waits-for-the-door.md) fixed, and no session pays a lookup call.
- 🚩 **A named exception to 229's enumeration, not a breach of its rule.** 229 ruled that a code earns
  a `t()` map only when its value set is **closed in server source**, and enumerated exactly two that
  qualify — `Tier` and `ActivityStatus`. `BlockedReason` does **not** qualify on that test and this
  answer does not claim it does: `LoyMemberBlockedReason` is a mapped master table read through
  `LoyMemberRepository.GetMemberBlockedReasons()`, and `LoyMemberBlockedReasonConstants` names only
  the two rows the *code writes*, exactly the way `Gender` looks closed and isn't. The set is open.
  It still earns keys for `CM` and `IA` specifically, because those two are **code-bearing**: `IA` is
  the whole definition of `IsInactive()`, and `CM` is written by
  `LoyMemberSignUpService`/`LoyMemberUpdateService` — they are branch conditions, not seed data. The
  pass-through fallback means this is a *superset* of 229's degrade rule and never asserts the set is
  closed; an unseeded `XZ` renders as `XZ`, never as a raw `loy:blockedReason.XZ`. 229's author may
  want to fold this in as a third entry with its own justification.

### Archived — normalized to the looser reading, and the door pays for it

The divergence is real and confirmed at source: `LoyMemberService.GetLoyMemberModel` throws
`LOY-00101` when `MemberType == "A"` (line 93); `GetLoyMemberModelByMobile` has **no such check**.
Worse, **`LoyMemberModel` carries no `MemberType` field at all** — so today a mobile hit on an
archived member is *indistinguishable* from a live one. Accepting the asymmetry does not merely give
two answers for one member; it lets the screen present an archived account as current with no tell.

**Ruling: the portal normalizes to the looser reading, and the `LoyWeb` door carries it.** Two lines
on the door issue:

1. The `LoyWeb` member projection **maps `MemberType` through** (the field is already on the
   `LoyMember` entity; this is a mapping line, not a new query or report).
2. The `LoyWeb` LoyId read **drops the `LOY-00101` archived refusal**, so both keys resolve the same
   member. `Loy/*` and `CallCenterWeb/*` are untouched — only the new door relaxes.

🚩 **This amends [228](228-whether-phase-1-waits-for-the-door.md)**, which specified the door as
delegating to the existing handlers with *no new query or projection*. The amendment is deliberate
and cheap because the BackOffice door issue is **not minted yet** — it is minted at the `/to-spec` →
`/to-tickets` hand-off, so this must ride into it there or it is lost.

For [One field that resolves a member](225-one-field-that-resolves-a-member.md): the constraint that
ticket was warned about **dissolves**. An archived member found by mobile and re-read by LoyId no
longer refuses. 225 is free to design the resolution rule without an archived special case.

### Member type — a second, independent chip

`LoyMemberRepository.GetMemberByMobile` is `FirstOrDefaultAsync(c => c.Mobile == mobile)` — **no
member-type filter, and no uniqueness**. Once `MemberType` is exposed, the screen can receive all
four of `LoyMemberTypeConstants`: `M` membership, `N` non-loyalty customer, `A` archived, `F` family.

**A member-type chip renders whenever the type is not `M`** — Archived · Non-loyalty · Family —
**independently of the blocked chip.** Two orthogonal facts shown orthogonally: there is no
precedence rule to write or get wrong, and an archived-and-blocked member never has one fact hidden
behind the other.

```
M, not blocked   →  Ahmed Al-Fulan
M, CM            →  Ahmed Al-Fulan  ⬤ Blocked · Mobile moved to another account
A, not blocked   →  Ahmed Al-Fulan  ⬤ Archived
A, IA            →  Ahmed Al-Fulan  ⬤ Archived   ⬤ Blocked · Inactive
N, not blocked   →  Ahmed Al-Fulan  ⬤ Non-loyalty
```

Chip tone and placement are [The shape of the member screen](227-the-shape-of-the-member-screen.md)'s
to draw, off the steel-blue POS palette — this ticket fixes *what is said*, not how it looks.

### Knock-on — none

A blocked or archived member changes **nothing else**. All three tabs and the whole
general-information block render identically for every status: the report reads carry no archived or
blocked check server-side, so suppressing anything would be a client-invented rule, and on a
read-only screen with no act the agent's need is more information, not less. No points-balance
caveat either — the reads expose no redeemability fact, so that line would be an assumption the API
never made. [What each tab puts in a row](226-what-each-tab-puts-in-a-row.md) and 227 stay free of
status branching.

### Where this sits against 229

[A code the server did not translate](229-a-code-the-server-did-not-translate.md) resolved
concurrently with this ticket and the two **agree** on everything they share: no lookup call, the
door holds at four reads, and an unknown code degrades to the bare code through a pure, unit-tested
`codes.ts`. This answer adds `CM`/`IA` to that module as the exception argued above, and adopts
229's model-layer naming — `blockedReasonCode` on the member, `blockedReasonDescription` on an action
row — so the chip reads `blockedReasonCode` and the Actions tab is unaffected.
