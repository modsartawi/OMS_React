---
status: open
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

- [ ] `stateBadge`: every `StoreState` maps to a label key and a severity; an unknown state is neutral (vitest).
- [ ] `fleetQuery`: tiles, filters, sort and page build the exact query string, with `state` repeated (vitest).
- [ ] `workerBanner`: stale → banner, fresh → none (vitest).
- [ ] `tools/sync-console-fleet-drive.mjs`: with stubs, the tiles filter, search and sort reach the request, paging works, the stale banner shows, and the menu item is hidden when `screenAllowed` is false.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. No feature flag: the menu item is gated by the access probe. The BackOffice side (BackOffice 2539) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green; the Fleet page renders from stubs.

## Blocked by

None — can start immediately
