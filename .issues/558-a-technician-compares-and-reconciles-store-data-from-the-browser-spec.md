---
type: spec
status: ready
---

# 558 — Data sync: a technician compares a store's data to HQ and reconciles it from the browser

Follows the DataSync engine spec (`C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\spec.md`)
and its ADRs (`…\.scratch\data-sync-engine\docs\adr\`). **DataSync**, a standalone .NET 10 service,
owns the state DB, the worker, the compare and apply engine and the `/DataSync/*` doors. It is built
and on `master` in `C:\Work\Replicate_SqlDataCompare`. **This spec owns the page.**

The wire contract is the OpenAPI draft
`C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\docs\api\datasync-openapi.draft.yaml`
(v0.2.0; the running service's contract tests are generated from it). A runnable reference is the
demo kit's Postman collection, `C:\Work\Replicate_SqlDataCompare\demo\postman\DataSync-Demo.postman_collection.json`,
against `demo\run-demo-api.ps1`.

## Problem Statement

A store's copy of HQ data drifts: a reformatted box, a missed ActionSync window, a store edited by
hand, or a new store that needs a whole table seeded. Today the fix is a technician running RedGate
SQL Data Compare by hand against one store at a time, with the store's `sa` credentials on their
desktop. Nothing records who changed what or why, and nothing stops them writing to a store while
the live ActionSync worker is also writing to it.

DataSync now does the compare and the apply as a service: pre-configured **sync profiles**, fanned
out to many stores as a **campaign** of per-store **jobs**, with resumable progress, an audit and the
ActionSync safety checks. It has no screen. The technician needs one to run it and follow it.

## Solution

A new **Data sync** screen in the admin area (`/admin/data-sync`):

- **Campaigns page** (landing): the campaigns, newest first, with status, mode, profile, progress
  (jobs by state) and created time. Filter by status. A service banner when DataSync's worker is off
  or its state DB is unreachable. A **Profiles** panel lists the runnable profiles read-only: each
  table, its strategy (Reconcile or Seed), its compare window and whether it may be applied.
- **New campaign dialog**: pick a profile, optionally a subset of its tables, the target stores
  (picked or pasted codes, or the whole fleet), a mode, a name. **Apply** needs a reason of at least
  10 characters and shows which tables will be written and which only reported. The campaign is
  created **Ready**; the technician reviews it and presses **Start**.
- **Campaign page**: the rollup (jobs by state) and a grid of the jobs, one per store: status, phase,
  why it waits or is held, attempts, failure. It refreshes while anything is in flight. A **job
  drawer** shows each table's progress (chunks, rows compared, to insert/update/delete, rows
  applied), its disposition (Applied or Reported only) and any failure.
- **Changes view** (report-only jobs): the row-level differences, filtered by table and kind
  (only at source, different, only at store), each row's key with the differing values side by
  side. A pruned manifest says so; a truncated one says counts are exact but rows stop.
- **Controls**: pause, resume and cancel a campaign or one job, with an optional note. Refusals
  show in the dialog.
- **Apply with ActionSync**: "pause ActionSync first" is on by default. The page pauses the target
  stores on ActionSync, tagged with the campaign, before starting the apply. When a store's job
  succeeds and DataSync reports it **resumable**, the page offers to hand it back to ActionSync.
  Every other store stays paused for a person.

English only. The screen is visible with `DataSync.View`; every action, and the Changes view,
needs `DataSync.Operate`. Both come from `GET DataSync/Access`; DataSync re-checks every door.

## User Stories

1. As a technician, I want a Data sync item in the admin menu only when I hold `DataSync.View`, so that I am not shown a screen I cannot open.
2. As a technician, I want the campaigns listed newest first with their status, mode, profile and jobs by state, so that I can see what ran and what is running.
3. As a technician, I want to filter the campaigns by status, so that I can find the running or the failed ones quickly.
4. As a technician, I want a banner when DataSync's worker is off or its state DB is unreachable, so that a stalled campaign never looks like a slow one.
5. As a technician, I want the runnable profiles listed with their tables, strategy, compare window and whether each table may be applied, so that I pick the right profile before I run anything.
6. As a technician, I want to create a campaign from a profile against stores I pick or paste, so that I never type a server, a table or a credential.
7. As a technician, I want to run only some of a profile's tables, so that I can compare or apply just the table that was added or broken.
8. As a technician, I want to target the whole fleet in one choice, so that a mass distribution does not need 980 codes.
9. As a technician, I want pasted store codes checked before the call and the unknown ones named, so that a typo does not fail the whole create.
10. As a technician, I want the campaign created Ready and started only when I press Start, so that I can check it before anything runs.
11. As a technician, I want a report-only mode that never writes to a store, so that I can see the drift before deciding to fix it.
12. As a technician, I want Apply to require a reason of at least 10 characters, so that every write to a store can be explained later.
13. As a technician, I want the Apply dialog to show which tables will be written and which only reported, so that I am never surprised by what an apply changes.
14. As a technician, I want each create refusal shown in the dialog in words (unknown store, table not in profile, profile with no appliable tables, source unavailable), so that I can fix the request and retry.
15. As a technician, I want a campaign page with jobs by state and one row per store, so that I can follow a fleet-wide run.
16. As a technician, I want the campaign page to refresh while anything is in flight and stop when it is done, so that I watch progress without reloading.
17. As a technician, I want a waiting job to say why (waiting for ActionSync to pause, backing off after a fault, until when), so that I know whether to act.
18. As a technician, I want a held job to say whether a person paused it or its store became busy, so that I know who has to resume it.
19. As a technician, I want each store's tables with chunk progress, counts and disposition, so that I can see how far a big table has got and what it changed.
20. As a technician, I want a failed job or table to show its failure reason in words (schema mismatch, invalid key, constraint violation, store unreachable, WPF-hosted store, target unresolved), so that I can tell a data problem from a connectivity one.
21. As a technician with Operate, I want a report-only job's row-level differences, filtered by table and kind, so that I can review exactly what an apply would change.
22. As a technician, I want each differing row to show its key and only the differing values from both sides, so that a one-character change is easy to see.
23. As a technician, I want a pruned manifest to say the rows are gone but the counts remain, so that an old job does not look broken.
24. As a technician, I want a truncated manifest flagged, so that I know the counts are exact even when the rows stop.
25. As a technician, I want to pause, resume or cancel a whole campaign, with an optional note, so that I can stop a run that is going wrong.
26. As a technician, I want to pause, resume or cancel one store's job, so that one bad store does not hold the fleet.
27. As a technician, I want only the controls the current state allows, so that I am never offered an action the server will refuse.
28. As a technician, I want a resume refused because the store is busy or WPF-hosted explained in the dialog, so that I know to pause ActionSync or give up on that store.
29. As a technician, I want "pause ActionSync first" on by default when I apply, so that DataSync and the live worker never write to the same store at once.
30. As a technician, I want the ActionSync pause tagged with the campaign, so that the hand-back later knows the pause was ours.
31. As a technician, I want stores that cannot be applied (WPF-hosted) named before I start, so that I can drop them rather than watch them fail.
32. As a technician, I want stores whose apply succeeded and are resumable offered for hand-back to ActionSync in one action, so that the fleet returns to normal sync.
33. As a technician, I want stores that are not resumable listed as staying paused with the reason, so that a person checks them before sync resumes.
34. As a manager with only `DataSync.View`, I want the whole screen read-only and the Changes view hidden, so that I can follow runs without seeing row data or changing anything.

## Implementation Decisions

- **One feature, `features/admin/data-sync`**, i18n namespace `data-sync` (English only), routes
  `/admin/data-sync` (campaigns + profiles), `/admin/data-sync/campaigns/:campaignId` (campaign page,
  job drawer as a URL-addressable `?job=` param) and `/admin/data-sync/jobs/:jobId/changes`. One menu
  leaf in Admin with an `accessProbe` on `DataSync/Access` (`screenAllowed === true`, fails closed),
  sharing one query key with the page's own gate, as sync-console does. Follows `feature-structure`,
  `i18n-zero-literal`, `logical-tailwind`, `api-envelope` and `bidi` (ids, store codes, table names,
  key values as `Ltr`; row values and free text as `<bdi>`).
- **Separate from `sync-console`.** Features never import features. The apply wizard's ActionSync
  calls (`ActionSync/Fleet` for store readiness, `ActionSync/Stores/Control` to pause and resume) are
  written again in this feature's own `api.ts`. Their types already live in `core/models/sync-console`
  and are imported from there.
- **The OpenAPI draft is the only source of the wire shapes.** `core/models/data-sync.ts` mirrors it
  field for field: `SyncProfile`, `TableSpec`, `Campaign`, `JobsByState`, `Job`, `TableTask`,
  `ChangeManifestRow`, `Access`, `Health`, `CreateCampaignRequest`, `ControlRequest`, plus the enums
  (`CampaignStatus`, `JobStatus`, `JobPhase`, `TableTaskStatus`, `Mode`, wait and hold reasons).
  Ids are ULID strings. Timestamps arrive as UTC and are shown local, per the estate's no-UTC rule.
- **Paths and the base.** Calls are bare `DataSync/…` paths through `core/api.ts`, like every other
  door. In production IIS on the SIS.Api host reverse-proxies `/DataSync/*` to the DataSync server
  (same origin, so the `sis_session` cookie and `X-Web-Client` travel). In dev, `vite.config.ts` gains
  one proxy rule ahead of `/api`: `/api/DataSync` → `DATASYNC_API` (default `http://127.0.0.1:5280`),
  stripping `/api`.
- **Envelope and refusals.** Success and business refusals are the shared envelope; auth failures are
  bare 401/403 (401 is `core/api`'s; a bare 403 on an Operate door hides that action). Codes the UI
  handles, each with its own sentence:
  - create: 404 `DATASYNC_PROFILE_NOT_FOUND`; 422 `DATASYNC_REASON_REQUIRED`,
    `DATASYNC_PROFILE_NO_APPLY_TABLES`, `DATASYNC_TABLE_NOT_IN_PROFILE`, `DATASYNC_UNKNOWN_STORE`,
    `DATASYNC_SOURCE_UNAVAILABLE`; 400 `DATASYNC_INVALID_REQUEST`; 409 `DATASYNC_STORE_BUSY` (no
    target safe);
  - create **warnings**: `success: true` with `DATASYNC_STORE_BUSY` / `DATASYNC_STORE_WPF_HOSTED` in
    `errors[]`, one per unsafe store; shown on the new campaign, never as a failure;
  - controls: 409 `DATASYNC_INVALID_STATE`, `DATASYNC_STORE_BUSY`, `DATASYNC_STORE_WPF_HOSTED`;
  - not found: 404 `DATASYNC_CAMPAIGN_NOT_FOUND`, `DATASYNC_JOB_NOT_FOUND`;
  - changes: 410 `DATASYNC_MANIFEST_PRUNED`.
- **Paging.** `GET DataSync/Campaigns`, `…/Jobs` and `…/Changes` take `page`/`pageSize` (clamped to
  1–500 by the door) and return a plain array with no total. The pager shows the page number and
  enables Next only when a page came back full. Pages are 50.
- **State words come from pure helpers**, never from the component:
  - campaign status, job status (+ phase, + wait reason with `notBefore`, + hold reason) and
    table-task status → a label key and a severity;
  - failure reasons → a sentence key (job: `TableFailures`, `StoreUnreachable`, `StoreWpfHosted`,
    `TargetUnresolved`; table: `SchemaMismatch`, `InvalidKey`, `ConstraintViolation`, `Error`); an
    unknown code falls back to its raw text;
  - which controls a campaign or job offers, from its status and `canOperate` (the state machines in
    the engine spec §2, §4.4);
  - whether to keep polling (any job non-terminal) and table progress (`chunksDone / chunksTotal`,
    indeterminate while `chunksTotal` is null);
  - the create request built from the dialog (tables omitted when all are picked; `targets` as either
    `storeCodes` or `fleet: 'all'`; reason trimmed, required ≥ 10 for Apply);
  - pasted store codes parsed (one per line, comma or tab, de-duplicated) and flagged before the call;
  - the apply readiness of each picked store from its ActionSync row (WPF → never; on worker and
    paused and acknowledged → safe; on worker otherwise → will be paused);
  - the hand-back set (jobs `Succeeded` with `actionSyncResumable`) and the stay-paused set with why.
- **Polling.** The campaign page refetches the campaign and its jobs every 5 s while any job is
  non-terminal and the tab is visible, and stops when the campaign is `Completed` or `Cancelled`.
  The campaigns list refetches every 30 s.
- **The apply flow** (engine spec §6.2, ADR 0004):
  1. The dialog checks the picked stores against `ActionSync/Fleet`: WPF-hosted ones are named and
     can be dropped; the rest are safe or will be paused.
  2. Create the campaign (`Apply` + reason) → **Ready**, with its id.
  3. With "pause ActionSync first" on (the default), pause the target stores through
     `ActionSync/Stores/Control` (`Pause`) in batches of ≤ 50, reason
     `DataSync campaign <campaignId>: <reason>`. Per-store refusals are listed.
  4. **Start.** Jobs whose store is not yet acknowledged wait as `Queued(WaitingForPause)`
     server-side; the page needs no ack polling.
  5. When jobs finish, **Hand back to ActionSync** resumes (`ActionSync/Stores/Control` `Resume`, the
     same tagged reason) exactly the jobs that `Succeeded` with `actionSyncResumable: true`. It is one
     operator action, pre-selected, never automatic. Everything else stays paused and is listed with
     why (failed, cancelled, not resumable because ActionSync's control changed since the job began).
  This flow needs the technician to also hold `ActionSync.Operate`; without it the pause step is
  unavailable and the dialog says the stores must be paused by someone who has it.
- **DataSync asks** (small changes in `C:\Work\Replicate_SqlDataCompare`, not BackOffice):
  - **Ask A — a store by code alone.** The ActionSync doors know a store by `code`; DataSync's
    `StoreRef` is `{client, code}` (HQ `DistributionLocation`). Proposed: accept `client` omitted on
    `targets.storeCodes[]` and default it to `DataSync:FleetClient`, the client `fleet: 'all'` already
    uses. Picking single stores waits on it; `fleet: 'all'` works without it.
  - **Ask B — create before pause.** Today `POST Campaigns` refuses an Apply with 409
    `DATASYNC_STORE_BUSY` when **no** target is safe yet, but step 3's tag needs the campaign id that
    only create returns. Proposed: a `pauseActionSyncFirst: true` flag on create that turns the
    all-unsafe refusal into per-store warnings (WPF-hosted stores still warn). Without it, the
    wizard must pause untagged first and re-pause tagged after create.
- **Grids:** AG Grid with `OMS_GRID_BASE_COL_DEF`: campaigns, jobs, a job's tables, changes.
- **No feature flag.** The leaf shows only to holders of `DataSync.View`, and the doors exist only
  where DataSync is deployed behind the SIS.Api host.

## Testing Decisions

- A good test drives a module's public interface with inputs and asserts outputs. No component
  internals.
- **Vitest** (pure, in-memory) for every helper above: state and failure words, controls per state,
  poll decision, progress, the create request builder, paste parsing, apply readiness, the hand-back
  split, and each `api.ts` call's exact path and query with `fetch` stubbed (the `helpers.test.ts`
  precedent in sync-console).
- **A Playwright drive per screen slice** (`tools/data-sync-*-drive.mjs`), `page.route('**/api/**')`
  stubs built from the OpenAPI draft's examples, against `npx vite --port 5199`. Manual-run tools,
  not CI gates. RTL is still not installed; this spec does not bootstrap it.
- `npm run typecheck`, `npm run lint` and `npm test` green on every slice.
- **A final live walk** against a running DataSync (the demo kit is enough: `demo\setup-demo.ps1`,
  `demo\run-demo-api.ps1`), with DataSync validating sessions against the same HQ as the SIS.Api the
  page logs into.

## Out of Scope

- **The DataSync service, its state DB, worker and doors** (built; the engine spec).
- **Authoring sync profiles and the apply allow-list** (admin-owned config outside the API).
- **Store connections and credentials** (HQ `DistributionLocation`; never on the wire).
- **Any ActionSync change**; the page only calls its existing control door.
- **Automatic hand-back to ActionSync**; it is always a person's action.
- **Schema or DDL reconciliation** (DataSync is data-only).
- **Arabic.**
- **Throughput metrics and chunk history** (later DataSync enhancements).

## Further Notes

- **Provisioning (owner acts, not this repo):** the `DataSyncConsole` screen and the roles
  `DATASYNC_VIEWER` / `DATASYNC_OPERATOR` seeded in HQ's authorization tables (rows as in
  `C:\Work\Replicate_SqlDataCompare\demo\sql\50_hq_schema.sql`); the IIS route `/DataSync/*`; DataSync
  configured against the same HQ as SIS.Api. Engine spec §9.2 has the full list.
- **Session idle.** DataSync validates the session but never touches it. A technician who only
  watches DataSync for longer than the idle timeout is logged out by design; ordinary SIS.Api traffic
  keeps the session alive.
- **SQL Server 2008 stores** work (client-side hashing) but compare more slowly; a long first chunk is
  expected, not a hang.
