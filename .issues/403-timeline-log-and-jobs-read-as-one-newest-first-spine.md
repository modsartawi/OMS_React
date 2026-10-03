---
status: done
spec: 380
blocked-by: 402
---

# 403 — The timeline, the Log and the jobs read as one newest-first spine

## What to build

Delivery details tells the delivery's story in **one vertical list, newest first**, on the start
side of the page (spec 380 **D1** Details-side times, **D4** spine, **D5**, **D6**, **D7**; ruled in
[371](371-the-delivery-details-record-page.md) §3–4 and
[369](369-how-a-deliverys-state-maps-to-timeline-steps.md) §2–5).

**Extend 396's `@/core` timeline derivation with Log rows:**

- **A step's time** is the `entryTime` of the **latest Log row** whose `actionType` reached it:

  | Step | Log action types |
  |---|---|
  | Created | `DCRT` |
  | Ready | `DRDY` / `DTXC` |
  | Out for delivery | `DOFD` |
  | Delivered | `DDLR` |
  | Cancellation requested | `DRCL` |
  | Cancelled | `DCLS` / `DFCL` / `DCNI` / `DCAD` |

  A reached step with no matching row shows **no time**.
- **Never a time source:** `statusHistory`, `DeliveryDateTime`, `EstimateDeliveryTime` or
  `changedOn`.
- **The next step's expectation** reuses 083 D-7's `deliveryWindow()`, never the raw schedule fields
  (live `8000000121` has from = to).

**`feed()`** merges Log rows and outbox jobs on `entryTime`. On a tie, the Log row comes first.

**The spine, top to bottom:**

1. **One banner per `F` job:**
   - line one: the handler, "failed", the attempts and the time;
   - line two: the last error.

   **No Retry button.** The banner's inline end keeps room for one (410).
2. A **`P` job with an error** gets a quiet line: "failing, retrying automatically · attempt n · next
   hh:mm" plus its error. It never gets a button.
3. The **unreached steps**, furthest first. The next one carries its window as an *expectation*.
4. **The Now line.** The composer arrives in 405, so this slice draws only the line.
5. **The past, newest first:**
   - A Log row that reached a step is a **milestone node** (the latest matching row).
   - An earlier pass superseded by a rewind is **struck through** and reads "earlier pass". Only
     lifecycle steps can be superseded.
   - A rewind row (`DRBK` / `DRSC` / `DCHC`) is an **amber node**.
   - Jobs and notes are small event rows.
   - Cancellation requested is **indigo**, and Cancelled is red. The prototype drew amber; the build
     must not.
   - **There is no "now" tag on a milestone.**

The spine **replaces the Log and Jobs tabs.** Items, conditions and the facts stay where they are
until 404.

The reference is `timeline()` / `feed()` in `__prototype__/derive.ts` on branch
`prototype/371-delivery-details` (`bf0754d`, variant D), with captures in `assets/371-shots/D-*.png`.

## Spine reach

