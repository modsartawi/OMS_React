---
status: open
spec: BackOffice 4127
blocked-by: —
---

# 934 — The price command center page opens on the price alerts, with accept and dismiss

## What to build

**Tracer bullet for the page** (BackOffice spec 4127, decision 8). A new Analytics page, the **price command
center**, shown only to a user holding the PriceWatch View grant (`GET PriceWatch/Access`). Its tab strip is
Index · Alerts · Grid · Matching · Feed health; tabs whose tickets are not built yet are hidden. This ticket ships
the shell and **Alerts**:

- **Mine** (`Alerts/Mine`, the default) and **All** (`Alerts`), with filters for A-level, B-level, brand,
  competitor and state. Ranked by value at risk.
- Each row shows our basic price and effective price, the competitor's regular and offer price, its seller, the
  gap, the value at risk, when it was observed, and the **recommended price**. While the alert's `FloorStatus` is
  `NOT_SET` (until BO 3507), the recommended price reads **"awaiting cost"** and no "can't match profitably" is
  ever shown.
- **Accept** and **Dismiss** (a reason is required; OTHER needs a note), with the Manage grant. The server's
  refusals are shown like any other refusal.
- Glossary wording (EN/AR): price alert, product match, competitor price. Never "notification" or "mapping".

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (page, route, nav entry, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [x] the page is hidden without the View grant · page test — `page.test.ts` (static render, permissions answer seeded)
- [x] Mine is the default and is ranked by value at risk · component test — `alerts.test.ts`
- [x] an alert with `NOT_SET` shows "awaiting cost" and no profitability verdict · component test (pure) — `alerts.test.ts`
- [x] dismiss refuses to send without a reason, and OTHER without a note · component test (pure) — `alerts.test.ts`
- [x] accept / dismiss buttons are hidden without the Manage grant · component test — `alerts.test.ts` (whole tab, cache seeded)

Also: `i18n-keys.test.ts` (en/ar mirror, built keys, glossary), `menu-analytics.test.ts` (leaf on its own grant), and the
drive `tools/price-command-center-drive.mjs` against stubbed `**/api/**` — **37/37** (Mine default, ranking, awaiting cost,
dismiss validation + body, PWT-00040 reload, All + competitor, viewer without buttons, Manage-only denial, RTL).
`npm run typecheck` and `npm test` green; `npm run lint` — four gates green, the boundaries gate fails only on the
pre-existing `insurance-rules/aliases/door-shapes.test.ts` imports (on the spec branch before this ticket, not ours).

## Boundaries

Uses BackOffice endpoints that already exist (BO 3502/3503). No push of any kind.

## Done when

Proofs green, and the page walked on dev against `PriceWatch_Dev` alerts.

## Blocked by

None — can start immediately

## Comments

**2026-11-22 — built (branch `t934-price-alerts`), dev walk owed.** Everything in Done-when holds except the walk on dev
against `PriceWatch_Dev` alerts, which is still owed — status stays open for it.

- **BO ask — brand / B-level / product title on the alert wire.** `PriceWatchAlertView` carries only the A-level
  (`categoryCode`); `GET PriceWatch/Alerts[/Mine]` filters only `status`, `competitor`, `category`, `take`. Ruling
  (2026-11-21): offer only the filters the wire supports — Mine/All, A-level, competitor, state (live / open / accepted /
  dismissed / resolved / all; the three live states narrow client-side). B-level, brand and a product name need BackOffice
  to add them to the view and the query. No paging/total either: the tab says when the server's 100 may hide more.
- **Gap sign:** the alert wire's `gapAmount`/`gapPercent` are positive when the competitor is cheaper (opposite to the
  comparison wire 936 reads). The client keeps the alert's sense, the column reads "Competitor cheaper by", and
  `formatGapPercent` (alerts.ts) says so.
- **Recommended price:** while `floorStatus` is `NOT_SET` the cell reads "Awaiting cost" with the lowest competitor price
  as a fact beside it; the namespace holds no "can't match profitably" sentence at all. `floorText` is never shown.
- **For 935–939 (layout):** tabs are registered in `tab-registry.tsx` — one entry per tab (`id`, own predicate, `built`,
  `Panel`), each tab its own file with a default component. `api.ts`, `core/models/price-watch.ts` carry a section per tab
  (`// ── Grid (935)` …) and each tab declares its own `PRICE_<TAB>_ERRORS`; the locale JSON has `tabs.<id>` already —
  add a top-level `"<tab>"` block. The drill-down hook point is `AlertMaterialCell.tsx` (936 makes it the link).
  Competitors for pickers: `priceWatchSharedApi.coverage()` + `PriceWatchCoverage` (Shared section) — don't redeclare.
