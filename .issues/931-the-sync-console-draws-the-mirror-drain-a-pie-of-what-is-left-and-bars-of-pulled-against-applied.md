---
status: open
spec: BO 4091 (C:\Work\DMSCO\BackOffice\.issues\4091-the-sync-console-shows-the-mirror-draining-or-falling-behind-and-since-when.md)
blocked-by: BO 4091
---

# 931 — The sync console draws the mirror drain: a pie of what is left, and bars of pulled against applied

## What to build

A **Mirror drain** page in the sync console, at `/admin/sync/mirror`, over `GET ActionSync/Mirror/Inbox` (BO 4091).
Link it from the Mirror pull / Mirror apply rows of the worker card and from the Fleet header. It refreshes every 60 s
and shows the time of the last read.

The owner wants something easy to read: an operator should see at a glance whether there is a problem, and since when.
Read the `dataviz` skill before building, and use the console's `core/charts` (`DonutChart`, `ComboChart`, `KpiTile`).

1. **The verdict sentence**, on top and in the verdict's colour:
   - `healthy`: "Draining, empty by 14:20".
   - `behind`: "Falling behind since 19 Nov 08:00", then the door's `reasons[]` as a short list.
   - The time comes from `troubleSince`. Never compute it in the browser.
2. **The pie: "Pulled in the last 24 h".** A donut of `window24h`:
   - applied (good colour);
   - still waiting to be applied (warning colour);
   - parked (danger colour).

   The centre reads the **% applied** and, under it, the pending count. Next to it, one muted line: "Not pulled yet:
   ~N rows at the stores (measured HH:mm)", from `tillBacklogKnown`. While the pull is paused, those rows cannot be
   in the pie.
3. **The bars: "Pulled against applied".**
   - Two bars per slot: pulled and applied.
   - The **pending line** (`pendingAtEnd`) on its own axis.
   - A dashed horizontal line at the backpressure threshold.
   - A switch for **6 h (10-minute slots) / 24 h / 7 days (hourly)**.
   - Slots the door marks `bad` get a light danger band behind them, and a vertical marker labelled **"since
     08:00"** at `troubleSince`. That marker is what answers "since when".
4. **Tiles** (`KpiTile`):
   - pending, against the threshold;
   - lag;
   - applied/min and arrived/min;
   - pull state ("paused since 19 Nov 21:38", or running);
   - **pull resumes at**;
   - **empty at**;
   - open parks.

   A null ETA reads "not draining", in the danger colour.
5. **Two tables:**
   - pending by type;
   - parks by reason. Each park links to the existing dead-letter tab (458): retry and acknowledge stay there.

No controls on this page. Arabic and English, RTL-safe, with figures wrapped in `Ltr`.

## Spine reach

UI → BackOffice SIS.Api `ActionSync/Mirror/Inbox` (BO 4091)

## Proof (→ `tdd` red-green cycles)

- [x] Helpers: verdict sentence for each verdict; the "since" marker placed on the `troubleSince` slot; null ETA reads
  "not draining"; the pie's centre % from `window24h` · vitest
- [x] Component: fixtures for `healthy`, `behind` (pull paused, trouble since 08:00) and `down`, in both languages ·
  vitest
- [ ] Live walk against a SIS.Api with BO 4091, on staging's sink

## Boundaries

Read-only. No settings door. No alerting (a follow-up).

## Done when

The owner opens the page and answers, without SQL, whether the mirror is winning, how much of today's pull is left,
and since when there has been trouble.

## Blocked by

BO 4091

## Comments

- 2026-11-20 - **Built** (uncommitted, worktree `C:\Playground\oms-react-t931`, branch `t931` off main `5fc9bd71`).
  - Page `MirrorDrainPage.tsx` at `/admin/sync/mirror`: a **Mirror drain** tab in `ConsoleNav` (every console holder), and links from the Mirror pull/apply rows of the worker card and the Fleet header. 60 s refresh, the read time shown.
  - The view model `mirror-drain-helpers.ts` (pure): the verdict sentence (`troubleSince`, else the pull's pause; never worked out in the browser), the reasons by code, the pie, the "since" marker (on the first slot, "before this window", when the trouble is older), the ETAs ("not draining" in danger ink).
  - `MirrorDrainChart.tsx`: two panes on one x-axis (766 §E: no dual axis): pulled vs applied bars; the waiting line with the pull's limit (drawn only when the line comes within half of it); danger bands over the door's bad runs and a dashed marker in both panes, its words as a caption above the chart (an SVG label at the window's edge clipped).
  - **Deviations:** the pie is the page's own recharts donut, not `core/charts/DonutChart`: its slices are states (success / attention / danger tokens), not palette entities. Tiles are the page's own: `KpiTile` is the analytics tile (delta, sparkline, measure units). The donut centre shows the % applied only; the all-time waiting count lives on the Waiting tile (beside the 24 h slice it read as a contradiction).
  - Copy in English and Arabic (`drain.*`, `nav.mirror`). ⚠ The OMS app boots i18n in English for every locale (`src/core/i18n.ts`), so under `oms.locale = ar` the page is RTL with English words; sentences carry `dir="auto"` / `<bdi>` so they read whole.
  - **Proofs:** `mirror-drain-helpers.test.ts` (16, the three fixtures healthy/behind/down and every key in both files); `console-pages.test.ts` and the Arabic key list in `control-helpers.test.ts` updated. Sync-console suite 570/570; `tsc` clean; lint gates clean except `check-boundaries`' four pre-existing `insurance-rules` hits. Stubbed drive `tools/sync-console-drain-drive.mjs`: 23/23, shots in `tools/.sync-console-drain-shots/` (add the folder to `.gitignore` with the commit).
  - **Owed:** the live walk against a SIS.Api with BO 4091, on staging's sink.
