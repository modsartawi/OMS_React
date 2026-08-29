---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\1386-idoc-inspector-spec.md
blocked-by: 297
---

# 300 — codesRenderRawWithTheirLabelAsSecondaryText

## What to build

Every code on the screen becomes readable without a spreadsheet beside the monitor.

🔑 **Always render the raw code, with the label as secondary text — never the label alone.** A
consultant reading a SAP ticket needs the literal code to paste into it. A screen that shows only a
friendly name is unusable for the job it exists for.

**Two kinds of code, from two places, and they are not interchangeable:**

- The **nine closed vocabularies** — source tag, condition source, condition class, condition
  control, IDoc type, billing type, workflow type, payment group, error type — come from the
  metadata route, fetched once per session and cached. They are generated server-side from the
  backend's own constants, so they cannot drift from the pipeline. **Never compile a copy of them
  into this bundle** — this repo is on its own release cadence and a bundled legend would be wrong
  the first time a constant changes.
- The **condition type** description arrives already resolved **on each condition row**, because
  condition types are open master data that a pricing analyst adds without a deployment. Render the
  code alone when no description came back; **never invent one.**

⚠ **Empty string is a first-class value in three vocabularies with three different meanings, and one
grey dash for all three is misinformation:**

| where | `""` means |
|---|---|
| source tag | a pre-feature row — provenance unknown |
| error type | **no error** |
| SAP discount-type code | no mapping was found — a defect |

Each renders distinctly.

The **registered workflow set** also arrives on the metadata route and is legend only — the server
already decided the verdict, so the screen never derives a state from it.

**No literal strings**: the legend supplies code labels, the locale file supplies everything else.

## Spine reach

client feature (metadata fetch + cache, code rendering) → server

## Proof

- [ ] `everyCodeRendersItsRawValue` — the label never replaces the code
- [ ] `aCodeWithNoLabelRendersAlone` — nothing is invented
- [ ] `theThreeMeaningsOfEmptyStringRenderDistinctly`
- [ ] `theLegendIsFetchedOncePerSessionAndReused`
- [ ] `conditionTypeDescriptionComesFromTheRowNotTheLegend`
- [ ] typecheck + build green

The code-rendering helper is a pure module; test it there.

## Boundaries

- Consumes BackOffice `IDocInspector/Metadata`, gated by the same grant as the rest.
- No bundled copy of any backend vocabulary.

## Done when

Every code column shows its raw value with a resolved label beside it, the three empty-string
meanings are visually distinct, and nothing about the vocabularies is hardcoded in this repo.

## Blocked by

[297](297-idoc-inspector-lookup-shows-documents.md)

**dep:** BackOffice [1392](file:///C:/Work/DMSCO/BackOffice/.issues/1392-legend-ships-from-the-api.md)
