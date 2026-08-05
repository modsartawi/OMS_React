---
type: wayfinder-map
status: done
---

# 222 — A Loy member, read-only, in the portal

## Destination

A **ready spec** (`/to-spec` → `/to-tickets`) for a read-only Loyalty member lookup in oms-react:
one search field resolves a member by mobile **or** LoyId, and the screen shows their general
information plus three tabs — **Activities**, **Sales**, **Actions** — each off an SIS.Api `Loy/*`
endpoint that already exists today. Phase 1 changes nothing about the member; there is no act on
this screen. Reached when every decision below is settled and the spec can be written without
another question.

## Notes

- **Domain:** loyalty (Loy). The WPF original is `C:\Work\DMSCO\BackOffice\Sartawi.Retail\IC` —
  eleven view-models, of which this effort takes four: `SearchViewModel`, `AccountViewModel`,
  `PointsViewModel` (last activities), `SalesViewModel`, `MemberActionsViewModel`.
- **The server side already exists.** `C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\Loy\LoyEndpoints.cs`
  serves all four reads: `GET Loy/Member/{loyId}`, `GET Loy/MemberByMobile/{mobile}`,
  `GET Loy/Reports/LastActivities/{loyId}`, `GET Loy/Reports/LoyaltySales/{loyId}`,
  `GET Loy/Reports/LoyMemberActions`. ~~**No backend change is planned**~~ — 🚩 **superseded twice
  over.** [Who may look a member up](224-who-may-look-a-member-up.md) found the reads are shut to the
  browser (802's default-deny cookie branch), and
  [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md) settled what
  follows: **a `LoyWeb/*` door is a BackOffice dependency, and the client does not wait for it.** No
  new query, projection or report — the door delegates to these same handlers — so the client builds
  against **mocked envelopes taken from 223's field inventory**, the Nphies-wave practice. Read the
  standing preference on verification below before starting any build ticket.
- 🚩 **Verification standard, set by
  [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md):** no ticket on
  this map may be called done on the strength of a live call — the door will not exist. Proof is
  `typecheck` + pure-module suites + a Playwright drive against **stubbed** envelopes, and each
  ticket's answer says out loud that nothing was driven against a live SIS.Api.
- 🚩 **The door is four reads *plus two lines*, amended by
  [A member who is blocked, or archived](230-a-member-who-is-blocked-or-archived.md).** 228 specified
  `LoyWeb/*` as pure delegation with no new query or projection; 230 found that holding to that lets
  the screen present an archived member as a live one, because `LoyMemberModel` carries **no
  `MemberType`** and `MemberByMobile` has no archived check. So the door issue must also carry:
  (1) the `LoyWeb` member projection **maps `MemberType` through** (a mapping line — the field is
  already on the `LoyMember` entity), and (2) the `LoyWeb` LoyId read **drops the `LOY-00101`
  archived refusal**, so both keys resolve the same member. `Loy/*` and `CallCenterWeb/*` are
  untouched; only the new door relaxes. **The door issue is not minted yet** — it is minted at the
  `/to-spec` → `/to-tickets` hand-off, so these two lines must ride into it there or they are lost.
  Still no new query, report, or phase-2 act.
- 🚩 **The browser sends what the agent typed.** Mobile normalisation is server-side and always has
  been (`LoyMobileNumbers.NormaliseTyped`, 879 §4) — no dialling-code prefixing, no `PadLeft`, no
  client-side country rule anywhere in `features/loy/`. The rule that builds the loyalty base's key
  lives in one place.
- **The one place WPF has no endpoint:** its Sales tab queries `RetailTrxDetail` straight out of
  NHibernate. Decided at charting and **reaffirmed by the user**: the web takes whatever
  `Loy/Reports/LoyaltySales` gives, columns differ, and **no new endpoint is created for it**.
- **WPF is a source, not a target.** The user's ruling: divergence is wanted, not tolerated. IC is
  where the *data* and the *domain rules* are read from — never the layout, the control choices, or
  the interaction. This is why the interaction/call half of IC is out of scope in the first place:
  the point of the rebuild is a better screen, not the same screen in a browser. A ticket that
  justifies a decision with "because that's what WPF does" has answered the wrong question; the
  right one is what the app's own design language would do. Reach for
  [logical-tailwind](../.claude/rules/logical-tailwind.md), the steel-blue POS palette that is the
  app standard, and the shapes the call-centre and Nphies screens already established — this screen
  should look like it was always part of the portal, not like a port.
- **Placement decided at charting:** a new `features/loy/` area under `/loy/*`, its own nav group —
  per [feature-structure](../.claude/rules/feature-structure.md), a new area folder appears when a
  new nav group does. Phase 2 (modifications, family, complaints) has room to land beside it.
- Skills: `/research` for the endpoint and permission tickets, `/prototype` for the layout,
  `/grilling` + `/domain-modeling` for the rest. `CONTEXT.md` is the glossary — add Loy vocabulary
  as it is pinned down.
- Standing preference for this effort: **read-only, and simple.** When a decision could go either
  way, take the one that ships a smaller phase 1.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [What the four Loy reads actually return](223-what-the-four-loy-reads-actually-return.md) — the
  full field inventory ([asset](assets/223-loy-reads-field-inventory.RESEARCH.md)): standard
  envelope, **no backend change needed for the data**, a miss is a business 400 on the member call
  only (the tabs answer `[]`), `branchId` is a currency knob the portal should not pass, Activities
  caps silently at 100 and Sales at 500 while Actions is the one truly paged read,
  `LoyMemberActions` without `LoyId` returns the **whole estate**, `Member/{loyId}` refuses an
  archived member where `MemberByMobile` does not, and the WPF Sales user loses every money
  breakdown below the line total.
- [Who may look a member up, and how the portal is let in](224-who-may-look-a-member-up.md) —
  🚩 the browser **cannot** reach `Loy/*`: 802 made `ApiKeyEndpointFilter`'s cookie branch
  default-deny and no Loy route carries the opt-in, so a portal call gets a bare 403. `core/api.ts`
  needs nothing; the gap is a gated `*Web/*` sibling door (the `SdDocumentWeb`/`CallCenterWeb`/
  `Nphies` pattern), a new `BackOfficeScreen[LoyMember,03]` + fail-closed screen gate, and its own
  `Access` probe — none of which exist. Two of the four reads are already built as
  `CallCenterWeb/Member*` behind the *call-centre* grant, with mobile normalisation done
  **server-side**; the three report reads have no web sibling. Degrade closed, not open.
- [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md) — **it does not,
  and it does not compromise either**: the tracks run in parallel, client against mocked envelopes
  from 223's inventory, the Nphies-wave practice — so the general-information-only slice on the
  call-centre grant is **dead and recorded as such**. The door is a **BackOffice issue the spec
  cites under Boundaries**, minted at the `/to-spec` → `/to-tickets` hand-off, not a ticket here:
  a new **`LoyWeb/*`** tag carrying the four reads **and nothing else** (no phase-2 acts designed
  in), its own `LoyWeb/Access` probe, and a newly minted **`BackOfficeScreen[LoyMember,03]`** with a
  fail-closed gate, a seed deployed **before** the API, and an Authz Admin role binding.
  `CallCenterWeb` keeps its two routes; both doors delegate to the same statics. 🚩 **The trap it
  found:** `NormaliseTyped`'s only production caller is the *call-centre door*, not the handler — so
  a `LoyWeb` that correctly "delegates to the existing handler" delegates **past** the normalisation
  and reproduces the live-driven not-found/duplicate-enrolment bug verbatim. The door issue must say
  so in those words. Ticket 228 holds the six-item spec of what that issue must carry.
- [What each tab puts in a row](226-what-each-tab-puts-in-a-row.md) — the three column sets, concrete
  enough to write the spec from: **Activities** six (Points the signed headline), **Sales** eight
  (Item the headline, Currency conditional), **Actions** seven with the **whole member snapshot
  dropped**. Capped tabs **always state the ceiling** and warn at the cap; Actions states its real
  total and pages 25. Sort/filter on what is held, never on what is paged. Lazy fetch ⇒ only the open
  tab can fail, and it fails inline with a tab-scoped Retry. **No row links** (no route takes these
  identifiers) and **no export** in phase 1 (a capped list becomes a file that outlives its caveat) —
  which **resolves and clears the Export fog item**. 🚩 **Two corrections to
  223**, both from source: `Points` is **already signed** (`AddActivity` negates `SpendPoints` for
  debits — no client-side debit/credit table), and Sales money is **multi-currency** (Bahrain BHD
  stores are live at 3 decimals), so "always 2dp" holds for points but not for riyals. A return line
  also carries signed `Qty`/`Amount` but an **unsigned `UnitPrice`**.
- [A code the server did not translate](229-a-code-the-server-did-not-translate.md) — one rule, six
  clauses: **a code is data unless its value set is closed in server *source***. So **no lookup call**
  — `Loy/Tiers` and `Loy/MemberBlockedReasons` are routes five and six and the door stays at four
  (and `GetTiers` is three C# literals, not a query, so the round-trip buys nothing). Exactly two
  codes earn a `t()` map, `Tier` and `ActivityStatus`, each citing the `.cs` that closes it;
  everything else passes through, **including `Gender`** — it looks closed and isn't, since the member
  read hands over whatever sign-up wrote. An unknown value **degrades to the bare code** via a pure
  unit-tested `codes.ts`, never a raw `loy:tier.X`. A passed-through code is labelled **"City code",
  not "City"** (wording only — placement stays 226/227's). And `blockedReasonCode` /
  `blockedReasonDescription` are split at the model layer, since 223 found the same server field name
  carries a code on the member and a joined description on the action row.
- [A member who is blocked, or archived](230-a-member-who-is-blocked-or-archived.md) — **two
  independent chips in the member header**, no precedence rule: a member-type chip whenever the type
  is not `M` (Archived · Non-loyalty · Family), and a blocked chip whenever `blockedReasonCode` is
  set — an ordinary unblocked member gets **no chip at all**. The reason is decoded client-side,
  `CM` → "Mobile moved to another account" / `IA` → "Inactive", passing through anything else; this
  is a **named exception to 229's enumeration, not a breach of its rule** (the set is a master table
  and genuinely open, but both codes are branch conditions in server logic). **Inactive is a blocked
  *reason*, not a third status** — `IsInactive() ≡ BlockedReason == "IA"` — so phase 1 has a notion of
  it and builds nothing for it, and `LOY-00011` never reaches a read. 🚩 **Archived normalizes to the
  looser reading, which amends the door** (see Notes): both keys resolve the same member, so the
  archived constraint on [One field that resolves a member](225-one-field-that-resolves-a-member.md)
  **dissolves**. Nothing else on the screen branches on status.
- [One field that resolves a member](225-one-field-that-resolves-a-member.md) — **there is no
  discrimination rule; the field never classifies what was typed.** `resolveMember(typed)` calls
  `LoyWeb/MemberByMobile/{typed}` and, **only** on a `LOY-00100` business miss, `LoyWeb/Member/{typed}`
  — WPF's fallback survives inverted: it retried after guessing wrong, this retries *because* a
  shape rule goes stale the day the number range rolls over. The sequence lives **client-side** in
  `features/loy/api.ts`, not a fifth door route, so 228's door holds at four reads and the rule is a
  pure module — the one thing provable with SIS.Api down. 🚩 The cascade condition is the correctness
  crux: 224's ungranted call returns a **bare 403**, so cascading on anything would render the shut
  door *and every outage* as "no member matches". The field **compacts to digits and nothing else**,
  because 🚩 `LoyMobileNumbers.Parse` never strips internal separators and a pasted
  `+966 55 500 0111` misses **server-side today**. The box is never rewritten; a double miss is a
  neutral client sentence in an empty state; submit is explicit. 🚩 **Ambiguity does not exist** —
  one mobile resolves to at most one member *by construction*, so WPF's family-lookup dialog is dead
  code and no disambiguation UI is built — and the try-both rule **cannot collide**, since a LoyId is
  9 pure digits while `NormaliseTyped` always searches a dialling-code-prefixed key.

- [The shape of the member screen](227-the-shape-of-the-member-screen.md) — three variants drawn light
  and dark in the shipped POS palette ([asset](assets/227-member-screen.PROTOTYPE.html)) and reviewed
  live: **B taken — the field collapses into an identity bar.** `/loy/members` is a centred hero field
  and nothing else; a resolved member replaces it and the field becomes a slim bar carrying **the
  searched key only**, the name living in exactly one place — the header. Rejected: A (search card as
  permanent furniture — simplest, but ~86 px of chrome above a scanning screen) and C (a lookup rail —
  the only variant where comparing two members is cheap, but ~250 px against an eight-column Sales tab),
  **so session recents die with C**. 🚩 **The member is in the URL — `/loy/members/:loyId`, tab as
  `?tab=…` — which resolves and clears the *URL shape and deep-linking* fog item**, with the
  consequence named: the URL holds the **LoyId, never what was typed**, so a refresh re-reads by key
  and does not replay 225's cascade. Header **not a tab and not sticky**; **one** headline number
  (`PointsBalance`, the SAR figure its subline); **one** disclosure, shut, over the field tail, with
  the engine machinery (`Profile`, the two factors, `ExchangeRate`, `PointsExpireSoonDays`) drawn
  nowhere; **Activities lands** and **only Actions carries a count**, because a count on a capped tab
  would be a lie. Nothing driven against a live SIS.Api.

## Not yet specified

- **The phase-2 seam.** Where a future modification act (block, tier change, points adjustment)
  would attach, so phase 1 doesn't paint itself into a corner. Deliberately dim: naming it early
  invites building it.

## Out of scope

- **Every mutating Loy act** — block/unblock, tier update, change mobile, redeem, transfer,
  compensation, activate. Phase 1 is a read. This is the user's ruling, not a discovery.
- **The other seven WPF IC views** — Call, Complain, ComplainItem, ICFamilyMembers, ICHistory,
  Redistribution, UpdateDistribution. The case-management half of IC is a different effort.
- **`Loy/Reports/LastPurchases`** — a fourth read the API offers that no WPF view uses; three tabs
  were asked for and a fourth is not one of them.
- **Faithfully reproducing the WPF Sales grid** — see Notes; the endpoint's shape wins.
- **WPF's Activity Summary grid and its Old Account (Mobile) field** — the year/month summary
  (last visit date · last visit store · net sales · redeem amount · visits count) off a read this map
  never named, and a field read straight from the legacy `LoyaltyCustomer` table with no endpoint at
  all. Surfaced as fog by
  [What the four Loy reads actually return](223-what-the-four-loy-reads-actually-return.md) and put to
  the user as a destination question on 2026-08-06: **ruled out — "obsolete."** The destination stands
  at general information plus three tabs; this does not graduate.