logic (`@/core` timeline + `feed()`) · component (spine column, job banners) · i18n (`document`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `step time is the latest matching Log row, and a reached step with no row has no time` (the full action-type table, the rewind case where Ready is reached twice) · pure
- [x] `feed merges Log and jobs newest first with the Log row first on a tie; only lifecycle steps are struck as earlier passes` · pure
- [x] `expectation uses deliveryWindow, not the raw schedule fields` (from = to fixture) · pure
- [x] `tools/document-spine-drive.mjs`: light, dark and RTL; one banner per `F` job, the `P` line, the struck pass, the amber rewind node, indigo vs red; the who · when meta and the expectation window isolated under RTL (D12) · flow (Playwright)

## Boundaries

- **No new endpoint.** It reads today's header, Log and Jobs.
- **BO-4** (`SdDocumentHeaderAction` milestone times) would later replace the Log derivation. It is
  not blocking and not filed.
- **i18n (`document`):**
  - `spine.now`, `spine.earlierPass`, `spine.expected`;
  - the rewind labels (returned by driver, rescheduled, courier changed);
  - `jobs.failed` (`{{handler}} failed · {{attempts}} attempts`);
  - `jobs.retrying` ("failing, retrying automatically · attempt {{n}} · next {{time}}").
- **No Retry** (370 / BO-1, which is 410).

## Done when

Details shows one newest-first spine in place of the Log and Jobs tabs, with Log-derived step times,
per-job failure banners and the indigo/red/amber rules, and the pure tests and drive are green.

## Blocked by

- [402](402-details-opens-on-a-light-header-with-now-step-and-due-tag.md) — the light header and the
  details-side derivation input

## Comments

**Built 2026-10-04 (AFK).** Judgement calls are in `.afk/HITL-403.md`.

- **Pure, in `@/core/oms`.**
  - `timeline.ts`: `timelineInputFromHeader(doc, logs)` now takes the Log. A step's time is the
    `entryTime` of the latest row whose action type reached it (`stepOfLogAction`,
    `latestLogFor`, `logStepTimes`; the six-step table of 369 §4). "Latest" is by time, then log
    number, never by arrival order. A row with no real time dates nothing. The rewind marker's
    time is the latest row of the `lastAction`'s own type. `statusHistory`, `DeliveryDateTime`,
    `EstimateDeliveryTime` and `changedOn` are never read. The expectation stays
    `deliveryWindow()`.
  - New `timeline-feed.ts`: `feed(logs, jobs)` merges on `entryTime`, newest first, with the
    Log row first on a tie (HITL: the 371 captures drew the reverse). `jobState` reads F / C /
    P + error / P. `spine(steps, logs, jobs)` returns the failed banners, the retrying lines,
    the future (furthest first) and the past. In the past:
    - the latest matching row of a reached step is its **milestone**;
    - a lifecycle row with a rewind after it is **superseded** ("earlier pass");
    - `DRBK`/`DRSC`/`DCHC` are **rewind** rows;
    - `DADN`/`OADN`/`XADN` are **notes**;
    - everything else is an **event**, and every job is a small row.
    A reached step with no row is drawn untimed, just above the step before it.
- **Component.** `ActivitySpine.tsx`, on the start side from 1280px, stacked above below that.
  It replaces the Log and Jobs tabs. The summary rail and the Items/Conditions/Attachments
  tabs stay beside it until 404.
  - One danger banner per F job: line one is `jobs.failed` plus the time it last failed, line
    two is the error. An empty `data-retry-slot` cell is kept for 410, and no Retry is built.
  - A quiet line per failing P job ("failing, retrying automatically · attempt n · next hh:mm"
    plus its error).
  - The unreached steps sit above the Now line (a dashed rule labelled Now; 405 adds the
    composer), and the next step carries `spine.expected`.
  - Milestone colours: done is primary, current is the inspector's ringed dot, Cancellation
    requested is `--fam-cancel-request` indigo, and Cancelled is danger red. Rewinds are amber
    nodes. There is no "now" tag on a milestone.
  - Who · when are two isolates: the user is a `<bdi>`, the time `Ltr`. The schedule window is
    `Ltr`, the slot's words are a `<bdi>`. A Log row's note, action data and "was <old value>"
    are each a `<bdi>`.
- **Retired:** the Log/Jobs grid columns, `failedJobRowStyle`, `isFailedJob`, the
  `logDateTime` kit and `formatLogDateTime`, the failed-count tab badge, and their keys. The
  load-failure keys are now `log.loadFailed` / `jobs.loadFailed`.
- **Proof.**
  - `src/core/oms/timeline.test.ts` gains the describes `step time is the latest matching Log
    row, and a reached step with no row has no time` (10 tests: the full table, Ready reached
    twice across a rewind, ties, the cancellation steps, the 0001 time, the never-sources, the
    marker) and `expectation uses deliveryWindow, not the raw schedule fields` (the From = To
    8000000121 capture).
  - `src/core/oms/timeline-feed.test.ts` has the describe `feed merges Log and jobs newest first
    with the Log row first on a tie; only lifecycle steps are struck as earlier passes` (14
    tests, including cancelled after delivery and the no-rewind repeat), plus `the spine around
    the Now line` (3).
  - All were run red first. `npm test`: 189 files, 3492 tests passed.
  - **`tools/document-spine-drive.mjs`: 92/92** in light/dark × LTR/RTL at 1440. It covers the
    out-for-delivery case (two F banners, one P line), the 8000000121 rewind capture, the
    8000000174 cancellation-requested capture, a cancelled stub and a Log that fails to load.
    It checks: the tabs are gone; the spine is at the inline start, 340–420px wide; the block
    order; the banner lines, the empty Retry slot and no button; the P line; the expectation
    isolates (ltr range vs dir-auto slot, never 23:56); the struck passes; the amber rewinds;
    indigo vs red, never amber; who · when isolated and reading LTR, with Arabic rows under
    RTL; the "was" old value; no "now" tag; the Now line; the in-spine Log error.
  - **Drives updated for the removed tabs, all green:** `document-detail` 37/37,
    `document-items` 22/22 (now at 1920, see HITL), `order-attachments` 244/244,
    `grid-theme` 119/119.
  - **Drives re-run:** `document-rtl` 52/53 (the pre-existing inert-box check),
    `document-header` 292/292, `document-cards` 45/45, `document-actions` 67/67,
    `return-dialog` 105/105, `deliveries-list` 362/362, `command-palette` 366/366, and
    `foundation` 1294/1302 (its baseline).
  - `npm run lint`: four gates clean (168 pairs, unchanged). Typecheck and build are green.
- **Reviews.**
  - /code-review found Delivered struck as "earlier pass" under `X`; fixed, with a test. Its
    note about the lost old value led to `spine.was`.
  - /standards-review raised four things:
    - a stale `grid-theme-drive`, now fixed;
    - a no-rewind repeat being struck; it is now an event, per D5;
    - a duplicated latest-row scan, now one `latestLogWhere`;
    - a glossary clash on "passed", now `rewoundAfter`.
    The tie order and the interim layout are logged for the owner.
  - The grid-theme drive surfaced duplicate React keys for rows that have no id. Keys now carry
    the row's position.
- **Outstanding (not AFK):**
  - the owner's S4 sign-off (at 405);
  - a human eye on real Arabic copy;
  - the owner's call on the HITL items: tie order, struck-pass rule, untimed-step placement,
    interim layout and `spine.was`.

