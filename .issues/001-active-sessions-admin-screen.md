---
type: wayfinder-map
status: open
---

# 001 — Active Sessions admin screen

## Destination

A **locked screen spec plus a confirmed interactive design mock** for a new
**Active Sessions** screen under the Admin nav group — ready to hand to `/to-spec`
then `/to-tickets` for the build. The screen is a **live monitoring table**: one
flat, searchable/filterable grid of every currently-live `sis_session` across the
estate, with per-row **Revoke** and a **revoke-all-for-user** action. It reuses the
`UaAdminWeb` cookie+grant transport and the shipped restyle so it reads as one
product with Ua Users and Authorization Admin.

Scope was fixed with the owner up front (`/wayfinder` questions, 2026-07-18):
IA = live monitoring table (no detail pane); filters = user id/name · store · channel
(web/mobile) · idle-stale; revoke power = per-session **+ revoke-all-for-user** (no
bulk multi-select).

## Notes

- **Domain** — see `CONTEXT.md` (session, envelope, guardrail refusal). A **session**
  is the server-owned `sis_session` row; the client is only a display mirror.
- **Lineage** — this mirrors the shipped Ua Admin (BackOffice map 413) and Authorization
  Admin (BackOffice map 445): search-first, 50-row cap ("first 50 of N — refine to
  narrow"), server-count worklist chips, an in-page denied card, cookie+screen-grant
  transport (`UaAdminWeb` family). Consult those before diverging.
- **Backend is largely already built.** `UaSessionService` (BackOffice
  `Sartawi.Retail.Data/Modules/Auth/UaSessions`) already exposes estate-wide
  `GetActiveSessions(channel)`, `RevokeSession(sessionId)`, and
  `RevokeSessionsForUser(userId)` (issue 317). The gap is the **web endpoint layer**
  (`UaAdminWebEndpoints.cs`), which today surfaces only *per-user* sessions +
  *per-session* revoke. Session revoke already audits as `ADMIN_SESSION_REVOKE`.
- **Skills every session should consult**: `/prototype` (the mock), `/grilling` +
  `/domain-modeling` (decisions), `/to-spec` then `/to-tickets` at the end. Rules in
  `.claude/rules/` (feature-structure, i18n-zero-literal, logical-tailwind, api-envelope)
  bind the eventual build.
- **Registration mechanics** (route `admin/sessions`, menu item + access probe, i18n
  namespace) are execution detail owned by `/new-feature` + `/to-tickets`, not this map.

## Decisions so far

<!-- one line per resolved ticket: gist + link; zoom the link for detail -->

- [Active-sessions endpoint gap & contract](002-active-sessions-endpoint-gap-and-contract.md) — the domain service already has estate-wide `GetActiveSessions` + `RevokeSessionsForUser`; the gap is web routes. New `UaAdminWeb/Sessions` (search+50-cap), `Sessions/Counts`, `Sessions/RevokeAllForUser`; reuse `Sessions/Revoke`. Server-side search+cap (not client-side). Grant fork → 003.
- [Access grant for the screen](003-active-sessions-access-grant.md) — its **own** new grant (`BackOfficeScreen[UaSessions,03]`), not a reuse of `UaUsers`; own endpoint filter + `UaAdminWeb/Sessions/Access` probe. Seed + day-one bind deferred to the spec.
- [Design mock confirmed](004-active-sessions-design-mock.md) — v2 (Web/Mobile/BackOffice/Idle chips) is the build target; live-monitoring table, search+50-cap, per-row Revoke + revoke-all-for-user bar, confirm modals, all states, light+dark. Mock: https://claude.ai/code/artifact/e2e07599-d259-4e37-b20a-4633852c6fdc

## Not yet specified

<!-- graduates to tickets as the frontier advances -->

- **Live-refresh behaviour** — a monitor implies freshness: manual Refresh only, or a
  polling/auto-refresh cadence (and does revoke optimistically drop the row or refetch)?
  Spec polish once the mock shape is confirmed.
- **Idle-stale threshold** — the "Idle > Nm" worklist chip needs a concrete N (and whether
  it is a server count like Ua Admin's cards, or derived client-side from `lastSeenTime`).
  Tied to 002's contract + 004's mock.
- **revoke-all-for-user audit shape** — one aggregate audit row vs one `ADMIN_SESSION_REVOKE`
  per killed session. Folds into 002 / spec polish.
- **New-grant seed + day-one bind** (from 003) — the migration that creates the
  `BackOfficeScreen[UaSessions,03]` grant row, and the initial `/authz-admin` assignment so
  administrators aren't locked out on first deploy. Spec (005) closes it.
- **POS channel chip** — the mock exposes Web / Mobile / BackOffice chips; POS sessions exist
  (issue 370) and currently fold into "All". Add a POS chip if the owner wants to isolate them.
- Empty / error / denied copy, exact i18n key strings, theme tokens — spec polish, none blocking.

## Out of scope

- **Bulk multi-select revoke** (checkbox-select N rows → revoke selected) — owner chose
  per-session + revoke-all-for-user only.
- **A session detail drill-down / right-hand pane** — owner chose a flat table; a row *is*
  the whole record.
- **Extending the x-api-key `UaAdmin` family** (IT scripting doors) — this screen is
  web-only over the `UaAdminWeb` cookie transport.
- **Changing session lifetime policy** (idle/absolute windows per channel, issue 370) — the
  screen *shows* POS/BackOffice/web/mobile sessions; it does not manage their lifetimes.
