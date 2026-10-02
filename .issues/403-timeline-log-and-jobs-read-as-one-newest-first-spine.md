---
status: open
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

- [ ] `step time is the latest matching Log row, and a reached step with no row has no time` (the full action-type table, the rewind case where Ready is reached twice) · pure
- [ ] `feed merges Log and jobs newest first with the Log row first on a tie; only lifecycle steps are struck as earlier passes` · pure
- [ ] `expectation uses deliveryWindow, not the raw schedule fields` (from = to fixture) · pure
- [ ] `tools/document-spine-drive.mjs`: light, dark and RTL; one banner per `F` job, the `P` line, the struck pass, the amber rewind node, indigo vs red; the who · when meta and the expectation window isolated under RTL (D12) · flow (Playwright)

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
