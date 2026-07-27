---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 134 — Who may open the call center, and what the door refuses

## Question

Note 13: the screen sits behind an access probe that **fails closed**. What is behind it mints real
OMS orders, so this is the ticket-125 situation, not the `Notifications/Access` one.

- **The grant.** What is it called, where is it seeded, and who holds it? Ticket 125's OQ1 is the
  likeliest failure and applies here verbatim: the current call-center team must be **bound to the
  role before the gate ships**, or it locks out the people it admits. Name the seeding step.
- **The probe.** Endpoint shape (`…/Access` returning capability booleans), the single cache key
  shared by the nav leaf and the route guard so a gated screen costs one call, and `staleTime`
  matching the menu's (125 hit a real bug where a mismatched one emptied the nav under a working
  screen).
- **Capabilities, not one boolean.** Does the probe answer `canOpenConsole` only, or also
  `canSubmitOrder` / `canApplyCoupon`? Server enforcement is mandatory regardless — the probe is
  show/hide hygiene, never the enforcement.
- **Server-side enforcement** on every session verb. A web session verb is a write door; the
  grant filter must sit on the endpoints, not only on the screen.
- **Store scoping.** May any admitted agent create an order for **any** fulfilment store, or is the
  set constrained? This interacts with the store switcher already in the shell.
- **Refusal copy.** 125's late fix: a failed probe must say the check is unavailable, not tell an
  entitled operator to request a grant they already hold.

## Answer

Grilled with the owner 2026-07-27. **One grant admits the whole console**, it carries no store
dimension, and the two surfaces that looked like they needed a second grant turn out not to exist in
phase 1. Server work minted as BackOffice
[800](C:\Work\DMSCO\BackOffice\.issues\800-call-center-console-grant.md) — the **DB + gate half**,
deliberately split from the route table the way [749](C:\Work\DMSCO\BackOffice\.issues\749-oms-web-screen-grant-seed.md)
was split from [750](C:\Work\DMSCO\BackOffice\.issues\750-sddocument-web-door.md). 800 deploys first;
[137](137-callcenter-web-door.md) is the 750 analogue.

### 1. One grant — open implies act

| | |
|---|---|
| `AuthorizationId` | `CallCenterConsoleView` |
| Object | `BackOfficeScreen` |
| `CONTROLLER` / `COMMAND` | `CallCenter` / `03` (Display) |
| Role | `CALL_CENTER_AGENT` (SCREAMING_SNAKE, per `OMS_AGENT` / `BBY_INQUIRY`) |

Owner ruling. If you can open the console you can add items, change quantity, void a line, attach a
customer, apply a coupon, rebind the store, and **submit**. This is 749's own ruling reused —
`BackOfficeScreen[DocumentDetails,03]` is what the OMS *write* doors read
(`SdDocumentWebEndpoints.cs:33-38`) — and it matters that map note 4 already stripped every
price-affecting power from the verb list (`ChangePrice`, `ManualCondition`, `Discount`, `OpenPrice`,
`SetPrice` are exposed nowhere), so there is **no dangerous verb left to single out**. A
build-but-not-submit tier was considered and rejected: it produces a stuck agent, not a safer one,
while still consuming a claim, a transaction row and a sweeper slot.

Consequence worth stating: this is why the ticket's "capabilities, not one boolean" bullet resolves
*to* one boolean. The probe answers `{ canOpenConsole }` and nothing else.

### 2. Where "how many grants" is really decided

There is **no generic `RequireGrant` attribute** in this codebase — I grepped the tree, zero hits.
The house pattern is **one `IEndpointFilter` subclass per grant** (11 of them in
`Services/SIS.Api/Auth/`), each delegating to a screen gate in Retail.Data that calls
`IAuthorizationService.Check` directly, bypassing the `Permissions` static facade so it is
independent of `AuthorizationFeature.IsUsingNewAuthorization` (OFF for BackOffice). So "how many
grants" literally equals "how many filter classes plus how many seed rows", which is what made it
the first branch to settle.

### 3. 🚩 The cookie-branch requirement is load-bearing, and the ticket didn't name it

`OmsGrantEndpointFilterBase.cs:57-67` requires `CookieBranch.WasEntered` **explicitly**, before
reading the user id — not merely a non-empty `UserId`:

```csharp
if (!CookieBranch.WasEntered(context.HttpContext, _cookieAuthOptions))
    return Results.StatusCode(StatusCodes.Status403Forbidden);
var userId = context.HttpContext.GetUserAction().User;
if (string.IsNullOrEmpty(userId) || !await CanOpenAsync(userId))
    return Results.StatusCode(StatusCodes.Status403Forbidden);
```

