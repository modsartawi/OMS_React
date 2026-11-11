---
status: open
spec: 819
blocked-by: 834
---

# 835 — The v2 analytics screens call the real doors on staging

## What to build

The live walk, the same shape as [784](784-the-analytics-screens-call-the-real-doors-on-staging.md). Against staging SIS.Api, the web half's stubbed wire is checked door by door against BackOffice's real v2 doors:
- Access;
- the item shapes, parameters and bindings;
- Query with series, `notReached` and `fellBack`;
- Audience, AudienceCandidates and Reassign;
- Words;
- Schedules and Runs;
- the copilot's report tools.

Then the acceptance case runs on real data, and one scheduled send reaches a real mailbox.

⚠ **Drift rule:** a `400` on a first live call is a drift report. Correct the BackOffice spec first, then spec 819's transcription.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model/api reconciled against the real wire · test (live drive)

## Proof (→ `tdd` red-green cycles)

- [ ] live drive: every v2 door answers in the shape the web expects; the acceptance case on staging data; one real scheduled email received with its PDF · flow (live)

## Boundaries

Needs BackOffice's v2 doors deployed to staging (spec 819's BackOffice asks) and v1 live first (784). Coupon redemption measures stay unavailable until 818.

## Done when

The live drive passes on staging, and any drift is corrected in BackOffice's spec and then here.

## Blocked by

[834](834-the-acceptance-case-runs-end-to-end-against-stubs.md)

## Open questions

Which staging accounts hold the runner, author and curator grants for the walk; which mailbox receives the test send.

## Comments

- 2026-11-07 — **first live walk, local rig** (staging has no v2 doors):
  - **The rig:**
    - BackOffice spec 3408 is merged in `pricing2`; only 3428 is unbuilt (it waits on 818).
    - The image `oms-analytics:835-local` is built from committed `pricing2`. It runs as `analytics835-one` on Docker port 14835, against a freshly seeded synthetic POS (`analytics835-mssql`, port 14335).
    - Local SIS.Api runs on :5111 as environment `Walk835` (a gitignored copy of the dev settings; see the worker bug below), with the worker on and report mail going to Mailpit `http://10.211.55.2:18025`.
    - On local `POS_Server` I applied SQL 003–005 and `Seed-Analytics-Author-Authorization.sql`, and gave employee 14419 the placeholder email `walk835.owner@al-dawaa.com.sa`.
    - The drive is `tools/analytics-v2-live-drive.mjs`.
  - **Works live:**
    - Access (`canView`, `canAuthor`, `canCurate` all true for the admin).
    - The model (97 measures, 13 views including store_day, claims, loyalty and promotions).
    - Health.
    - The copilot builds a report through `create_report`. Its third attempt was accepted, after two refused. It took 94 s.
    - The designer and the report page open. All 3 panels answer, and each Query goes by `{itemId, panelId}` with the period. No door refused anything.
    - History answers, as `{at, by{id,name}, action, revision, detail}`.
    - Creating a schedule (server shape) and Send now both work.
  - **Server findings (BackOffice):**
    1. With `Analytics:ReportScheduleWorker=X`, SIS.Api won't start under `Development`. The singleton `AnalyticsScheduleWorker` takes the scoped `IAnalyticsAccessGate` from the root provider (`AnalyticsWebEndpoints.cs:102-104`). In production it would start, but keep one gate and its session for the life of the process.
    2. The copilot defaults (`Copilot:MaxSeconds` 60, `MaxToolCalls` 8) can't build the acceptance report with gemini-3.8-flash. It stopped early after 3 reads. With 180 s and 12 calls it built the report, but only as KPI and bar panels: no text with live figures, no summary, no stores table.
    3. The trace's failed `create_report` steps carry no reason, so neither the web nor the audit says why the AI's first two reports were refused.
    4. The answer never sends `assumptions` or `nextSteps` (Share… / Schedule…).
    5. No render-ticket door returns the report definition, so the print route can't draw the report under a ticket (ADR 0125).
  - **Web drift, confirmed live:**
    - AudienceCandidates is a flat `[{kind, id, name, label, removed, employeeId}]`. The share dialog and the recipient picker therefore offer nothing, and a schedule can't be saved from the UI.
    - Weekly `days` sent as numbers gets a bare 400. The server takes `sun`…`sat`.
    - A 414 answers `{recipients:[{id, reason}]}` with `noCompanyEmail`, `noRunGrant`, `notInAudience` or `overLimit`.
    - SendNow and runs come back as `{recipients{sent, dropped}, outcome:'' (open), summary: string, artefacts{html, pdf, expired, keptUntil}, addedAt, processedAt}`.
  - **Web drift found by reading code, still to confirm live:** 3408 drift items 2, 5, 7/8/46, 11, 12, 16/23, 20, 24, 27, 37 and 59, plus the 411/413 data, Revisions `savedAt`/`savedBy` and audience role `{name, label: string}`. The field-by-field table is in this session's notes.
  - **Mail (rig limit, not a defect):** `EmailService` always uses STARTTLS (or SSL on connect), and Mailpit has no TLS. The Send now run failed 3 times as "The mail to every recipient failed". It issued 3 render tickets and kept no artefact. Proving the email and its PDF needs either a TLS catcher the machine trusts or the real SMTP account.

