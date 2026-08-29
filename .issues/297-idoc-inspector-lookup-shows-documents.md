---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\1386-idoc-inspector-spec.md
blocked-by: 296
---

# 297 — lookingUpAStoreAndTrxNumberShowsItsDocuments

## What to build

A consultant enters a store and a transaction number and sees everything the new SAP rail generated
for it.

**One page, two levels of navigation, and that is the whole budget.**

- A document is **selected** in a horizontal rail across the top — at most five exist on any
  transaction, so a rail is the right shape and a tree is not.
- A line **opens in place** beneath itself.
- **Conditions and item details live inside the open line and are never a third level.**

Everything arrives in **one server call**, so selecting a document or opening a line never touches
the network.

🔑 **No AG Grid.** The workspace's nearest solved problem is exactly where a comparable feature's last
AG Grid was deliberately removed. Reuse the **idiom**, never the components — the import boundary
forbids reaching across features. A prototype covering seven scenarios exists in this tracker's
assets.

🔑 **Provenance is ONE column.** The source tag is a chip on every line and condition row; the
condition's own origin rides beside it as a small marked letter, because a column of its own would be
a wall of repeated letters. The filter bar filters the **tag** only.

- ⚠ An **empty source tag renders as a dimmed *unknown*, never as a POS row.** The server sends `""`
  verbatim for exactly this reason: a provenance bug must not be able to disguise itself as ordinary
  data.
- **Payments and FI lines carry no provenance at all, and the screen says so** — their rows have no
  provenance column rather than an empty one.

Each document shows its **export state** as a three-way badge: exported, batched but not exported, or
not batched.

Two things are drawn as **stated absences** so they cannot be silently re-added: there is **no
header-conditions pane** (this rail never writes an item-0 condition, so it would be permanently
blank), and the "read the rate, not the value" rule belongs to the *pricing engine's* condition
table, not to the IDoc condition table shown here.

## Spine reach

client feature (lookup form, document rail, line table, in-place expansion) → server

## Proof

- [x] `aLookupRendersOneTabPerGeneratedIDocType` — `document-graph.test.ts`; the rail itself in the
      drive (one card per document, every generated type on it, and a five-way split is still one type)
- [x] `openingALineShowsItsConditionsAndItemDetailsInPlace` — `provenance.test.ts` for WHAT it shows;
      the drive asserts IN PLACE structurally (the expansion is a row of the same `<table>` as the line)
- [x] `anEmptySourceTagRendersAsUnknownNotAsPos` — `provenance.test.ts` + the drive's untagged line
- [x] `paymentAndFiRowsShowNoProvenanceColumn` — `document-graph.test.ts` asserts it at the TYPE level
      with `@ts-expect-error`, so adding a `sourceTag` to either row breaks the build; the drive
      asserts the rendered panes carry no such column and say so in words
- [x] `theExportStateBadgeDistinguishesAllThreeStates` — `document-graph.test.ts` (three severities,
      three keys, raw fallback) + the drive's three documents
- [x] typecheck + build green — plus lint (boundaries/contrast/palette), 2044 pure cases, drive 61/61,
      invoice drive 79/79

Pure modules only.

⚠️ **Nothing here has met a live SIS.Api**: BackOffice 1388 is open, so the drive stubs the envelopes
and the payload shape is this client's reading of the spec. Decisions and their reasons are in
`.afk/HITL-297.md`.

## Boundaries

- Consumes BackOffice `IDocInspector/Transaction`. Read-only screen; it submits nothing.
- No client-side paging — the payload is always small enough to render whole.

## Done when

A seeded transaction renders its documents, lines, conditions and item details within the two-level
budget, with provenance on one column and the export badge correct.

## Blocked by

[296](296-idoc-inspector-screen-access-spine.md)

**dep:** BackOffice [1388](file:///C:/Work/DMSCO/BackOffice/.issues/1388-processed-transaction-returns-its-documents.md)
— the graph payload. FI lines arrive with BackOffice 1389.
