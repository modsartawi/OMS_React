---
status: done
spec: 308
blocked-by: —
---

# 311 — Posting an entry requires a description

## What to build

`ReasonField` is required (non-blank after trim, <= 200) on the single post, and the bulk template's
description column is marked required. A server refusal for a blank row is shown against that row.

## Contract

Build against the envelope recorded under `## Web contract` in the BackOffice ticket(s) below, stubbed exactly.
Do not add fields the contract does not name.

## Proof

- [x] criteria / columns / projection modules under vitest for the behaviour above:
  - `posting.test.ts` (`checkDescription`): empty, spaces, tabs and null are refused as `blank`. The posted text is
    trimmed. 200 characters padded with spaces still post, and 201 is `too-long`.
  - `bulk.test.ts` (`reviewBulk(...).errorsByRow`): a `REASON_REQUIRED` row carries the server's words on row 3
    only. Row 0 and the client's unresolved blocker are not attached to any row. Two refusals on one row are both
    kept.
  - `bulk.test.ts` (`withCommitRowErrors`): `ROW_ERRORS` folds onto the preview and blocks commit. An empty error
    list, or any other refusal, is not folded.
  - `bulk-template.test.ts`: the description column is marked required, and every example row carries a
    description the door accepts.
  - vitest **2290** green.
- [x] the screen renders against the contract stub (loading, empty, error, refusal):
  `tools/settlement-description-drive.mjs` passes **41/41** against 1980's envelopes, stubbed exactly as the
  contract records them. It checks that:
  - the box is marked required;
  - an empty or spaces-only description blocks Review and says why;
  - a padded description posts trimmed, in the contract's four-field body;
  - `SettlementReasonRequired` stays on the box in the server's words (English then Arabic), with the typed text
    kept;
  - the branch list shows its loading state and its error;
  - the template marks the column and still downloads `StoreCode,Amount,Reason`;
  - the upload shows loading, an empty answer and a 400 error, and a `REASON_REQUIRED` row is refused on its own
    row with commit blocked;
  - a `ROW_ERRORS` commit lands back on the preview, counting ONE row for two refusals.

  Regression: `settlement-drive` **291/291**, `settlement-approval-drive` **42/42**, `settlement-supervision-drive`
  **41/41**. Typecheck, lint (3 gates) and build are clean.
- Outstanding (not AFK's): any drive against a LIVE SIS.Api with 1980. Every check above is stubbed.

## Blocked by

- BackOffice [1980](C:\Work\DMSCO\BackOffice-spec1976\.issues\1980-an-entry-cannot-be-posted-without-a-description.md) must be **done** and its `## Web contract` written

## Comments

**Done 2026-09-25 (AFK).** Built against BackOffice 1980's `## Web contract`, and cross-checked with the committed
`SettlementAccountantService.PostAsync` and `SettlementBulkPostingService`. No drift, and no new field.

- **Single post:** the description is required. `checkDescription` in `posting.ts` trims it first, then measures
  it. `ReasonField` marks it required in words and to assistive tech, through new optional `required` / `error`
  props; its other callers are unchanged. A server refusal (`SettlementReasonRequired` / `SettlementReasonTooLong`)
  returns to the form and stays on the box in the server's words.
- **Bulk:** the template marks its columns required and says a row without a description is refused. A
  `REASON_REQUIRED` row shows the server's refusal on its own grid row (`errorsByRow`). A `ROW_ERRORS` commit folds
  back onto the preview (`withCommitRowErrors`).
- **Copy:** on-screen "reason" is now "description", in the post form and in both grids' column header.

Decisions and review outcomes are in `.afk/HITL-311.md`.