- **2026-11-07, later: the copilot fixed end to end (local rig, uncommitted in both repos).** The acceptance sentence now builds the whole report on its first `create_report`, and the live drive passes steps 1–3, 22/22:
  - the copilot builds it in 87 s with no refused step and no early stop;
  - the card shows Open, Share and Schedule (to `#share`/`#schedule`) and both assumptions;
  - the page fills all 8 live figures from the Words door.
  - Five fixes, one at a time, each red then green:
    1. **BackOffice: the trace says why a step failed.** It gains an additive `error` field, the same scrubbed text the model read. That showed the real cause: a chart-fit `ANALYTICS-406` on every series panel.
    2. **BackOffice: series are the bar's and the table's axis.** `AnalyticsQueryCompiler.CheckShape` counted only the query's dimensions, so "HungerStation vs QC, yesterday" as a grouped bar or a table was always a 406. That's why the copilot fell back to KPI tiles. It now counts the series as one category for bar and table, within the series rules' one-category limit, so 411 still lists every problem.
    3. **BackOffice: `create_report`/`edit_report` take `assumptions[]` and `nextSteps[]`** (`share`, `schedule`). The answer carries `assumptions[]` and `reportRefs[].nextSteps`, the shapes the web already read. The model had been writing its own links (`/reports/<id>/share`, `report:<id>`), which lead nowhere.
    4. **BackOffice: report rulebook 3, migration `007_copilot_report_rulebook_3.sql`.** It adds a text block of live figures at the head of each section, links via `nextSteps` and never as a written URL, and assumptions via the tool. It swaps only an unedited rulebook 2, and a test holds it byte-identical to `CopilotSystemPrompt.ReportRulebook3`. **Found on the way:** the local DB was on house-rules v1, because 006 had never been applied. Staging and prod need 004 → 006 → 007, then the D14 eval.
    5. **Web: live figures in the server's shape** (3408 §F, drift 16/23). Tokens are `{{fig:<panel>:<measure>[:<series>]}}`, and the Words figures are `{value, formatted{en,ar}}`. A panel offers each measure over its whole selection, each one per series on a series panel. Changed: `live-figures.ts`, `wire.ts` `readWords`, `ReportTextEditor`, the sample report, the stubs, and `analytics-drive.mjs` (829 now clicks the field's edge, because a wider chip took its middle).
  - Gates: BackOffice copilot+analytics 394 tests. Load-only timing/DB flakes pass alone. Web: 9,482 tests, typecheck, the lint gates (only the 4 known `insurance-rules/aliases` boundary violations), and the stub drive 827/829/831/834.
  - Still open from this walk: the AudienceCandidates and schedule-shape drift (share and schedule from the screen), the print route's ticket doors, the email proof, and the worker DI crash.
  - Committed: BackOffice pricing2 `9131cbe2f`, oms-react main `ca199d63`.

