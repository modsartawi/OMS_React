---
status: open
spec: 006
blocked-by: 008, 010
---

# 011 — revokeAllForUserSignsAPersonOutEverywhere

## What to build

When the current result set resolves to **exactly one distinct user**, a context bar appears above
the grid naming the person + their live-session count and offering **"Revoke all for this user"** —
the lost-phone / leaver hammer. Confirming (a modal that states how many devices will be signed
out) calls the revoke-all door, clears those rows optimistically, and toasts. Each killed device is
audited individually server-side (one `ADMIN_SESSION_REVOKE` per session). A multi-user result set
hides the bar.

## Spine reach

api (revokeAllForUser) · logic (single-distinct-user derivation) · component (context bar + confirm
modal) · i18n

## Proof (→ `tdd` red-green cycles)

- [ ] `singleUserResultRevealsBarWithCount` — a result set of one distinct user shows the bar with
  the correct device count · pure derivation (in-memory when runner lands; typecheck + drive until)
- [ ] `multiUserResultHidesBar` — a mixed result set hides the bar · pure / drive
- [ ] `revokeAllClearsUserSessions` — confirm(count) → the user's rows clear + toast ·
  component (stub `api.revokeAllForUser`) / drive

Runner not installed — verify via typecheck + drive.

## Boundaries

- **External dep (BackOffice):** new `POST UaAdminWeb/Sessions/RevokeAllForUser { userId } →
  { success, revokedCount }` (thin door over `RevokeSessionsForUser`; per-session audit rows).
- New i18n keys: context-bar copy, confirm title/body with count, toast.

## Done when

Narrowing to one user reveals the bar and revoke-all clears their sessions with a count-stating
confirm; a multi-user set hides it; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md), [010](010-active-sessions-revoke-one.md)
