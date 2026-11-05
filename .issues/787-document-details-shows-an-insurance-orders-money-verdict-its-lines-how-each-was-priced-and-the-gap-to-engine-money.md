---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md
blocked-by: — (server: BackOffice 3390)
---

# 787 — Document Details shows an insurance order's money verdict, its lines, how each was priced, and the gap to engine money

## What to build

Backend: BackOffice spec 3389 (`C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md`). SIS.Api minimal APIs, System.Text.Json web defaults (camelCase). Door: BackOffice 3390 `GET SdDocumentWeb/Document/{no}/Insurance` (insurance-view grant).


An **Insurance section** on Document Details (the page has no tabs — the section sits in its layout, linkable
directly), drawn only for an insurance order and only with the insurance-view grant. Verdict first:

- **Money**: the `CHANNEL` / `ENGINE` badge with one line on what it means; channel / current / engine money side by
  side for patient, deductible, deductible VAT, uncovered, insurer, plus amount due / on account / paid; a gap
  between current and engine money flagged ⚠.
- **Lines**: sent (SFDA, text, item, qty, unit) → dispensed; original item and pharmacist reason on a swap; group,
  category, ceiling; engine deductible beside applied; VAT, patient, insurer; channel per-line amounts when sent;
  voided lines struck through; unresolved reason and guard decision. A per-line **How it was priced** disclosure lists
  the conditions in step order with description, base, rate, value (item-0 conditions read by rate).
- Unpriced engine money shows as unpriced, never 0. EN + AR, RTL; money in the currency's decimals.

Approved layout (spec 3389 prototype preview):

```
MONEY   [CHANNEL] Patient pays what Bupa sent
            Received   Current   Engine
Patient      63.65      63.65    13.26 ⚠
LINES   # Sent (SFDA/text/qty) → Dispensed · Grp · engine vs applied · ▸ How it was priced
```

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [ ] `insurance-section model: flags a gap between current and engine money` · vitest
- [ ] `insurance-section model: an unpriced line reads unpriced, not zero` · vitest
- [ ] `insurance-section model: an item-0 condition's money is its rate` · vitest
- [ ] `insurance-section is absent without the grant or on a non-insurance order` · vitest

## Boundaries

Read-only; door stubbed until BackOffice 3390 is on staging.

## Done when

Proof tests green; 1006358459 on dev shows engine 13.26 beside current 63.65 with the gap flagged.

## Blocked by

Server: BackOffice [3390](C:\Work\DMSCO\BackOffice\.issues\3390-an-insurance-orders-insurance-read-answers-its-plan-money-lines-and-pricing-and-the-engine-money-without-changing-it.md)
