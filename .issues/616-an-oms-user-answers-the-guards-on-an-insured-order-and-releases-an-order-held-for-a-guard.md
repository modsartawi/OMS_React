---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 616 — An OMS user answers the guards on an insured order and releases an order held for a guard check

## What to build

On an insured OMS / delivery order, the same per-line guard dialog as the till: REFUSE → remove or change;
WARN → tick; OVERRIDE → intervention / outcome / reason with the `INS_GUARD` grant. The order list shows "guard
check: action needed" and "guard check pending"; a user with the release grant releases a held order.

**HQ contract:** the brief's sections for BackOffice 3142, BackOffice 3143. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components (in the existing orders area via a shared core piece) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `guardAnswer_requiresTriadForOverride` — pure
- [ ] drive (stubbed)

## Boundaries

Touches the orders feature — the dialog lives in `core/` so features don't import features. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)
