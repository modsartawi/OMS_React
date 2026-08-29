# HITL log — ticket 297 (the lookup shows a transaction's documents)

## Q: BackOffice 1388 (the route that serves the graph) is OPEN, and its DTO is an empty class. Who decides the payload's field names?
**Decision taken:** this client defines them, camelCased **from the NHibernate entity columns**
(`IDocDocument`, `IDocLineItem`, `IDocCondition`, `IDocItemDetail`, `IDocPaymentMethod`, `IDocFiItem`),
plus the four names the spec itself fixes (`verdict`, `attention`, `exportState`, `batch`).
**Why:** the spec's outline names only the top of the shape; every field below it is a column that
already exists, so mirroring the column name is the one choice that cannot be arbitrary. 1388 is
free to disagree, and then this is one file to edit.
**Revisit if:** 1388 lands with different names — `core/models/idoc-inspector.ts` is the only place
they are spelled.

## Q: `IDocLineItem` has NO description column, but the prototype's line table shows a description over a material number. What goes in the Item column?
**Decision taken:** material number (primary) over item type code, plus a return marker. No
description column at all.
**Why:** the prototype's data was fake. Modelling a `materialDescription` the server has no column
to fill would ship a permanently blank column, which the prototype's own rulings reject twice
(`SubGroupId`/`Qualifier` are off the screen for exactly this reason).
**Revisit if:** 1388 chooses to join the material master and serve a description.

## Q: Which document fields does the wire model carry — everything on `IDocDocument`, or only what 297 renders?
**Decision taken:** only what 297 renders (plus `verdict`/`attention`, which 298 renders and which
are on the same response). `hasError`/`errorType`/`errorMessage` are NOT modelled here.
**Why:** 296 set the convention — paste a shape when there is first a caller for it. The held-document
banner is 298's slice and it should add those three fields with the code that reads them, so the model
never carries a field nothing renders.
**Revisit if:** 298 finds the held banner needs a field 297 could have declared.

## Q: 298 owns the ten verdicts and their copy, but 297 must render *something* when the payload carries no documents. What?
**Decision taken:** one neutral placeholder (`idocInspector.noDocuments.*`) saying the rail generated
nothing and that the reason is named on the transaction — distinct from the LANDING state, and
explicitly marked in the Page comment as 298's to replace.
**Why:** a blank page is the one outcome the spec forbids, and inventing verdict wording here would
have 298 rewrite it — including the three trap-wordings that are 298's whole point.
**Revisit if:** 298 prefers to keep a generic fallback for an unrecognised verdict code.

## Q: The export badge is three-way. Which severities?
**Decision taken:** `exported` → `ok`, `batched-not-exported` → `go`, `not-batched` → `warn`; an
unrecognised value renders its RAW code at `mute`.
**Why:** the ticket requires all three to be distinguishable, and three distinct severities is the
only way the badge is not a two-way one wearing three words. The escalation matches the facts: done,
in motion, wants a human (3.1% of production sits in no batch). The prototype gave the last two the
same colour and distinguished them by text alone.
**Revisit if:** the owner reads `not-batched` as ordinary rather than as attention-worthy.

## Q: The prototype puts a warning glyph on an amount whose `3302` code blanks it in the exported XML. Is that in 297's scope?
**Decision taken:** included — a tested pure predicate (`blankedInXml`) plus one glyph with a title,
on condition values and payment amounts.
**Why:** it is a correctness statement, not a flourish: without it the table silently disagrees with
the file the same screen will hand over (299). It is one helper and one key.
**Revisit if:** standards-review reads it as scope creep — it deletes cleanly.

## Q: The condition-source letter (`M`/`A`/`H`/`B`) and the source tag both need a human label. 300 owns the legend. What does 297 show?
**Decision taken:** the raw code only, with a generic `Condition source: {{code}}` title. No
hardcoded label table anywhere in this slice.
**Why:** 300 is explicit that the nine closed vocabularies come from the `Metadata` route and must
**never** be compiled into this bundle — a bundled legend is wrong the first time a constant changes.
Rendering the raw code is also 300's own primary rule.
**Revisit if:** 300 finds the letter unreadable without a label before the legend arrives.

## Q: Which pane hangs off a document — derived from the IDoc type, or from whether `fiItems` is populated?
**Decision taken:** from the **type**. An FI document with zero FI lines renders an empty FI pane, in
attention ink, with a sentence saying it is worth reporting.
**Why:** the rail's ordinary loader excludes FI lines, so a silently empty FI section is the exact
trap BackOffice 1389 exists to close. Deriving the pane from the array would draw a payments table
instead and hide the bug the pane exists to reveal.
**Revisit if:** a fourth IDoc type arrives that carries neither payments nor FI lines. *(Amended in the
review triage below: the type is still the primary reading, with `fiItems.length > 0` as a fallback.)*

## Q: Nothing has met a live SIS.Api — BackOffice 1388 is open and so is 1387. Proceed?
**Decision taken:** built against a hand-shaped stub in `tools/idoc-inspector-drive.mjs` (61/61),
with the fixture module and the drive both stating in their headers that the shape is the client's
reading of the spec and not a captured response.
**Why:** the wave brief says nothing has landed and the ticket's Boundaries name the route as a
dependency. Every decision the ticket asks for is a client decision and is assertable on a stub; what
a stub cannot prove is that the server sends this shape, and that proof lives in 1388's `Data.Tests`.
**Revisit if:** 1388 lands — the first live drive is what reconciles the two, and ticket 295 is the
wave's "call the real door" slice.

