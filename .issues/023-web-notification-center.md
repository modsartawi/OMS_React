---
type: wayfinder-map
status: done
---

# 023 — Web Back-Office Notification Center

> **MAP DONE** — destination reached: combined spec
> [031 — Web Back-Office Notification Center](031-web-notification-center-spec.md) is `ready`.
> Handoff: `/to-tickets` on 031 for the build. Deferred future efforts (SignalR wake; back-office
> order alerts) are recorded in the spec's Out of Scope, not open frontier.

## Destination

A **ready spec** (handed off via `/to-spec` → `/to-tickets`) for a Notification Center in the
oms-react back-office portal, in the spirit of the POS NC
(`C:\Work\DMSCO\BackOffice\Sartawi.POS\Notifications`) but adapted to a browser back-office
audience. Two halves, both in scope:

- **Receive** — a top-bar bell + unread badge, a notifications list/panel (newest / soonest-SLA
  on top), deep-link routing into web screens, an in-app banner/toast on fresh arrivals, and
  per-row **Claim** (first-register-wins). Driven by **polling** `Notifications/Poll` with the
  back-office identity (no `registerid` → `User+All` audience, device = staffid).
- **Send** — a broadcast/compose admin screen posting `POST Notifications` with channel/audience
  targeting (all / stores / back-office), gated by the `NotificationBroadcast` grant.

The map is done when every decision below is locked and the spec(s) are `ready`. No production
oms-react code is a deliverable of the map itself.

## Notes

- **Domain glossary:** `CONTEXT.md`. Keep NC vocabulary consistent (audience, read scope, claim,
  watermark, display style, nav route, presence).
- **Skills:** `/research` (AFK contract digs), `/grilling` + `/domain-modeling` (the decisions),
  `/prototype` (bell/panel/compose UX), `/to-spec` then `/to-tickets` at the end.
- **Repo rules that bind the build:** feature-structure (`features/admin/…` for the compose
  screen; the bell is cross-cutting chrome in `layout/`), i18n-zero-literal, api-envelope (all
  calls through `src/core/api.ts`), logical-tailwind.
