---
status: done
spec: 319
blocked-by: 321
---

# 323 — Finance withdraws a wrong slip, and it moves to Withdrawn

## What to build

A **Withdraw** action on each stored slip in 321's drawer. A wrong slip (the wrong store or day, unreadable, a
duplicate, not an ECR slip) is retired for good. Its bytes stay on the server, but nobody can read them again.
There is **no restore** (C7) and no collection cutoff (C3).

- **Who sees it.** Withdraw is shown only when the `AttachmentWeb/Access` probe's `withdrawCategories` contains
  `"CASH_CLOSE"`, tested with a strict membership check. A missing field, a refused probe or a pending probe
  hides it. That grant (`AttachmentsCashCloseWithdraw`) is seeded into `COLLECTION_ACCOUNTANT` and
  `ACCOUNTANT_SUPERVISOR` only, so a collector sees the drawer and Withdrawn (n), but never the action.
- **The dialog.** It opens from the slip's row and names the slip (file name, till, uploaded at).
  - **Reason picker**: the five codes, in this order, each labelled English beside Arabic:

    | code | English | Arabic |
    |---|---|---|
    | `WRONG_STORE_DAY` | Wrong store or day | فرع أو يوم غير صحيح |
    | `UNREADABLE` | Unreadable | غير مقروء |
    | `DUPLICATE` | Duplicate | مكرر |
    | `NOT_ECR_SLIP` | Not an ECR slip | ليس إيصال جهاز الدفع (ECR) |
    | `OTHER` | Other | سبب آخر |

  - **Note**: a free-text box. It is **required for Other**: confirm stays disabled while it is blank or
    whitespace. It is optional for the other codes. The server keeps the first 200 characters, so say so and
    cap the input at 200.
  - The dialog says the withdrawal is **final**, and that a mistake is fixed by adding the file again.
- **Send.** `POST AttachmentWeb/{attachmentId}/Withdraw` through `api.post`, with body `{ reasonCode, note }`.
- **Answers:**
  - **200**: `data` is the withdrawn item. Re-read `ByOwner`, so the slip leaves the list and heads Withdrawn
    (n). If it was the slip in preview, revoke its object URL and clear the preview. Invalidate the grid's query
    (the count drops on the next read) without reloading it under the user. A withdraw of a row that is already
    withdrawn also answers 200 with that row **unchanged**, so treat it the same way. A double press is
    harmless, but still disable confirm while the request is in flight.
  - **400**: `errors[0].errorCode` is `reasonCode` or `note`. Show `message` in the dialog and keep the user's
    input.
  - **404 `NOT_FOUND`**: the slip is no longer a stored slip you may withdraw. Say so, close the dialog and
    re-read `ByOwner`.
  - **403 (no body)**: the session lacks the grant. Say so and take the action away for this drawer (the probe
    and the server disagree, and the server wins).
  - **503 `NOT_SET_UP`**: the File Server is not configured. Show the message, with no retry.

## Contract

Build against BackOffice
[2035](C:\Work\DMSCO\BackOffice\.issues\2035-finance-withdraws-a-wrong-slip-and-it-stops-being-readable.md)'s
`## Web contract` (the Access and Withdraw sections), stubbed exactly. Cross-check the codes and statuses
against `AttachmentWebEndpoints.cs` and the withdraw service on BackOffice `pricing2`. Add no field the contract
does not name.

## Proof

- [x] vitest on the pure modules:
  - the withdraw predicate: true only for a `withdrawCategories` array holding `"CASH_CLOSE"`, and false for a
    missing field, an empty array, a bare string and a refused probe;
  - the reason list: five codes, in contract order, each with both labels;
  - the confirm rule: Other with a blank or whitespace note is disabled, Other with a note is enabled, and every
    other code is enabled with or without a note;
  - the body: exactly `{ reasonCode, note }`, with the note trimmed and capped at 200;
  - the answer mapping by status and code (200 / 400 `reasonCode` / 400 `note` / 404 / 403 / 503).
- [x] A drive (stubbed, no live SIS.Api) covers:
  - Withdraw hidden without the withdraw grant, while Withdrawn (n) is still shown;
  - Other blocked until a note is typed;
  - a 200 moving the slip into Withdrawn (n) and clearing its preview;
  - a repeat 200 (already withdrawn) leaving the row unchanged;
  - a 400, a 404 and a 403 each shown as the contract says.
- [x] 320's, 321's and 322's drives unchanged.
- [x] `typecheck`, `lint`, `build` and `npm test` green.

## Boundaries

- No undo, no restore and no route for one (C7).
- Do not preview or download a withdrawn slip. `/Content` answers 404 for one (C6).
- The reason labels are drafted and wait on the owner's read. Put them under their own i18n keys (both
  languages as values) so the wording can change without touching code. The Withdrawn list shows the server's
  `reasonLabel` / `reasonLabelArabic`, never this table.

## Done when

A collection accountant, or their supervisor, withdraws a wrong slip from a store day's drawer with a reason
(and a note, for Other). The slip leaves the list and appears under Withdrawn (n) with who, when and why. It can
no longer be opened, and a collector never sees the action.

## Blocked by

- [321](321-a-days-slips-open-in-a-drawer-with-preview-and-download.md): the drawer and the Withdrawn (n) list.
- BackOffice 2035: **done** (merged `da71a9621`).

## Open questions

- None on the wire. The label wording is the owner's read, not a build question.

## Comments

**Done 2026-09-26 (AFK).**

