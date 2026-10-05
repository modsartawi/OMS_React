---
status: done
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

- [x] `generate fills the buy line with the returned COUP number` · vitest
- [x] `the action is absent on a non-Planned bonus buy and on a grouping line` · vitest

## Boundaries

Needs BackOffice 2404 for the live walk.

## Done when

The owner generates a coupon material on a new bonus buy, saves it, picks the same material on a coupon template, and redeems
it on a simulated basket.

- [ ] **OWNER, outstanding:** the walk above. It needs a dev SIS.Api carrying BackOffice 2404 (open). Until a pick list
  exists, the "picks on a coupon template" step is done by typing the number (ADR 0051).
- [ ] **OUTSTANDING, no door:** "the coupon template's material box also offers coupon materials to pick from" is NOT
  built. `CouponsAdminWeb` has no list of coupon materials and spec 2396 names none. Nothing was invented, and coupons does
  not import the bonus-buy feature's Generate. The typed box is unchanged (ADR 0051). The missing door is a coupon-material
  list read on `CouponsAdminWeb` (for example `GET CouponsAdminWeb/CouponMaterials`), not yet asked of BackOffice.

## Blocked by

419 (read-only rules) (+ BackOffice 2404)

## Comments

**Built 2026-10-05 (AFK).** BackOffice 2404 is open, so `POST BbyMaintainWeb/CouponMaterial/Generate { description }` →
`{ status: 'saved' | 'refused', material, refusals? }` is the SPEC'S READING. It lives in one place:
`BbyCouponMaterialRequest` / `BbyCouponMaterialResult` in `src/core/models/bonus-buy-maintenance.ts` plus
`bbyMaintainApi.generateCouponMaterial`. `refusals` is optional and shown when present.

- `editor.ts` (pure): `couponMaterialOffered(access, line)` is `!readOnly && type === 'material'`, so the action shows on
  Planned OMS bonus buys and on new ones before their first Save. It never shows on a grouping line, in Display, on SAP
  bonus buys, or on Tested, Activated, Deactivated or unreadable statuses.
- `couponMaterialDefault` gives the bonus buy's text. `readGenerateOutcome` only counts a `saved` that names a material.
- `fillCouponMaterial` puts the number on the asked-for line, as a typed material would. A line removed, or turned into a
  grouping, while the call was out is left alone. `couponMaterialLands` lets the page say "created but not placed" instead
  of claiming the number is on the line (a `/code-review` finding).
- `BuyGetPanels.tsx`: a `TicketPlus` icon button beside a Buy line's identifier (aria-label "New coupon material").
- `BonusBuyEditorPage.tsx`: a description prompt, mounted on each press so it starts from the bonus buy's text, with no
  `maxLength` (the server clamps). Each press is a new call and a new material; nothing is cached.
- The outcome shows in the editor's `ActReport`: `saved` fills the line, `refused` shows the server's EN + AR refusals.
- The description column shows what 417 renders for any keyed material, which is nothing yet: there is no item-lookup
  door, and none was added.
- Copy is server-side and unchanged. A copied bonus buy keeps its source's material.
- i18n under `couponMaterial.*` only. Proof: vitest 203 files / 3714 tests green (11 new); typecheck, lint (4 gates) and
  build clean; `tools/bby-maintenance-drive.mjs` 176/176 **stubbed** (new block 42–44).
- Step 28 (419's block) now waits for the toolbar to re-render before reading Activate. It failed 2 of 3 runs here (HITL-420
  logged it). Only a wait was added; the assertion is the same.
- Guesses and decisions: `.afk/HITL-422.md`.
