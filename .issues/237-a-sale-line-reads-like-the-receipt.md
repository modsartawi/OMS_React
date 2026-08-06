---
status: done
spec: 231
blocked-by: 236
---

# 237 — A sale line reads like the receipt, in its own currency

## What to build

The Sales tab, in the shell [236](236-activities-fetches-when-opened-and-states-its-ceiling.md)
established. A row is **one sales line** — one item on one receipt — so a five-item basket is five
rows sharing a receipt number.

**Eight columns:** Date · Receipt · Store · Item no. · **Item** · Qty · Unit price · Amount.
**Item is the headline** — "what did they buy" is answered by scanning one column.

Three source facts this slice must render faithfully rather than tidily:

1. 🚩 **Date-only, not a timestamp.** `TrxTime` is a separate column the report **does not select**,
   so rendering `HH:mm` would print a fabricated `00:00` on every row and imply a midnight purchase.
   Use `formatShortDate`. Corollary: lines within one day tie, and their relative order is undefined.
2. 🚩 **`qty` and `amount` are signed on a return; `unitPrice` is not.** A return line reads
   `-1.00 · 12.00 · -12.00`. That is the receipt, and matching it beats tidying it.
3. 🚩 **Money is multi-currency.** `Currency` is per-row plant master data (SAP `WAERS`), **Bahrain
   BHD stores are live**, and BHD is the footprint's only 3-decimal currency. The column is nullable,
   so old rows can be empty. **"Always 2 decimals" holds for points but not for riyals.**

So this tab needs a **currency-aware money formatter**, which does not exist:
`core/util/number-format.ts`'s `formatMoney` is documented as *"the single money formatter for the
app"* and is **fixed 2dp**. Build the currency-aware one as a pure module **inside the feature** —
one consumer today, and it graduates to `core/` when a second wants it, per
[feature-structure](../.claude/rules/feature-structure.md). Do **not** widen `formatMoney` itself:
every existing caller means 2dp.

**A ninth Currency column appears only when the fetched rows hold more than one distinct currency.**
The SAR-only member — the overwhelming case — spends no width on a constant; the Bahrain member has
the currency stated rather than implied. 🚩 **Nothing on this tab is summed, and nothing may be** —
the report does not select an exchange rate.

**Dropped:** `TrxTypeNumber` / `DocumentTypeNumber` (raw twins of the enum-name strings) and
`TrxType` / `DocType` themselves — the signed qty and amount already mark a return, and the channel
(Insurance, Wasfaty, CallCenter, ECommerce…) is not what an agent opens this tab for. Note both are
emitted with `Enum.ToString()`, so an undefined value serialises as **the number as a string** —
neither is a closed union in TypeScript, which is a second reason not to lean on them.

**Ceiling:** *"Most recent 500 sales lines."* + the at-cap warning at exactly 500. Sort and filter are
**on** — on 500 lines a filter is the difference between answering "did they ever buy X" and
scrolling.

**Two caveats to expect in the data**, both from source, neither a bug to chase: the SQL has **no
`LineType` filter**, so non-item lines (discount, donation) can appear as rows; and the
**`INNER JOIN Item`** means a line whose item no longer exists **vanishes silently**.

## Spine reach

model · **api** (`LoyWeb/Reports/LoyaltySales/{loyId}`) · **logic** (`sales-columns` + the
currency-aware money formatter, both pure) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] money — SAR renders 2dp, **BHD renders 3dp**, a null currency degrades without throwing, and
      `formatMoney`'s existing 2dp callers are untouched · **pure** —
      `src/features/loy/member/money.test.ts`, 17 cases. The last clause is asserted by reaching
      across to `@/core/util/number-format` in this same suite: the decision is as much *do not
      widen the app's formatter* as it is *format per currency*, and a suite that only looked at the
      new module could be satisfied by editing the old one. `formatMoney.length === 1` pins that it
      still takes no currency argument.
- [x] `sales-columns` — the Currency column appears iff the rows hold more than one distinct
      currency; a return row renders signed qty and amount against an **unsigned** unit price ·
      **pure** — `src/features/loy/member/sales-columns.test.ts`, 18 cases, asserted through the
      columns' own `valueFormatter`s (where every decision here lives) rather than a rendered grid.
