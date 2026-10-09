---
type: spec
status: ready
---

# 444 — The store sync console: follow and control store sync from the browser

Follows BackOffice spec 2523 (`C:\Work\DMSCO\BackOffice\.issues\2523-store-sync-worker-spec.md`), from BackOffice map 2499.
BackOffice owns the tables, the worker and the SIS.Api doors. **This spec owns the page.** Both
sides build to one shared **door contract**: `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The reference picture is the
[Store Sync Console prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd), which the owner accepted as drawn (BackOffice 2522).

## Problem Statement

Store sync (master data pushed from HQ to the 980+ stores, sales pulled back) runs in a WPF
desktop app. Its only view is a per-day attempts report, and that report cannot tell an idle store
from an offline one. Every control, from adding a store to resetting a counter, means opening WPF
and editing rows.

The owner is delegating store sync to one person and has ruled that **nobody opens WPF for anything
on this subject again**. BackOffice is moving sync onto an always-on SIS.Api worker that records
per-store health. That person needs a browser page to follow it and control it.

## Solution

A new **Sync console** in the admin area (`/admin/sync`), built to the door contract:

- **Fleet page:**
  - a worker card with its heartbeat, and a red banner when the heartbeat is stale;
  - clickable state tiles (all, on worker, on WPF, paused, offline, behind, erroring, control
    pending) that filter the store table;
  - last-hour totals;
  - a paged store table with search, host filter and sort;
  - a selection of up to 50 stores for bulk move, hand-back, pause, resume and re-push.

  It refreshes every 30 s and shows an "as of" stamp.
- **Store page:**
  - a header with the host, the states and a "pending" badge;
  - a health summary;
  - the controls the store's host allows;
  - a 24 h strip;
  - tabs: Counters, Passes (each pass drills into its detail), Commands, Scripts (read only),
    Audit, Location.

  A WPF store shows only its counters and passes.
- **Commands and Audit feeds** for the whole fleet.
- **New store wizard:** step 1 creates the store master, step 2 its sync location. It takes one
  store or pasted rows, shows a preview and a result per row, and runs a connection test that only
  warns. Also: the **Sync pending** list with dismiss, **Edit store** and **Edit location**.
- **Every control opens an in-page dialog that requires a reason.** The re-push dialog shows the
  objects, a date limited to the 41-day window, and the number of actions it will replay, per
  store and in total.

The page is English only. It is visible only with `ActionSync.Health.View`; controls render only
with `ActionSync.Operate`, and the store-master steps only with `Store.Onboard`. All three come
from `GET ActionSync/Access`, and the server re-checks every door.

## User Stories

1. As the sync delegate, I want one page listing every store with its host, reachability, push lag and last error, so that I can see the fleet's sync at a glance.
2. As the sync delegate, I want state tiles that filter the table in one click, so that I can jump straight to the offline or erroring stores.
3. As the sync delegate, I want a red banner when the worker's heartbeat is stale, so that a dead worker never looks like a quiet fleet.
4. As the sync delegate, I want the fleet page to refresh itself every 30 s with an "as of" stamp, so that I always know how fresh the numbers are.
5. As the sync delegate, I want to search by store code or name and sort by most behind, longest offline, newest error or code, so that I can find the store I am chasing.
6. As the sync delegate, I want a store page with a 24 h strip (work, idle, pass errors, connect failures only, no data), so that I can see when a store stopped syncing.
7. As the sync delegate, I want every counter of a store with its lag behind the action log, so that I know which object is behind.
8. As the sync delegate, I want a store's passes for the last 30 days, each one opening into its detail, so that I can investigate an error without WPF.
9. As the sync delegate, I want a store's scripts shown read-only (no SQL text), so that I can see why one failed while a browser can never queue SQL onto a store.
10. As the sync delegate, I want a store's location details without its credentials, so that the `sa` password never reaches a browser.
11. As the sync delegate, I want to move, hand back, pause or resume one store, or a selection of up to 50, with a required reason, so that I can run the rollout from the browser.
12. As the sync delegate, I want a "pending" badge until the worker has applied my control, so that I know when it has taken effect.
13. As the sync delegate, I want only the controls a store's host allows (a WPF store offers only move and connection test), so that I am never offered an action the server will refuse.
14. As the sync delegate, I want "retry now" on a store, so that a store just back online syncs at once.
15. As the sync delegate, I want a connection test that shows "testing…" and then OK or the error, so that I can check whether the worker reaches a store.
16. As the sync delegate, I want a re-push dialog that previews how many actions it will replay, per store and in total, before I confirm, so that I never trigger a larger replay than I meant to.
17. As the sync delegate, I want the re-push date limited to the 41-day window, so that I cannot ask for a replay the server cannot do.
18. As the sync delegate, I want to see and cancel my pending commands, so that nothing I queued is invisible or stuck.
19. As the sync delegate, I want a fleet-wide audit feed and a per-store audit tab with the reasons, so that every change to sync can be explained later.
20. As the sync delegate, I want a New store wizard (store master, then sync location) for one store or pasted rows with a preview and a result per row, so that onboarding is one job in one place.
21. As the sync delegate, I want the store code checked as four characters from A–Z and 0–9 as I type, with lowercase refused, so that I learn the rule.
22. As the sync delegate, I want a failed connection test during onboarding shown as a warning, not an error, so that I can onboard a store before its box is reachable.
23. As the sync delegate, I want a Sync pending list of stores with a master but no location, with a dismiss for non-store masters, so that an unfinished onboarding is never forgotten.
24. As the sync delegate, I want Edit store and Edit location dialogs (audited, with a reason), so that I can fix an address or an IP without WPF.
25. As a manager with only `ActionSync.Health.View`, I want the whole console read-only, so that I can watch without being able to change anything.
26. As a user without the view grant, I want the menu item hidden, so that I am not shown a screen I cannot open.

## Implementation Decisions

- **One feature, `features/admin/sync-console`**, with i18n namespace `sync-console`, routes under
  `/admin/sync` (the fleet page), `/admin/sync/store/:code`, `/admin/sync/commands`,
  `/admin/sync/audit`, `/admin/sync/new-store` and `/admin/sync/pending`, and one menu item with an
  `accessProbe` on `ActionSync/Access`. It follows `feature-structure`, `i18n-zero-literal`,
  `logical-tailwind`, `api-envelope` and `bidi` (store codes and ids as `Ltr`; descriptions and
  free text as `<bdi>`).
- **The door contract is the only source of the wire shapes.** The model types in `src/core/models/`
  mirror it field for field. A shape change goes to the contract first, then to both repos.
- **States come from the door** (`states[]`). The page never derives offline, behind or erroring
  itself; it only maps a state to a label and a severity.
- **Pure helpers carry the logic worth testing:**
  - state → label and severity;
  - the hour-cell → colour legend;
  - the fleet query built from tiles, filters and sort;
  - which controls a store row offers (by host, paused state and grants);
  - the re-push date bound (41 days) and the summary sentence for its preview;
  - paste-many parsing (TSV/CSV lines into rows, flagging bad codes before the call);
  - the command poll (stop when the command reaches a terminal status);
  - the per-row result summary.
- **Polling:** the fleet page refetches every 30 s (TanStack `refetchInterval`). A connection test
  or retry polls `ActionSync/Commands?batch=` every 2 s until the command is terminal, up to 60 s.
- **Grids:** AG Grid with `OMS_GRID_BASE_COL_DEF`, server-side paging at 50 (the door pages), and
  multi-row selection capped at 50 on the fleet table.
- **No feature flag.** The menu item shows only to holders of the view grant, and the doors exist
  only once BackOffice deploys them.

## Testing Decisions

- **Vitest** for every pure helper above, next to `helpers.ts`. These are where a regression would
  be silent.
- **A Playwright drive per screen slice** (`tools/sync-console-*-drive.mjs`): `page.route('**/api/**')`
  stubs built from the contract's shapes (the `coupon-import-delete-drive` precedent), driven
  against `npx vite --port 5199`. These are manual-run tools, not CI gates.
- `npm run typecheck`, `npm run lint` (boundaries, grid base, contrast, colour literals) and
  `npm test` stay green on every slice.
- **A final owner walk against the real doors on staging** once BackOffice 2539–2542 are deployed and
  the grants are seeded on OMS-HQ.

## Out of Scope

- **The doors, tables and worker** (BackOffice spec 2523).
- **Arabic**: English only, per BackOffice 2522; oms-react's i18n can add Arabic later.
- **Authoring `DistributionLocationScript`s** (read only, by ruling).
- **The SAP twin location** (`<code>_SAP`), which stays in WPF.
- **Showing or editing location credentials.**
- **Fleet-wide re-push of more than 50 stores in one request** (page through deliberately).
