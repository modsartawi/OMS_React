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

- [x] `insurance-section model: flags a gap between current and engine money` · vitest
- [x] `insurance-section model: an unpriced line reads unpriced, not zero` · vitest
- [x] `insurance-section model: an item-0 condition's money is its rate` · vitest
- [x] `insurance-section is absent without the grant or on a non-insurance order` · vitest

## Boundaries

Read-only; door stubbed until BackOffice 3390 is on staging.

## Done when

Proof tests green; 1006358459 on dev shows engine 13.26 beside current 63.65 with the gap flagged.

## Blocked by

Server: BackOffice [3390](C:\Work\DMSCO\BackOffice\.issues\3390-an-insurance-orders-insurance-read-answers-its-plan-money-lines-and-pricing-and-the-engine-money-without-changing-it.md)

## Comments

**2026-11-05 — built on `impl/787`, stubbed (implementer).**

- **What was built.** A full-width **Insurance section** (`id="insurance"`, linkable as
  `/oms/document/<no>#insurance`; it scrolls itself into view once the read has landed) between the LF return panel
  and the two columns of Document Details. Drawn only on the document route, for a record that is not a delivery,
  with `canViewInsurance`, and only when the read answers an insurance order.
  - `InsuranceSection.tsx` (container) → `InsuranceMoneyPart.tsx` (badge + its line, Received / Current / Engine per
    figure, ⚠ on each gap + a gap note, amount due / on account / paid) → `InsuranceLinesPart.tsx` (sent → dispensed,
    original item + pharmacist reason, group / category / ceiling, engine vs applied deductible with ⚠, VAT,
    patient, insurer, channel per-line split, unresolved / unpriced reason / guard decision, voided struck; a native
    `<details>` "How it was priced" per line and one for the header conditions). `InsuranceCell.tsx` draws a money
    cell or the word for its absence.
  - Pure model `insurance-section.ts` (`moneyTable`, `lineView`, `pricingSteps`, `asksInsurance`,
    `insuranceSectionGate`, `moneySourceBadge`); money via `formatMoneyIn` in the read's `currency`, gaps compared at
    `roundMoney`; unpriced is its own cell kind, never `0.00`; item-0 money is `rate`.
  - `documentApi.getInsurance` reads the business refusal `NOT_INSURANCE_ORDER` as `null` (no section); a 403 runs
    `revokeInsuranceViewOnForbidden`; any other failure is said in place. Refresh re-reads it.
  - `document:insurance.*` in **en and ar** (`insurance-i18n-keys.test.ts` proves they mirror).
- **Proof.** The four vitest proofs above are green (20 tests in `insurance-section.test.ts`). The UI was driven
  with `tools/insurance-section-drive.mjs` (LTR + RTL, 38/38): gap flagged on 1006358459, unpriced and voided
  variant, step order, DFEE read by rate, absent on a non-insurance order / without the grant / on the delivery
  route, a failing read said in place. Gates: typecheck, `npm test` (9010), lint with only the 4 inherited boundary
  hits.
- **Stubbed.** The door `GET SdDocumentWeb/Document/{no}/Insurance` is not built: the drive stubs it with
  `__fixtures__/insurance-1006358459.json` (hand-built in 3390's proof shape: current 63.65 / 2.66, engine
  13.26 / 53.05). Guesses carried from the contract commit: the grant flag `canViewInsurance`, the refusal code
  `NOT_INSURANCE_ORDER`, `currency` on the read, all-`null` engine header money when any line is unpriced.
- **Still open.** "Done when"'s live check — 1006358459 on dev showing engine 13.26 beside current 63.65 — waits on
  BackOffice **3390** reaching dev/staging.
- **Seams.** 788 adds Plan / Changes / Received as parts in `InsuranceSection` (marked slot) with their own pure
  modules beside `insurance-section.ts`. 789's strip can reuse `moneySourceBadge` and `MoneyCell`/`InsuranceCell`
  (same feature) and link to `#insurance` (`INSURANCE_SECTION_ID`).

**2026-11-06 (orchestrator, /implement-spec 786-789):** built and code-reviewed on integration branch `spec/3389-order-insurance` (tip after review fixes 512e87e3); Proof green against stubbed doors. Stays **open** only for the live Done-when check, which waits on the BackOffice 3389 doors reaching dev/staging.
