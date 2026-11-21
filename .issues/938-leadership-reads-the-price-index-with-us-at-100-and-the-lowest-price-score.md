---
status: open
spec: BackOffice 4110
blocked-by: 934, BO 4115
---

# 938 — Leadership reads the price index with us at 100, and the lowest-price score

## What to build

The **Index** tab (BackOffice spec 4110, decisions 5 and 8), read from Cube (BO 4115).

- **The price index per competitor**, shelf and paid. We are 100, and a competitor above 100 is dearer (the CMO's
  Mindsite sense). It is coloured so that "competitor cheaper than us" reads as the warning.
- By A-level (a table like Mindsite's category competition), plus a weekly and daily trend.
- **Lowest-price score** tiles, overall and per competitor, shelf and paid, with a trend line.
- A one-line explanation of each figure (EN/AR), in glossary words.
- This becomes the page's first tab once it ships. Alerts stays the default for a user with open alerts of their
  own **(default)**.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4110-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (index tab, Cube queries)

## Proof (→ `tdd` red-green cycles)

- [ ] a competitor index above 100 renders as "they are dearer", below 100 as the warning · component test (pure)
- [ ] shelf/paid switch changes the queried measure · component test
- [ ] the score tile shows flagged ÷ counted as a percent · component test (pure)

## Boundaries

Needs BO 4115 and its image released.

## Done when

Proofs green, and the tab walked against the released image.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4115](C:\Work\DMSCO\BackOffice\.issues\4115-the-price-index-reads-us-as-100-counts-only-authoritative-prices-and-the-lowest-price-score-is-added.md)
