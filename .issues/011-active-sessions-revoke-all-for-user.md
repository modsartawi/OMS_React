---
status: done
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

- [x] `singleUserResultRevealsBarWithCount` — a result set of one distinct user shows the bar with
  the correct device count · pure derivation (`singleDistinctUser`; verified by isolated node check
  of the pure fn — single-user→count, mixed→null, empty→null, single-row→1 all pass)
- [x] `multiUserResultHidesBar` — a mixed result set hides the bar · pure (`singleDistinctUser`
  returns null on >1 distinct userId; node check green)
- [x] `revokeAllClearsUserSessions` — confirm(count) → the user's rows clear + toast · component
  (typecheck green; optimistic drop mirrors the shipped 010 revoke; drive deferred — needs the
  BackOffice `RevokeAllForUser` door + live SIS.Api)

Runner not installed — verified via `npm run typecheck` (green), `npm run build` (green), and an
isolated node check of the pure `singleDistinctUser` seam. End-to-end drive of the mutation is
blocked on the external BackOffice door (see Boundaries) and is deferred to a live-backend pass.

## Boundaries

- **External dep (BackOffice):** new `POST UaAdminWeb/Sessions/RevokeAllForUser { userId } →
  { success, revokedCount }` (thin door over `RevokeSessionsForUser`; per-session audit rows).
- New i18n keys: context-bar copy, confirm title/body with count, toast.

## Done when

Narrowing to one user reveals the bar and revoke-all clears their sessions with a count-stating
confirm; a multi-user set hides it; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md), [010](010-active-sessions-revoke-one.md)

## Comments

**Intentional deviation — revoke-all bar trigger narrowed (2026-07-18).** The ticket/spec 006 say
the bar appears "when the current result set resolves to exactly one distinct user." As built, the
bar is additionally gated to `chip === 'all' && !isCapped`: a single-user set reached via a channel
or Idle chip, or a 50-capped set, does **not** offer the hammer. Reason: revoke-all kills every
channel server-side, but a channel-filtered/capped `rows.length` would understate the true device
count the confirm must state (story 26 — "know the blast radius before I confirm"). Gating to the
complete all-channels view keeps that count honest. The primary lost-phone/leaver flow (search an
id → default All chip) is unaffected; to get the hammer on a channel-filtered search, clear the
chip back to All. Standards + spec review judged this a defensible trade — flagged here for the
owner to confirm. If the owner prefers the literal trigger, the alternative is an extra
all-channels count query per single-user result to feed the confirm.
