---
status: open
spec: BackOffice 4127
blocked-by: 934
---

# 937 — The matching team works the queue on the page, Mindsite suggestions labelled

## What to build

The **Matching** tab (BackOffice spec 4127, decision 8), on existing endpoints (BO 3501).

- Pick a competitor, then work its queue in our sales order: each candidate shows both images, titles, sizes and
  barcodes. The actions are **Exact**, **Comparable**, **Not the same**, and **Not carried** for the material.
- **Request discovery** for a material, and **confirm by URL**.
- **Coverage** per competitor: matched, not carried, still open.
- A candidate whose origin is `MINDSITE` (BO 4135) carries a **"suggested by Mindsite"** label. Until 4135 ships,
  no candidate has that origin and the label never shows.

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (matching tab, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [x] each action sends its endpoint and moves to the next candidate · component test
- [x] a MINDSITE-origin candidate shows the label, and others do not · component test (pure)
- [x] coverage shows the three counts per competitor · component test
- [x] actions hidden without Manage · component test

## Boundaries

Endpoints exist now. The label lights up with BO 4135.

## Done when

Proofs green, and a dev Nahdi queue worked on the page.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md)

## Comments

**2026-11-22 — built (branch `t937-matching`), dev walk owed.** Proofs green (`matching.test.ts`, static-markup
component tests + the pure `matching.ts`), drive `tools/price-matching-drive.mjs` 37/37 against stubbed envelopes. The
dev walk on a Nahdi queue is still owed — status stays open for it.

- **Gap — discovery is per competitor, not per material.** `POST PriceWatch/Matching/{competitor}/Discovery` asks the
  scraper for the queue's first `take` materials with no open candidate / request (none in 30 days); there is no
  single-material door. Ruling (2026-11-22): the tab offers **Request discovery** for the picked competitor with the
  server's default `take` (body `{}`), and a material with no candidate says "confirm by URL, or mark it not carried".
  "Request discovery for a material" needs a BackOffice door (e.g. `{ material }` on Discovery) — BO ask.
- **⚠ GUESSED (BO 4135) — candidate `origin`.** Not on the wire until 4135 ships. Typed optional
  (`origin?` and the less likely `candidateOrigin?`) in `core/models/price-watch.ts`; the "Suggested by Mindsite" label
  shows only on the exact upper-case `MINDSITE` (`suggestedByMindsite`, matching.ts). Absent / `SCRAPER` / other casing →
  no label, so today the label never shows. Reconcile the field name and casing when 4135 lands.
- **Queue moves locally.** A queue page is read once; decisions close the material (Exact, Comparable, Not carried,
  confirm by URL) or only the candidate (Not the same) client-side, so the next pair comes up without a re-read; coverage
  is re-read after each decision. A refusal meaning the queue moved (PWT-00021/00022/00023) shows with its code and the
  queue is read again. A worked page offers "Read the queue again".
- **Comparable** sends an empty body (the server reads both sizes from our title and the listing); a PWT-00024 refusal
  (sizes not comparable) is shown as the server's sentence. Entering sizes by hand is not in this slice.
- Our side has no product image on the wire (`ours.imageUrl` always ''), so it reads "No image".
- The 934 drive's "only built tabs show" check expects `["alerts"]` and will now see `matching` too — update it when the
  sibling tabs land.
