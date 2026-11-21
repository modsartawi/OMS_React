---
status: open
spec: BackOffice 4110
blocked-by: 934
---

# 937 — The matching team works the queue on the page, Mindsite suggestions labelled

## What to build

The **Matching** tab (BackOffice spec 4110, decision 8), on existing endpoints (BO 3501).

- Pick a competitor, then work its queue in our sales order: each candidate shows both images, titles, sizes and
  barcodes. The actions are **Exact**, **Comparable**, **Not the same**, and **Not carried** for the material.
- **Request discovery** for a material, and **confirm by URL**.
- **Coverage** per competitor: matched, not carried, still open.
- A candidate whose origin is `MINDSITE` (BO 4118) carries a **"suggested by Mindsite"** label. Until 4118 ships,
  no candidate has that origin and the label never shows.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4110-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (matching tab, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [ ] each action sends its endpoint and moves to the next candidate · component test
- [ ] a MINDSITE-origin candidate shows the label, and others do not · component test (pure)
- [ ] coverage shows the three counts per competitor · component test
- [ ] actions hidden without Manage · component test

## Boundaries

Endpoints exist now. The label lights up with BO 4118.

## Done when

Proofs green, and a dev Nahdi queue worked on the page.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md)
