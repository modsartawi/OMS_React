---
type: wayfinder-ticket
wayfinder: research
map: 001
status: done
blocked-by: —
---

# 002 — Active-sessions screen: endpoint gap & contract

## Question

The estate-wide monitoring grid can only show what the server can answer. Inventory
what `UaSessionService` + `UaAdminWebEndpoints` expose today, and specify the web
endpoint contract the new screen needs: the estate-wide list (with search / channel /
idle filters + 50-cap), the chip counts, per-session revoke, and revoke-all-for-user.
Decide **server-side search+cap vs client-side filtering** over the full estate, and
flag (don't decide) the access-grant fork.

## Answer

Resolved 2026-07-18 by reading the backend: `UaSessionService`
(`Sartawi.Retail.Data/Modules/Auth/UaSessions/Services/UaSessionService.cs`) and
`UaAdminWebEndpoints.cs`.

**What already exists.** The *domain service* already supports the whole chosen scope:
`GetActiveSessions(channel = null)` (estate-wide live rows, most-recent first, optional
channel filter), `RevokeSession(sessionId)`, and `RevokeSessionsForUser(userId)` →
count (built for issue 317's deactivate / password-reset hammer). The `ActiveSessionModel`
carries `sessionId, userId, currentStoreCode, channel, createdTime, lastSeenTime,
ipAddress, userAgent`. **What's missing is at the web layer:** `UaAdminWebEndpoints`
exposes only *per-user* `Employees/{id}/Sessions` and *per-session* `Sessions/Revoke` —
no estate-wide list, no revoke-all-for-user. Session revoke already audits
`ADMIN_SESSION_REVOKE`.

**Decision — server-side search + cap, NOT client-side.** The estate is ~6,000 people
across web/mobile/pos/backoffice channels; peak concurrent live sessions run to the
thousands. `GetActiveSessions` today returns the *whole* estate uncapped with no search,
and the service's own doc comment warns against pulling all live rows to filter one
person. So we keep Ua Admin's never-load-all posture: the new endpoint takes search +
cap params, the browser never receives the estate.

**Contract — new `UaAdminWeb` routes (cookie + screen-grant gated; grant identity = ticket 003):**

1. `GET UaAdminWeb/Sessions?term=&channel=&idleOverMinutes=&skip=0&take=50` — estate-wide
   live sessions, search-first + 50-cap, mirroring `SearchEmployees`. `term` matches
   userId / display name / store code / IP. Returns
   `{ rows: ActiveSessionRow[], totalMatches, rowCap, isCapped }`. Needs a new service
   method `SearchActiveSessions(term, channel, idleOverMinutes, skip, take)` (or an
   overload of `GetActiveSessions` + a store/text/idle filter + cap).
   - `ActiveSessionRow` = `ActiveSessionModel` fields **+ `displayName`** (join to
     `UaEmployee` so the grid shows a name, as `SearchEmployees` does; accept id-only if
     the join proves costly).
2. `GET UaAdminWeb/Sessions/Counts?idleOverMinutes=` — server-computed chip counts
   (All / Web / Mobile / Idle>N), like `ReportCounts`, so the chips show true totals under
   the 50-cap.
3. `POST UaAdminWeb/Sessions/Revoke  { sessionId }` — **already exists; reuse verbatim.**
   Actor = cookie UserId; audits `ADMIN_SESSION_REVOKE`.
4. `POST UaAdminWeb/Sessions/RevokeAllForUser  { userId }` → `{ success, revokedCount }` —
   **new thin door** over the existing `RevokeSessionsForUser`. Actor = cookie UserId.
   Audit shape flagged to spec: recommend **one aggregate `ADMIN_SESSIONS_REVOKE_ALL` row**
   (userId + count) rather than one `ADMIN_SESSION_REVOKE` per killed session, which would
   flood the user's audit tab.

**Idle / stale** is `lastSeenTime` + an admin-facing threshold, independent of each
channel's own expiry (web 60m idle, mobile 12h, pos/backoffice idle-disabled — issue 370).
Recommend a fixed default (≈30m) computed server-side; the exact N is spec polish.

**Flagged, not decided — the access-grant fork → ticket 003.** Every `UaAdminWeb/*` route
is double-gated (cookie + a `BackOfficeScreen` grant; today `UaUsers[03]`). Whether the
sessions screen **reuses the `UaUsers` grant** or gets its **own new grant** is a product /
security call (delegation: who should see the whole estate's live sessions and kick people
out?). That decision picks both the endpoint filter and the `Access` probe route
(reuse `UaAdminWeb/Access` vs a new `UaAdminWeb/Sessions/Access → { canOpen }`).

Graduated: **003** (grant fork) was already open; **004** (design mock) is now unblocked —
the grid columns, filter chips, and actions above are exactly what it renders.
