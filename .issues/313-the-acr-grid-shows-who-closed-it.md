---
status: done
spec: 308
blocked-by: —
---

# 313 — The ACR grid shows who closed each ACR, including SYSTEM

## What to build

A closed-by column on the ACRs grid and the ACR form header. `SYSTEM` reads as "Closed automatically at end
of day" (EN+AR), and a collector id as that collector's name.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above:
  - `acr-columns.test.ts`, "who closed it" (9 cases):
    - the sweep reads as the `acrs.closedBy.system` sentence;
    - the sentence is keyed on the RAW `closedBy`, so a person whose name is "SYSTEM" is still a person;
    - a collector's close shows the server's name (or the echoed id) verbatim;
    - an OPEN or pre-090 ACR is blank, not "unknown";
    - sort uses the shown text;
    - the filter answers to the sentence and to `SYSTEM`;
    - it is a default column, headed through `t()`;
    - the raw id sits in the tail.
  - The completeness union now covers 17 columns.
  - `csv.test.ts`: the file writes the closer raw (`SYSTEM` / `="SYSTEM"`, a staff id keeps its leading zero, OPEN is
    blank).
  - Mutations run: keying the sentence on `closedByName` turns 1 test red; showing `closedBy` for the name turns 3
    red. Vitest **2309** green.
- [x] the screen renders against the contract stub (loading, empty, error, refusal):
  - `tools/acr-closed-by-drive.mjs` passes **41/41**. It stubs 1987's sample row verbatim, plus the contract's other
    closers. It checks that:
    - Closed By is on the default grid, beside Status;
    - SYSTEM reads "Closed automatically at end of day", a collector reads as their name, an unresolved id is echoed,
      and OPEN and pre-090 rows are blank;
    - the sentence is not truncated;
    - the floating filter matches on "automatically" and on "SYSTEM";
    - sort follows the shown text;
    - the Closed By Id tail shows SYSTEM or COLL-9 and filters on them;
    - loading shows the list's loading status, empty shows the empty state, a 500 reads as a server fault, a 400
      `ServedByKindUnknown` shows its message, a bare 403 names its status, and a refused probe gets the denied
      backstop;
    - on the ACR form, أُغلق بواسطة is the fourth cell of the الحالة row on every page, carries `closedByText` as
      given (the contract's `فهد القحطاني  (COLL-9)` with both spaces), is blank when `''`, and still prints under
      print media;
    - AcrNotFound still gives the miss;
    - there are no raw keys and no page errors.
  - Regression: `collection-print-drive` **151/151** (its one-A4 checks run over the fixture that now carries a
    wrapping closer name) and `collection-drive` **220/220** (its ACR export header count is now 17). Typecheck, lint
    (3 gates) and build are clean.
- Outstanding (not AFK's): any drive against a LIVE SIS.Api with 1987 (and POS_Server 090, which is 1997's cutover),
  and a human eye on the printed ACR form with a long closer name. Every check above is stubbed.

## Blocked by

- BackOffice [1987](C:\Work\DMSCO\BackOffice-spec1976\.issues\1987-every-open-acr-is-closed-at-2359-by-the-system.md) must be **done** and its `## Web contract` written

## Comments

**Done 2026-09-25 (AFK).** Built against BackOffice 1987's `## Web contract` and cross-checked with the committed
`AcrInquiryModel.ClosedBy/ClosedByName`, the inquiry SELECTs' `ClosedByName` CASE, and `AcrFormBuilder.ClosedByText`.
No drift, and no field beyond the three named.

- **Model:** `AcrInquiryRow.closedBy` and `closedByName`, `AcrForm.closedByText`, and `ACR_SYSTEM_CLOSER = 'SYSTEM'`,
  all in `core/models/collection.ts`.
- **Grid:** `closedByText()` in `acr-columns.ts` is the cell's pure projection. Closed By (`closedByName`) is a default
  column beside Status. Closed By Id (`closedBy`, the raw value) is in the tail beside Closed, following the
  collector's name/id pair. The en key is `acrs.closedBy.system`; there is no Arabic bundle, since the web is
  en-only.
- **Export:** both columns, written raw.
- **Form:** أُغلق بواسطة is the fourth cell of the تاريخ التحصيل / الوصف / الحالة strip, where the WPF puts it. It
  renders `closedByText` as given, with `pre-wrap` so the format's two spaces survive.

Decisions are in `.afk/HITL-313.md`. ⚠️ One finding predates this ticket and is **left for a human**: the web's
`AcrInquiryRow.netCollectedTotal` no longer exists on the wire, because BackOffice 1183 renamed it to `bankedTotal`
(beside `cashSalesTotal` and `settlementTotal`). Against a live SIS.Api, the ACRs grid's Net Collected column and CSV
column are blank. This fits 316, which rewrites this row type for 1993, or a ticket of its own.
