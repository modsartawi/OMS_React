---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md
blocked-by: 419
---

# 422 — New coupon material on a Buy line

**Source:** BackOffice spec 2396.

## What to build

- On a Buy line of a **Planned** bonus buy (Line Item Type = Material), add a **New coupon material** action. It works before
  the bonus buy's first Save.
- The action opens a prompt for the item description, defaulting to the bonus buy's text (editable), then calls
  `POST BbyMaintainWeb/CouponMaterial/Generate { description }`.
  - On `saved`, the returned `COUP…` number fills the line, and its description shows like any keyed material.
  - On `refused`, the reason is shown.
- Each press makes a new material. A copied bonus buy keeps its source's coupon material.
- The coupon template's material box still accepts a typed number (ADR 0051). It also offers coupon materials to pick from.

## Spine reach

UI (Buy grid, coupon template) · API client (Generate)

## Proof (→ `tdd` red-green cycles)

- [ ] `generate fills the buy line with the returned COUP number` · vitest
- [ ] `the action is absent on a non-Planned bonus buy and on a grouping line` · vitest

## Boundaries

Needs BackOffice 2404 for the live walk.

## Done when

The owner generates a coupon material on a new bonus buy, saves it, picks the same material on a coupon template, and redeems
it on a simulated basket.

## Blocked by

419 (read-only rules) (+ BackOffice 2404)
