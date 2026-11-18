---
status: open
spec: BO 4032 (E:\Projects\BackOffice\.issues\4032-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4043
---

# 915 — The operations lead keeps Mini POS assignments, pharmacies and item lists in OMS

## What to build

Three screens behind the 4043 grants:
- **Mini POS assignments:** today's view (who is where), add a row with dates and planned hours (the overlap
  message comes from the server), end a row, and "end this promoter now" (sessions and future rows).
- **Mini POS pharmacies:** enable, trial role, print or reprint the signed QR as a printable page.
- **Mini POS items:** the A-level allow-list and the refusal list with its reason.

Arabic and English, RTL, phone width.

## Spine reach

UI → BackOffice SIS.Api (4043)

## Proof (→ `tdd` red-green cycles)

- [ ] Component tests: today view, the overlap message shown, the reprint confirm, the list add/remove · vitest
- [ ] Live walk against a SIS.Api with 4043

## Boundaries

Behind the 4043 grants. No back-end change here.

## Done when

The three screens work against 4043 and their component tests are green.

## Blocked by

BO [4043](E:\Projects\BackOffice\.issues\4043-the-operations-lead-manages-assignments-pharmacies-and-item-lists-through-sis-api.md)
