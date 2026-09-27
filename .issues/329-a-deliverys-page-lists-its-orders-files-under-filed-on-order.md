---
status: open
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

- [ ] `filedOnOrder`: it is shown only when the owner differs from the route's number. There is no heading for an
      order's own page, or for an absent owner. · pure (vitest)
- [ ] `order-attachments-drive`: a stubbed delivery shows its order's files under the heading, and the link lands on
      `/oms/document/<owner>`. An order's page shows no heading. · flow

## Boundaries

No endpoint (the delivery read already carries `attachmentOwnerNo`, 2063). New `document` key. The heading's link
uses logical utilities.

## Done when

A stubbed delivery's Attachments tab says "Filed on order \<no\>" with a working link, and the pure test and the drive
are green.

## Blocked by

[327](327-opening-the-attachments-tab-lists-the-orders-files-once.md)
