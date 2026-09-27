---
status: done
spec: 324
blocked-by: 327
---

# 329 — A delivery's page lists its order's files under "Filed on order \<no\>"

## What to build

Opened as a delivery (`/oms/delivery/{no}`), the Attachments tab already lists `attachmentOwnerNo`'s files (327).
This ticket makes that visible (spec 324 → "A delivery's page").
- When `attachmentOwnerNo` differs from the **route's** number, the list is headed **"Filed on order \<no\>"**. The
  number links to `/oms/document/<no>`.
- An ATBI owner reads the same, since it is an order document.
- When the owner is the route's own document (an order's page), no heading shows.
- One pure predicate decides it: the owner number and the route number are compared trimmed, and an absent owner
  gives no heading.

The heading is a caller's word passed into the shared panel (326's words seam), so the panel itself stays unaware of
orders.

**Words:** "Filed on order {{documentNo}}", interpolated, goes in `document`.

## Spine reach

store/logic · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `filedOnOrder`: it is shown only when the owner differs from the route's number. There is no heading for an
      order's own page, or for an absent owner. · pure (vitest)
- [x] `order-attachments-drive`: a stubbed delivery shows its order's files under the heading, and the link lands on
      `/oms/document/<owner>`. An order's page shows no heading. · flow

## Boundaries

No endpoint (the delivery read already carries `attachmentOwnerNo`, 2063). New `document` key. The heading's link
uses logical utilities.

## Done when

A stubbed delivery's Attachments tab says "Filed on order \<no\>" with a working link, and the pure test and the drive
are green.

## Blocked by

[327](327-opening-the-attachments-tab-lists-the-orders-files-once.md)

## Comments

**Built 2026-09-27 (AFK).**

- **Pre-flight:** BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. 2077 is still open, which is expected.
  329 adds no endpoint.
- **The rule:** `filedOnOrder(ownerNo, routeNo)` in `attachments-tab.ts` returns the trimmed owner number, or `null`.
  It returns `null` when the owner is absent, empty, blank or not a string, and when the trimmed owner equals the
  trimmed route number (an order's own page). An ATBI owner is just another order number to it.
  `useOrderAttachments` exposes it as `filedOnOrderNo`, but only while the tab's gate admits.
- **The seam:** `AttachmentsPanelWords` gains an optional `heading?: ReactNode` (a type-only import). The panel draws
  it first, above Add and the list, and draws nothing when it is absent. The slip drawer passes none, so its four
  drives are unedited and green.
- **The link:** the order tab's `FiledOnOrder` renders `document:attachments.filedOnOrder` =
  `"Filed on order <order>{{documentNo}}</order>"` through react-i18next's `<Trans>`. The number is a named param, and
  only it is the link: a router `<Link>` to `/oms/document/<no>`, with no tab parameter. This is the first `<Trans>` in
  the repo, chosen so the Arabic word order stays data. It is logged in HITL-329 for the owner's wording read.
- **Proof:**
  - vitest: 5 new `filedOnOrder` cases plus one wording case in `attachments-tab.test.ts`, red first. The full suite
    has 2656 tests, all passing.
  - `order-attachments-drive` 244/244, with 6 new 329 checks:
    - the heading text;
    - the number is the link, with its href;
    - the link lands on `/oms/document/<owner>`;
    - landing reads **zero** ByOwner;
    - the order's own tab reads once;
    - the order's own page shows **no heading**.
  - Slip drives, **unedited**: count 64/64, drawer 63/63, add 52/52, withdraw 68/68.
  - Document drives: detail 39/39, cards 45/45, rail 25/25, rtl 53/53, band 34/34, items 23/23. `document-actions`
    fails the same 3 checks it has failed since before this wave (7358a84).
  - `typecheck`, `lint` (all three gates) and `build` are green.
- **Reviews:**
  - `/code-review`: no findings. It noted one speculative edge case, now logged in HITL-329: the comparison is against
    the route's number, as the ticket says, so a route written differently from the server's number would show the
    heading on the order's own page.
  - `/standards-review`: no hard violations on either axis. Applied: `filedOn` renamed to `filedOnOrderNo`. Kept, as
    judgement calls:
    - the node in the words type, which the ticket names as the seam;
    - the props passed one by one from the hook, the page's existing pattern;
    - a third hand-built `/oms/document/` path. Unifying it means a core route helper, which is out of this slice.
- **Outstanding (owner):** the read of the new wording, and a delivery's page against a live SIS.Api (2071's hand
  walk).

