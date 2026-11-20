---
status: done
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

- [x] a Bahrain promotion → the editor currency is BHD and the header shows 1000 / 21 with its labels · `editor.test.ts`
- [x] a KSA promotion → SAR and 1000 / 20, unchanged · `editor.test.ts`
- [x] `currPe` and the per-unit hint format BHD to 3 decimals (e.g. 1.250) · `editor.test.ts`
- [x] the request carries no sales-area field · `editor.test.ts`

## Boundaries

Needs the BO 4097 contract (the promotion document carries the pair, currency and labels).

## Done when

The Proof tests are green, and a stubbed drive of a Bahrain bonus buy shows BHD throughout. A live walk is owed
after BO 4097 deploys.

## Blocked by

BackOffice 4097

## Done — 2026-11-20 (stubbed; live walk owed after BO 4097 deploys)

- `BBY_ORG`, `ORG_CURRENCY` and `orgCurrency` are gone from `editor.ts`. `editorSalesArea(promo)` reads the
  pair, the currency and the server's names through `readSalesArea` (no pair → KSA); `orgNameKey` words a
  name the server did not send (`editor.org.salesOrg1000` / `channel20` / new `channel21`), and a code outside
  the closed list shows no name rather than a raw key. The page already read GET `Promotion/{n}`; the header,
  the Organizational Data row, the minimum's label, Curr/Pe, the Total Discount panel and the per-unit hint all
  take `area.currency`.
- Proof: `editor.test.ts` (the KSA, BHD 3-decimal and no-sales-area-on-the-wire cases passed on first run:
  the contract's `readSalesArea`, `formatMoneyIn` and `toRequest` already held them).
- Drive: `tools/bby-maintenance-drive.mjs` step 51, a Bahrain bonus buy (stub reconciled to the shipped 4097 document, see below).
- 2026-11-20 code-review fix: an off-list sales area with no currency is never shown as a 2dp currency with a
  blank unit — the header, the minimum, Curr/Pe say "Currency not known" (`editor.currencyUnknown`, EN + AR) and
  the per-unit hint uses `formatMoneyOfUnknownCurrency`. `bby-maintenance-drive.mjs` 258/258.
- 2026-11-20 reconciled to the SHIPPED contract, BackOffice pricing2 e35485209: `BbyPromotionDocument` has no
  `salesOrganizationName`/`distributionChannelName` — removed from the model and `EditorSalesArea`; the
  Organizational Data names come from the client's own keys (`editor.org.salesOrg1000`, `channel20`,
  `channel21`). The pair and `currency` (SAR/BHD, blank off the list) match the guess; the bonus-buy request
  still carries no sales area (the server stamps the promotion's pair). `bby-maintenance-drive.mjs` 258/258 on the
  shipped stub shape. Live walk owed after BO deploy.
