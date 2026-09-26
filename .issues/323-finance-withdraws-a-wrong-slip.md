---
status: open
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

- [ ] vitest on the pure modules:
  - the withdraw predicate: true only for a `withdrawCategories` array holding `"CASH_CLOSE"`, and false for a
    missing field, an empty array, a bare string and a refused probe;
  - the reason list: five codes, in contract order, each with both labels;
  - the confirm rule: Other with a blank or whitespace note is disabled, Other with a note is enabled, and every
    other code is enabled with or without a note;
  - the body: exactly `{ reasonCode, note }`, with the note trimmed and capped at 200;
  - the answer mapping by status and code (200 / 400 `reasonCode` / 400 `note` / 404 / 403 / 503).
- [ ] A drive (stubbed, no live SIS.Api) covers:
  - Withdraw hidden without the withdraw grant, while Withdrawn (n) is still shown;
  - Other blocked until a note is typed;
  - a 200 moving the slip into Withdrawn (n) and clearing its preview;
  - a repeat 200 (already withdrawn) leaving the row unchanged;
  - a 400, a 404 and a 403 each shown as the contract says.
- [ ] 320's, 321's and 322's drives unchanged.
- [ ] `typecheck`, `lint`, `build` and `npm test` green.

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
