---
status: open
spec: BackOffice 4127
blocked-by: 934, BO 4132
---

# 938 — Leadership reads the price index with us at 100, and the lowest-price score

## What to build

The **Index** tab (BackOffice spec 4127, decisions 5 and 8), read from Cube (BO 4132).

- **The price index per competitor**, shelf and paid. We are 100, and a competitor above 100 is dearer (the CMO's
  Mindsite sense). It is coloured so that "competitor cheaper than us" reads as the warning.
- By A-level (a table like Mindsite's category competition), plus a weekly and daily trend.
- **Lowest-price score** tiles, overall and per competitor, shelf and paid, with a trend line.
- A one-line explanation of each figure (EN/AR), in glossary words.
- This becomes the page's first tab once it ships. Alerts stays the default for a user with open alerts of their
  own **(default)**.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (index tab, Cube queries)

## Proof (→ `tdd` red-green cycles)

- [x] a competitor index above 100 renders as "they are dearer", below 100 as the warning · component test (pure)
- [x] shelf/paid switch changes the queried measure · component test
- [x] the score tile shows flagged ÷ counted as a percent · component test (pure)

## Boundaries

Needs BO 4132 and its image released.

## Done when

Proofs green, and the tab walked against the released image.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4132](C:\Work\DMSCO\BackOffice\.issues\4132-the-price-index-reads-us-as-100-counts-only-authoritative-prices-and-the-lowest-price-score-is-added.md)

## Comments

**2026-11-22 — built (branch `t938-price-index`), status stays open: BO 4132 image + the walk against it are owed.**

- Proofs: `index-tab.test.ts` (tone pure + `IndexFigure` markup: >100 "They are dearer" `ok`, <100 "They are cheaper"
  `warn`; `lowestPriceScore` = flagged ÷ counted + `ScoreTile` markup "75.0%" / "45 of 60 materials"),
  `index-query.test.ts` (`@/core/api` stubbed: Shelf asks `shelf_price_index` / `shelf_lowest_price_flagged`, Paid the
  `paid_*` ones, on every index and score query), `page.test.ts` (predicate, Index first, default tab). Drive
  `tools/price-index-drive.mjs` 30/30 (stubbed `**/api/**`, EN + RTL).
- 🚩 **GUESSED (BO 4132 not built):** members `shelf_price_index` / `paid_price_index` (flipped, same names),
  `price_indexed_materials`, `shelf_lowest_price_flagged` / `paid_lowest_price_flagged` / `lowest_price_counted`; dims
  `competitor`, `category`, `date` with `grain` `day` | `week`. The index is read by its column's unit: `share` ×100,
  anything else taken as already ×100 (4132's text writes "× 100"). The score is computed client-side (flagged ÷
  counted), not read from a `*_lowest_price_score` measure. An `ANALYTICS-406` / `-410` refusal (an image without
  4132) reads "not in the analytics model on this server yet" per section. Reconcile against `GET Analytics/Model`.
- 🚩 **Owner ruling owed (orchestrator ruling):** `Analytics/Query` is gated `Analytics:03`, so the Index tab's
  predicate `canViewPriceIndex` requires `PriceWatch:03` AND `Analytics:03`; a PriceWatch-only user does not see the
  tab. Alternative: a BO PriceWatch door that proxies the index.
- Default tab: with no `?tab=` and both tabs showing, the page reads Mine (live) — the Alerts tab's own default read,
  shared cache key — and opens Alerts when one is `OPEN`, else Index; while that read runs it says "Opening…", and a
  failed read falls back to Alerts.
- Competitor names come from `PriceWatch/Matching/Coverage` (Cube gives codes only).

- Review fixes (branch `t4127-review-fixes`): the decided default tab is now **pinned** into the URL (`?tab=`, replace,
  other params kept — `pinTab`) as soon as it is known, so an Accept / Dismiss / Break re-reading Mine no longer yanks
  the user from Alerts to Index. The own-open-alerts read now asks Mine, live, at the server's largest `take` (500,
  `ownOpenAlertsRequest`) — its own cache key, no longer shared with the Alerts tab's default read.
- 🚩 **BO ask:** the alert lists have no OPEN-only filter (`status` is `live|resolved|all`) and no paging/total, so
  "has own open alerts" is judged from the first 500 live alerts (ACCEPTED / DISMISSED included). A user with > 500
  live alerts, none OPEN in the first 500, reads as having none (opens on Index). Ask: `status=open` on
  `PriceWatch/Alerts/Mine` (or a `Alerts/Mine/OpenCount` door).
