---
type: spec
status: ready
---

# 006 — Active Sessions admin screen (spec)

Synthesized from wayfinder map [001](001-active-sessions-admin-screen.md) and its resolved
tickets: [002](002-active-sessions-endpoint-gap-and-contract.md) (endpoint contract),
[003](003-active-sessions-access-grant.md) (access grant), [004](004-active-sessions-design-mock.md)
(confirmed mock — https://claude.ai/code/artifact/e2e07599-d259-4e37-b20a-4633852c6fdc),
[005](005-active-sessions-screen-spec.md) (spec-polish decisions). Ready for `/to-tickets`.

## Problem Statement

A support administrator has no single place to see **who is signed in across the estate right
now** or to sign a specific device out. The shipped Ua Users screen answers "what is true about
*this one person*" — including their live sessions — but to act you must already know the person.
When a device is reported lost, a shared workstation is left logged in, or an operator needs
kicking out of every channel at once, there is no estate-wide view: no way to search live
sessions by store or IP, no way to see the mobile fleet, no way to spot sessions that have gone
dormant, and no one-click "sign this person out everywhere." The capability exists in the domain
layer but is not reachable from the browser.

## Solution

A new **Active Sessions** screen under the Administration nav group — a **live monitoring table**
of every currently-live session (`sis_session`) across the estate. It reads as one product with
Ua Users and Authorization Admin: search-first, results capped at 50 with a "refine to narrow"
note, server-counted filter chips, an in-page denied card, and the shipped warm-neutral restyle.

The admin types an employee id, name, store code, or IP into one search box, or clicks a channel
chip (All / Web / Mobile / BackOffice) or the Idle chip, and gets a flat table of matching live
sessions — user (id + name), store, channel, when it started, when it was last seen, IP, and
client. Each row has a **Revoke** action that signs that one device out immediately. When the
result set narrows to a single user, a **Revoke all for this user** action appears — the "kick
them out of every device, every channel" hammer. The table stays fresh on a 30-second poll of the
current query, with a manual Refresh alongside. Revoking a session leaves the person enabled — it
is a session action, not an account action.

## User Stories

1. As a session-monitor administrator, I want an estate-wide list of every live session, so that I can see who is signed in right now without first knowing which person to look up.
2. As an administrator, I want the list to start empty and load only when I search or pick a chip, so that the screen never tries to pull thousands of live sessions at once.
3. As an administrator, I want to search live sessions by employee id, so that I can find one person's devices fast.
4. As an administrator, I want to search by part of a name, so that I can find sessions when I don't have the id to hand.
5. As an administrator, I want to search by store code, so that I can see everyone signed in at a given branch.
6. As an administrator, I want to search by IP address, so that I can investigate activity coming from one machine or location.
7. As an administrator, I want results capped at 50 rows with a "first 50 of N — refine to narrow" note, so that a broad query stays fast and I'm told when I'm seeing a sample.
8. As an administrator, I want each row to show the user's display name beside the id, so that I recognise the person, not just a number.
9. As an administrator, I want a channel chip for Web, so that I can isolate browser sessions.
10. As an administrator, I want a channel chip for Mobile, so that I can see the collector fleet.
11. As an administrator, I want a channel chip for BackOffice, so that I can see HQ desktop sessions.
12. As an administrator, I want an "All live" chip, so that I can return to the full estate view.
13. As an administrator, I want each chip to show a server-computed count, so that I know the true total even though the grid shows at most 50.
14. As an administrator, I want an Idle chip that surfaces sessions with no recent heartbeat, so that I can spot devices left dormant.
15. As an administrator, I want "idle" judged per channel (web dormant > 45m, mobile > 8h; POS/BackOffice never idle), so that the flag means "unusually quiet for this channel" rather than one blunt number.
16. As an administrator, I want a tooltip on the Idle chip explaining the per-channel rule, so that I understand why a given session is or isn't flagged.
17. As an administrator, I want the rows ordered most-recently-seen first, so that the liveliest sessions are at the top.
18. As an administrator, I want to see when a session started and when it was last seen (relative and absolute), so that I can judge how long a device has been signed in and how active it is.
19. As an administrator, I want a dormant session's "last seen" visually marked, so that idle rows read at a glance without opening anything.
20. As an administrator, I want to Revoke a single session from its row, so that I can sign out one reported-lost or left-open device.
21. As an administrator, I want a confirmation before a revoke, naming the session and person, so that I don't sign out the wrong device by a mis-click.
22. As an administrator, I want the row to disappear immediately on revoke (optimistic), so that the action feels instant.
23. As an administrator, I want a success toast after revoking, so that I have confirmation the device was signed out.
24. As an administrator, I want revoking a session to leave the person enabled and able to sign in again, so that a session action is never mistaken for disabling the account.
25. As an administrator, when my query narrows to exactly one user, I want a "Revoke all for this user" action, so that I can sign a person out of every device and channel in one step (lost phone, leaver).
26. As an administrator, I want the revoke-all confirmation to state how many devices will be signed out, so that I know the blast radius before I confirm.
27. As an administrator, I want each device killed by a revoke-all recorded individually in that person's audit trail, so that I can later see exactly which sessions (device + IP) were ended and when.
28. As an administrator, I want the table to auto-refresh every 30 seconds on my current query, so that the monitor stays live without me clicking.
29. As an administrator, I want a manual Refresh button and an "updated N ago" stamp, so that I can force a reload and always know how fresh the view is.
30. As an administrator, I want the auto-refresh to re-run only my current (capped) query, so that keeping the tab open doesn't hammer the server.
31. As an administrator without the permission, I want a clear "you don't have access" card instead of a broken screen, so that I understand it's a permissions matter and who to ask.
32. As an administrator, I want the Active Sessions menu item hidden unless I hold the grant, so that I'm not shown a door I can't open.
33. As a security-conscious owner, I want this screen gated by its own permission (separate from Ua Users administration), so that "watch sessions and sign people out" can be delegated independently of identity administration.
34. As an administrator, I want an empty-state message when nothing matches, so that I can tell "no results" from "still loading."
35. As an administrator, I want a loading state while a query runs, so that the screen doesn't look frozen.
36. As an administrator, I want the screen to honour light and dark themes and the shipped restyle, so that it feels like the same product as the other admin screens.
37. As an administrator, I want every label localised through the translation layer, so that the screen is ready for the planned Arabic/RTL retrofit.
38. As an end user whose session is revoked, I want to simply be signed out and able to log in again, so that a support action doesn't lock me out of my account.

## Implementation Decisions

**New feature module.** A new feature `features/admin/active-sessions/` (Administration area,
per `.claude/rules/feature-structure.md`): a default-export Page + `api.ts`, its own i18n
namespace `active-sessions`, and optional `columns`/`helpers`. It never imports another feature;
shared code comes from `@/core/*`. Registration touches exactly the four points in the
add-a-feature checklist: the folder, the `active-sessions` namespace (locale JSON +
`core/i18n.ts`), one lazy route `admin/sessions` in `app/router.tsx`, and one menu item in
`layout/menu-model.ts`.

**Server layer (BackOffice — a sibling build, consumed here).** The domain service
(`UaSessionService`) already exposes estate-wide `GetActiveSessions(channel)`,
`RevokeSession(sessionId)`, and `RevokeSessionsForUser(userId)`. The gap is the `UaAdminWeb`
web-endpoint family, which must gain:

- `GET UaAdminWeb/Sessions?term=&channel=&idleOnly=&skip=0&take=50` → estate-wide live sessions,
  search-first + 50-cap, mirroring the `SearchEmployees` shape. Returns
  `{ rows, totalMatches, rowCap, isCapped }`. `term` matches userId / display name / store code /
  IP. Needs a new searchable+capped service method (server-side search+cap — the browser never
  receives the estate).
- `GET UaAdminWeb/Sessions/Counts` → the chip counts `{ all, web, mobile, backoffice, idle }`,
  server-computed like `ReportCounts`. `idle` is **per-channel-relative** (see below), not a single
  scalar.
- `POST UaAdminWeb/Sessions/Revoke { sessionId }` → `{ success: true }`. **Already exists** —
  reuse verbatim. Actor = cookie UserId; audits `ADMIN_SESSION_REVOKE`.
- `POST UaAdminWeb/Sessions/RevokeAllForUser { userId }` → `{ success, revokedCount }`. **New**
  thin door over `RevokeSessionsForUser`. Actor = cookie UserId. Audits **one
  `ADMIN_SESSION_REVOKE` row per killed session** (not an aggregate) — no new action code.
- `GET UaAdminWeb/Sessions/Access` → `{ canOpen }`. Cookie-gated, NOT grant-gated (it reports the
  grant).

**Row model.** `ActiveSessionRow` = the existing `ActiveSessionModel` fields (`sessionId`,
`userId`, `currentStoreCode`, `channel`, `createdTime`, `lastSeenTime`, `ipAddress`, `userAgent`)
**plus `displayName`** (joined from `UaEmployee`, as `SearchEmployees` does). Model type lives in
`src/core/models/` alongside the existing `UaSessionModel`.

**Access grant.** Its own new screen grant `BackOfficeScreen[CONTROLLER='UaSessions', COMMAND='03']`
(final string confirmed against the authz catalog at build time), enforced fail-closed by a new
`UaSessionsGrantEndpointFilter` on every `UaAdminWeb/Sessions*` route except `Access`. The React
menu access probe uses its own react-query key (e.g. `['active-sessions','access']`) shared with
the Page's route-guard — one network call, not two, exactly as Ua Users does.

**Idle rule (heartbeat-based, per-channel).** `lastSeenTime` is the session heartbeat: the server
`TouchSession` bumps it on each authenticated request, throttled to at most once per 60s. "Idle" =
no heartbeat for longer than a per-channel window — **web > 45m, mobile > 8h; POS and BackOffice
never count as idle** (their idle expiry is disabled, issue 370). The count and the `idleOnly`
filter are computed server-side; the chip is labelled **"Idle"** (no fixed number) with a tooltip
explaining the per-channel rule.

**Freshness.** TanStack Query drives the list with `refetchInterval: 30s` keyed on the current
query (search term + active chip), plus a manual Refresh that refetches now, and an "updated N
ago" stamp. Revoke and revoke-all are optimistic mutations (drop the affected row(s) immediately),
then the next poll / invalidation reconciles.

**Revoke-all affordance.** Surfaced only when the current result set resolves to exactly one
distinct `userId` (a context bar above the grid naming the person and count). Both revoke actions
go through a confirmation modal (mirroring Ua Users' confirm UX).

**Error / envelope handling.** All calls go through `@/core/api` (`.claude/rules/api-envelope.md`):
typed `ApiError`, `apiErrorMessage` for display, `handle401` owns 401. A revoke of an
already-dead session is a no-op server-side (business success), not an error. No feature-specific
`success:false` codes are expected beyond the standard taxonomy.

**Confirmed screen shape** comes from the mock (004): live-monitoring table, no detail pane;
columns User(id+name) · Store · Channel badge · Started · Last seen(rel+abs) · IP · Client;
per-row Revoke; revoke-all context bar; confirm modals; loading / no-matches / no-access states;
light + dark.

## Testing Decisions

**A good test asserts external behaviour, not wiring** — that a search term produces the right
query, that the revoke-all bar appears only for a single-user result set, that a revoked row
leaves optimistically, that the denied grant renders the access card — never that a particular
hook or state variable exists.

**Seams, highest first (ideal count = one):**

- **Pure module (in-memory)** — the query-shaping and view helpers in the feature's `api.ts` /
  `helpers.ts`: building the `Sessions` query params from (term, channel, idleOnly), the
  single-distinct-user derivation that gates the revoke-all bar, and `lastSeen` relative-time
  formatting. This is the highest, cheapest seam and should carry most of the logic-bearing
  assertions.
- **Component (RTL, network stubbed at `api.ts`)** — the Page: search → rows, chip → filtered
  rows + counts, per-row revoke → confirm → optimistic removal + toast, revoke-all visibility and
  flow, and the access-denied / empty / loading states. Stub the four reads/mutations at the
  `api.ts` boundary, never `fetch`.
- **Flow (Playwright)** — one end-to-end path: open the screen with the grant, search a user,
  revoke one session, then revoke-all — only if a real cookie+grant fixture is cheap.

**Runner status.** vitest/RTL/Playwright are **not yet installed** (CLAUDE.md; deferred to the
hardening ticket). This feature does **not** bootstrap the runner — verify via `npm run typecheck`
and by driving the app (the `tdd`/`verify` skills), extending the Playwright smoke pattern at
`tools/screen1-smoke.mjs` if a quick check is wanted. Prior art for the component shape and its
query/mutation/optimistic patterns is the shipped `features/admin/ua-admin` (`UaAdminUsersPage`,
`UserDetailPane`, its `api.ts`). When the runner lands, the pure-module seam above is the first
thing to cover.

## Out of Scope

- **Bulk multi-select revoke** (checkbox-select N arbitrary rows → revoke selected) — only
  per-session and revoke-all-for-user.
- **A session detail drill-down / right-hand pane** — the table is flat; a row is the whole record.
- **A POS channel chip** — POS sessions exist and fold into "All"; isolating them is a later,
  optional addition.
- **Extending the x-api-key `UaAdmin` family** — this screen is web-only over the `UaAdminWeb`
  cookie transport.
- **Changing session lifetime policy** (per-channel idle/absolute windows) — the screen shows
  sessions; it does not manage their lifetimes.
- **An aggregate revoke-all audit row** — explicitly rejected in favour of per-session rows.

## Further Notes

- **Build prerequisite for `/to-tickets`:** the new grant needs a **seed/migration** to create the
  `BackOfficeScreen[UaSessions,03]` row and a **day-one `/authz-admin` bind** so administrators
  aren't locked out on first deploy — a build slice, sequenced before or alongside the transport.
- The confirmed mock still labels the chip "Idle > 30m"; per the idle decision the built label is
  **"Idle"** with the per-channel tooltip — a copy fix at build time, not a shape change.
- Server work (the new `UaAdminWeb/Sessions*` endpoints, the searchable service method, the
  `UaSessionsGrantEndpointFilter`, the grant seed) lands in the BackOffice repo; this repo consumes
  the contract above. `/to-tickets` should slice the web endpoints + React screen together as a
  tracer (mirroring how the Ua Users web screen was built: contract → endpoints → React screen).
