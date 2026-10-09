# HITL log — ticket 454 (GS1 check, spec 2544)

## Contract gap: the envelope's error entries are abbreviated in the contract
**Decision taken:** Same ruling as 451/453: the stub and the client use the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`. The page shows a failed batch's text only through `apiErrorMessage`. It does not branch on any MAT code: MAT-00005 (no codes, or over 500) cannot be provoked by the client, which refuses the 501st scan before any call and never sends an empty batch.
**Why:** The contract abbreviates the shared estate envelope; every SIS.Api door emits the long form.
**Revisit if:** the MaterialWeb doors ever emit `{ code, message }`. A refusal would then read as the generic "unexpected" text instead of the server's sentence.

## Q: The GS character (0x1D) in the export, and on screen
**Decision taken:** `write-excel-file` (under `@/core/util/grid-xlsx`) silently REMOVES characters that are invalid in XML (`removeInvalidXmlCharacters`), so a raw scan would be written with its element strings glued together. The scan column's `valueFormatter` shows GS as `<GS>` (`visibleScan`, the GS1 General Specifications' own notation), and the export uses the same formatter. The same marker shows on screen (grid cell, tooltip, card), where the character would otherwise be invisible. The stored scan, the duplicate test and the request stay byte for byte (drive check 3 asserts `\u001d` in the POST body). grid-xlsx is unchanged.
**Why:** Dropped silently, the scan reads as a different code. `<GS>` is unambiguous and cannot be confused with the `#` a pasted string uses.
**Revisit if:** the owner wants the export to be re-pastable (then `#` is the marker), or wants the screen to show the bare code without a marker (the wave brief reads "in the EXPORT cell only").

## Q: How is "expand a row to load its history" built on AG Grid Community?
**Decision taken:** A chevron button in a pinned first column opens ONE history pane under the grid. Only one unit is open at a time; the chevron toggles it, and the verdict card has a "Show history" button for the latest scan. The pane is a plain table: history has no export in the ticket. A row with no material or no serial has a disabled chevron with the reason in its title.
**Why:** Community has no master/detail and the repo has no full-width-row precedent. A pane is the conservative choice.
**Revisit if:** users want several histories open at once.

## Q: Is a history cached per unit forever, or re-asked when a re-scan shows more?
**Decision taken:** The query key is material + serial + lot + the `historyCount` the check gave. Opening the same unit again, or its duplicate row, makes no new call (the drive proves one call). A re-scan whose count has CHANGED asks again, so the pane can never contradict the card (code-review finding).
**Why:** `staleTime: Infinity` alone would have shown an old, empty trail beside a card saying "1 sale or return".
**Revisit if:** the owner reads "one per unit" strictly. Then drop the count from `historyKey`.

## Q: Severities for the verdicts
**Decision taken:** SELLABLE `ok`, SOLD `bad`, HELD `warn`, no status `mute`. Batch: known `ok`, unknown `warn` (the ticket says so), not applicable `mute`. Material reason: NOT_PARSED `bad`, GTIN_UNKNOWN `warn`. History: SALE `go`, RETURN `warn`. A duplicate is a `warn` badge.
**Why:** For a quality user checking a unit in hand, "already sold" is the alarming answer, and "held" needs a human.
**Revisit if:** the owner sees SOLD as neutral (e.g. auditing returns, where sold is expected).

## Q: Where does the sync note stand?
**Decision taken:** On the card, as text beside the SELLABLE badge. In the grid, as an info icon beside every SELLABLE badge, with the sentence as its title and aria-label. It is not shown for SOLD, HELD or no status.
**Why:** The spec says "beside every SELLABLE verdict". A sentence in every grid cell would not fit.
**Revisit if:** the owner wants the note always visible, regardless of status.

## Q: Is a scan trimmed? Are blank lines scans?
**Decision taken:** A line is never trimmed (byte for byte). A line that is empty or only whitespace is not a scan. A pasted block splits on `\r\n`, `\n` or `\r`.
**Why:** The wave rules the raw scan is kept byte for byte. A scanner that adds a trailing space would get the server's verdict on exactly what it sent.
**Revisit if:** live scanners add whitespace that makes valid units fail parsing. Trimming would then be a deliberate client change.

## Q: "Always-focused" input
**Decision taken:** The box is focused on landing and again after Enter, a paste, Check again and Clear list. It does not steal focus back from other controls (the grid, Export, the history pane).
**Why:** Refocusing on blur would make the grid and its buttons unusable.
**Revisit if:** users scan while focus sits elsewhere and lose reads.

## Q: Clear list — confirm first?
**Decision taken:** No confirm. It clears the list, the answers, the open pane and the refusal note.
**Why:** No repo precedent asks for confirmation on clearing a client-only list, and the scans can be re-pasted.
**Revisit if:** auditors lose 500-scan lists by mistake.

## Q: Scope beyond the ticket's letter (standards/spec review)
**Decision taken:** Kept Duplicate, Description, Arabic description and Issues columns in the grid (and so in the export), a failed-batch banner with "Check again", and the card's "Show history" button.
**Why:** The duplicate flag needs a column of its own to reach the export. The descriptions and the issue categories are the "verdicts" the export is for. A failed check needs a way to be re-sent.
**Revisit if:** the owner wants the grid leaner.

## Note: spec wording on duplicates
Spec 2544 story 42 says "flagged rather than added twice". The wave ruling and the ticket say a duplicate is flagged on its own row and never merged, and that is what is built. The spec line may want amending in BackOffice; it was not touched here.

## Note: code-review findings outside this ticket (not changed)
- `features/materials/stock-check/StockCheckPage.tsx` (453): `addSet`'s option-level `onSuccess` still adds a set's stores, and clears the newly chosen value, if the user changes kind/value while the request is pending.
- `features/materials/search/MaterialSearchPage.tsx` (451): a URL write that settles back on the URL already shown leaves the echo queue non-empty, which blocks the level-cascade prune until a later write.
- `MaterialPlaceholderPage.tsx`: its doc comment and the `static` branch are stale now that both static routes have pages. 452 deletes the file.
- `figure = (n) => n.toLocaleString('en-US')`, `PANEL` and `DEFAULT_COL_DEF` are now copied in three Materials pages. They are candidates to move up to `@/core`.
