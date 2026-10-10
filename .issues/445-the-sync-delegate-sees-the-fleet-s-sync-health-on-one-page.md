---
status: done
spec: 444
blocked-by: —
---

# 445 — The sync delegate sees the fleet's sync health on one page

## What to build

**Slice 0.** It registers the feature end to end and builds the Fleet page:

- **Registration:** the feature folder, the `sync-console` namespace registered in `core/i18n.ts`,
  the route `/admin/sync`, and the menu item with an `accessProbe` on `ActionSync/Access`.
- **API and models:** `api.ts` with the read calls this page uses (`Access`, `Workers`,
  `Fleet/Summary`, `Fleet/LastHour`, `Fleet`), and the model types in `core/models/` taken from the
  contract.
- **Worker card:** heartbeat, version, widths, in-flight counts, the settings shown read-only, and
  a **red banner when `isStale`**.
- **State tiles:** clickable; each one sets the table's `state` filter (repeated, AND).
- **Last-hour totals:** the current hour and the previous one.
- **Store table:** AG Grid, server-paged at 50, search `q`, host filter, sort (most behind, longest
  offline, newest error, code). Each row shows its states as badges and links to
  `/admin/sync/store/:code` (that route can be a placeholder until 446).
- **Refresh:** every 30 s, with an "as of" stamp from `Fleet/Summary.asOf`.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (BackOffice read doors)

## Proof (→ `tdd` red-green cycles)

- [x] `stateBadge`: every `StoreState` maps to a label key and a severity; an unknown state is neutral (vitest).
- [x] `fleetQuery`: tiles, filters, sort and page build the exact query string, with `state` repeated (vitest).
- [x] `workerBanner`: stale → banner, fresh → none (vitest).
- [x] `tools/sync-console-fleet-drive.mjs`: with stubs, the tiles filter, search and sort reach the request, paging works, the stale banner shows, and the menu item is hidden when `screenAllowed` is false.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. No feature flag: the menu item is gated by the access probe. The BackOffice side (BackOffice 2539) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green; the Fleet page renders from stubs.

## Blocked by

None — can start immediately

## Comments

**Done 2026-10-09 (AFK).** Built in `src/features/admin/sync-console/` (`FleetPage`, `WorkerCard`,
`LastHourPanel`, `StateBadges`, `fleet-columns`, `helpers`, `api`, a placeholder `StorePage`). The model
file is `src/core/models/sync-console.ts`. The namespace `sync-console` is English only. The routes are
`/admin/sync` and `/admin/sync/store/:code` (placeholder until 446). The menu leaf sits last in Admin,
on `ActionSync/Access` `screenAllowed`, and fails closed.

Proof:
- **vitest:** `helpers.test.ts`, 16 tests. They cover `stateBadge`, `fleetQuery` (the exact URL through
  `syncConsoleApi.fleet` with `fetch` stubbed, `state` repeated), the tiles, `workerBanner` and
  `lastLoopError`.
- **drive:** `tools/sync-console-fleet-drive.mjs`, **38/38**, against STUBBED contract envelopes on vite
  :5199. It shows that:
  - the tiles, search, host and sort reach the request;
  - paging works at 50 a page;
  - the stale and no-worker banners show;
  - the summary refetches at 30 s (Playwright clock);
  - a failed filtered read draws no stale rows;
  - the leaf is hidden and the page is guarded when `screenAllowed` is false.
- **Gates:** `typecheck` clean, `npm test` 229 files and 4178 tests, `lint` four gates clean, `build` green.

Reviews: `/code-review` returned 10 findings. 9 are fixed: no stale rows or heartbeat under a failed read,
the pager stays live during the poll, the last page is clamped, the search is compared trimmed, no `fsi`
in the column file, the host falls back to its raw code, badge keys are positional, there is one `figure`
helper, and the refresh comment is corrected. Background polling is left at the default; see HITL.
`/standards-review` found no hard violations, and I applied two naming and typing nits. The decisions
are logged in `.afk/HITL-445.md`: tile toggling, the pending column, the severities, the no-worker
banner, the model scope, the envelope drift and the last-error cell.

Outstanding, not AFK-able: the live walk against BackOffice 2539 (ticket 450), and an owner eye on the
page against the prototype.
