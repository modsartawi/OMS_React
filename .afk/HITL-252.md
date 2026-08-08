# HITL — ticket 252 (an ACR form prints across its pages)

Decisions taken unattended, and the one item that stays open.

## Q: The ticket says "reuse 251's sheet primitives". 251 has no shared primitive — `.cv-sheet` / `.cv-doc` are the voucher's own classes. Extract, or duplicate the A4 geometry into `.acr-sheet`?

**Decision taken:** Extracted. `PrintSheet.tsx` + `print-sheet.css` now hold the 210×297mm block,
the 780px document box, the WPF's 0.956 shrink-to-fit, Tahoma, RTL and the break-before rule. Each
document's stylesheet keeps only what genuinely differs — its font size, line height and inner
padding, both transcribed from its own XAML. `CollectionVoucher` was rewired onto it; the drive's
`.cv-sheet` / `.cv-doc` selectors became `.print-sheet` / `.print-doc`.

**Why:** duplicating the geometry is precisely the "second answer" the ticket forbids, and 251's own
comments already anticipate the ACR ("the ACR joins it at 252", "ticket 252's ACR route calls this
too"). All 41 of 251's drive assertions still pass unchanged in substance.

**Revisit if:** a third print document wants a non-A4 sheet — then `PrintSheet` takes a size, rather
than the two documents each growing their own copy again.

## Q: Same shape for the miss state — `ReceiptPrintPage` and `AcrPrintPage` render the identical "this document no longer exists" block off the identical two i18n keys.

**Decision taken:** Extracted to `PrintMiss.tsx`, shared by both routes. It is chrome, so it holds
none of the documents' three-rule exception: `t()`, logical utilities, tokens.

**Why:** 245 §7 gives the two misses different envelope codes but deliberately the same sentence to
the same reader. Two copies would drift on the next copy edit.

**Revisit if:** 259 finds the two misses want different wording once real envelope codes arrive.

## Q: Is the `صفحة n / m` stamp an LTR island, like the negative figure and 251's `collectedAtText`?

**Decision taken:** No. Left unisolated, as the WPF and the signed-off variant C render it — and the
painted order is now asserted in the drive rather than assumed.

**Why:** measured, not reasoned. `2 / 3` follows an Arabic word, so its digits resolve to AN and the
neutrals between them to the paragraph direction; the sheet paints صفحة at x=64, `2` at x=59, `3` at
x=44 — right to left, which is the correct reading order in the document's own direction. This is
not the negative-figure bug: there the minus lands on the WRONG SIDE of its own number, which is
wrong in any reading order. Isolating the stamp would flip the pair against the WPF and against the
sign-off for no reading gain.

**Revisit if:** 260's paper proof finds a reader parsing the stamp left-to-right. The drive
assertion is written so that "fixing" it fires a failure and forces the ruling to be re-opened
rather than silently reversed.

## Q: The fixture needs 51 rows of pre-formatted money, dates and Arabic. Hand-author them?

**Decision taken:** No. The signed-off prototype mock was recovered from `prototype/247-acr-form`,
run once at authoring time by a throwaway generator, and its output serialized into
`acr-fixture.ts` as plain literals. The generator is NOT checked in.

**Why:** two rules meet here — never retype Arabic, and the client cannot format. Generating at
authoring time satisfies both: every Arabic string and every figure is the byte the 247 sign-off
looked at, and no `toFixed`, no chunker and no running total survives into the browser. Verified
afterwards that all 28 Arabic runs in the new component and stylesheet appear verbatim in the
recovered prototype, the fidelity inventory or a wave ticket.

**Revisit if:** 259 replaces the fixture with the real door, at which point the file becomes a
test fixture or disappears.

## Q: `key` for the ACR's row list — `seqText` is unique and contractual.

**Decision taken:** Keyed by position, like 251's pages.

**Why:** 251's code review ruled against keying a list on a server string; `seqText` is one. The
list never reorders or filters, so the index is stable.

## 🚩 STILL OPEN — the logo. Not a decision, a file.

Unchanged from 251, and sharper on this document: the paper original prints the **DMSCO** mark, the
WPF prints al-dawaa, and the receipt's pad wants a *horizontal* al-dawaa lockup that exists in
neither repo. The interim shipped here is the stacked al-dawaa the WPF ships, recovered from the
prototype branch — byte-identical to the file 251 already checked in (same md5), so it is reused
rather than added twice. The honest fallback if the interim is rejected is the prototype's labelled
placeholder; a faked DMSCO mark is not on the table. Tracked as BackOffice 1088.

## Q: /code-review — the two print routes carry no `ScreenGate`, while all four list screens do.

**Decision taken:** Not fixed. Left session-guarded only, exactly as 251 shipped it.

**Why:** three reasons, in order. The ticket rules it directly — *"Route outside the AppShell, as
251"* — and 253 says explicitly that where a print route sits in `router.tsx` is independent of the
grant work it did. There is no grant to gate on: `CollectionWeb/Access` returns four booleans, one
per SCREEN (`canOpenCollections`, `canOpenAcrs`, `canOpenDeposits`, `canOpenAttempts`), and picking
one for a document would be inventing a ruling. And the exposure today is a checked-in fixture, not
data: at 259 the real door 403s an ungranted session and the document refuses server-side, which is
where a document's access answer belongs anyway.

**Revisit if:** 259 lands and the door turns out NOT to enforce the grant per document — then this
becomes a real hole and needs a ruling on which grant a document sits behind.

## Q: /standards-review — spec 249 story 77 says a shortfall ROW carries the mismatch red; this reddens only the cash figure.

**Decision taken:** Kept the figure. Documented the tension inline at the mark.

**Why:** 247's ruling is narrower than the spec's story and it is the one a human actually looked
at — *"a negative cash figure prints in the same `#B00020` the mismatch mark uses"* — and the
variant C that was signed off side by side against the paper reddens the figure alone. Widening it
is one class name if 260's paper proof asks.

## Q: /code-review — `src/core/money.ts` `currencyDecimals` treats a table entry of `0` as missing.

**Decision taken:** Not touched. It is ticket 250's file, not this slice's, and staging is narrow.

**Why:** `(code && CURRENCY_DECIMALS[code]) || DEFAULT_DECIMALS` degrades a zero-decimal currency
(`JPY: 0`) to 2 dp. Real, but unreachable from this wave — neither document formats money at all,
and the table holds no zero-decimal entry today. Recorded here so it is not lost.

## Notes for the wave, not blockers

- **`npm test` baseline moved.** The runner's snapshot said 76 files / 1215 tests; main now carries
  78 / 1224 (tickets 250/251/253 landed after the snapshot). All green before and after this slice.
- **The palette gate's load-bearing count is 15, not the ticket's predicted 22.** The ticket's number
  came from the prototype's four files (three variants plus a host page). This slice's two facsimile
  stylesheets trip 11 (`collection-acr.css`) + 4 (`print-sheet.css`) = 15 with the exclusions
  removed. Measured by removing each entry and re-running the gate.
- **No renderer unit test, deliberately** — spelled out in the ticket's Proof. The client computes
  no displayed value, so a test would have to reimplement a server string to compare against it,
  manufacturing the very drift this design exists to prevent.