- [x] `tools/loy-member-drive.mjs` (extended) — a SAR-only member (no Currency column), a mixed-currency
      member (column present, BHD at 3dp), a return line, and the at-cap warning at 500 · **flow** —
      scenarios 27–30, **135/135 green** (was 105/105 before this ticket).

## Answer

Landed: `money.ts` + `sales-columns.ts` (both pure, both with suites), `SalesTab.tsx`,
`LoySalesRow` on `core/models/loy.ts`, `loyReportsApi.sales` + `salesKey` on the feature's `api.ts`,
the `tabs.sales.*` block in `loy.json`, and one branch in `MemberTabs.tsx`. No registration point
moved — the area, the namespace, the routes and the menu item all landed with 233/234, and the tab
shell with 236.

Five things worth carrying forward:

- 🚩 **The currency-aware formatter is a second money formatter, deliberately.** `formatMoneyIn`
  lives in the feature and `core/util`'s `formatMoney` is untouched at fixed 2dp — every existing
  caller draws a SAR figure and means 2dp, so widening it would put a decision on hundreds of call
  sites that none of them has to make. The footprint's exceptions are a **stated table**
  (`{ BHD: 3 }`), not `Intl`'s currency-digit knowledge: ICU's answers move with the runtime build
  and a price is not a thing to render differently on two machines. Same reasoning pins the locale
  to `en-US` rather than leaving it `undefined`.
- 🚩 **An empty `Currency` is not a currency.** `salesCurrencies` counts only non-empty codes, so a
  `[SAR, null]` window is one currency and grows no column. Counting the absence would grow the
  Currency column on exactly the SAR-only member the conditional exists to spare — and the column
  being nullable in source means that member really does exist. Logged in `.afk/HITL-237.md`.
- **The columns depend on the ROWS, not just on `t`.** `buildSalesColumns(t, rows)` is memoised on
  both, because the ninth column is a fact about the fetched window and not about the member. That
  is the one structural difference from `activity-columns`.
- **Qty is not currency-aware.** A BHD line's *quantity* has no third decimal; `formatQty` is fixed
  2dp with the value's own sign, which is what the ticket's `-1.00 · 12.00 · -12.00` shows.
- **The header reads "Store code", not "Store".** 226's table is a column list; spec 231 §6 is the
  copy rule and names "Store code" among its examples, matching the `City code` / `Nationality code`
  labels already in the member disclosure.

One earlier drive assertion needed updating rather than adding: 236's scenario 21 proved "a cold
`?tab=sales` makes no `LastActivities` call" by waiting for the *"not available yet"* placeholder.
Sales now renders, so it waits for a sales row instead — the assertion it makes is unchanged.

Gates: `npm run typecheck`, `npm run lint` (three gates), `npm run build`, `npm test`
(1181 pure cases, 72 files) and `tools/loy-member-drive.mjs` **135/135**, all green.

🚩 **Nothing was driven against a live SIS.Api** — `LoyWeb/Reports/LoyaltySales/{loyId}` is
BackOffice 978 and does not exist. Every envelope in the drive is stubbed from 223's field
inventory.

## Boundaries

- **New API dependency:** `GET LoyWeb/Reports/LoyaltySales/{loyId}` — BackOffice, not built. Raw SQL,
  no existence check ⇒ `200 []` for a missing member. 🚩 The likeliest real failure is a **SQL timeout
  on a heavy member**, arriving as a **raw 500 with no envelope** — this is the tab that earned the
  scoped Retry.
- **A new pure money formatter lives in the feature**, not `core/`, until a second feature needs it.
  Called out here so a reviewer does not read it as a duplicate of `formatMoney`.
- ⚠ **Out of scope, by ruling:** faithfully reproducing WPF's Sales grid. WPF queries
  `RetailTrxDetail` through NHibernate with no endpoint behind it; the web takes what
  `LoyaltySales` gives, lets the columns differ, and **creates no endpoint for it**.

## Done when

Both pure suites green, and the drive shows a single-currency member without the Currency column, a
BHD member with it at three decimals, and a return line reading `-1.00 · 12.00 · -12.00`.

🚩 Nothing driven against a live SIS.Api.

## Blocked by

[236](236-activities-fetches-when-opened-and-states-its-ceiling.md) — the tab shell, the ceiling
caption and the per-tab failure surface are established there.
