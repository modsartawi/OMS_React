---
type: spec
status: ready
---

# 863 — Data sync: a technician retries a store that dropped out, or re-runs the stores that failed as a new campaign

Follows spec [558](558-a-technician-compares-and-reconciles-store-data-from-the-browser-spec.md) and the DataSync
engine spec (`C:\Work\Replicate_SqlDataCompare\.scratch\data-sync-engine\spec.md`, §2.5 / §2.6 / §4). Unlike 558,
this spec owns **both halves**: a small set of new DataSync doors and fields (built in
`C:\Work\Replicate_SqlDataCompare`), and the page work in `features/admin/data-sync`. Glossary terms
**Retry** and **Re-run** were pinned in the DataSync glossary for this spec (grilling session, 2026-11-10).

## Problem Statement

A technician running a DataSync campaign across many stores ends up with some stores **failed** and no
way, from the screen, to do anything about them:

- A store whose link dropped half-way through (a few tables finished, then it went unreachable) shows
  `Failed`. DataSync can already **retry** it from where it stopped, but the screen has no Retry button,
  so the technician does not know retry exists, or whether to "retry later" by hand.
- A store that failed because a table could not be synced (schema mismatch, bad key, FK check) cannot be
  retried — it would fail the same way. After the cause is fixed, the technician wants to run **just
  those stores and just those tables** again, in a new campaign. Today that means reading each failed
  job's drawer, writing down the store codes and tables, and typing them into New Campaign.
- On a fleet campaign the jobs grid spans many pages and can only be filtered by job status, so finding
  one store's job, or every store that failed for a given reason, means paging by eye.

## Solution

From the campaign page the technician can:

1. **Search the jobs by store** and **filter by failure reason**, alongside the existing status filter,
   on any page of any campaign.
2. **Retry** a failed store that dropped out — one store from its job drawer, or every retryable store
   from the campaign header. The retried store resumes inside the same campaign from its checkpoints;
   finished tables are not redone.
3. **Re-run the failed stores** that retry cannot help with one button, *New campaign from failed (N)*.
   It opens the New Campaign dialog already filled in — same profile (locked), those stores, only the
   tables they did not finish, the original's mode — and the technician writes what was fixed as the
   reason. The new campaign is stored as a **re-run of** the original, and both pages show the link.

The rule the technician follows: **a store that dropped out → Retry; a store that failed on its data →
fix it, then Re-run.** DataSync's own automatic attempts (three, with backoff) are unchanged and come
first; Retry is what the operator does after they run out.

No new role: Retry and creating a re-run need `DataSync.Operate` (role `DATASYNC_OPERATOR`); the search,
the filters and reading the re-run offer need `DataSync.View`.

## User Stories

### Finding stores in a campaign

1. As a technician, I want to type part of a store code into the campaign page and see only that store's
   job, so that I do not page through a fleet campaign by eye.
2. As a technician, I want the store search to ignore letter case, so that `p014` finds `P014`.
3. As a technician, I want to filter the jobs by failure reason (unreachable, table failures, WPF-hosted,
   location unresolved, error), so that I can see every store that failed the same way.
4. As a technician, I want the store search, the status filter and the reason filter to combine, so that
   I can ask for "failed, table failures, stores starting P0".
5. As a technician, I want the search and filters kept in the page address, so that a refresh, the back
   button or a shared link shows the same filtered list.
6. As a technician, I want the paging to restart at page one when I change a filter, so that I never
   land on an empty page of a shorter list.
7. As a technician, I want an empty filtered list to say that nothing matches the filter, not that the
   campaign has no jobs, so that I do not think the campaign is broken.
8. As a viewer (View only), I want to search and filter too, so that I can follow a campaign without
   the Operate grant.

### Retrying a store that dropped out

9. As a technician, I want each job to say whether it can be retried, so that I do not try to retry a
   store that will fail the same way.
10. As a technician, I want a Retry button in the drawer of a retryable job, so that I can bring back one
    store whose link is up again.
11. As a technician, I want a *Retry N retryable* button in the campaign header, so that after a network
    blip I can retry thirty stores at once.
12. As a technician, I want to confirm a retry and optionally add a note, so that the job's last control
    note says why it was retried.
13. As a technician, I want a retried store to resume from where it stopped, keeping the tables it
    already finished, so that a retry does not redo hours of work.
14. As a technician, I want a retried store in a completed campaign to reopen the campaign as running,
    so that the campaign's progress keeps telling the truth.