Because `ApiKeyEndpointFilter.cs:133-134` stamps a never-empty **service account** `UserId` on the
api-key branch, an `IsNullOrEmpty`-only guard would silently grant-check that service account. This
matters more here than it did for OMS: `CallCenter/SubmitOrder`
(`CallCenterSubmissionEndpoints.cs:28-31`) is api-key-only and WPF drives it *today*. The
cookie-branch check is the exact mechanism that lets the WPF call center keep running beside the web
one through phase 1 with its endpoint **byte-identical and unedited** (pin it the way 750 pinned
`SdDocumentEndpoints` with `TheIntegrationDoor_IsUntouched`).

Refusal is a **bare 403 with no body** — `ACCESS_DENIED` exists only as doc prose in 750.

### 4. Store scoping — none, because the material gate is stronger

The grant carries `CONTROLLER` + `COMMAND` only. An admitted agent may bind an order to **any**
fulfilment store. Three reasons, in order of weight:

1. In the CLCN flow the store is not picked, it is **derived** from the address's district
   ([132](132-header-capture-inventory.md)) and **pinned at the address act**
   ([129](129-rebind-store-door.md)).
2. The only free choice is 129's rebind, and that is already constrained *materially*: the door
   **refuses atomically**, naming any line that no longer prices at the new plant. A store that
   cannot serve the basket is rejected by the basket, not by a permission list — a better gate, and
   one already being built.
3. There is nothing to constrain against. `StoreSwitcher.tsx:12-15` documents `SdDocument/StoreDetails`
   as deliberately broader than real permissions (AR-2), and **no per-user `Auth/Stores` endpoint
   exists**.

A store field on the authorization object *is* expressible in the Ua model and was considered for a
regional-team split; it was rejected as fighting the premise of a central call center.

### 5. The two surfaces that looked like they needed a second grant

**Grouping members.** [130](130-potential-bby-prerequisites.md) flagged that `Bby/GroupingMembers` is
gated on `BackOfficeScreen[BbyInquiry,03]` — a back-office inquiry grant a call-center agent has no
business holding. Resolved by **removing the client call entirely**: the near-miss guidance ships its
prerequisite items **already resolved and ATP-filtered** inside `getState()`. 130 had already ruled
ATP filtering into SIS.Api and identified `PricingContext.BuildSimulationResult` as the promotion
seam, so this costs nothing new — it is one payload shape rather than one route plus one grant plus a
round trip per card, and it keeps prerequisite resolution server-side where note 3 wants it. This is
a **contract ruling for [136](136-session-api-contract.md)** and a brief for
[138](138-near-miss-guidance-design.md).

**The bonus-buy detail modal.** Ticket 118 put the SAP "Display Bonus Buy" mirror in `@/core/`, gated
on the Bby probe. **Ruled out of phase 1.** Note 10 says guidance is actionable, not informational,
and 138 already rules the card may promise a discount *definition* and never a savings total. Validity
windows, access sequences and condition tables are back-office vocabulary; an agent on a call needs
"add two more of these". So the console touches **no `Bby/*` route at all** and `[BbyInquiry,03]`
stays purely a back-office grant.

### 6. The probe, and where it lives

`GET <tag>/Access` → `{ canOpenConsole }`, carrying `ApiKeyEndpointFilter` +
`CookieSessionOnlyEndpointFilter` and **no grant filter** — like `SdDocumentWeb/Access`
(`SdDocumentWebEndpoints.cs:85-88`) it must be able to answer a user who holds nothing. The **tag**
(`CallCenterWeb`?) is [137](137-callcenter-web-door.md)'s to settle with the route list; the probe
route follows it, and nothing else here depends on that choice.

Client side, following 125 rather than re-deciding it:

- The probe stays in **`features/callcenter/api.ts`, not `@/core/`**. `layout/` importing a feature's
  own access call is explicitly allowed by `feature-structure.md`, and unlike ticket 118's case there
  is no second feature consuming it. (If a second one ever appears, it graduates — it does not get
  copied.)
- `CALLCENTER_ACCESS_KEY = ['callcenter','access']` is an **exported constant**, because a re-spelled
  inline literal silently splits the cache and costs a second request — the reason `OMS_ACCESS_KEY`
  and `BBY_ACCESS_KEY` are constants while seven other keys still aren't.
