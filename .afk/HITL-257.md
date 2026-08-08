# HITL — ticket 257 (a row opens its document, and an ACR opens its collections)

Decisions taken unattended while building the slice. None is a blocker; each is the most
conservative reading of the ticket I could find, and each says what would make it wrong.

## Q: What does the `?acr=` chip NAME the ACR by?

**Decision taken:** by its **AcrId** — the ULID the URL carries — rendered monospaced after the
label `ACR`. Not by the ACR *number*, which is what a supervisor actually holds.

**Why:** the URL is `?acr=<AcrId>` and nothing else — the ticket spells it that way, and
`CollectionInquiryRow` carries neither `acrId` nor `acrNumber`, so a scoped Cash Collections screen
has **no ACR number anywhere on the wire** to read. Naming it by number would mean either a second
display-only URL param (deviating from the ticket's stated address) or deriving a value the client
is forbidden to derive.

**Revisit if:** the door grows `AcrNumber` on the collections projection (a BackOffice change, sibling
to 1089's `CollectionReceiptId`) — then the chip reads `ACR 41` and the ULID stays in the URL only.
That is a **server change**, logged here rather than guessed at client-side.

## Q: Does the chip disable the **Search** button as well as the four inputs?

**Decision taken:** yes — Search is disabled while scoped.

**Why:** the ticket names four controls (From/To/Store/Collector) that the chip "overrides and
disables". With all four overridden, Search has nothing left to promote: clicking it would re-issue
the identical scoped query. A live button that changes nothing is the same lie as a live input the
server ignores.

**Revisit if:** a fifth, non-overridden filter ever lands on this toolbar — then Search has work to
do again under a scope.

## Q: What do the four overridden inputs *display*?

**Decision taken:** nothing. While scoped they render empty (the criteria state underneath is
untouched, so clearing the chip puts them straight back).

**Why:** the ticket says the chip **overrides** as well as disables. A greyed box still reading
`2026-08-08 → 2026-08-08` over a grid scoped to an ACR spanning three weeks reads as "this period
was applied, then frozen" — which is exactly the misreading the disabling exists to prevent, since
the door discarded that period entirely.

**Revisit if:** a reviewer prefers the WPF's own posture of leaving stale values visible.

## Q: Is `Collections ▸` offered to a session that cannot open Cash Collections?

**Decision taken:** no. The action is withheld when `canOpenCollections` is false; `Form ▸` still
shows. Taken from the built-in `/code-review`, not invented.

**Why:** the four grants are **independent** (253's ruling, and the whole point of the ragged
group), so an account holding `AcrInquiry` and not `CollectionInquiry` is ordinary rather than
hypothetical. Offering it a same-tab drill-down would walk it out of a grid it can read and into
`ScreenGate`'s denial, losing its grid state. The probe is already cached under
`COLLECTION_ACCESS_KEY`, so asking costs no second call. Driven as its own scenario.

**Revisit if:** the four grants are ever collapsed into one.

## Q: Does the `Filtered` chip show alongside the ACR chip?

**Decision taken:** no — the ACR chip replaces it while scoped.

**Why:** two chips over one grid are two different accounts of why it is narrowed, and only the
scope is true (the door ignores the criteria the Filtered chip measures).

## Q: Extra copy beyond "the chip and the three row-action labels"?

**Decision taken:** three extra keys — `collections.empty.scopedTitle`/`scopedHint` and
`collections.capReachedScoped`.

**Why:** both existing strings name controls the chip has disabled ("widen the period, clear the
store"), i.e. advice a scoped screen cannot take and the door would ignore. Both surfaced in
`/code-review`. Small, and confined to this screen's namespace.

## Note — 258 must exclude the action column from the export

`ag-grid-community@36.0.1` has **no `suppressCsvExport` on `ColDef`** (checked against the typings,
not assumed). The action columns therefore carry `colId: 'actions'` as 258's handle: they render
links and hold no cell value, so a CSV taken with `allColumns` would include a headed, empty column
between the real ones. Recorded in `RowActions.tsx` beside the column builder.

## Outstanding — not this ticket's to close

- **`CollectionReceiptId` on the grid row** is BackOffice **1089** and still in flight. The mock
  supplies it; the link shape does not change when it goes live. A row that arrives without one
  draws **no link at all** rather than a link to a route that cannot match — asserted in the drive.
- **Nothing here has been driven against a live SIS.Api.** Every `CollectionWeb/*` envelope is
  stubbed at Playwright, and the two print routes read checked-in fixtures. Ticket **259** is the
  wave-joining event, and **260** is the paper proof.