15. As a technician, I want an apply retry on a store whose ActionSync is not paused to be refused in
    words ("the store is busy — pause ActionSync first"), so that I know what to do next.
16. As a technician, I want an apply retry on a WPF-hosted store to be refused in words, so that I stop
    trying a store that can never be applied to.
17. As a technician, I want a retry refused because the campaign is cancelling or cancelled, or because
    nothing is retryable any more, to say so in words, so that a stale screen does not confuse me.
18. As a viewer, I want no Retry buttons shown without Operate, so that the screen does not offer what
    the server will refuse.
19. As an auditor, I want an apply retry to be its own audited run chained to the failed one, so that I
    can tell what the retry wrote apart from what the first run wrote.

### Re-running the stores that failed on their data

20. As a technician, I want a *New campaign from failed (N)* button on a campaign that has failed stores
    retry cannot help, so that I can run them again after fixing the cause.
21. As a technician, I want the button to count only those stores, so that I know how many the new
    campaign will hold before I open it.
22. As a technician, I want stores that dropped out (retryable) left out of the re-run, so that a store is
    never synced by the old campaign's retry and the new campaign at the same time.
23. As a technician, I want the new campaign's profile locked to the original's, so that it really is a
    re-run of the same sync.
24. As a technician, I want the new campaign pre-filled with only the tables the failed stores did not
    finish, so that tables that already synced are not run again everywhere.
25. As a technician, I want those tables to be every table any of the failed stores did not finish, so that
    one campaign covers them all; a store already in sync on a table just compares it and writes nothing.
26. As a technician, I want to drop a store or a table from the pre-filled dialog, so that I can leave out
    the one I have not fixed yet.
27. As a technician, I want the dialog to start in the original's mode but let me switch to Report-only,
    so that I can check a fix before applying it.
28. As a technician, I want WPF-hosted stores dropped from an apply re-run with a note saying why, so that
    I do not create a campaign whose jobs will fail at start.
29. As a technician, I want the reason box to start empty and still need at least ten characters for
    Apply, so that the audit records what was fixed rather than a generic "re-run" sentence.
30. As a technician, I want an apply re-run to pause ActionSync for its stores first, exactly like any
    apply campaign, so that a re-run gets the same safety as the first run.
31. As a technician, I want the new campaign's page to say *Re-run of <original>* with a link, so that I
    can go back to the campaign whose failures it is fixing.
32. As a technician, I want the original campaign's page to list its re-runs (*Re-run by …*) with their
    status, so that the original stops looking like unfinished work.
33. As a technician, I want a second click on *New campaign from failed* to leave out stores already in a
    live re-run of this campaign and say which re-run holds them, so that I cannot create two campaigns
    for the same store by accident.
34. As a technician, I want a store whose re-run was cancelled offered again from the original, so that
    a cancelled re-run does not strand the store.
35. As a technician, I want a store that failed again in the re-run to be offered from the re-run's own
    button, so that each store's history follows one chain.
36. As a technician, I want the button available while the campaign is still running, so that I can start
    fixing the first failures before the last stores finish — failed jobs never run again, so this is
    safe.
37. As a technician, I want the button hidden when no store qualifies, so that I am not offered an empty
    campaign.
38. As a technician, I want the server to refuse a re-run whose profile differs from the original's, or that
    names a store already in a live re-run of it, so that a stale screen or a direct call cannot break the
    rules the dialog follows.
39. As a viewer, I want to see the re-run links but not the button, so that I can follow the history
    without Operate.
40. As an operations lead, I want a re-run of a re-run to be allowed, so that a stubborn store can be
    worked through more than one fix.

## Implementation Decisions

### Boundaries

- **Engine vs app:** this is **DataSync + oms-react only**. No change to SIS.Pos, the BackOffice
  assemblies DataSync consumes, ActionSync, or the compare/apply engine.
- **No new grant or role.** Existing `DataSync.View` / `DataSync.Operate`.
- **No flag.** The new doors and fields are additive; the page reads them when present.
- **Live posture:** DataSync is deployed on DWOMS02 behind the OMS BackOffice proxy. This spec ships a
  new state-DB migration and a new DataSync package; it is a live deploy to a running service, not a
  re-seed. A deploy that replaces the OMS BackOffice site's `web.config` drops the `/DataSync/*` proxy
  rule — the runbook must keep it.

### DataSync: retry (already built — consumed, not changed)

