---
status: open
spec: 031
blocked-by: —
---

# 032 — theBellPollsAndShowsAnUnreadBadge

## What to build

The **tracer bullet** for Receive. A notification bell appears in the AppShell top bar (between the
POS channel chip and the theme toggle). It polls `GET Notifications/Poll?watermark=` on an interval
as the existing back-office identity and shows a terracotta unread badge whose count is
**client-derived**: items where `Status === 'Active'` ∧ `ExpiresAt > now` ∧ `!IsRead`. Zero unread ⇒
no badge. A `404` from the poll means the feature is disabled server-side ⇒ the bell renders nothing
(no error). Watermark is held in memory (reload ⇒ `watermark=0` ⇒ cold-start full set); polls send
`x-presence: skip`.

Retires the biggest unknown: **does the web client actually poll the NC contract as a `User+All`
back-office caller and get items back?** Everything downstream thickens this proven spine.

Includes the small **prefactor**: `src/core/api.ts` `get()` accepts optional per-request headers so
the poll can send `x-presence: skip` (a shared-layer change — keep existing callers working).

## Spine reach

model/api (`core/models` NC poll types + a notifications `api.ts` over `core/api.ts`; `api.get`
header passthrough) · logic (pure `unreadCount(items, now)` + a TanStack Query poll hook, in-memory
watermark) · component (bell in `layout/AppShell`) · i18n (`notifications` namespace, registered) ·
test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `unreadCountCountsActiveUnexpiredUnread` — pure: given a mixed item set + `now`, returns the right count · pure
- [ ] `pollErrorOf404HidesTheBell` — pure/component: a 404 poll ⇒ NC-disabled state ⇒ no bell · pure (state) / component
- [ ] `theBellShowsTheUnreadBadge` — component (RTL, poll stubbed at `api.ts`): badge renders the derived count · component
- App-drive fallback (runner not installed): `npm run typecheck` + drive `npm run dev` against a NC-enabled SIS.Api; bell shows a count; disable the flag ⇒ bell vanishes.

## Boundaries

New API dependency `GET Notifications/Poll` — envelope `HttpGeneralResponse<NotificationPollResult>`;
handle `404` (feature-off, not an error). New i18n namespace `notifications` (register in
`core/i18n.ts`). Shared-layer change to `core/api.ts` `get()`. Does NOT bootstrap the vitest runner
(verify via typecheck + drive unless the runner lands first — see handoff).

## Done when

The bell renders in the top bar, polls on an interval, shows the correct client-derived unread
badge, and disappears on a 404 poll — proven by `theBellShowsTheUnreadBadge` green (or the app-drive
action) with `npm run typecheck` clean.

## Blocked by

None — can start immediately.
