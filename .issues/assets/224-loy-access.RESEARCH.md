# 224 — Who may look a member up, and how the portal is let in

Research asset for wayfinder ticket 224 (map 222, *A Loy member, read-only, in the portal*).
Everything below is read from source in `C:\Work\DMSCO\BackOffice`, not inferred.

---

## Part 1 — Authentication: the browser **cannot** call `Loy/*` today

### What `ApiKeyEndpointFilter` actually is

`Services/SIS.Api/Auth/ApiKeyEndpointFilter.cs` is **not** api-key-only. It is *cookie-session
**OR** api-key*, in that order:

1. **Cookie branch** — taken when `CookieAuth:Enabled` (ON for the web-facing IIS instance) *and*
   the request carries the `sis_session` cookie. Identity comes strictly from the session row; the
   browser's `staffid`/`storecode` headers are ignored.
2. **Api-key branch** — the integration door: `x-api-key`, identity from the key's service account.

So the portal's session cookie *is* a currency this filter understands. That is not the blocker.

### The blocker: the cookie branch is **default-deny** (issue 802)

`ApiKeyEndpointFilter.cs:55` — before the CSRF header check and before the session lookup:

```csharp
if (!CookieSessionEligibility.IsAllowed(context.HttpContext))
    return Results.StatusCode(StatusCodes.Status403Forbidden);
```

`CookieSessionEligibility.IsAllowed` is true only when the endpoint carries
`AllowCookieSessionAttribute`, attached by `.AllowCookieSession()` in the route table.

**No `Loy/*` route calls `.AllowCookieSession()`.** A repo-wide grep for the marker returns
`AuthzAdminWeb`, `UaAdminWeb`, `UaSessionsWeb`, `CallCenterWeb`, `CallCenterWebSession`,
`CouponsAdminWeb`, `Nphies`, `NphiesSession`, `BbyInquiryWeb`, `BonusBuyDownloadWeb`, `Pricing`,
`Notification`, `SdDocument`, `SdDocumentWeb`, `Slot` — and nothing under `Endpoints/Loy/`.

> **A `fetch` from the portal to `Loy/Member/{loyId}` gets a bare 403 with no body, today.**
> Deliberately 403 and not 401: `core/api.ts` treats 401 as "session expired" and logs the tab out,
> so a missing marker must break one screen, never the whole session
> (`CookieSessionEligibility.cs`, "THE REFUSAL IS A BARE 403").

### And the marker must **not** simply be added to `Loy/*`

802's audit (`.issues/802-UNGATED-ROUTES.AUDIT.md` in BackOffice) counted 394 cookie-reachable
ungated routes and names `Loy/*` as its lead example, verbatim:

> *"including the whole of `Loy/*` (enumerate the loyalty base by phone number, change a member's
> mobile, reset their password, mint members over OTP)"*

`Loy` is one flat tag: the four reads this map wants sit in the same route table as `BlockMember`,
`ChangeMobileWithoutOtp`, `SaveNewPassword`, `RedeemPoints`, `TransferPoints`. `AllowCookieSession()`
is per-route so it *could* be applied to just the four — but the doc that defines the marker rules
even that out for this shape: it is for *(a) a grant-gated route, (b) an access probe, or (c) a
reference read carrying no customer, credential or money data.* A loyalty member read is (a)-only.
"Anything else belongs behind a gated `*Web/*` sibling door, not behind this marker."

### The established shape: a gated `*Web/*` sibling door

Three precedents, all the same construction:

| Door | Issue | Grant |
|---|---|---|
| `SdDocumentWeb/*` | 125 / 750 | `BackOfficeScreen[DocumentList,03]` / `[DocumentDetails,03]` |
| `CallCenterWeb/*` | 801 | `BackOfficeScreen[CallCenter,03]` |
| `Nphies/*` | 912 | `BackOfficeScreen[Nphies,03]` |