- Retry is DataSync spec §2.6 as built: job and campaign Retry, only for `StoreUnreachable` and
  `TargetUnresolved`, resuming from checkpoints with a fresh three attempts; everything else is 409
  `DATASYNC_INVALID_STATE`; apply retry re-checks the store like Resume (`DATASYNC_STORE_BUSY`,
  `DATASYNC_STORE_WPF_HOSTED`). The read models already carry `Job.retryable` and
  `Campaign.retryableJobs`. **Nothing here changes on the server**; the page has never consumed them.

### DataSync: jobs list filters

- `GET /Campaigns/{campaignId}/Jobs` gains two optional query parameters beside `status`:
  - `store` — a case-insensitive **contains** match on the store code (the client part of the
    `(Client, Code)` key is not searched; a fleet has one client);
  - `failureReason` — one of the job failure reason codes; an unknown value is refused 422 like an
    unknown `status`.
- All three filters combine with AND; paging and ordering are unchanged (creation order).
- The search is bound as a bounded ANSI string, never a unicode parameter, so it stays a seekable
  predicate on the store-code column.

### DataSync: the re-run offer

- New `GET /Campaigns/{campaignId}/RerunTargets`, grant **View**, enveloped like every door. 404
  `DATASYNC_CAMPAIGN_NOT_FOUND` for an unknown campaign.
- It returns the campaign's **re-runnable** jobs: `Failed` with reason `TableFailures`, `Error` or
  `StoreWpfHosted` — exactly the failures Retry refuses (it reuses the server's own retryable rule, so
  the two can never disagree).
- Per job: `{client, code, failureReason, unfinishedTables[]}`. **Unfinished tables** = the job's tables
  that did not end `Succeeded` (for `TableFailures` these are the failed ones; for an `Error` part-way
  through, the failed and the never-started; for `StoreWpfHosted`, all of them).
- Top level: `{campaignId, profileId, mode, tables[], targets[], excluded[]}`, where `tables` is the
  **union** of every target's unfinished tables, in profile order.
- `excluded[]` lists re-runnable stores that are **already in a live re-run** of this campaign —
  `{client, code, rerunCampaignId}`. *Live* = the re-run campaign is in any state but `Cancelled`. Only
  **direct** re-runs of this campaign are checked; a store that fails again in a re-run is offered from
  that re-run.
- WPF-hosted stores are returned (their reason says why); dropping them from an **Apply** re-run is
  the client's pre-fill rule, and the existing create warning stays the server's backstop.

### DataSync: the re-run link

- Campaign create body gains optional `rerunOf` (a campaign id). The checks, after the existing ones:
  - the named campaign exists → else 404 `DATASYNC_CAMPAIGN_NOT_FOUND`;
  - its profile is the request's profile → else 422 `DATASYNC_RERUN_PROFILE_MISMATCH`;
  - no requested store is already in a live re-run of it → else 422 `DATASYNC_STORE_IN_LIVE_RERUN`,
    naming the stores. (The dialog leaves them out; **the refusal is the guard, the omission the
    courtesy**.)
- Stores and tables are otherwise free within the profile's existing rules — the server does not
  require them to be a subset of the offer (an operator may legitimately narrow, and a re-run is still a
  campaign).
- The `reason` rules are unchanged: required and at least ten characters for Apply, ignored for
  Report-only. `rerunOf` never supplies or satisfies a reason.
- **State DB:** one new migration adds a nullable re-run-of column on the campaign (NULL = not a re-run)
  and an index on it for the *re-run by* and *live re-run* reads. NULL is the meaningful value here.
- Campaign read model gains `rerunOf: {campaignId, name} | null` and
  `rerunBy: [{campaignId, name, status}]` (newest first).
- The OpenAPI draft, DataSync spec §2 / §4 / §5, the Postman contract collection and the demo handbook
  are updated in the same change, as the Retry change did.

### oms-react: the page

- **Model:** `Job.retryable`, `Campaign.retryableJobs`, `Campaign.rerunOf`, `Campaign.rerunBy`, and the
  re-run offer shape are added to the data-sync model; the API module gains `campaignJobs` filters,
  `rerunTargets`, campaign Retry and job Retry.
- **Jobs grid filters:** a store search box and a failure-reason select beside the status select; all
  three live in the page address with the page number, and any change resets to page one. The empty
  state distinguishes *no jobs* from *nothing matches*.
- **Retry:** a Retry control in the job drawer when `retryable`, and *Retry N retryable* in the campaign
  header beside Pause / Resume / Cancel when `retryableJobs > 0`. Both behind `canOperate`, both through
  the existing control confirm dialog with its optional note, and their 409s mapped to sentences in the
  existing control refusal words.
