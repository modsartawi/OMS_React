---
status: open
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

- [ ] Existing `rail.test.ts` / `items.test.ts` stay green with the cards reused unchanged (the emptiness rules hold) · pure
- [ ] `tools/document-facts-drive.mjs`: light, dark and RTL at 1280 and 1440; no tabs and no summary rail; every block present for a full delivery and absent per the emptiness rules for a sparse one; the items grid has no empty floor; the conditions disclosure shows its count and expands; the Attachments door is still reachable · flow (Playwright)
- [ ] `npm run lint`: the grid base `defaultColDef` gate (383) passes on the items grid · gate

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