Each route is `.AllowCookieSession()` + `ApiKeyEndpointFilter` + a `*GrantEndpointFilter`, and the
handlers **delegate to the original `Loy*Endpoints` static methods** rather than duplicating them,
so the two doors cannot drift apart (750's rule).

### 🎁 Two of the four reads are **already built**

`Services/SIS.Api/Endpoints/CallCenter/CallCenterWebEndpoints.cs:157-158`:

```csharp
Gated(app.MapGet($"{Tag}/MemberByMobile/{{mobile}}", GetLoyMemberByMobile));
Gated(app.MapGet($"{Tag}/Member/{{loyId}}",         GetLoyMember));
```

Both delegate straight into `LoyEndpoints.GetLoyMember` / `GetLoyMemberByMobile` — same handler,
same payload, different gate — behind `BackOfficeScreen[CallCenter,03]`.

**One deliberate divergence the Loy screen inherits, and must not re-implement client-side:**
`CallCenterWeb/MemberByMobile` runs `LoyMobileNumbers.NormaliseTyped(mobile)` *before* delegating.
The WPF till has a country picker and builds `966555000111` itself; a browser agent types
`0555000111`, and the loyalty base is keyed on the full number. Found by driving the console live
(2026-07-29), and not inert: an existing member searched under their local number came back as *not
found*, and the console offered to enrol them a second time. Fixed server-side on purpose — "the
rule that builds the loyalty base's key lives in ONE place" (879 §4). **The oms-react search field
sends what the agent typed and the server normalises.** See map 222's ticket
*One field that resolves a member* (225).

**The three report reads have no web sibling anywhere.** `Loy/Reports/LastActivities`,
`Loy/Reports/LoyaltySales`, `Loy/Reports/LoyMemberActions` exist only on the api-key door.

---

## 🚩 BACKEND DEPENDENCY (stated separately, as the ticket asks)

> **Phase 1 cannot be built with zero server change.** Map 222's Notes say "no backend change is
> planned" and "a ticket that concludes one is needed must say so loudly." This is that ticket.

What is needed, minimally:

1. **A cookie-reachable, grant-gated door for the four reads.** Either a new `LoyWeb/*` endpoints
   file, or an extension of an existing one, each route `.AllowCookieSession()` +
   `ApiKeyEndpointFilter` + a grant filter, delegating to the existing `LoyEndpoints` /
   `LoyReportService` handlers. No new query, no new projection — a route table and a filter.
2. **A `<Tag>/Access` probe** on that door (cookie-only, *not* grant-gated — see Part 2).
3. **A screen-grant seed** (`Seed-*-Screen-Authorization.sql`) + agents bound to the role in Authz
   Admin, **deployed before** the SIS.Api carrying the filter, or the door locks out the floor it
   exists to admit (the warning `NphiesGrantEndpointFilter` carries in bold).

It is small and entirely patterned — but it is a server deploy, a SQL seed, and a deploy-ordering
constraint, and it gates the first ticket that writes `features/loy/api.ts`.

**The one route around it** — worth stating so the spec can weigh it, not recommended: bind the Loy
screen to `BackOfficeScreen[CallCenter,03]` and call the two existing `CallCenterWeb` member routes.
That ships the *general information* pane with no backend change at all. It buys nothing for the
three tabs (which are the screen), and it mis-labels the audience: a back-office loyalty analyst
would have to be granted the call-centre console to look a member up. Recorded as an option, not a
recommendation.

---

## Part 2 — Authorization: which permission, and which probe

### There is no loyalty screen grant in the new engine

The full set of `BackOfficeScreen` CONTROLLER values in use:

`AuthzAdmin` · `BbyDownload` · `BbyInquiry` · `CallCenter` · `CouponsAdmin` · `CouponsSupport` ·
`DepositPanel` · `DocumentDetails` · `DocumentList` · `Nphies` · `NotificationBroadcast` ·
`PosSimulation` · `PricingCache` · `UaSessions` · `UaUsers`

No `Loy`, no `IC`, no `Member`. COMMAND `03` is `Permissions.Activity.Display`
(`Sartawi.Core.Data/Permissions.cs:16`), i.e. screen-open; every screen door above uses `,03` and
none splits read from write.

### The WPF IC gate is legacy, and reusing its key is ruled out

`Sartawi.Retail/IC/ICController.cs:260-269` — `ControllerID => "IC"`, gated by
`Permissions.Check("IC", Permissions.Activity.Display)`. That is the **legacy `Permission` family**,
disjoint from the `Ua*` tables the web platform reads (map 420: the web platform is new-engine by
owner directive).

`NphiesScreenGate.cs:47-58` settles whether a WPF key may be reused, and says no:

> *"⚠ ITS OWN VALUE, deliberately NOT a reuse of the WPF panel's `NphiesPanel`. The BbyInquiry
> precedent reuses its WPF controller key because the WPF screen gates on the LEGACY `Permission`
> family, which is disjoint from `Ua*`. That is no longer safe here: POS screen authority is itself
> being hydrated out of the new engine (map 437), so a shared value would silently admit every store
> pharmacist holding the till's panel to an HQ web tool."*

The same argument applies with more force here: `"IC"` is held by the retail floor, and this screen
is customer PII. **Mint a new controller value** — `BackOfficeScreen[LoyMember,03]` is the natural
name (`LoyMemberWebView`-style role), its own gate class (`ILoyMemberScreenGate`) on the
`ScreenGate` pattern: reads `IAuthorizationService` directly, fail-closed on no userId / unseeded
grant / missing tables / any engine fault, and the engine's `*/*` wildcard covers superusers with no
hardcoded ADMIN bypass.

### There is no generic access probe — every door mints its own

Eleven exist, all `GET <Tag>/Access`: `AuthzAdminWeb`, `UaAdminWeb`, `UaSessions`, `CallCenterWeb`,
`CouponsAdminWeb`, `Nphies`, `BbyInquiryWeb`, `BonusBuyDownloadWeb`, `Pricing`, `Notification`,
`SdDocumentWeb`. The shape is fixed (`CallCenterWebEndpoints.cs:188`):

```csharp
app.MapGet($"{Tag}/Access", Access)
   .WithOpenApi()
   .AllowCookieSession()
   .AddEndpointFilter<ApiKeyEndpointFilter>()
   .AddEndpointFilter<CookieSessionOnlyEndpointFilter>();
```

Two invariants worth carrying into the spec:

- **Cookie-only, but NOT grant-gated** — "it must answer a session that holds NOTHING, or such a
  user could never learn that they hold nothing." It is the one route on the door *not* behind the
  grant filter, and every other route re-checks the grant independently.
- **The probe and the filter read the same gate object**, so they can never disagree. The probe is
  UX; the grant is the boundary.

So: **no probe exists for loyalty, and one would have to be added** — as part of item 2 of the
backend dependency above.

### The portal side of the probe

`src/layout/menu-model.ts` — `accessProbe({ key, run, visible })`. The `key` **must equal** the
screen guard's react-query key so the shell's probe and the page's own guard share one cache entry
and make one network call. The shell reads `visible(data)` only on a resolved success: **pending OR
error ⇒ hidden**, fail-closed, no flash-then-hide. Every leaf in `MENU` carries a probe; an ungated
one is the exception and needs a reason.

### The graceful-degradation precedent, and why it does *not* transfer

`src/core/bonus-buy/api.ts:40-62`. `GET Bby/Access` does not exist in SIS.Api; a 404 or network
error is caught and mapped to `{ screenAllowed: true, probed: false }` — **unknown ⇒ shown** — with
the reasoning that the list endpoint's own `403 ACCESS_DENIED` remains the authoritative boundary,
so a degraded probe costs a wasted navigation at worst. The `probed` flag lets a stricter caller
refuse the degradation (the Simulation rail gates on `probed && screenAllowed`).

**That trade does not transfer to this screen.** It was written for a read-only *bonus-buy* inquiry
— promotion metadata, no personal data. Here "unknown ⇒ shown" would put a **customer PII** screen
in the nav of every signed-in back-office user, and the reason it was tolerable there — that the
data endpoint refuses anyway — only holds once the gated door of Part 1 exists. Absent that door
there is nothing behind it refusing at all.

**Recommendation for the spec:** this screen degrades **closed**. If the probe is missing or errors,
the leaf stays hidden — which is already the shell's default for a failed probe, so it needs no
special code, only the absence of a bonus-buy-style `catch`.

---

## Summary for the spec

| Question | Answer |
|---|---|
| Can the browser call `Loy/*` today? | **No.** Bare 403 from `ApiKeyEndpointFilter`'s default-deny cookie branch (802). |
| Does `core/api.ts` need anything new? | **No.** Cookie + `X-Web-Client` CSRF header is exactly what the filter wants. The gap is entirely server-side. |
| Fix? | A grant-gated, `.AllowCookieSession()` `*Web/*` sibling door delegating to the existing handlers. 🚩 **backend dependency.** |
| Already built? | `CallCenterWeb/Member/{loyId}` + `/MemberByMobile/{mobile}` — 2 of 4 reads, behind the *call-centre* grant. The 3 report reads have no web sibling. |
| Mobile normalisation | Server-side (`LoyMobileNumbers.NormaliseTyped`); the client sends what was typed. |
| Which permission? | **None exists.** Mint `BackOfficeScreen[LoyMember,03]` + its own `ScreenGate`. Do **not** reuse WPF `"IC"` (legacy family, retail-floor audience) or `CallCenter,03` (wrong audience). |
| Probe endpoint? | **None exists.** Add `GET <Tag>/Access`, cookie-only, not grant-gated, reading the same gate. |
| Degrade on a missing probe? | **Closed** (hidden). The bonus-buy "unknown ⇒ shown" precedent is for non-PII and does not transfer. |
