# HITL log — ticket 298 (every empty result names its verdict)

## Q: Where does the verdict copy live, and how is "each code maps to its own copy" made unshippable-if-missing?
**Decision taken:** `verdict.ts` maps code → severity/presentation/**key**; the sentences live in
`reports.json` under `idocInspector.verdict.<Code>.{name,sentence}` (the raw server code IS the key
segment). `verdict.test.ts` imports the shipped locale JSON and walks all ten.
**Why:** a missing sentence renders a raw key to a consultant and a typecheck cannot see it; importing
the locale in a test is an established idiom here (`ua-admin/csv.test.ts`, `callcenter/*`).
**Revisit if:** a second locale lands — the test then has to walk every locale, not just `en`.

## Q: The ten codes are written into the client bundle. Doesn't ticket 300 forbid a bundled legend?
**Decision taken:** written down, deliberately.
**Why:** 300 forbids copying the nine *open-ended vocabularies* (they grow whenever a C# constant is
added, hence `Metadata`). The verdicts are a published client contract — BackOffice's
`IDocInspectorVerdicts` says "oms-react switches on these strings and owns the wording" — and a code
this screen cannot switch on is a code it cannot word.
**Revisit if:** the server ever starts adding verdicts without a client release; then they belong on
`Metadata` too.

## Q: A documents-family verdict (`Processed`) arriving with an EMPTY documents array — what renders?
**Decision taken:** a named contradiction. `readVerdict` flags it and the empty state draws
`verdictContradiction.sentence`, quoting the raw code.
**Why:** unreachable from a correct server, but the two smooth alternatives are both dishonest —
drawing "the rail generated the documents below" over nothing, or blanking. Naming it is the
ticket's whole posture.
**Revisit if:** the server ever legitimately answers `Processed` with an empty array.

## Q: `ProcessedButStampedLegacy` outranks `ProcessedWithHeldDocuments` on the wire (BackOffice 1391).
Does the held finding disappear when a transaction earns both?
**Decision taken:** no — `banners()` adds the held banner whenever any document carries `isHeld`,
whatever the verdict says, and the held document is marked on its own card.
**Why:** 1391's own reasoning for the precedence is that the hold-back "stays legible off the graph".
This is where it stays legible.
**Revisit if:** the server starts sending a `DOCUMENTS_HELD` attention code (1390/1391 both declined
one).

## Q: The verdict's own banner vs. the attention block — both name the disagreement. Draw one or two?
**Decision taken:** one. `banners()` deduplicates by kind; the attention block wins because it
carries the offending export version, and the verdict's own entry stays as a fallback for a
`ProcessedButStampedLegacy` that arrived without its block.
**Why:** a finding told twice reads as two findings; a finding lost because the block was missing is
the silence this verdict exists to end.
**Revisit if:** the server guarantees the block is always present with the verdict.

## Q: Attention ink or the danger `ErrorBanner`?
**Decision taken:** a new `AttentionBanner` on the attention family.
**Why:** `ErrorBanner` is the danger family and means *something failed*. Nothing failed here — the
lookup went right and found something. The attention family is this repo's "needs a human".
**Revisit if:** the design system grows a dedicated finding surface.

## Q: `document-graph.ts`'s `hasDocuments` (ticket 297) — keep or remove?
**Decision taken:** removed; its assertion moved into `verdict.test.ts`.
**Why:** it was a second predicate answering "does this draw a graph", free to drift from the
server's verdict — which user story 29 forbids.
**Revisit if:** something needs a pure array-length question that is NOT the verdict.

## Q: The `errorType` vocabulary (ticket 300 said its blank was 298's) still has no render site.
**Decision taken:** left without one, and noted rather than invented.
**Why:** BackOffice 1391 deliberately does NOT ship the document's `ErrorType`/`ErrorMessage` —
"the generator's diagnostics in the generator's words", where this screen's contract is machine codes
it words itself. So the held banner names the finding and says nothing about why.
**Revisit if:** a later BackOffice slice puts `errorType` on the document.

## Q (from /code-review): the disagreement banner's FALLBACK path quoted a column value it was never told.
**Decision taken:** `VerdictBanner.exportVersion` became a three-state quote —
`{kind:'value'} | {kind:'blank'} | {kind:'unstated'}` — with its own sentence each.
**Why:** a NULL column arrives as `""` and IS a disagreement (the legacy uploader claims empty too),
but "no attention block came with the verdict" is the screen never having been told. Giving the
second the first's sentence would invent the very value the banner exists to report.

## Q (from /code-review): an attention block on a verdict with NO documents was silently dropped.
**Decision taken:** the banner list moved above the graph/empty-state branch, so it renders either
way; and `banners()` no longer emits `unknownVerdict` when there is no graph, because
`VerdictEmptyState` already carries that shout.
**Why:** dropping a finding is the one thing this ticket exists to stop; telling it twice is the
other.

## Q (from /code-review): an attention block carrying a BLANK code.
**Decision taken:** dropped rather than drawn.
**Why:** the block's whole contract is a machine code; "flagged with , which this screen does not
know — report the raw code" is a banner about nothing. The disagreement is not lost with it — the
verdict's own fallback still fires.

## Q (from /code-review): a 200 with `data: null`, or a payload missing `verdict`.
**Decision taken:** its own copy, `verdictMissing`, with no `{{code}}` in it.
**Why:** the unrecognised sentence asks the consultant to report the raw code, which here would be an
empty sentence asking for a blank.

## Q (from /standards-review + /spec): an unknown verdict OVER a graph was shouted twice.
**Decision taken:** the banner keeps the sentence; the strip drops to the pill plus the raw code.
**Why:** the empty case was already de-duplicated the other way (the empty state carries it, the
banner is suppressed). The graph case is the mirror, and the strip's job there is the caption.

## Q (from /spec): the contradiction case kept `Processed`'s green pill and name.
**Decision taken:** a contradiction now turns the WHOLE reading — `sev: 'warn'` and its own
`verdictContradiction.name` ("Contradictory answer").
**Why:** a green *Processed* badge over a sentence saying the server contradicted itself is the same
shape of trap as a `GaveUp` that reads like success.

## Q (from /spec): the per-document chip key lived under `banner.heldMark`, and it is not a banner.
**Decision taken:** moved to `idocInspector.document.held`.

## Declined (judgement calls, with reasons)
- `unknownAttention` + a one-entry `ATTENTION_BANNERS` map called mild Speculative Generality: kept.
  The one-entry lookup is the seam that makes an unrecognised code loud instead of silent, which is
  the ticket's own "fails loudly" rule applied to the other half of the payload.
- `isHeld(doc)` called a Middle Man: kept. It is the single reading of the `=== true` guard shared by
  three call sites (two components and `banners()`), which is what stops a payload predating the
  field reading as truthy-adjacent noise in one of them.
- `AttentionBanner`'s `text-[0.8125rem]` vs the feature's `text-[12.5px]`: kept. It is a banner, and
  the anchor it should match is core's `ErrorBanner` beside it on the same page, not the tables.
