---
type: spec
status: ready
---

# 031 — Web Back-Office Notification Center (spec)

Destination spec for wayfinder map [023](023-web-notification-center.md). Synthesised from its
Decisions-so-far (tickets 024–029) and their linked assets:
[024 backend contract](024-nc-backend-contract-for-web.RESEARCH.md),
[025 identity fit](025-web-identity-session-fit.RESEARCH.md),
[029 UX prototype](029-nc-bell-panel-compose-ux.PROTOTYPE.html). One combined spec, split into
**Receive** and **Send** so `/to-tickets` can slice independent build tickets.

## Problem Statement

Back-office users have no in-portal way to be told things. Operational announcements ("system
read-only tonight", "new refund policy"), and job-completion signals ("coupon import finished")
reach POS tills through the POS Notification Center, but a person working in the oms-react
back-office portal is blind to them — they find out by word of mouth or not at all. Conversely, an
operations administrator has no way to *send* a fleet-wide or per-store announcement from the
portal; today that requires a developer or a POS-side tool.

The SIS.Api Notification Center backend already ships the whole contract (poll / read / create), and
the web portal already authenticates as a first-class back-office caller — but the portal presents
none of it.

## Solution

Add a Notification Center to the oms-react portal in two halves that share one backend contract:

- **Receive** — a bell in the top bar with an unread badge, opening a dropdown panel of
  announcements (newest first). Fresh arrivals raise a `sonner` toast/banner. A user reads an item
  by clicking it, or clears everything with "Mark all as read". Driven by polling
  `Notifications/Poll` as the existing back-office identity.
- **Send** — a "Send Broadcast" admin screen where an authorized operations administrator composes
  a title + message and sends it to the whole fleet or a single store, gated by the
  `NotificationBroadcast` permission.

Scope is deliberately **v1 = "broadcasts-and-jobs"**: a back-office caller only ever receives
`All`- and `User`-audience notifications, so v1 surfaces exactly the `BROADCAST` and `JOB_DONE`
types (plus `NC_TEST` for smoke). Order alerts, SLA countdowns, per-item Claim, and deep-link
routing are explicitly out of v1 (see Out of Scope).

## User Stories

### Receive — bell & badge

1. As a back-office user, I want a bell in the top bar, so that there is one obvious place to check for things I've been told.
2. As a back-office user, I want an unread count on the bell, so that I can see at a glance whether anything needs my attention without opening the panel.
3. As a back-office user, I want the unread count to reflect only genuinely-unread, still-active, non-expired items, so that the number means what it says.
4. As a back-office user, I want the badge to disappear when there's nothing unread, so that a clean state looks clean.
5. As a back-office user, I want the bell to sit between the POS channel chip and the theme/account controls, so that the two status affordances are grouped and the account stays rightmost.
6. As a back-office user on a portal where the feature is switched off, I want the bell to simply not appear, so that I'm not shown a control that does nothing.

### Receive — panel & list

7. As a back-office user, I want clicking the bell to open a dropdown panel anchored to it, so that reading announcements never takes me away from what I was doing.
8. As a back-office user, I want the newest announcement on top, so that the most recent thing is the first thing I read.
9. As a back-office user, I want unread items visually emphasised and read items muted, so that I can tell at a glance what's new.
10. As a back-office user, I want each row to show a title, a short body, and a relative time ("4m ago"), so that I can triage without opening anything.
11. As a back-office user, I want an empty panel to say I'm all caught up, so that emptiness reads as success, not breakage.
12. As a back-office user, I want opening the panel *not* to silently mark everything read, so that the badge keeps meaning "genuinely unread" until I act.
13. As a back-office user, I want a type tag (Broadcast vs Job) on each row, so that an announcement reads differently from a job-completion notice.

### Receive — read state

14. As a back-office user, I want clicking an item to mark it read, so that reading is the act of reading, with no extra step.
15. As a back-office user, I want a "Mark all as read" action, so that I can clear a backlog in one gesture.
16. As a back-office user, I want a read item to stay read after a reload, so that I don't re-clear the same announcements every session.
17. As a back-office user, I want the row and badge to update instantly when I read something, so that the UI feels immediate even before the server confirms.
18. As a back-office user, I want "Mark all as read" to be disabled when nothing is unread, so that the control tells me its own state.

### Receive — arrivals

19. As a back-office user, I want a fresh announcement to raise a toast, so that I'm told the moment it arrives without watching the bell.
20. As a back-office user, I want a job-completion toast to auto-dismiss after a few seconds, so that routine confirmations don't pile up on screen.
21. As a back-office user, I want an operational broadcast to stay on screen until I dismiss it, so that a "system read-only tonight" notice isn't missed because I looked away.
22. As a back-office user, I want a broadcast toast to offer a "View" action that opens the panel, so that I can go read the full announcement in context.
23. As a back-office user, I want the badge to bump at the same moment the toast appears, so that the two signals agree.
24. As a back-office user first opening the portal, I want a backlog of old items *not* to toast at me, so that only genuinely-fresh arrivals interrupt me (15-minute freshness window).
25. As a back-office user, I want an item that has since expired to drop out of my list and count, so that I'm not shown stale notices the server would no longer serve.

### Send — access

26. As an operations administrator with the broadcast grant, I want a "Send Broadcast" item in the admin nav, so that composing an announcement is a normal screen.
27. As a back-office user *without* the broadcast grant, I don't want to see "Send Broadcast" in the nav at all, so that I'm not offered something I can't use.
28. As a back-office user who reaches the compose URL directly without the grant, I want a clear "you don't have access" screen naming the permission, so that I know why and what to ask for.
29. As the business, I want the server to remain the authority on who may broadcast, so that hiding the nav is convenience, not the security boundary.

### Send — compose

30. As an operations administrator, I want a title and a message field, so that I can write an announcement.
31. As an operations administrator, I want live character counters against the limits (title 200, message 1000), so that I know when I'm over before I try to send.
32. As an operations administrator, I want the Send button disabled until the form is valid, so that I can't fire an empty or over-long broadcast.
33. As an operations administrator, I want to choose between "Whole fleet" and "One store", so that an announcement reaches exactly who it should.
34. As an operations administrator choosing "One store", I want to pick from the existing open-stores list, so that I target a real store the same way I do elsewhere in the portal.
35. As an operations administrator, I want an optional expiry date, so that a time-bound notice stops showing itself once it's irrelevant.
36. As an operations administrator leaving expiry blank, I want a sensible default lifetime, so that I don't have to think about expiry for an ordinary announcement.
37. As an operations administrator about to broadcast to the whole fleet, I want a confirmation step, so that I can't blast every store and back-office user by a stray click.
38. As an operations administrator sending to a single store, I want the send to go straight through, so that a low-blast-radius message isn't nagged with a dialog.
39. As an operations administrator, I want a success confirmation and a cleared form after sending, so that I know it went and I'm ready for the next one.
40. As an operations administrator, I want a server refusal (e.g. permission lost) surfaced as its message, so that I understand the real reason rather than a generic error.

### Cross-cutting

41. As a back-office user, I want the whole NC to speak through the app's existing look (warm neutrals, terracotta accent, pill buttons), so that it feels part of the portal, not bolted on.
42. As a back-office user in either light or dark theme, I want the NC to render correctly, so that it matches the rest of my portal.
43. As a back-office user, I want the poll to run quietly in the background and pause sensibly, so that the feature doesn't hammer the server or drain the tab.

## Implementation Decisions

### Shared / platform

- **All server calls through `src/core/api.ts`** (api-envelope rule). New typed calls live in a
  feature `api.ts`; the envelope (`HttpGeneralResponse<T>`) is already unwrapped by `request()`.
  Business refusals arrive as a thrown `ApiError` (400, `success:false`) whose code is read via
  `apiErrorCode` — the code the Send screen must handle is **`NC_FORBIDDEN`**.
- **Identity is already carried** (025): the portal polls/creates as its existing session
  (cookie + `X-Web-Client`), which the server resolves to `AppKind=BO`, audience `User+All`, and
  `DeviceKey = StaffId = userId`. **No new identity headers**, and the client must **not** send
  `x-api-key`.
- **`api.get` needs a per-request header passthrough** (025 gap) so the poll can send
  `x-presence: skip`. This is a small `core/api.ts` change (accept optional per-call headers) —
  a shared-layer prerequisite, not feature code.
- **Enablement:** a `404` from `Notifications/Poll` means the feature is disabled server-side —
  treat as "NC off", hide the bell, and back off; never surface it as an error.
- **i18n:** one namespace per feature area, zero literals (i18n-zero-literal). The bell/panel chrome
  and the compose screen each need keys; register namespaces in `src/core/i18n.ts`.
- **Logical Tailwind only** (logical-tailwind); the NC lives in both themes via the existing tokens.

### Receive

- **Placement (feature-structure):** the bell + panel + arrival wiring is **cross-cutting chrome in
  `layout/`** (it rides the AppShell top bar, like the account menu), not a `features/` screen. The
  poll lives at that level so it runs portal-wide regardless of route.
- **Endpoint:** `GET Notifications/Poll?watermark=` → `NotificationPollResult { items[], watermark }`.
  Poll on a **TanStack Query `refetchInterval`**; **watermark held in memory** (a reload ⇒
  `watermark=0` ⇒ cold-start full active set); send **`x-presence: skip`** on polls (presence is
  ops-only, nothing branches on it). Pause when the tab is hidden.
- **Item model (subset consumed in v1):** `NotificationId, TypeCode, Title, Body, CreatedAt,
  ExpiresAt, Status, IsRead, DisplayStyle, ReadScope`. (`DeadlineAt`, `NavRoute`, `EntityId`,
  `ClaimedBy*` are present in the contract but **unused in v1**.)
- **Badge / list are 100% client-derived** — there is no server unread-count or list endpoint.
  - **Unread count** = items where `Status === 'Active'` ∧ `ExpiresAt > now` ∧ `!IsRead`.
  - **List order** = `CreatedAt` descending (newest-on-top). No SLA/soonest-deadline sort.
  - **Expiry** = a client-side render filter: the poll never *announces* expiry (rowversion doesn't
    bump), so both badge and list exclude `ExpiresAt <= now`, and expired items are dropped from the
    in-memory store.
- **Read model** = binary unread/read (no traffic-light).
  - **Read-on-click:** clicking a row fires `POST Notifications/{id}/Read` (per-id). Both v1 types
    (`BROADCAST`, `JOB_DONE`) are **Device-scope**, so the server receipts and `IsRead` rehydrates
    on reload.
  - **Mark all as read:** loops `POST …/Read` per unread id (there is **no bulk endpoint**).
  - **Optimistic overlay:** flip the row/badge immediately; `IsRead` from the next poll is
    authoritative. **Drop the POS `_ncReadIds` local set** — for a BO caller the device is the user,
    so receipts are already per-user.
  - Opening the panel does **not** mark anything read.
- **Arrivals via `sonner`** (already a dependency). Distinguish arrivals from changes client-side by
  tracking `NotificationId → last seen`; a genuinely-new id within a **15-minute `CreatedAt`
  freshness window** raises a toast:
  - `DisplayStyle === 'Toast'` (`JOB_DONE`) ⇒ auto-dismiss (~8s).
  - `DisplayStyle === 'Banner'` (`BROADCAST`) ⇒ persistent, with **View** (opens the panel) +
    **Dismiss**. No sound (no v1 type sets `PlaySound`).
  - The badge bump and the toast fire from the same poll-diff, in lock-step.

### Send

- **Placement (feature-structure):** a real screen under **`features/admin/…`** (nav group Admin,
  URL under `/admin/*`), registered in `router.tsx` + `menu-model.ts` + i18n per the add-a-feature
  checklist.
- **Endpoint:** `POST Notifications` → `{ notificationId }`. Request fields used:
  `TypeCode='BROADCAST'` (always), `AudienceKind ∈ {All, Store}`, `AudienceKey` (empty for All, the
  storecode for Store), `Title` (≤200), `Body` (≤1000), optional `ExpiresAt` (blank ⇒ omitted ⇒
  server 30-day default; if sent it must be in the future or the server refuses `NC_BAD_EXPIRY`).
- **Channels:** segmented **Whole fleet** (`AudienceKind=All`) vs **One store**
  (`AudienceKind=Store`, storecode from the **existing open-stores picker**). Multi-store /
  back-office-group audiences are out of v1 (not server-expressible; see Out of Scope).
- **Validation** mirrors the server (`ValidateCreateRequest`): title 1–200, body 1–1000, future
  expiry; Send disabled until valid, with an inline validity hint.
- **All-fleet confirmation:** an `AudienceKind=All` send opens a **confirm dialog** ("reach every
  open store and back-office user… can't be recalled"); a `Store` send goes straight through. An
  inline amber warning shows while composing an All send.
- **Access gate (soft) — depends on a NEW backend endpoint:** the whole screen soft-gates on a new
  **`GET Notifications/Access`** probe (ticket 028) that reports whether the caller holds
  `NotificationBroadcast[CONTROLLER='NotificationBroadcast', COMMAND='01']`. Denied ⇒ the nav item is
  **hidden** (permission-aware nav, same pattern as the rest of the portal) and a direct URL hit
  shows a soft "You don't have access" gate naming the grant. **The server `Create` stays
  authoritative** — a lost grant surfaces as `NC_FORBIDDEN` on send. ⚠️ `GET Notifications/Access`
  does **not exist in SIS.Api yet** — it is a cross-repo backend dependency (see Further Notes); the
  client must degrade gracefully until it lands (treat probe 404/absence as "unknown → let the
  server decide", showing the screen but relying on `NC_FORBIDDEN`).
- **On success:** a confirmation toast ("Broadcast sent — Delivered to <target>") and the form
  resets.

### UX reference

The [029 prototype](029-nc-bell-panel-compose-ux.PROTOTYPE.html) is the **primary-source reference
for look and interaction** (user signed off "do it as in the artifact"). It encodes: the ~380px
panel, row layout, badge pop, the two toast styles, the compose card (counters, segmented channel,
store picker, expiry, pill Send), the all-fleet confirm modal, and the denied gate. Build to that
fidelity, re-expressed in React/Tailwind/shadcn against the real tokens.

## Testing Decisions

- **Good test = external behavior only.** Assert what a user observes (badge shows 2; reading a row
  drops it to 1; an All send opens a confirm; a store send doesn't; a `404` poll hides the bell),
  never internal call shapes.
- **Highest seam first.** Most of this feature's logic is **pure and belongs in-memory**:
  - `unreadCount(items, now)`, the `CreatedAt`-desc + not-expired list derivation, and the
    arrival-vs-change / freshness-window diff are **pure functions** — the cheapest, highest-value
    seam. Test these in-memory.
  - The compose **validation** (title/body/expiry → valid + which hint) is likewise a pure function.
- **Component seam (RTL) with the network stubbed at `api.ts`** for: bell badge reflecting a stubbed
  poll; read-on-click firing one `Read` and updating optimistically; "Mark all as read" looping;
  the compose channel/confirm interaction; the denied gate.
- **Runner bootstrap:** vitest/RTL are **not installed yet** (deferred to the hardening ticket).
  This feature is a strong candidate to **finally bootstrap the vitest + RTL runner** — the pure
  functions above give an easy first target. If the runner isn't bootstrapped here, verify via
  `npm run typecheck` + driving the app (the current live check is `tools/screen1-smoke.mjs`), and
  leave the pure functions structured so tests drop on later. **`/to-tickets` decides** whether the
  runner-bootstrap is its own tracer ticket ahead of the feature tickets.
- **Prior art:** the Active Sessions screen (map 001, tickets 007–012) is the closest sibling —
  a polling admin screen with client-derived counts and a freshness indicator; follow its shape.

## Out of Scope

- **SLA countdowns, per-item Claim, and back-office order alerts** (`NEW_ORDER`/`SLA_ORDER`). These
  need a SIS.Api producer/audience change (the order types are Store-audience and never reach a BO
  caller). A **deferred effort** with its own map; brings SLA rendering + claim UX + deep-link
  routing back with it.
- **Deep-link routing** (`NavRoute`/`EntityId` → a web screen). Parked: nothing routable reaches a
  BO caller in v1.
- **SignalR real-time wake** (`/hubs/notifications`). A latency-only enhancement over the poll
  baseline; the client half isn't compiled server-side yet. Deferred; poll is the source of truth.
- **Presence / "who's connected" ops fleet view** (`GET Notifications/Presence`). A separate
  ops-visibility feature nothing branches on. (The poll still sends its presence heartbeat header;
  that's contract, not this view.)
- **Multi-store and back-office-group broadcast audiences.** Not server-expressible in the current
  `AudienceKind` (All/Store/User); v1 compose offers All + single-Store only.

## Further Notes

- **Backend dependency (blocks the Send access-gate ticket, not the whole Send screen):**
  `GET Notifications/Access` must be added to SIS.Api (mirrors the existing `Sessions/Access` /
  `Pricing/Access` probe pattern) to report the `NotificationBroadcast[01]` grant to the client.
  Until it ships, the compose screen relies on the server's authoritative `NC_FORBIDDEN` on `Create`
  and shows the nav (can't hide what it can't probe). The grant seed
  (`Modules\NotificationCenter\Sql\002_seed_broadcast_permission.sql`) already exists server-side.
- **Enablement flag** `NotificationCenter:Enabled` gates the whole backend; the client's only tell
  is the poll `404`.
- Watermark healing, presence throttling, and the full field-by-field contract are documented in the
  [024 research note](024-nc-backend-contract-for-web.RESEARCH.md); identity/session specifics in the
  [025 note](025-web-identity-session-fit.RESEARCH.md).
