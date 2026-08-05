---
type: wayfinder-ticket
wayfinder: grilling
map: 222
status: done
blocked-by: —
---

# 228 — Whether phase 1 waits for the door

## Question

[Who may look a member up](224-who-may-look-a-member-up.md) found what the map's Notes said must be
said loudly: **phase 1 cannot be built with zero server change.** Every `Loy/*` route is closed to
the browser by `ApiKeyEndpointFilter`'s default-deny cookie branch (issue 802), and the marker that
would open it is reserved for routes that already carry a grant. The four reads need a gated
`*Web/*` sibling door, an `Access` probe, and a screen-grant seed — small, entirely patterned, but a
server deploy with a deploy-ordering constraint, and it gates the first ticket that writes
`features/loy/api.ts`.

That is a scoping decision the map cannot make for itself. Grill it:

**1. Does phase 1 wait, or route around?** The one way around is to bind the screen to
`BackOfficeScreen[CallCenter,03]` and call the two `CallCenterWeb` member routes that already exist
— which ships the general-information pane with no backend change, does nothing for the three tabs
that are the point of the screen, and grants a loyalty analyst the call-centre console. 224 records
it as an option, not a recommendation. Is a general-information-only slice worth anything on its
own, or is a screen without its tabs not a screen?

**2. Who builds the door, and when?** It is BackOffice-repo work (`Services/SIS.Api/Endpoints/`,
`Sartawi.Retail.Data/Modules/`), not oms-react's. Does it become a ticket on this map, a separate
BackOffice issue this map blocks on, or a precondition the spec simply states? Note that map 222's
Notes currently assert "no backend change is planned" — whichever way this goes, that line needs
rewriting.

**3. Confirm the grant.** 224 recommends minting `BackOfficeScreen[LoyMember,03]` with its own
fail-closed screen gate, rather than reusing WPF's legacy `"IC"` (retail-floor audience, legacy
`Permission` family) or `CallCenter,03` (wrong audience). Confirm the name and that a *new* grant —
with the SQL seed and the Authz Admin role binding that come with it — is acceptable rather than a
reuse, since an unseeded grant locks the screen out of the floor it exists to admit.

**4. Which routes the door carries.** The four reads, or the four plus room for phase 2's acts?
The map's standing preference is the smaller phase 1; the counter-argument is that a door built once
with the acts' shape in mind costs nothing extra now.

Read [224-loy-access.RESEARCH.md](assets/224-loy-access.RESEARCH.md) before grilling — it holds the
filter mechanics, the three precedent doors, and the two routes that already exist.

## Answer

**Phase 1 does not wait, and does not compromise. The two tracks run in parallel.**

**1. Neither waiting nor routing around — the question was a false binary.** The ticket offered
"wait" or "ship the info pane on the call-centre grant"; the user took the third answer, which is
this repo's own established practice. All twelve tickets of the Nphies wave (spec 209) were built
and verified against **mocked envelopes** with SIS.Api down and every server endpoint unbuilt, while
BackOffice 912–922 ran as a parallel track; the two met at drive time. The same shape applies here,
and it is a better fit than it was there — 224's door needs no new query, projection or report, so
the envelopes the client mocks against are exactly the ones
[What the four Loy reads actually return](223-what-the-four-loy-reads-actually-return.md) already
inventoried from source. The mock cannot drift from the contract because the contract is a field
list read off C# classes, not a design.

🚩 **The consequence the build must carry:** no oms-react ticket on this map may be called done on
the strength of a live call. Verification is `typecheck` + the pure-module suites + a Playwright
drive against stubbed envelopes, and the ticket says so — the same standard the Nphies wave held to,
including saying out loud in each answer that nothing was driven against a live SIS.Api.

**The general-information-only slice is dead.** Recorded here so it is not re-proposed: it buys the
info pane, buys nothing for the three tabs that are the screen, and grants a loyalty analyst the
call-centre console.

