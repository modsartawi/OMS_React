---
status: open
spec: BackOffice 4127
blocked-by: 934, BO 4131
---

# 939 — An operator reads feed health per competitor and source

## What to build

The **Feed health** tab (BackOffice spec 4127, decision 8), on the feed-health endpoint extended by BO 4131.

- Per competitor: its authoritative source, enabled, blocked (with reason and the clear action where it
  exists), and its latest runs **per source**: counts, failures, and quota or auth errors.
- **Cross-check** flags (two sources disagree above the margin) with the example materials, each linking to the
  drill-down.
- The nightly effective-price job's last run and its watched count.
- The authority setting per competitor, changeable with the Manage grant (BO 4128's endpoint), with a
  confirmation that names what changes ("Mindsite's prices will count for Panda; our scraper's will not").

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (feed-health tab, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [ ] runs are shown per source per competitor · component test
- [ ] a cross-check flag lists its materials and links them · component test
- [ ] the authority change asks for confirmation and sends the setting, and is hidden without Manage · component test

## Boundaries

Needs BO 4131 (and 4128 for the authority setting).

## Done when

Proofs green, and the tab walked on dev.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4131](C:\Work\DMSCO\BackOffice\.issues\4131-feed-health-shows-each-source-and-flags-where-the-two-sources-disagree.md)