- **Re-run:** *New campaign from failed (N)* in the campaign header behind `canOperate`, where N is the
  offer's target count; hidden at N = 0. It opens the existing New Campaign dialog in a **re-run mode**:
  - profile shown and locked;
  - targets = the offer's stores as codes (the existing pasted-codes path), removable;
  - tables = the offer's union, removable (not addable beyond the profile's tables);
  - mode = the original's, switchable;
  - in Apply, WPF-hosted stores are left out of the pre-fill and named in a note;
  - excluded stores are named in a note ("P014 is in re-run 01JE…");
  - reason empty;
  - the request carries `rerunOf`.
  The rest of the dialog is the existing flow unchanged — for Apply that is create → pause ActionSync
  in tagged batches → Start (564).
- **Links:** the campaign page header shows *Re-run of …* and *Re-run by …* as links to those campaigns.
- Strings in English and Arabic in the `data-sync` namespace.

## Testing Decisions

- A good test drives the **public door** or the **rendered behaviour** and asserts what a caller sees —
  statuses, envelopes, rows returned, buttons present, requests sent — never private helpers or SQL text.
- **Not POS:** the SIS.Pricing tiers do not apply. Two seams, both existing:
  1. **DataSync — the `/DataSync` HTTP API**, through the integration suite's API host over a throwaway
     LocalDB state DB, and the Postman contract run. Covers:
     - jobs filters: store partial match, case-insensitivity, reason filter, combined with status,
       unknown reason refused, paging over the filtered set;
     - `RerunTargets`: which failure reasons appear and which do not (unreachable and unresolved never),
       unfinished tables per reason, the union in profile order, exclusions by a live re-run, a
       cancelled re-run not excluding, a re-run's own failures not offered from the grandparent, 404,
       View grant enough and no grant 403;
     - create with `rerunOf`: link stored and read back as `rerunOf` / `rerunBy`, unknown campaign 404,
       profile mismatch 422, live-re-run store 422 naming the stores, apply reason still enforced;
     - the migration applies cleanly on an existing state DB and leaves existing campaigns as non-re-runs.
     Seed a non-trivial store count so a filter or exclusion that ignores its input cannot pass, and
     mutation-check the exclusion predicate once.
     Prior art: `ControlTests` (Retry, state set-up by job row), `CampaignReadTests`,
     `CreateValidationTests`, `DoorGrantTests`, and the Postman contract scenarios.
  2. **oms-react — pure helpers plus a stubbed drive.**
     - pure: the jobs-view ↔ address round-trip with the new filters; the re-run pre-fill from an offer
       (union kept, Apply drops WPF-hosted, excluded stores become a note, reason empty, `rerunOf`
       set); Retry control visibility by `retryable` / `retryableJobs` × `canOperate`; the new refusal
       codes in words.
     - stubbed drive: filters reach the jobs door; Retry posts to the job and campaign doors with the
       note; *New campaign from failed* opens the dialog pre-filled and the create carries `rerunOf`;
       no Operate → no Retry and no re-run button.
     Prior art: `control-helpers.test.ts`, `create-helpers.test.ts`, `job-helpers.test.ts`, and the
     563 / 564 drive scripts.
  - The **live** check on DWOMS02 (a real dropped store retried, a real table failure re-run) folds into
    ticket 566's walk rather than a ticket of its own.

## Out of Scope

- A CSV / Excel export of failed stores (the pre-fill replaces it; can be added later if audit asks).
- Any change to DataSync's automatic retry policy (three attempts, backoff, cap) or to which failures
  Retry accepts.
- Retrying `TableFailures` in place, or fixing a schema mismatch from the screen.
- One re-run per distinct set of failed tables; re-running across profiles.
- A new role or grant.
- Store search by name, region or client; searching across campaigns.
- Automatic re-runs or scheduled retries.

## Further Notes

- Defaults chosen by the agent during grilling and not vetoed: the re-run button is available in any
  campaign state; Apply re-runs drop WPF-hosted stores with a note; the re-run keeps the "pause
  ActionSync first" default; re-runs of re-runs are allowed; no new role.
- Defaults chosen while writing this spec (veto in `/to-tickets` if wrong): *unfinished tables* =
  tables not `Succeeded` (so an `Error` part-way through re-runs its never-started tables too); the
  store search is a contains match on the code only; the server does not force a re-run's stores or
  tables to be a subset of the offer — it only refuses a profile mismatch and a store in a live re-run.
- Glossary: **Retry** (same campaign, from checkpoints) and **Re-run** (a new campaign of the failures
  retry cannot help) — *avoid* using either word for the other.
