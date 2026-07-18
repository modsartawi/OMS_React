---
status: open
spec: 031
blocked-by: 033
---

# 035 — aFreshArrivalRaisesAToastAndBumpsTheBadge

## What to build

A genuinely-new announcement raises a `sonner` notification the moment it's polled, in lock-step with
the badge bump. Arrival-vs-change is a client-side diff (track `NotificationId → seen`); a new id
within a **15-minute `CreatedAt` freshness window** toasts (so a cold-start backlog does not
re-pop). Style by `DisplayStyle`:

- `Toast` (`JOB_DONE`) ⇒ auto-dismiss (~8s).
- `Banner` (`BROADCAST`) ⇒ persistent, with **View** (opens the panel) + **Dismiss**.

No sound (no v1 type sets `PlaySound`).

## Spine reach

logic (pure `arrivalsToToast(prevSeen, items, now)` = new-id ∧ within-freshness ∧ Active) · component
(`sonner` toast/banner wiring at `layout/`, View opens the panel) · i18n (View/Dismiss labels) ·
test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `onlyFreshUnseenActiveItemsToast` — pure: backlog + a fresh new item ⇒ only the fresh one · pure
- [ ] `broadcastTogglesPersistentJobAutoDismisses` — pure/component: DisplayStyle → toast style · pure
- App-drive fallback: drive a fresh poll delta → a toast appears and the badge bumps together; Broadcast stays until dismissed; View opens the panel.

## Boundaries

Reuses the poll rail — no new endpoint. `sonner` already a dependency. New i18n keys. `—` runner.

## Done when

A fresh polled arrival raises the correctly-styled `sonner` notification and bumps the badge in
lock-step, with the 15-minute freshness gate suppressing cold-start backlogs — proven by the pure
tests green (or the app-drive action) with typecheck clean.

## Blocked by

[033](033-nc-panel-list.md)