- `staleTime: Infinity, retry: false` on **both** the menu observer and the route guard. A mismatched
  pair is the real bug 125 hit: the page-side observer refetched on mount and could empty the nav
  group under a working screen.
- **Fails closed** — no 404/network-tolerant catch, unlike `Notifications/Access` and `Bby/Access`.
  Same reasoning as `core/oms/api.ts:31-37`: what is behind it mints real orders. The endpoint ships
  with 800, so there is no window in which a tolerant catch would be doing anything useful.

**The probe is show/hide hygiene and never the enforcement.** Every route on the door carries the
filter; a client that skips the probe gains nothing.

### 7. Nav placement

Its own **top-level nav group** ("Call center" → "Console"). `features/callcenter/` is neither `oms/`
nor `admin/`, and `feature-structure.md` says a new area folder appears exactly when a new nav group
does — so it earns one. The leaf carries the probe with the **same exported key** the route guard
uses, which is the one-call invariant this ticket asked for.

### 8. 🚩 The refusal is a dead end unless the console builds its own exit

Note 13 says the console renders its **own full-viewport layout**. But `ProtectedLayout.tsx:34`
renders `<AppShell/>` unconditionally once hydrated, and AppShell owns the nav — so a chrome-less
console has to come out from under that, and a refused agent has **no nav to click away from**,
unlike every existing denied card in this repo.

Ruled: a **full-viewport refusal carrying one explicit link back to the portal**. It keeps 125's
explain-don't-redirect ruling (a deep link must not silently teleport, or the operator never learns
whether they were refused or the check merely failed), at the cost of the console owning an exit
affordance every other screen gets from the nav for free. Copy is the **five-key** form the two OMS
screens use — `access.checking` / `deniedTitle` / `deniedHint` / `unavailableTitle` /
`unavailableHint` — in a `callcenter` namespace; note that this five-key split exists **only** on the
OMS screens today, every other screen carries the three-key form. **This is a state
[135](135-agent-console-prototype.md) must draw.**

### 9. 🚩 The cutover prerequisite — 125's OQ1, and worse here

The ticket named this as the likeliest failure and it is. Three facts compound:

- Seed scripts **bind no holder** by convention — `Seed-Oms-Screen-Authorization.sql:14-18`: *"WHO
  holds the role is a deliberate admin decision."*
- The **sole** runtime path that mints the `UaUser` shell is **first role assignment in Authz Admin**
  (`AuthzAdminWebService.cs:617-625`). `UpsertEmployeeAsync` writes `UaEmployee` only. Until that
  assignment happens, `AuthorizationSnapshotLoader` answers every probe with an empty list —
  **silently**. A fully employed, fully activated call-center agent holds nothing.
- Deploy ordering is load-bearing and repeated in four places for OMS: the **seed goes onto the DB
  before the SIS.Api carrying the filter**, or every user is refused.

OMS absorbed this because it is a handful of back-office users. A call center is a shift-staffed
floor. Owner ruling: **keep the convention** — bind per user in Authz Admin, which is also what mints
the shell. Do *not* hand-mint `UaUser` rows in the seed script; that would duplicate
`AuthzAdminWebService`'s rule in a second place where it can drift. What changes from 125 is that it
stops being a warning and becomes a **named, query-verified cutover step** the spec carries and the
map's Rollout item schedules.

`ADMIN_ROLE`'s `*/*` wildcard (`BackOfficeAdminAll`) admits the console for free, and is what makes
that first binding possible at all.

### What this hands forward

| To | Ruling |
|---|---|
| [137](137-callcenter-web-door.md) | The grant is `CallCenterConsoleView` = `BackOfficeScreen[CallCenter,03]` — **one grant for every route on the door**, reads and writes alike, so the "same one or stricter for writes?" bullet resolves to *the same one*. The tag is still 137's to pick. `GroupingMembers` and `BbyDetail` are **removed** as route candidates. |
| [136](136-session-api-contract.md) | `getState()` carries guidance whose prerequisites are already resolved to eligible items and ATP-filtered server-side. |
| [138](138-near-miss-guidance-design.md) | No bonus-buy detail modal in phase 1; the card promises a definition, and its only affordance is the add. |
| [135](135-agent-console-prototype.md) | Three access states to draw: checking, denied, and check-unavailable — full-viewport, chrome-less, each carrying a way back to the portal. |
| Map fog (Rollout) | Per-agent binding in Authz Admin becomes a named, verified cutover step. It is a build prerequisite, not an open decision, so it earns no ticket. |