---

## Review triage (added after `/code-review high` + `/standards-review`)

`/code-review high` found four, all real and all fixed: `exportedAt` printed the .NET default date
instead of "Not exported" (the column is non-nullable, so it is never null); the minted-by filter
survived a document switch onto a bar with no button left to clear it; a line with no conditions
blamed a filter nobody set; and `mintedByTags` did not trim while `sourceTagDisplay` did, so a padded
tag off a fixed-width column would have drawn two identical buttons.

`/standards-review` reported **no hard rule violation** on either axis. Its findings, and what was
done:

## Q: An FI document's line items were hidden behind the pane choice (`pane === 'payments' && …`). Bug or scope?
**Decision taken:** fixed — the line table now renders for every document, and only the
payments-versus-FI-lines pane is the exclusive slot. Driven with an FI document that carries a line.
**Why:** BackOffice 1381 puts the lines table on the document pane unconditionally; only *"payments /
FI lines"* is the one slot. Hiding them was the same silent-empty-section class of bug that keying
the pane on the type exists to prevent.

## Q: `FI_TYPE = 'FI'` compiles a backend vocabulary value into this bundle, which ticket 300 forbids.
**Decision taken:** kept the constant — 300's rule is about the *legend of labels*, and this is a
value the screen must BEHAVE differently for — but added a fallback: a document gets the FI pane if
its type is `FI` **or** it carries FI lines.
**Why:** the type stays the primary reading, so an FI document whose lines failed to load still shows
an empty FI pane loudly (the 1389 trap). The fallback only adds a safety net, so an unfamiliar
financial type cannot make FI lines vanish.

## Q: `idocTypesPresent()` and `DocumentCounts.conditions` had no production caller — only tests.
**Decision taken:** both deleted, with a comment saying the distinct-type list belongs to 299 (which
hangs one download button off it).
**Why:** 296 wrote this rule for this very feature one commit ago when it removed `sameLookup`, and it
applies to its own author. A forward-built helper with no caller has no way to be wrong.

## Q: The wire model carried `isPostItem`, `currency`, `fiCurrency` and `isReturn` (document-level) that nothing renders.
**Decision taken:** pruned, and the file's header now states the rule: a field lands in the model when
something first renders it.
**Why:** extra fields on the wire are ignored anyway, so a field in the model that nothing draws is a
claim about the screen that is not true. This is the same rule the held-document fields are deferred
under.

## Q: Duplicated badge conditional, ~18 repeated `<th>` class strings, and `DocumentPane` at 316 lines holding four unrelated things.
**Decision taken:** extracted `ExportStateBadge.tsx`, `MintedByFilter.tsx`, `DocumentPanes.tsx`
(payments + FI + the shared XML-blanked mark) and `sub-table.ts` (the shared class strings).
**Why:** the badge's raw-code fallback is the branch nobody exercises by hand and it was written
twice; `LineTable` had already solved the header-class repetition with a const, so the sub-tables
should share one.

## Q: 1381's shape diagram carries a per-document ERROR badge and a transaction footer (post-conditions, forensic snapshot). Neither is here.
**Decision taken:** the error badge stays deferred to 298 (with an explicit comment where it would
go); the footer is a **stated absence**, and this is where it is stated.
**Why:** a held document renders in full *under an attention banner*, and that banner, its verdict and
the fields it reads are 298's whole ticket — half a finding on the screen is worse than none. The
footer is not deferred but **dropped by the spec**: 1386's payload and 1382's read model carry no
post-conditions and no forensic snapshot at all, and 1381 itself notes nothing writes the consumed
flag. The spec supersedes the map ticket.
**Revisit if:** 298 declines the error badge, or someone asks for the footer — it would need a payload
change first.

## Q: The filter bar hides itself below two distinct tags, so a document where every row is untagged shows no *unknown* button.
**Decision taken:** kept, and the reason is now in `MintedByFilter`.
**Why:** with one distinct tag the filter cannot narrow anything — every row already carries it — so
the bar would be one button that does nothing beside a Clear.

## Q: CONTEXT.md's **Source tag** entry lists *origin* under _Avoid_, but this wave's own tickets use "origin" for `conditionSource`.
**Decision taken:** sharpened the glossary line rather than the code — *origin* is now avoided only as
a **synonym for the source tag**, and a condition's own `conditionSource` may be called its origin.
The screen's column is named *minted by*, which the entry now records.
**Why:** the ticket and BackOffice 1381 both say "the condition's own origin rides beside its tag", so
the code is using the wave's settled word; the glossary was the thing that was ambiguous.

## Q: `Math.round(splitRatio * 100)` assumes a 0–1 fraction on a DTO that does not exist yet.
**Decision taken:** kept, and the assumption is now stated on the model field and at both call sites.
**Why:** checked rather than assumed — the engine's billing split writes `SplitRatio = 1.000000000000`
for a whole document (`ReversalDocumentBuilderTests`, `ZeroValueDocumentSplitTests`: *"there is
nothing to apportion it against"*). It is a fraction.
