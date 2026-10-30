---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 699
---

# 701 — Monitors take the communication and payment scopes

## What to build

Stories 43, 44; A11; doors 3299, 3300. A monitor can choose scope `communicationRequest` (reason, category and a
payload-text-present flag, never its content) or `paymentReconciliation` (per detail: payment, early fee, Nphies fee and
amount). The catalog offers each scope's facts. The editor says that every payment fact reads unknown when a detail
matches no auth, or matches ambiguously.

## Spine reach

model (scopes) · store/logic (facts per scope) · component (scope picker, note) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] each scope offers only its own facts, and no `$previous` where the door has none — pure
- [ ] write and save one monitor on each scope — flow

## Boundaries

These scopes ship last in BackOffice, each gated on its own census run, so this ticket may go live after the others.
Doors stubbed; 711 reconciles.

## Done when

An author can watch payer communications and payments, and no screen shows communication content.

## Blocked by

699.

## Comments
