---
status: open
spec: 558
blocked-by: —
---

# 559 — A technician sees DataSync's campaigns and runnable profiles on one page

## What to build

**Slice 0.** It registers the feature end to end and proves the new service's path from the browser
to DataSync and back:

- **Registration:** the `features/admin/data-sync` folder, the `data-sync` namespace registered in
  `core/i18n.ts`, the route `/admin/data-sync`, and an Admin menu leaf with an `accessProbe` on
  `DataSync/Access` (`screenAllowed === true`, fails closed). The leaf and the page's own gate share
  one query key.
- **Dev proxy:** a `vite.config.ts` rule ahead of `/api`: `/api/DataSync` → `DATASYNC_API` (default
  `http://127.0.0.1:5280`), stripping `/api`. The production path is unchanged (IIS proxies
  `/DataSync/*` on the SIS.Api host).
- **Models:** `core/models/data-sync.ts`, field for field from the OpenAPI draft
  (`C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml`):
  every read model and enum the spec lists, so later slices only add calls.
- **API:** `api.ts` with `access`, `health`, `profiles` and `campaigns(filter, page)`.
- **Campaigns grid:** newest first, 50 a page (Next enabled only when a page came back full, since
  the door returns no total), a status filter kept in the URL; columns for name, profile, mode,
  status badge, jobs by state, total jobs and created time (local). Each row links to
  `/admin/data-sync/campaigns/:campaignId` (a placeholder until 560). Refreshes every 30 s.
- **Profiles panel:** each profile's source and tables, with each table's strategy, compare window
  (`where`), and whether it may be applied. Read-only.
- **Service banner:** from `DataSync/Health`: worker disabled, no worker tick for over a minute, or
  the state DB unreachable (503).

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `campaignStatusBadge`: every `CampaignStatus` maps to a label key and severity; an unknown status is neutral · pure
- [ ] `campaignsQuery`: status filter and page build the exact query string through `dataSyncApi.campaigns` with `fetch` stubbed · pure
- [ ] `serviceBanner`: healthy → none; worker off, stale tick, 503 → the right banner · pure
- [ ] `tools/data-sync-campaigns-drive.mjs`: with stubs, the grid renders, the status filter reaches the request, Next pages and disables on a short page, the banner shows, the leaf is hidden and the page guarded when `screenAllowed` is false

## Boundaries

New endpoints: `GET DataSync/Access`, `DataSync/Health`, `DataSync/Profiles`, `DataSync/Campaigns`.
New namespace `data-sync`. Menu leaf gated by the probe; no feature flag. Doesn't bootstrap a runner
(vitest is in place; RTL is not).

## Done when

The helpers and the drive are green, and the Campaigns page renders from stubs; `typecheck`, `lint`
and `test` green.

## Blocked by

None — can start immediately
