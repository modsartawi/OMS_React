---
status: done
spec: 380
blocked-by: 403
---

# 404 — Facts, items and folded conditions sit beside the spine, and the tabs are gone

## What to build

Delivery details becomes **two columns**: the spine (403) on the start side, about 340–420px, and
the **facts column** on the end side (spec 380 **D4**; ruled in
[371](371-the-delivery-details-record-page.md) §3).

- **The facts column**, top to bottom:
  - **Customer · Prescription · Fulfilment · Driver & tracking · Payment**, as dense label/value
    blocks built by today's `railCards` (083 D-5/D-6's emptiness rules kept);
  - **Items:** the items grid **sized to its rows** (AG Grid's auto-height floor was a capture
    artefact), with deleted lines struck through and the pinned totals footer;
  - **Pricing conditions**, folded into a disclosure that shows its count. This is the default from
    choosing C; reopen 371 to overturn it.
- **Remove** the 083 tabs and the 340px summary rail. Every fact they held now lives in the spine or
  the facts column, so check that nothing is orphaned (attachments included: wherever today's
  Attachments tab lives, it keeps a door).
- **A cancelled delivery keeps 083 D-10's evidence-only gating** (D3 default).

## Spine reach

component (two-column layout, facts column, items grid, conditions disclosure) · logic (reuse
`railCards`, `items`) · i18n (`document`) · test

## Proof (→ `tdd` red-green cycles)

- [x] Existing `rail.test.ts` / `items.test.ts` stay green with the cards reused unchanged (the emptiness rules hold) · pure
- [x] `tools/document-facts-drive.mjs`: light, dark and RTL at 1280 and 1440; no tabs and no summary rail; every block present for a full delivery and absent per the emptiness rules for a sparse one; the items grid has no empty floor; the conditions disclosure shows its count and expands; the Attachments door is still reachable · flow (Playwright)
- [x] `npm run lint`: the grid base `defaultColDef` gate (383) passes on the items grid · gate

## Boundaries

- **No new endpoint.**
- **i18n (`document`):** the conditions disclosure label with count (plural), and any section headers
  the facts column needs. **Retire** the tab-label keys that no longer render.
- **Logical Tailwind.** The column order mirrors in RTL.
- 🚩 **Check the Attachments tab** (prescriptions wave 324) before deleting the tabs. Its door must
  survive, as a facts block or a disclosure.

## Done when

Delivery details renders as spine + facts column with no tabs and no summary rail, every fact still
reachable, and the drive green in light, dark and RTL.

## Blocked by

- [403](403-timeline-log-and-jobs-read-as-one-newest-first-spine.md) — the spine must exist before
  the tabs that held Log and Jobs go

## Open questions

- Where does the order's **Attachments** tab land: a facts-column block, or a disclosure under Items?
  371 did not draw it. Default: a disclosure under Items, with the file count. Raise it with the
  owner at S4 sign-off.

## Comments

**Built 2026-10-04 (AFK).** Judgement calls are in `.afk/HITL-404.md`.

- **`FactsColumn.tsx`** (the old `SummaryRail.tsx`, moved) is the end side of Delivery details,
  beside the 403 spine. The page is two columns from 1280px; below that the facts stack under the
  spine. Under RTL the column order mirrors. Top to bottom:
  - **The facts.** One `--card` card holds the five blocks `railCards` returns, unchanged, so
    083 D-5/D-6's emptiness rules hold. The blocks sit in two columns from `md` and three from
    `2xl`. Each value is isolated by kind: `numeric` → `Ltr`, otherwise `<bdi>`. IDs, codes and
    phones are in Plex Mono; money stays in Sans. Only the Prescription heading is coloured.
  - **Items · n.** `DetailGrid` is now always `domLayout: 'autoHeight'`. The core theme sets a
    one-row floor (`autoHeightMinBodyHeight`; AG Grid's default is 150px). A `global.css` rule
    puts AG Grid's overlay horizontal scrollbar in its own lane, because without the floor it
    covered the last line. Deleted lines are struck and the totals pin under the last line.
  - **Pricing conditions · n.** A `<details>` disclosure. Its grid is built on the first opening
    and then kept.
  - **Attachments · n.** A `<details>` disclosure, last in the column (the settled default). It
    is drawn only while `attachmentsTabGate` admits. The audited ByOwner read waits for its
    first opening. Files · N · Show opens it and focuses its summary. Its body stays mounted when
    folded.
- **Removed:** the tabs, their state and counts, the 340px rail, the `rail:` 900px breakpoint,
  and `DetailGrid`'s unused loading and error states.
- **i18n (`document`):**
  - Added `items.heading`, `conditions.heading` and `attachments.heading` (each
    `_one`/`_other`, with the count in an `Ltr` Trans slot), plus `attachments.headingUncounted`.
  - Retired `tabs.*`.
  - Reworded `cards.ariaLabel` ("Document facts"), `cards.showFiles`, `conditions.empty` and the
    withdraw 403 notice, so no copy says "tab".
- **Gate:** check-contrast gains `--prescription` on `--card` (170 pairs).
- **Proof.**
  - `npm test`: 189 files, 3492 tests. `fields.test.ts` (railCards) and `items.test.ts` were not
    edited and pass. `rail.test.ts` was deleted in 402 along with the pill rail; railCards'
    tests are in `fields.test.ts`. `attachments-tab.test.ts` now names the disclosure's keys.
  - **`tools/document-facts-drive.mjs`: 240/240** in light/dark × LTR/RTL × 1280/1440. It checks:
    - no tabs and no summary rail; the spine at the start and the facts at the end;
    - all five blocks and their rows on a full delivery, and only Customer · Fulfilment ·
      Payment with blank rows omitted on a sparse one;
    - every value isolated by kind and reading LTR under RTL; mono for IDs, Sans for money;
    - no em dash;
    - Items · 4 and Items · 1 with no empty floor and nothing over the last line, a struck
      deleted line and the pinned footer;
    - Pricing conditions · 2 folded and then expanding to its grid, and · 0 on the sparse
      delivery;
    - the Attachments door: folded with · 3, Show opening it with focus and exactly one
      ByOwner, a fold and reopen reading nothing, and absent without files;
    - a cancelled delivery drawing the same commands as a live one, with no More menu;
    - no raw keys and no page errors.
  - `npm run lint`: four gates clean, and the grid-base gate passes on the items grid.
  - **Drives updated for the removed tabs and rail, all green:**
    - `document-detail` 36/36;
    - `document-items` 22/22;
    - `document-cards` 45/45;
    - `order-attachments` 243/243 (the tab is now the disclosure; the "selected" checks are
      now "open" checks);
    - `grid-theme` 119/119;
    - `document-spine` 92/92.
  - **Re-run:**
    - `document-header` 292/292, `document-actions` 67/67, `return-dialog` 105/105;
    - `document-rtl` 52/53 (the pre-existing Plex Mono inert-box check, the same three
      entries as before);
    - `foundation` 1294/1302 (its baseline).
  - Typecheck and build are green.
- **Reviews.**
  - /code-review caught `grid.loading` being retired while two dialogs still use it. It is
    restored.
  - /standards-review raised the dead `rail:` breakpoint (removed), stale "tab"/"selection"
    wording (fixed), and `conditions.empty` copy drift (fixed). It also raised the
    mono-phone call and the attachments placement, both logged in HITL. The `*Tab`/`rail*`
    names are kept on purpose.
- **Outstanding (not AFK):**
  - the owner's S4 sign-off (at 405), including where Attachments sits and phones in mono;
  - a human eye on real Arabic copy.