**Contract.** Built against BackOffice 2035's `## Web contract` (Access and Withdraw). Both 2034 and 2035 are
`status: done` on `pricing2`. I cross-checked it against the code on `pricing2`:
- `AttachmentWebEndpoints.cs`;
- `AttachmentWithdrawResult.cs`;
- `AttachmentWithdrawGrantEndpointFilter.cs` (a bare 403);
- `AttachmentWithdrawReasons.cs`;
- `AttachmentWithdrawRequest.cs`;
- `AttachmentService.WithdrawAsync` (trims, then clamps to 200; a withdrawn row comes back unchanged);
- `AttachmentMessages.cs`.

**No drift.** The drive stubs exactly those shapes.

**What was built.**
- **`slip-withdraw.ts`** (pure):
  - `canWithdrawSlips`: `withdrawCategories` holds `CASH_CLOSE` by array membership, on top of `canSeeSlips`.
  - `WITHDRAW_REASONS`: the five codes in contract order, each with its label key.
  - `canConfirmWithdraw`: Other needs a non-blank note.
  - `withdrawBody` / `withdrawNote`: exactly `{ reasonCode, note }`, the note trimmed and cut to 200 without
    splitting a surrogate pair.
  - `withdrawAnswer`: by code. The one status read is the bodiless 403 (kind `unknown`, no code, 403).
  - `withdrawClosesDialog` / `withdrawCanResend`.
- **`api.ts`**:
  - `withdrawSlip` through `api.post`.
  - `slipContentKey`.
  - `markSlipDayChanged`: re-read ByOwner, and mark both grid heads stale with `refetchType: 'none'`. 322's store
    uses it now too.
- **`SlipWithdrawDialog.tsx`** is on `core/ui/Modal`. It:
  - names the slip (file name, till, uploaded at) and says the withdrawal is final and how to fix a mistake;
  - offers the five reasons as radios;
  - takes the note with `maxLength` 200 and says so;
  - holds confirm disabled until it may be pressed, and while in flight (a ref-held press as well);
  - cannot be dismissed while in flight, even by a repeated Escape.

  A 400, a 503 `NOT_SET_UP` or a failure stays in the dialog with the server's message as sent and the input kept.
  `NOT_SET_UP` leaves confirm disabled.
- **`SlipDrawer.tsx`**:
  - Withdraw sits beside Download on the previewed slip (see the HITL note on placement).
  - **200**: the preview is dropped (its URL revoked, its bytes removed from the cache), ByOwner is re-read so the
    slip heads Withdrawn (n), the grids are marked stale without reloading, and a line says it was withdrawn.
  - **404**: the dialog closes, the drawer's sentence shows with the server's words under it, and ByOwner is
    re-read.
  - **Bare 403**: the drawer says so and the action is gone for this drawer.
  - The drawer's `onCancel` now ignores the dialog's bubbled Escape.
  - `TillText` moved to `SlipTillText.tsx` so the dialog names a till the same way.
- **i18n**: `slips.withdraw.*` in `collection.json`. The five reason values are `"<English> · <Arabic>"`, byte for
  byte from the table above (a vitest compares them). The Withdrawn list still shows the server's
  `reasonLabel` / `reasonLabelArabic`.

**Proof.**
- **vitest**: `slip-withdraw.test.ts` has 24 tests. Each of these mutations was run once, went red, and was
  restored:
  - the status-keyed 403;
  - `String.includes` membership;
  - an untrimmed confirm rule;
  - an untrimmed body;
  - a resend after `NOT_SET_UP`.
- **npm test**: 147 files / 2571 tests green.
- **`tools/slip-withdraw-drive.mjs`**: 68/68, stubbed. It covers:
  - hidden for no field, an empty list and a bare string, with Withdrawn (n) still shown;
  - Other blocked until a note is typed;
  - one request for many presses;
  - a 200 into Withdrawn (n), with the preview cleared, its URL revoked and no grid reload;
  - a repeat 200 leaving the first withdrawal's row;
  - 400 `reasonCode` / `note`, 404, 403 and 503;
  - a collected Collections row (C3);
  - Escape closing the dialog only;
  - no raw key and no page error.

  Two drive mutations (the drawer's Escape guard, the native-close guard) each went red.
- **Other drives**, all unmodified: `slip-count` 64/64, `slip-drawer` 63/63, `slip-add` 52/52, `ready` 44/44,
  `collection` 220/220, `collections-filters` 44/44, `four-filters` 80/80. One `collection-drive` run failed its
  first ACRs check ("Checking your access…", a cold Vite start). That page is untouched, and two re-runs were 220/220.
- **Gates**: `typecheck`, `lint` (boundaries 657 files, contrast, colour literals) and `build` are green.

**Review.**
- **/code-review**: one finding, fixed. A repeated Escape in flight could force-close the dialog for good. The
  dialog now re-shows itself, and the drive proves it.
- **/standards-review, Standards axis**: no hard violations. Taken:
  - `apiErrorKind`;
  - a `WithdrawClosingAnswer` type;
  - one `markSlipDayChanged`;
  - the body built once;
  - a clearer ref name;
  - the 404's server words shown as sent.

  Left: the native-close guard is local to the feature. It belongs in `core/ui/Modal` once a second modal needs it.
- **/standards-review, Spec axis**: no defects. The row-versus-preview placement was judged acceptable, and it is
  logged. The extras are logged in `.afk/HITL-323.md`: the read-grant conjunction, the success line, and the 404
  marking the grids stale.

**Outstanding (not AFK-able).**
- The live walk against a real SIS.Api with the File Server key set. None is up, and every drive is stubbed.
- The owner's read of the drafted EN+AR reason labels and every new `slips.withdraw.*` string.
