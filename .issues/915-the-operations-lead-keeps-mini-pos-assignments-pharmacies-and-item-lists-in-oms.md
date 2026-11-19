---
status: done
spec: BO 4063 (E:\Projects\BackOffice\.issues\4063-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4074
---

# 915 — The operations lead keeps Mini POS assignments, pharmacies and item lists in OMS

## What to build

Three screens behind the 4074 grants:
- **Mini POS assignments:** today's view (who is where), add a row with dates and planned hours (the overlap
  message comes from the server), end a row, and "end this promoter now" (sessions and future rows).
- **Mini POS pharmacies:** enable, trial role, print or reprint the signed QR as a printable page.
- **Mini POS items:** the A-level allow-list and the refusal list with its reason.

Arabic and English, RTL, phone width.

## Spine reach

UI → BackOffice SIS.Api (4074)

## Proof (→ `tdd` red-green cycles)

- [x] Component tests: today view, the overlap message shown, the reprint confirm, the list add/remove · vitest
- [ ] Live walk against a SIS.Api with 4074 — owed: no SIS.Api with 4074 and the `OMS_MINIPOS_ADMIN` seed was reachable from the build session

## Boundaries

Behind the 4074 grants. No back-end change here.

## Done when

The three screens work against 4074 and their component tests are green.

## Blocked by

BO [4074](E:\Projects\BackOffice\.issues\4074-the-operations-lead-manages-assignments-pharmacies-and-item-lists-through-sis-api.md)

## Comments

**2026-11-19 — built on `t915` (from `spec/4063-mini-pos`).**

- New area `src/features/mini-pos/` (URL prefix `/mini-pos/*`, its own nav group right after OMS): `assignments`,
  `stores`, `items`, each with its `api.ts`, a pure module and props-only view components; namespaces
  `mini-pos-assignments` / `mini-pos-stores` / `mini-pos-items`, English and Arabic. Wire shapes in
  `src/core/models/mini-pos.ts`; the two grants in `src/core/mini-pos/access.ts` read the one permissions answer
  (`MiniPosAdmin:03` view, `MiniPosAdmin:06` manage, both added to `SCREEN_KEYS`) — not the `MiniPosAdmin/Access` probe,
  per oms 914. Every manage control is hidden without `:06`; the doors check again.
- Assignments: today's view grouped by pharmacy; add (promoter login, optional staff id, pharmacy, from/to, planned hours
  a day) with the form's own checks; the `MINIPOS_ASSIGNMENT_OVERLAP` refusal shows the clashing row from the refusal's
  `data` beside the server sentence; End one row and "End this promoter now" behind a confirm; a find by promoter or
  pharmacy (current and future, or all).
- Pharmacies: enable/disable, trial role (Trial / Control / none) per row, "add a pharmacy" (a control pharmacy is only
  marked, never enabled), Print (opens `/mini-pos/print/:storeCode`, a chromeless page that draws the QR client-side with
  `react-qr-code` from `PrintedCode`'s signed code) and Reprint behind a confirm that names both versions and warns every
  older print stops working.
- Items: the A-level allow-list and the refusal list with its reason; add and remove, the list updated from the answer.
- Proof: `src/features/mini-pos/**/*.test.ts` + `src/layout/menu-mini-pos.test.ts` (55 tests) render the views as
  static markup through real en/ar i18next instances and stub the network at `@/core/api`; three guards were
  mutation-checked (manage gate on the row actions, the reprint warning, the list add's de-duplication). Full suite,
  typecheck, build and the lint gates green, except `check-boundaries`' four violations in
  `src/features/insurance-rules/aliases/door-shapes.test.ts`, which are on `spec/4063-mini-pos` already.
- Owed: the live walk against a SIS.Api carrying 4074, with `Seed-MiniPos-Admin-Authorization.sql` applied and a holder
  bound to `OMS_MINIPOS_ADMIN`.
