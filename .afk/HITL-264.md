# HITL — ticket 264 (one field finds an invoice)

Decisions taken unattended, and one observation for a human.

## Q: The grid — 14 columns, but the spec also says `trxDate`/`trxTime` are "joined for display"

Ticket 264 lists **14 columns** including `trxDate` **and** `trxTime` as separate entries; spec 261
§Columns says the two raw fields "are joined for display through `@/core/util/date-format`" and its
own wireframe shows ONE `Date/Time` column. The AFK runner repeats the join instruction verbatim.
Both cannot be literally true.

**Decision taken:** **13 grid columns**, one of which is a joined `Date / time` cell built by a new
pure `joinDayAndTime(day, time)` in `@/core/util/date-format`. All **14 wire fields are still
rendered** — `trxTime` is declared in an exported `JOINED_FIELDS` list, and
`invoice-columns.test.ts` proves `COLUMN_FIELDS ∪ JOINED_FIELDS ∪ NON_COLUMN_FIELDS` is exactly the
wire row, so no field can go quietly unrendered.

**Why:** the join is stated three times (spec, wireframe, runner) and is a behaviour; "14" is a
count that the field list satisfies either way. Drawing the time twice — once joined, once raw —
was the only reading that satisfied both literally, and it is worse UI than either.

**Revisit if:** an operator wants to sort by time-of-day across days (today the joined string sorts
chronologically, i.e. by date first), or a reviewer holds that the column count is normative — the
change is one entry in `COLUMN_FIELDS` and one line in the bundle.

## Q: `RetailInvoiceKey` has no consumer until ticket 265 — paste it now or leave it?

**Decision taken:** pasted, with §2's other two, in the same block.

**Why:** the runner names all three as "paste VERBATIM", and contract §2 is one block that says to
copy it whole — splitting a verbatim paste across two sessions is how a paste drifts. 263 deferred
the search shapes because it had no *screen*; the type block is a different thing from a screen.

**Revisit if:** an unused-export gate ever lands (there is none today; `typecheck` and all three
lint gates are clean).

## Q: `amount` has no currency on the wire, but the estate includes Bahrain (BHD, 3 dp)

**Decision taken:** the column formats through `formatMoneyIn(value, INVOICE_AMOUNT_CURRENCY)` with
`INVOICE_AMOUNT_CURRENCY = null` — i.e. the footprint's default 2 decimals — rather than through
`number-format`'s fixed-2dp `formatMoney`.

**Why:** contract §2 carries no currency field and spec 261 rules out any server change. Going
through the currency-aware formatter anyway means the day the contract grows a currency, the fix is
that one constant; going through the fixed one would have to be unpicked at every call site.

**Revisit if:** the contract grows a currency field, or 266's live check finds a Bahraini invoice.

## Observation for a human (NOT acted on — BackOffice is not this session's to edit)

`InvoiceCandidate` (contract §2) has **no currency**, and `RetailTrx.Amount` on a Bahraini store is
a 3-decimal figure. This screen will render such an amount at 2 dp — a misstated amount rather than
an untidy one. §6.2 already flags `amount` as unverified and ticket 266 is the slice holding both
the row and the PDF, so it is the cheapest place to catch it. Raised here rather than as a server
change, per spec 261 §Out of Scope.

## Note: the drive ran on :5201, not :5199

Unchanged from 263 and for the same reason: **PID 33320 has held `127.0.0.1:5199` since
2026-08-08 06:29** — an orphaned `vite --port 5199` from the collection wave's AFK run, not this
session's to kill. The drive's existing `DRIVE_PORT` override was used. The vite server this
session started on :5201 **was** killed after the run.
