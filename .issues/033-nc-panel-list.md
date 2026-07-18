---
status: open
spec: 031
blocked-by: 032
---

# 033 — theBellOpensAPanelListingAnnouncementsNewestFirst

## What to build

Clicking the bell opens a **dropdown panel** (~380px) anchored to it, listing the polled
announcements **newest-first** (`CreatedAt` descending), excluding expired items
(`ExpiresAt <= now`). Each row shows Title, a short Body, a relative time ("4m ago"), and a type tag
(**Broadcast** vs **Job**). Unread rows are visually emphasised, read rows muted (binary — **no**
traffic-light). An empty panel reads "You're all caught up." Opening the panel does **not** mark
anything read. Outside-click / Escape closes it. Not a full page — a dropdown.

## Spine reach

logic (pure `visibleItems(items, now)` = not-expired + `CreatedAt`-desc sort; `relativeTime`) ·
component (panel + rows in `layout/`, anchored to the bell) · i18n (panel header, empty state, type
tags, relative-time units) · test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `visibleItemsAreNewestFirstAndDropExpired` — pure · pure
- [ ] `theEmptyPanelReadsAllCaughtUp` — component · component
- [ ] `unreadRowsAreEmphasisedReadRowsMuted` — component · component
- App-drive fallback: click bell → panel lists stubbed/real items newest-first; expired absent; empty state shows.

## Boundaries

Reuses 032's poll data — no new endpoint. New i18n keys in `notifications`. `—` runner.

## Done when

The bell opens a dropdown panel listing non-expired announcements newest-first with correct
read/unread styling and empty state, closing on outside-click/Escape — proven by the component tests
green (or the app-drive action) with typecheck clean.

## Blocked by

[032](032-nc-bell-poll-badge.md)
