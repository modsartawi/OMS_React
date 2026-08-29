---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\1386-idoc-inspector-spec.md
blocked-by: 297
---

# 298 — everyEmptyResultNamesItsVerdict

## What to build

A lookup that finds nothing never shows a blank page. **The empty state replaces the document area
with the named verdict and a plain-language sentence** saying what it means.

The server sends a **stable machine code**; the wording lives entirely in this feature's locale file,
so a verdict can be reworded without a server release. Ten codes, each with its own copy.

Three of them carry a specific obligation, and getting the wording wrong is the defect:

- ⚠ **Parked must read "the workflow has not shipped yet"** — not "failed", not "pending". This is
  the most common empty result in production (3.2% of entries) and it describes work that has not
  been built, not work that went wrong.
- ⚠ **Gave-up must not read as success.** The underlying row has its processed flag set, which is
  exactly the trap; a consultant who reads "processed" reports a lost invoice as delivered.
- ⚠ **Held documents are NOT an empty state at all.** They render **in full**, under an attention
  banner. A held document is a finding, not an absence.

**The tenth verdict gets a banner over a full render.** When documents exist while the transaction's
own export-version column says legacy, the screen shows everything **and** names the contradiction.
This is the one case where the screen must not smooth over what it found: those transactions are
being exported by both rails, and this screen would otherwise be the only place a double-posted
invoice looks entirely normal. The banner states the disagreement and the offending value; it does
not diagnose, and it does not offer to fix anything.

**No literal strings** — every verdict sentence resolves through the namespace.

## Spine reach

client feature (verdict → copy mapping, empty states, attention banner) → server

## Proof

- [ ] `eachVerdictCodeMapsToItsOwnCopy` — a table-driven test over all ten codes, so an unmapped code
      cannot ship
- [ ] `parkedReadsAsNotYetShippedNotAsFailure`
- [ ] `gaveUpDoesNotReadAsSuccess`
- [ ] `heldDocumentsRenderInFullUnderABanner` — not an empty state
- [ ] `aLegacyStampWithDocumentsRendersEverythingAndNamesTheDisagreement`
- [ ] `anUnknownVerdictCodeFailsLoudlyRatherThanRenderingBlank`
- [ ] typecheck + build green

The verdict-to-copy mapping is a pure module; test it there, not through components.

## Boundaries

- Consumes the verdict and attention fields already on the transaction payload — no new route.
- Copy is client-owned. The server never sends a sentence.

## Done when

All ten verdicts render their own named empty state or banner, the three trap-wordings are correct,
and an unmapped code cannot ship silently.

## Blocked by

[297](297-idoc-inspector-lookup-shows-documents.md)

**dep:** BackOffice [1390](file:///C:/Work/DMSCO/BackOffice/.issues/1390-every-empty-result-is-a-named-verdict.md)
and [1391](file:///C:/Work/DMSCO/BackOffice/.issues/1391-documents-outrank-the-export-version-column.md).