**2. The door is a BackOffice issue the spec cites, not a ticket on this map.** Wayfinder here stays
planning-only (map 222's Notes carry no execution override), and the code lives in another repo. It
is minted in `C:\Work\DMSCO\BackOffice\.issues\` at the `/to-spec` → `/to-tickets` hand-off — the
912–922 precedent, where the server issues were minted with the build tickets and each cited the
contract by section — and named under the spec's **Boundaries**, not left as prose. **Not minted by
this session**: it is the hand-off's act, and the BackOffice tracker has its own numbering that a
concurrent session would race. Everything it needs is specified below.

**3. `BackOfficeScreen[LoyMember,03]`, confirmed as recommended.** New controller value, its own
fail-closed `ScreenGate` (`ILoyMemberScreenGate`) on the established pattern. Not WPF's legacy
`"IC"` — retail-floor audience, disjoint `Permission` family, and `NphiesScreenGate`'s ruling that a
shared value would silently admit every store pharmacist to an HQ tool applies with more force to a
PII screen. Not `CallCenter,03` — wrong audience. Accepted with it: a SQL seed **deployed before the
API**, and agents bound to the role in Authz Admin, or the door locks out the floor it exists to
admit.

**4. A new `LoyWeb/*` tag carrying the four reads and nothing else.** Own grant, own `GET
LoyWeb/Access` probe (cookie-only, **not** grant-gated, reading the same gate object). Phase-2 acts
are not designed into it — the map's standing preference is the smaller phase 1, and a door built
"with the acts in mind" invites exactly the scope questions the destination ruled out. Not an
extension of `CallCenterWeb/*`: that is the cheapest diff and the wrong audience, the same objection
that killed option 3 twice over.

**Consequence — `CallCenterWeb` keeps its two routes.** `LoyWeb` carries all four reads including
its own `Member`/`MemberByMobile`, both doors delegating to the same `LoyEndpoints` statics. Two
doors over one handler is 750's no-drift rule working as designed, not duplication.

### 🚩 The trap this ticket found, which 224 surfaced without connecting

`LoyMobileNumbers.NormaliseTyped` lives in the shared data module
(`Sartawi.Retail.Data/Modules/Loy/Services/LoyMobileNumbers.cs:119`) — but its **only production
caller is `CallCenterWebEndpoints.cs:230`**, the web door. `LoyEndpoints.GetLoyMemberByMobile` does
not call it.

So a `LoyWeb` door that follows the no-drift rule and delegates straight to the existing handler
**delegates past the normalisation**, and reproduces verbatim the bug found by driving the console
live on 2026-07-29: an existing member searched under `0555000111` comes back *not found* against a
base keyed `966555000111` — which on the call-centre screen offered to enrol them a second time.

**The normalisation is a property of the web door, not of the handler.** `LoyWeb/MemberByMobile`
must call `NormaliseTyped` before delegating, exactly as `CallCenterWeb` does, and the door issue
must say so in those words — because "delegate to the existing handler" is otherwise the correct
instruction and it is the instruction that breaks this. The BackOffice tests at
`Tests/Data.Tests/CallCenterWeb/CallCenterWebMemberLookupTests.cs` already pin the behaviour
(`0501234567` → `966501234567`, `971…`/`+973…` pass through, junk → empty) and the new door should
be held to them.

This settles the client half too, and
[One field that resolves a member](225-one-field-that-resolves-a-member.md) inherits it: **the
browser sends what the agent typed.** No dialling-code prefixing, no `PadLeft`, no client-side
country rule — the rule that builds the loyalty base's key stays in one place, server-side (879 §4).

### What the BackOffice door issue must carry

1. New `LoyWeb/*` endpoints file. Four routes, each `.AllowCookieSession()` +
   `ApiKeyEndpointFilter` + `LoyMemberGrantEndpointFilter`, delegating to `LoyEndpoints.GetLoyMember`
   / `GetLoyMemberByMobile` and the three `LoyReportService` reads. No new query or projection.
2. 🚩 `MemberByMobile` applies `LoyMobileNumbers.NormaliseTyped` **before** delegating (above).
3. 🚩 `LoyMemberActions` must not be reachable without a `LoyId` — called bare it returns the first
   25 member actions **of the whole estate**
   ([What the four Loy reads actually return](223-what-the-four-loy-reads-actually-return.md)). The
   door is the right place to make that unrepresentable.
4. `GET LoyWeb/Access`, cookie-only, not grant-gated, same gate object as the filter.
5. `BackOfficeScreen[LoyMember,03]` + `ILoyMemberScreenGate`, fail-closed on no userId / unseeded
   grant / missing tables / any engine fault; engine `*/*` wildcard for superusers, no ADMIN bypass.
6. `Seed-*-Screen-Authorization.sql` **deployed before** the API, plus the Authz Admin role binding.