- **2026-11-07, later still: three more fixes, committed.**
  1. **Web drift: share and schedule in 3408's shapes** (oms-react `fe302372`).
     - AudienceCandidates is read as the server's flat `{kind, …}` list. A role's key is its `name` and its label one string; the item's audience reads the same way.
     - Weekly days are written and read as `sun`…`sat`. A monthly day may be `last`, which the editor now offers.
     - Schedule recipients are read from `{id, name}`. `ownerNoRun`/`ownerNoAuthor` read as `ownerGrant`.
     - A 414 is read by its `reason`.
     - A run is read from `recipients{sent, dropped}`, a plain `summary`, `artefacts{html, pdf, expired}`, trigger `slot`, outcomes `sentWithoutCharts`/`missed`, and an open run reads as "Sending…".
     - The candidates carry no address, run grant or audience flag (3408 item 18). A flag the server did not send no longer bars a recipient: the save's 414 names whom it refuses.
     - Gates: 9,491 tests and the stub drive 826/833/834 at 232/232.
     - **Not yet proven live:** the saved sign-in expired, and the sign-in window timed out.
  2. **BackOffice: the worker DI crash** (`87c1c25c9`). The singleton worker now resolves the scoped `IAnalyticsAccessGate` **and** the scoped `IReportEmailService` per check and per send (`AnalyticsWorkerScopedGate`, `AnalyticsWorkerScopedMail`). Proven live: SIS.Api starts under `Development` with the worker on, and survives a tick.
  3. **The print route under a render ticket** (BackOffice `671c3f5d2`, oms-react `1cea7152`).
     - BackOffice gains a fourth ticket door, `GET Analytics/Render/Report/{id}`: the report at the ticket's revision, read as its owner. ADR 0125 and 3408 item 24 are amended.
     - The web print page, opened with `?ticket=`, does all of the following:
       - skips the session guard;
       - calls the four ticket doors with `X-Analytics-Render-Ticket`;
       - asks no session door;
       - takes the run's `lang`;
       - sets `data-print-ready` instead of opening the print dialog.
     - Proven live with a cookie-less headless Chromium and a ticket issued on the local DB. The copilot-built report printed whole (3 panels, live figures filled), and all four doors answered 200.
  - **Still open:**
    - Prove share and schedule live (needs a sign-in).
    - The email proof: the mail service always requires STARTTLS with normal certificate checks. Mailpit needs a certificate the machine trusts, or a real send through the company account. The owner decides which.
    - Cosmetic: a series panel's title reads "Value through our tills by" with nothing after it.

- **2026-11-07: the copilot edits the open report (832), live in the owner's browser.**
  - **Drift:** the web sent `reportContext.draft` as `{title, subtitle, definition}`. BackOffice reads `draft` as the definition itself (`{params, bindings, sections}`, 3421). So the model was shown an empty report:
    - it answered `cannot-answer` with no tool call;
    - or it returned an empty `edit_report`, which the designer applied, wiping the report (Undo restored it).
  - **Fixed in the web:** `CopilotReportContext.draft` is now the bare definition.
  - **Proven live:** "Remove the cancellation rate panel." took one `edit_report` with no refusal. Exactly that panel went, the other two sections, texts and panels stayed, and it became one "AI: …" undo step, unsaved.
  - **Correct refusal:** report `06GV64D27KTXDS08HD960HTBR2` is Certified, so `edit_report` is `403` (3408 item 37), and the model offers Save as my copy.
  - **BackOffice asks (unfiled):**
    - `edit_report` should refuse an edit that empties the report in context, as a guard.
    - 3408 §I should say `draft` is the bare definition.
    - The designer should say on a Certified report that the AI can't edit it (see 836).
