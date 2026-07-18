---
type: wayfinder-ticket
wayfinder: grilling
map: 001
status: done
blocked-by: —
---

# 003 — Which access grant gates the Active Sessions screen?

## Question

Every `UaAdminWeb/*` route is double-gated: cookie auth + a server-side `BackOfficeScreen`
screen grant (today `[CONTROLLER='UaUsers', COMMAND='03']`, re-evaluated fail-closed by
`UaUsersGrantEndpointFilter`). The new Active Sessions screen needs one too. Decide:

- **Reuse the `UaUsers` grant** (anyone who can administer Ua Users also sees/kills the
  estate's live sessions — simplest, one grant), **or a new distinct grant** (e.g.
  `[CONTROLLER='UaSessions', COMMAND='03']`) so "watch the estate and sign people out"
  can be delegated separately from identity administration?
- Whichever wins sets: the endpoint filter on 002's new routes, the `Access` probe route
  (reuse `UaAdminWeb/Access` vs a new `UaAdminWeb/Sessions/Access`), the menu access probe
  in `layout/menu-model.ts`, and the in-page denied card.
- If a **new** grant: is there a seed/migration to create it, and who holds it on day one
  (does it need a `/authz-admin` bind so admins aren't locked out)?

HITL via `/grilling` — a security/delegation call for the owner. Feeds the spec (005).
Can run in parallel with the design mock (004).

## Answer

Decided 2026-07-18 by the owner: **its own distinct access-grant, NOT a reuse of the
`UaUsers` grant.** "Watch the estate's live sessions and sign people out" is delegated
separately from Ua identity administration — an operator can be given the session monitor
without the full user-admin surface, and vice-versa.

**What this fixes into the contract (002) and build:**

- A **new screen grant** — mirror the `UaUsers[03]` shape, e.g.
  `BackOfficeScreen[CONTROLLER='UaSessions', COMMAND='03']` (final controller/command string
  is a build detail, confirmed against the authz catalog at build time).
- A **new endpoint filter** (`UaSessionsGrantEndpointFilter`, sibling of
  `UaUsersGrantEndpointFilter`) gates the new `UaAdminWeb/Sessions*` routes fail-closed —
  authoritative, not merely show/hide.
- A **dedicated `Access` probe**: `GET UaAdminWeb/Sessions/Access → { canOpen }` (cookie-gated,
  NOT grant-gated, like Ua Admin's `Access`). Drives the `layout/menu-model.ts` access probe
  (own react-query key, e.g. `['active-sessions','access']`) and the in-page denied card.
  → supersedes 002's "reuse `UaAdminWeb/Access`" fallback.

**Left to the spec (005) / build, not blocking:** the grant **seed/migration** that creates
the new `BackOfficeScreen` row, and the **day-one bind** so administrators aren't locked out on
first deploy (a `/authz-admin` assignment, mirroring how the existing screen grants were
seeded). Captured in the map's Not-yet-specified for the spec to close.
