---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: 134
---

# 137 — The header-capture routes need a web door

## Question

[132](132-header-capture-inventory.md) found that header capture needs **no new server data** — every
lookup, customer call, address CRUD, and slot read the phase-1 CLCN order requires is already a live
SIS.Api endpoint. But every one of them carries `ApiKeyEndpointFilter` and nothing else, and a
browser must not carry the API key. That is the single real server-side gap in header capture, and it
is a door, not a contract.

Decide the door. The pattern is settled and documented at length in
`C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\Sd\SdDocumentWebEndpoints.cs:12-50` (ticket 125 /
spec 750): a cookie-only, grant-gated **sibling** route table whose handlers delegate to the existing
ones verbatim, so the two doors cannot drift. Crucially, the old door is **not edited** — the WPF call
center keeps running beside the web one through phase 1, and hanging a grant filter on
`SdDocumentEndpoints` / `SlotEndpoints` / `LoyEndpoints` would grant-check the API key's service
account and 403 the WPF screens.

Resolve:

- **The route list.** 132 §7 proposes ~15: `Cities` · `Districts` · `CustomerAddresses`
  (GET/POST/PUT/DELETE) · `CustomerAddresses/SetDefault` · `AddressLabels` · `DocumentSources` ·
  `DocumentSourceUsers/{userId}` · `DocumentTypes` · `StoreDetails` · `AvailableSlots/{storeCode}` ·
  `SlotIsActive` · `MemberByMobile/{mobile}` · `Member/{loyId}` · `SignUpByBranch` ·
  `ConfirmSignUpByBranch`. Confirm, trim, or extend it — and settle the tag (`CallCenterWeb/*`?),
  given `CallCenter/*` already exists for the submission hook.
- **The grant.** 134 decides who may open the console; the door and the access probe should share one
  key rather than inventing two. What is it, and does every route take the same one, or do the
  *write* routes (address CRUD, OTP signup) take a stricter one than the reads?
- **`CustomerAddresses/Touch`.** CC2 deliberately calls it only after the order commits
  (`ICustomerAddressBookService.cs:20-24`). If phase 1 keeps that, it is a server-side post-submit
  step inside [133](133-submission-path-server-side.md)'s path and does **not** belong on this door.
  Confirm.
- **The lookups this repo already calls ungated.** `DocumentSources`, `DocumentTypes`, `StoreDetails`,
  and `Districts` are live in `src/core/services/lookups.ts` today on the ungated `SdDocument/*` path,
  and 125 deliberately left them there because `StoreDetails` feeds the store switcher on every
  screen. Does the call center reuse those session-cached queries as-is, or does it need its own
  gated copies? Answering "reuse" is cheaper and is probably right for the four reference reads —
  but say so deliberately, because the reasoning does not extend to the customer and address routes.
- **`Slots/AvailableSlots/{storeCode}`.** Spec 750 OQ2 ruled it stays on its old path for the OMS
  reschedule dialog, "because it exposes slot availability for a store, not document data". That
  ruling was made for a read inside a screen already behind a grant. Re-decide it on this door's own
  terms rather than inheriting it.

### Settled by [134](134-access-and-authorization.md) — do not re-open

- **The grant is decided.** `CallCenterConsoleView` = `BackOfficeScreen[CallCenter,03]`, role
  `CALL_CENTER_AGENT`, seeded and gated by BackOffice
  [800](C:\Work\DMSCO\BackOffice\.issues\800-call-center-console-grant.md), which **deploys before**
  this door. So the second bullet above resolves to: **one grant for every route on the door**, reads
  and writes alike — the writes do *not* take a stricter one. What remains yours is the tag and the
  route list; the `…/Access` probe route follows whatever tag you pick.
- **The filter shape is decided**: `CallCenterGrantEndpointFilter` on the
  `OmsGrantEndpointFilterBase` pattern, requiring `CookieBranch.WasEntered` **explicitly** before
  reading the user id, because the api-key branch stamps a never-empty service account. That is also
  what keeps `CallCenter/SubmitOrder` unedited for WPF — so this door must not touch it.
