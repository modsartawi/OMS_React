---
status: open
spec: BackOffice 4096
blocked-by: BO 4097
---

# 933 — The bonus-buy editor shows the promotion's sales area and currency, BHD to 3 decimals

## What to build

The bonus-buy editor reads its Organizational Data and currency from the bonus buy's promotion instead of the
fixed `BBY_ORG` (1000 / 20) and the org-only `ORG_CURRENCY` map. That map cannot tell 1000 / 20 from
1000 / 21, so it goes.

- The header shows the promotion's sales area: sales organization, its name, distribution channel, its name,
  and the Bonus Buy Currency.
- Every money label and hint follows that currency: Total Minimum Value, Value, Total Discount, Curr/Pe, and the
  per-unit hint. The existing `formatMoneyIn` already gives BHD 3 decimals, and the inputs already step 0.001.
- A bonus buy loaded under a Bahrain promotion shows BHD everywhere, and no SAR remains on the screen.

The editor sends no sales area: the server takes it from the promotion.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4096-an-oms-promotion-is-written-for-ksa-or-bahrain-spec.md`.

## Spine reach

UI (editor state, header, Buy/Get panels, locales)

## Proof (→ `tdd` red-green cycles)

- [ ] a Bahrain promotion → the editor currency is BHD and the header shows 1000 / 21 with its labels · `editor.test.ts`
- [ ] a KSA promotion → SAR and 1000 / 20, unchanged · `editor.test.ts`
- [ ] `currPe` and the per-unit hint format BHD to 3 decimals (e.g. 1.250) · `editor.test.ts`
- [ ] the request carries no sales-area field · `editor.test.ts`

## Boundaries

Needs the BO 4097 contract (the promotion document carries the pair, currency and labels).

## Done when

The Proof tests are green, and a stubbed drive of a Bahrain bonus buy shows BHD throughout. A live walk is owed
after BO 4097 deploys.

## Blocked by

BackOffice 4097
