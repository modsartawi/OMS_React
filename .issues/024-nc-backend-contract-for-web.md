---
type: wayfinder-ticket
wayfinder: research
map: 023
status: done
blocked-by: —
---

# 024 — Notification Center backend contract for the web client

## Question

What is the exact HTTP contract the oms-react portal consumes to be a full NC client, and what
does each endpoint require/return? Produce a research note (linked asset) covering:

- **Poll** (`GET Notifications/Poll?watermark=`): request headers (x-api-key, storecode, staffid,
  the `x-presence` throttle header — and confirm the web BO caller sends **no** `registerid`), the
  watermark/delta semantics (0 = cold-start full active set), and the **poll-item response shape**
  (`Services/Models/NotificationPollModels.cs` — fields: NotificationId, TypeCode, Title, Body,
  Status, CreatedAt, DeadlineAt, ExpiresAt, DisplayStyle, ReadScope, IsRead, NavRoute, EntityKind,
  EntityId, ClaimedBy*…). Note which fields drive the badge, ordering, banner, and routing.
- **Claim** (`POST Notifications/{id}/Claim`): the `NcClaimResult` shape (Won, Status,
  ClaimedByDevice/StaffId/At), the `NC_NOT_CLAIMABLE` / `NC_NOT_FOUND` / `NC_NOT_AUDIENCE` errors,
  and which TypeCodes are Claim-scope. **Confirm claim works for a BO (no-registerid) caller.**
- **Read** (`POST Notifications/{id}/Read`): device requirement (staffid as device for BO), and
  which ReadScope types actually receipt server-side vs. are read-by-claim.
- **Create/broadcast** (`POST Notifications`): `CreateNotificationRequest` fields, the
  `HttpCreatableTypes` allow-list (Broadcast/JobDone/NcTest), `AudienceKind` values (All/Store/User)
  + `AudienceKey` rules, `ExpiresAt` validation, and the `NotificationBroadcast` permission gate.
- **Wake hub** (`MapHub NotificationHub`): the SignalR path + contract (`NcHubContract`,
  `NcHubWakeConnector`) — enough to judge it as a later enhancement, not to build now.
- **Enablement flag** (`NotificationCenter:Enabled`): behaviour when disabled (routes 404).
- **Constants** (`NcConstants.cs`): TypeCodes, statuses, read scopes, display styles, nav routes.

Reference: `NotificationEndpoints.cs`, `Sartawi.Retail.Data\Modules\NotificationCenter\`, and the
POS consumer for how each field is actually used. Output: a Markdown note linked from this ticket.

## Answer

Full contract dig captured as a linked, spec-ready research note:
[024 — NC backend contract (research)](024-nc-backend-contract-for-web.RESEARCH.md). It traces
every endpoint, field, and code back to source under `C:\Work\DMSCO\BackOffice\`. Key findings:

- **BO no-registerid caller fully works for Poll + Claim + Read.** `GetCallerIdentity`
  (`NotificationEndpoints.cs:320–337`): absent `registerid` → `AppKind="BO"`, audience
  **User+All**, **device = staffid**. Poll/Claim need only a non-empty `staffid`; **Read is the
  one endpoint that hard-requires a non-empty device** (`NC_NO_DEVICE`) — for BO that means the
  `staffid` header must be present/non-empty. All refusals are HTTP 400 `success:false` with the
  machine code in `Errors[0].ErrorCode` (`NC_NOT_CLAIMABLE`, `NC_NOT_AUDIENCE`, `NC_NOT_FOUND`,
  `NC_FORBIDDEN`, `NC_BAD_*`) — exactly the api-envelope "business outcome" shape.
- **Broadcast is server-gated by a new-auth check.** `Create` enforces
  `BackOfficeScreen[CONTROLLER='NotificationBroadcast', COMMAND='01']` on the caller's staffid
  whenever `TypeCode==BROADCAST` **or** `AudienceKind==All`; **fail-safe DENY** (any engine
  fault/missing tables → `NC_FORBIDDEN`). Only `BROADCAST`/`JOB_DONE`/`NC_TEST` are HTTP-creatable
  (`HttpCreatableTypes`); order types are producer-only. Store/User-scoped creates stay ungated.
- **Watermark is a SQL ROWVERSION-as-BIGINT, not a timestamp/id.** Cold start `watermark=0` →
  full active audience set; client rides the server-returned watermark verbatim. Arrival-vs-change
  is a client-side rowversion diff — there is no server "isNew" label.
- **Badge / list / banner / routing are all client-derived** from denormalized poll-item fields:
  badge = `Status==Active` ∧ not-expired ∧ not-`IsRead`; list order = `CreatedAt` desc; banner =
  `DisplayStyle` (Toast/Banner) + fresh `CreatedAt` + `PlaySound` + `DeadlineAt`; routing =
  `NavRoute` + `EntityId`. **No server unread-count, list, or bulk-read endpoint exists** — the
  poll result is the whole model.
- **Enablement:** `NotificationCenter:Enabled` OFF ⇒ routes never mapped ⇒ **404** (a definite
  "feature off" signal). SignalR wake hub (`/hubs/notifications`, single empty `Wake`) is a
  latency-only enhancement; its client half isn't compiled yet — poll-only is fully supported v1.
- **Gap flagged for the spec:** routable OMS order types (`NEW_ORDER`/`SLA_ORDER`) are minted
  **Store**-audience by the in-process producer, so a BO no-registerid caller never sees them
  today. Surfacing order alerts to back-office users needs a producer/audience decision the source
  does not settle — feeds the deep-link route-map fog and receive-scope ticket 026.