- **Two candidate routes are removed before you start.** `Bby/GroupingMembers` and `Bby/Detail` get
  **no sibling**: near-miss prerequisites ship already resolved and ATP-filtered inside `getState()`,
  and the SAP "Display Bonus Buy" mirror is out of phase 1. The console touches no `Bby/*` route.

Backend work is minted as a BackOffice issue per Note 14. The outcome also feeds
[136](136-session-api-contract.md): the session verbs are new routes with no WPF twin, so they can be
born cookie-gated and may need no sibling at all — but that is 136's call, and it should be made
knowing what this door decided.

## Answer

Server work minted as BackOffice
[801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md); the exposure it does *not* close
is minted as [802](C:\Work\DMSCO\BackOffice\.issues\802-callcenter-pii-routes-ungated.md).

### 🚩 The ticket's premise was wrong, and correcting it halves the door

132 §7 concluded that because every header route carries `ApiKeyEndpointFilter` and nothing else,
"**none of these are callable from the web client as they stand**." That is false.
`ApiKeyEndpointFilter` is not an api-key filter — it is **cookie-session OR api-key**
(`C:\Work\DMSCO\BackOffice\Services\SIS.Api\Auth\ApiKeyEndpointFilter.cs:40-79`): when
`CookieAuth:Enabled` and an `sis_session` cookie is present it validates the CSRF header, validates
the session row, stamps `UserId`/`StaffId`/`StoreCode` **from the row** (browser-supplied
`staffid`/`storecode` headers explicitly ignored) and calls `next()`, never reaching the api-key path.
That is exactly why `SdDocumentWebEndpoints` uses it *as* its cookie gate (`:32-33`).

Every one of the ~15 routes is therefore **already reachable from the browser today**, and this repo
proves it: `src/core/services/lookups.ts:28-59` drives five of them live over cookies right now.

So the door was never about **reachability**. It is about **gating**, and the question reframes from
"which routes need a sibling to be callable" to "**which routes may any signed-in back-office session
call, and which need `CallCenterConsoleView`**". The route list falls out of that, and it is smaller
and better-motivated than 132's fifteen.

### The tag: `CallCenterWeb/*`, and it hosts everything

One tag, one `CallCenterGrantEndpointFilter`, one `CallCenterWeb/Access` probe — for the header
siblings, [131](131-item-search-endpoint.md)'s `ItemSearch`, **and**
[136](136-session-api-contract.md)'s session verbs. The verbs have no WPF twin so they are born
cookie-gated; putting them on a second tag would mean two tables and two filters to keep aligned for
no gain. `CallCenter/*` stays untouched for WPF `SubmitOrder` — the `Web` suffix is the whole
distinction, matching `SdDocumentWeb` / `UaAdminWeb` / `AuthzAdminWeb` / `UaSessionsWeb` /
`BbyInquiryWeb`. **136 inherits this**: its verbs go here, and it needs no sibling question of its own.

### Eight routes leave the door: reuse ungated, zero server work

`Cities` · `Districts` · `AddressLabels` · `DocumentSources` · `DocumentTypes` · `StoreDetails` ·
`AvailableSlots/{storeCode}` · `SlotIsActive`. No customer data in any of them; four are already
session-cached here; `StoreDetails` feeds the store switcher on every screen, so gating it would break
the shell for an admin-only user (125's standing warning at `lookups.ts:23-26` — the swap was
deliberately left unfinished and stays that way). **750 OQ2's slot ruling is re-confirmed on this
door's own terms, not inherited**: slot availability is store *operational* data, not document or
customer data, and the reasoning does not depend on the caller's screen.

### Nine routes stay, and the reason is PII and writes — not the API key

| Route | Why gated |
|---|---|
| `GET MemberByMobile/{mobile}`, `GET Member/{loyId}` | customer PII; the mobile route is an enumeration surface over the whole loyalty base |
| `POST SignUpByBranch`, `POST ConfirmSignUpByBranch` | mints a loyalty member via OTP |
| `CustomerAddresses` GET/POST/PUT/DELETE, `SetDefault` | reads and mutates a named customer's address book |

Plus `GET MyDocumentSources` and the `Access` probe (below).

