---
status: done
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

- [x] `everyCodeRendersItsRawValue` — the label never replaces the code ·
      `code-legend.test.ts` + the drive (the rail card shows `AGG` **and**
      `Aggregation`, and still shows `AGG` with the legend refused)
- [x] `aCodeWithNoLabelRendersAlone` — nothing is invented · pure, and in the DOM:
      a tag the legend does not carry keeps its value and gets **no tooltip**
- [x] `theThreeMeaningsOfEmptyStringRenderDistinctly` — pure over all four blanks;
      in the DOM for the two with a render site (`unknown` chip vs the disc-type
      *no mapping* defect, asserted to differ). ⚠️ **The error-type blank has no
      render site yet and is 298's** — the document payload carries no
      `errorType`/`isHeld` until the banner that reads them exists
- [x] `theLegendIsFetchedOncePerSessionAndReused` — the drive counts **one**
      `Metadata` call across two lookups and a document switch
- [x] `conditionTypeDescriptionComesFromTheRowNotTheLegend` — pure (there is no
      `conditionType` vocabulary to ask) and in the DOM
- [x] typecheck + build green — plus `vitest` 2060, `lint` three gates, and the
      drive at **77/77**

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

## What shipped

`IDocInspector/Metadata` behind one `LegendProvider` inside the gate, and every
code on the screen reading through it.

🔑 **The label is the SERVER's `name`, and this bundle carries no alternative.**
BackOffice 1392 reflects each vocabulary off its own C# constants and ships the
declaring identifier as `name`, precisely so a constant added today is readable
today. A per-code wording map in this repo would be the bundled legend the ticket
forbids, one file further down — wrong the first time a constant changes. The
locale file owns the chrome and the blanks, and nothing else.

🔑 **Fetch-once is structural, not a convention.** `LegendProvider` is the only
caller of `idocInspectorMetadataQuery` (`staleTime: Infinity`, `retry: false`), so
no render site has a reason to ask for its own copy. Codes read it through one
hook, `useCodeLabel`, which holds the rule the whole ticket rests on: **no label ⇒
no tooltip, and never the code echoed back as its own explanation.**

⚠️ **A refused legend costs the labels and NOT the screen** — driven. The raw codes
are on the transaction payload, not this one, and they are what a consultant came
for; the labels are decoration.

**Placement follows 1381's prototype**: visible label where a code appears once
per document (the IDoc type, on the rail card and the document strip), the label
on hover where it repeats per row (source tag, condition origin, and the condition
class/control, which are new here as dotted marks rather than two more columns in
a seven-column expansion).

⚠️ **The four blanks, and only ONE grey dash between them.** An empty source tag is
a dimmed `unknown`; an empty disc-type code is a *no mapping* **defect** in
attention ink (and is deliberately not in the legend — it is derived from a map
each billing type may override); an empty error type is 298's; an empty condition
source draws **nothing**, because it only appears beside a source tag and a second
kind of nothing on one row reads as one fact told twice.

### ⚠️ The wave's server doors have shipped, and 297 had drifted

BackOffice 1387–1393 are all `done` now. 297 was built while they were open and
modelled the payload from 1381's prototype; reconciling against the shipped
`IDocInspectorDocument` was unavoidable here, because two of the codes 300 was
told to label were fields the server does not send:

- `idocType` → **`iDocType`**. SIS.Api sets no naming policy, so minimal APIs use
  `JsonSerializerDefaults.Web`, whose camelCase pass stops at the first uppercase
  run followed by a lowercase letter. It is the only two-leading-caps property in
  the graph — and the key 299 groups its download buttons by.
- `line.batch` → **`line.batchNumber`**.
- **`billingType`, `paymentGroupId`, `splitAmount`, `splitRatio` deleted.** The
  spec's payload outline names none of them and the DTO carries none; they were
  rendering `undefined` and `Group undefined · SAR 0.00 · 0%`. With them went the
  rail card's split line and three attribute-strip entries.

⚠️ Still nothing has met a live SIS.Api — `iDocType` is inferred from the naming
policy, not observed. The first real call is what confirms it.

**Consequently four of the nine vocabularies have no render site**: `billingType`
and `paymentGroup` because the payload carries neither field, `errorType` and
`workflowType` because 298 owns the banner and the verdict strip that read them.
`registeredWorkflowTypes` is carried and is **legend only** — the server decided
the verdict, so the screen derives no state from it.

### Reviews

`/code-review` high found four, all fixed: the condition-origin tooltip asserted
"no label in this deployment's legend" from a fetch that may simply not have
landed; `CodeMark` echoed the code as its own label; the minted-by buttons were
the one source-tag render site with no label at all; and the rail card's
replacement sub-line was the same value on every card.

`/standards-review` found **no hard rule violation** on either axis. Its judgement
calls landed: nine `codes.vocabulary` labels of which seven were dead, and a
`markHint` composing a tooltip from a colon-bearing fragment, are both gone — a
mark's title is the legend label alone, which is server data and needs no key. The
"label or nothing" hover shape, written out in four files, became `useCodeLabel`.
`DiscTypeCode` moved beside its two sibling renderers. The spec axis caught the
module's blank table promising a `conditionSource` rendering the screen does not
draw: the behaviour stands and the docstring now says so, and lists the *ticket's*
three blanks rather than the *legend's* three.

Seven decisions taken unattended are in `.afk/HITL-300.md`.
