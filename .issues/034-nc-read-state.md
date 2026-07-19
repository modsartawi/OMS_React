---
status: code-complete
spec: 031
blocked-by: 033
---

# 034 — readingAnItemDropsTheUnreadCount

> **Build note (runtime-blocked):** code-complete, `npm run typecheck` green. Runtime app-drive
> deferred (SIS.Api :5111 down). Optimistic overlay lives in the store (`setRead`), read actions
> in `actions.ts`; reload-rehydration relies on the server receipt (untested this session).

## What to build

Reading is the act of reading. Clicking a panel row marks it read via `POST Notifications/{id}/Read`
(per-id) and **optimistically** flips the row to muted and drops the badge by one immediately;
`IsRead` from the next poll is authoritative (and rehydrates read state across reload — both v1 types
are Device-scope, so the server receipts). A **"Mark all as read"** action loops `Read` over every
unread id (there is **no bulk endpoint**) and is disabled when nothing is unread. Opening the panel
still does not auto-clear. Drop any POS-style local read set — for a BO caller the device is the
user, so receipts are already per-user.

## Spine reach

api (`markRead(id)` over `core/api.ts`) · logic (optimistic overlay in the poll store; mark-all
loop) · component (row click handler, "Mark all as read" button) · i18n (action label) · test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `readingARowFiresOneReadAndDropsTheCount` — component (RTL, `Read` stubbed): one call, badge −1, row muted · component
- [ ] `markAllAsReadLoopsEveryUnreadId` — component: N unread ⇒ N `Read` calls, badge → 0 · component
- [ ] `markAllIsDisabledWhenNothingUnread` — component · component
- App-drive fallback: click a row → it mutes and badge drops; reload → stays read; "Mark all as read" clears.

## Boundaries

New API dependency `POST Notifications/{id}/Read` (returns `{ ok }`). No new namespace. `—` runner.

## Done when

Clicking a row and "Mark all as read" both drop the unread count optimistically and persist across
reload — proven by the component tests green (or the app-drive action) with typecheck clean.

## Blocked by

[033](033-nc-panel-list.md)