### 🚩 Two routes are deliberately NOT verbatim — the "delegates verbatim" law breaks twice, and should

`SdDocumentWebEndpoints`' governing law is that every handler delegates verbatim so the two doors
cannot drift. Two cases here earn an exception, both for the same reason: **the original trusts a
client-supplied identifier that the cookie branch exists to distrust.**

1. **`DocumentSourceUsers/{userId}` → `CallCenterWeb/MyDocumentSources`, no path parameter.** The user
   id comes off the session row. A verbatim copy would let an agent read another user's source list —
   browser-supplied identity, which `ApiKeyEndpointFilter.cs:69-75` refuses on principle.
2. **The five `CustomerAddresses` routes are scoped to the active session's attached customer.** The
   originals are **unscoped**: `GetCustomerAddresses` takes a client-supplied `customerId` from the
   query string (`SdDocumentEndpoints.cs:1412`), and `DeleteCustomerAddress` takes **only an
   `addressNumber`** (`:1449`) — no customer reference whatsoever. A verbatim sibling would give any
   `CALL_CENTER_AGENT` the power to read any customer's address book by id and **delete any address in
   the estate by number**, unrelated to the call they are on. 134 ruled one grant admits the whole
   console, but it was ruling on *screen* access; it never ruled that unscoped object references were
   acceptable. Each of the five now resolves the agent's active engine session (127's
   one-active-order-per-agent), reads the attached customer, and refuses when there is no open
   session, no attached customer, or the target address belongs to someone else — for `DELETE`,
   resolving `addressNumber` → owner before acting.

   ⚠ **This is a new ordering constraint, not just a check.** The address book becomes unreachable
   before customer attach. That matches CC2's flow (find member → attach → pick address) so it costs
   nothing behaviourally, but it is now *enforced*, and it is a refusal state
   [135](135-agent-console-prototype.md) must draw and [136](136-session-api-contract.md) must carry
   in the contract.

   The four **lookup/signup** routes cannot be scoped this way — they are how the agent finds or mints
   the customer, so they *precede* attach. Grant-only is their whole boundary, and per-agent
   enumeration by mobile is inherent to the job.

### `CustomerAddresses/Touch` — confirmed off this door

CC2 calls it only after the order commits
(`Sartawi.POS/CallCenter2/Services/ICustomerAddressBookService.cs:20-24`). Phase 1 keeps that, so it
is a server-side post-submit step inside [133](133-submission-path-server-side.md)'s path and is never
client-callable.

### The probe

`GET CallCenterWeb/Access` — cookie-only, **not** grant-gated, answering 134's single boolean
`{ canOpenConsole }`. Grant-free on purpose: a session holding no grant must still be able to learn
that it holds none. Deploy order is unchanged and unforgiving — 800's seed, then every agent bound in
Authz Admin and query-verified, then this API.

### 🚩 Found on the way, and ruled out of scope: a live PII hole with no call center in it

The same correction that shrank this door exposes something that is true **today**, before any web
call center exists. Any signed-in back-office session — a warehouse user with only `DocumentList`, or
with no screen grant at all — can already call `Loy/MemberByMobile/{mobile}`, `Loy/Member/{loyId}`,
`SdDocument/CustomerAddresses` (read *and* write, including the unscoped delete), and
`Loy/SignUpByBranch`, because `ApiKeyEndpointFilter` alone is not an authorization check. Most of
`LoyEndpoints` (`ChangeMobile`, `BlockMember`, `ResetPassword`, the `Reports/*` reads) is unaudited
and carries the same filter.

801 does **not** fix it — it builds a sibling and leaves the originals untouched, because the WPF OMS
screen, the WPF call center, and the ecommerce integrations all drive those routes over `x-api-key`.
Owner ruling: **out of scope for this map** — the blast radius is past the destination and it is not
the call center's defect. Minted standalone as
[802](C:\Work\DMSCO\BackOffice\.issues\802-callcenter-pii-routes-ungated.md), which carries the
integration-safe fix shape (grant-check the cookie branch only, pass api-key callers straight through)
and the route audit it needs first.
