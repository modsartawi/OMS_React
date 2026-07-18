---
status: done
spec: 006
blocked-by: 008
---

# 012 — theMonitorAutoRefreshesAndShowsFreshness

## What to build

The monitoring table stays live: the current query (search term + active chip) auto-refreshes
every **30 seconds** via a TanStack Query `refetchInterval`, a **manual Refresh** button forces a
reload now, and an **"updated N ago"** stamp shows freshness. The poll re-runs only the current
capped query, so a tab left open doesn't hammer the server; optimistic revokes reconcile on the
next poll.

## Spine reach

query config (refetchInterval on the list query) · component (Refresh button + freshness stamp) ·
i18n

## Proof (→ `tdd` red-green cycles)

- [x] `listRefetchesOnIntervalAndManual` — the list query refetches on the 30s interval and on
  Refresh click · `refetchInterval: 30_000` on the `listKey`-keyed query + Refresh button
  `onClick={() => void list.refetch()}`; verified via typecheck + two-axis review.
- [x] `freshnessStampAdvances` — the "updated N ago" stamp reflects the last successful fetch ·
  `relativeTime(list.dataUpdatedAt, nowTick)` with a 15s render tick; verified via typecheck + review.

Runner not installed — verified via `typecheck` (green), `build` (green), `/code-review`, and
`/standards-review` (both axes pass). A live network-activity drive is pending a running SIS.Api
(:5111 was down this session); the polling/freshness wiring was verified statically instead.

## Boundaries

- Uses the endpoints from 008 (list) / 009 (counts) — no new server door.
- New i18n keys: Refresh label, "updated {{ago}}" stamp.

## Done when

The table reloads on a 30s interval and on manual Refresh, with a freshness stamp; only the current
query is polled; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md)