- **Backend reference (SIS.Api, already shipped — NotificationCenter issues 164–172):**
  - HTTP surface: `C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\Notifications\NotificationEndpoints.cs`
    — `GET Notifications/Poll?watermark=`, `POST Notifications/{id}/Claim`,
    `POST Notifications/{id}/Read`, `POST Notifications` (Create/broadcast),
    `GET Notifications/Presence`, `MapHub NotificationHub`.
  - Data module + client: `C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\NotificationCenter\`
    (`Services/Models/*`, `Client/NotificationClient.cs`, `Client/NotificationPresenter.cs`,
    `NcConstants.cs`, PRD `NOTIFY-CENTER.PRD.md`).
  - POS consumer (behaviour reference): `C:\Work\DMSCO\BackOffice\Sartawi.POS\Notifications\`
    (`POSController.Notifications.cs`, `NotificationCenterController.cs`).
- **Identity fact already established:** a caller with no `registerid` header is a BackOffice user
  → `User+All` audience, device = staffid, `AppKind = "BO"`. The web portal is exactly this caller.
- **Broadcast grant fact:** `POST Notifications` with `TypeCode=Broadcast` or `AudienceKind=All`
  requires the caller's staffid to hold `NotificationBroadcast` (server-side permission service).

## Decisions so far

<!-- one line per resolved ticket; zoom the link for detail -->

- [Web app identity & session fit for the NC](025-web-identity-session-fit.md) — no identity-header gap: `Notifications/*` reads identity from claims (`GetUserAction`), which `ApiKeyEndpointFilter`'s cookie branch mints from `sis_session` — so the web client polls as-is with cookie + `X-Web-Client` (`AppKind=BO`, `User+All`, `DeviceKey=StaffId=userId`). Real gaps are small & client-side: `api.get` needs a per-request header passthrough (for `x-presence: skip`); read-receipts are already per-user (drop POS local `_ncReadIds`); watermark in-memory is fine; store-scoped items don't reach a BO caller. Config prereq `CookieAuth:Enabled` already on.
- [Notification Center backend contract for the web client](024-nc-backend-contract-for-web.md) —
  full HTTP contract dug to source ([note](024-nc-backend-contract-for-web.RESEARCH.md)): the BO
  no-registerid caller works for Poll+Claim+Read (device=staffid; Read alone hard-requires a
  non-empty staffid); badge/list/banner/routing are all client-derived from denormalized poll-item
  fields (no server unread-count/list/bulk-read); watermark is a ROWVERSION bigint (0=cold-start);
  broadcast is fail-safe-DENY gated on `NotificationBroadcast[01]`; only Broadcast/JobDone/NcTest
  are HTTP-creatable; `NotificationCenter:Enabled` OFF ⇒ 404; SignalR wake is a later enhancement.
  **Gap:** routable order types (`NEW_ORDER`/`SLA_ORDER`) are Store-audience today, so a BO caller
  never sees them — a producer/audience decision for receive-scope (026) + the deep-link fog.
- [Broadcast channel/audience model](027-broadcast-channel-model.md) — v1 compose = **two channels
  within the existing contract, no server dependency**: **All** (`AudienceKind=All`) and **Store**
  (`AudienceKind=Store`, one storecode via the existing open-stores picker). "Back-office only" and
  multi/all-stores are **out of v1** (BO-group audience isn't server-expressible; accepted, not a
  cross-repo change). Every send is `TypeCode=Broadcast` (Banner, device-receipt, non-claimable, no
  deep-link) ⇒ **one `NotificationBroadcast[01]` grant governs the whole screen**. Form = Title
  (≤200) + Body (≤1000) required + optional future `ExpiresAt` (blank ⇒ 30-day default). Soft-gate
  via 028's new `GET Notifications/Access` probe; server `Create` stays authoritative (`NC_FORBIDDEN`).
- [Receive-side parity scope for the back-office](026-receive-side-parity-scope.md) — v1 = **(A)
  "broadcasts-and-jobs"**: BO caller sees only `All`+`User` audience, so `BROADCAST`+`JOB_DONE`
  (+`NC_TEST`) only. **SLA countdowns CUT** (no deadline type reaches BO; list = `CreatedAt` desc).
  **Claim CUT** (no order subject under (A); announcements read-only). **Arrivals = `sonner` for
  both styles** (Toast auto-dismiss, Banner persistent, 15-min freshness gate, no sound). **Read =
  binary unread/read** (traffic-light cut), read-on-click + explicit "Mark all as read" (per-id
  loop), thin optimistic overlay, `IsRead` authoritative, no mark-all-on-open, drop `_ncReadIds`.
  **Expiry = client-side `ExpiresAt` filter** (poll never announces expiry). Order alerts/SLA/claim
  deferred to a later effort gated on a producer/audience change (new fog item).
- [Bell / panel / compose UX prototype](029-nc-bell-panel-compose-ux.md) — clickable
  [prototype](029-nc-bell-panel-compose-ux.PROTOTYPE.html) built & signed off; all 5 open questions
  settled: **(1) list = dropdown panel** (not full page); **(2) bell placement** `POS chip → bell →
  theme → account`, terracotta badge, hidden when NC disabled; **(3) denied-compose = hidden nav +
  soft-gate** backstop (not a disabled form); **(4) all-fleet blast = confirm dialog** for
  `AudienceKind=All` only (store sends go straight through); **(5) arrival = badge bump + `sonner` in
  lock-step**, `JOB_DONE` auto-dismiss toast / `BROADCAST` persistent banner (View→panel), 15-min
  freshness gate. **Compose screen locked at prototype fidelity** (Title≤200 + Message≤1000 required,
  Whole-fleet/One-store segmented + open-stores picker, optional Expires⇒30-day, pill Send, success
  toast). User asked to build it "as in the artifact" — captured as the build's reference, built via
  the spec chain not this planning session.

- [Lock the NC spec shape & hand off to /to-spec](030-nc-spec-shape-and-lock.md) — **one combined
  spec** (not receive/send split): the halves share the whole contract/identity/enablement surface,
  so a single spec with clean Receive/Send sections stays coherent and `/to-tickets` still gets
  independent slices. Spec synthesised & `ready`:
  [031 — Web Back-Office Notification Center](031-web-notification-center-spec.md). **Map destination
  reached.**

## Not yet specified

<!-- graduates into tickets as the frontier advances -->

- **Deep-link route map** — **PARKED by 026.** Under the (A) v1 scope nothing routable
  (`NavRoute=OmsDocument` + `EntityId`) reaches a BO caller — only order types carry a nav route and
  they're Store-audience. So there is no v1 route map to spec; it graduates only *with* the
  back-office order-alerts effort below, not before. Kept here as a signpost, not a live frontier.
- **Back-office order alerts (deferred effort carved out by 026)** — surfacing `NEW_ORDER`/
  `SLA_ORDER` to back-office users needs a backend producer/audience change (mint a User/All copy,
  or a BO-targeted producer) — a cross-repo SIS.Api item the web map can't settle alone. Brings back
  with it: **SLA countdown rendering** (live `DeadlineAt`), the **order-claim UX** (first-wins,
  "Claimed by X"/greying, agent-pool workflow), and the **deep-link route map** above. Its own
  effort/map when wanted; out of NC v1.
- **Spec shape & lock** — GRADUATED into
  [Lock the NC spec shape & hand off to /to-spec](030-nc-spec-shape-and-lock.md) (ticket 030), the
  last open frontier ticket. One combined spec vs. receive/send split, then `/to-spec`. On its
  resolution the map is done.
- **Real-time wake (SignalR `NotificationHub`)** — an enhancement over the poll baseline (lower
  latency on broadcasts). In scope for the effort but deferred until the poll baseline is specced;
  graduates after the receive spec exists.

## Out of scope

- **Presence / "who's connected" ops fleet view** (`GET Notifications/Presence`) — an
  ops-visibility extra that nothing branches on; a separate feature from send/receive NC. Returns
  as its own effort if wanted. *(The client still sends the presence heartbeat header on poll —
  that's part of the poll contract, not this view.)*
- **POS-only mechanics** — mid-sale navigation guard, `PosTimeMachine` fake-clock timekeeping,
  per-till `registerid` device identity. Not web-portal concerns; do not port them.
