---
status: done
spec: 319
blocked-by: 321
---

# 322 — Finance adds a slip from the drawer, and a retry never files it twice

## What to build

An **Add slip** action in 321's drawer, for a slip a store emailed in. It is shown only when the
`AttachmentWeb/Access` probe's `categories` contains `"CASH_CLOSE"` (the same answer that shows the column), and
it works on any day's drawer, a `0` included. There is no collection cutoff (C3), so a collected Collections row
takes it as readily as a Ready row.

- **Pick.** A file input with multi-select, accepting `.jpg,.jpeg,.png,.pdf`. There is **no count cap** (C9).
- **Check in the browser, before sending**, per file: the extension or type is jpg/jpeg/png/pdf, and the size is
  **at most 10,485,760 bytes** (10 MiB, so exactly 10 MiB passes). A refused file is named with its reason and
  never sent. The others still go.
- **Send.** `POST AttachmentWeb/Upload` through `api.upload`, **one request per file**, as `multipart/form-data`:

  | part | value |
  |---|---|
  | `ClientRequestId` | `crypto.randomUUID()`, minted **once per picked file** and reused on every retry of that file |
  | `OwnerKind` | `STORE_DAY` |
  | `OwnerKey` | `storeDayOwnerKey(row.storeId, row.businessDay)` (321's function) |
  | `Category` | `CASH_CLOSE` |
  | `Kind` | `ECR_SLIP` |
  | `File` | the file part |

  Send **no `SourceDevice`**. The server records the session's user as `uploadedBy`.
- **Per-file status.** Each picked file shows sending, stored or refused. A refused file shows the server's
  `message` exactly as sent (English, then Arabic).
- **Retry, only when it can help**, with the **same** `ClientRequestId`:
  - the request got no answer (`apiErrorKind` is the network arm);
  - the answer was not a JSON envelope;
  - `errors[0].errorCode` is `FILE_SERVER_UNREACHABLE`.

  Branch on the **code** (`apiErrorCode`), never on the status. `NOT_SET_UP` is also a 503 and is **not**
  retryable. Every other refusal (`TOO_LARGE`, `UNSUPPORTED_TYPE`, `CATEGORY_NOT_HELD`, `FILE_SERVER_REFUSED`,
  `STILL_UPLOADING`, `CAPTURE_REUSED`, `WITHDRAWN`, a field name) shows its message and offers no retry.
- **On 200,** re-read `ByOwner` so the new slip lands in the list (it shows "Web · \<uploadedBy\>"). The grid's
  `slipCount` stays stale until the grid reloads. Invalidate the grid's query so its next read catches up, but
  do not reload it under the user.
- **In-flight guard.** A file that is sending cannot be sent again, and the drawer cannot be dismissed while
  any file is in flight. Closing and reopening a drawer mid-send must not mint a new id for a file that is
  still in flight.

## Contract

Build against BackOffice
[2035](C:\Work\DMSCO\BackOffice\.issues\2035-finance-withdraws-a-wrong-slip-and-it-stops-being-readable.md)'s
`## Web contract` (the Add slip section), stubbed exactly. Cross-check the part names, codes and statuses
against `AttachmentWebEndpoints.cs` and the upload service on BackOffice `pricing2`. Add no part the contract
does not name.

## Proof

- [x] vitest on the pure modules:
  - the file check: accepted types by extension and by type, the size edge (10,485,760 passes, +1 refuses) and
    an unknown type;
  - the form builder: exactly the six parts, no `SourceDevice`, and the owner key from 321's function;
  - `isRetryable`: true for a network failure, a non-envelope answer and `FILE_SERVER_UNREACHABLE`; false for
    `NOT_SET_UP` **on a 503** (the mutation check is to branch on status and see it go red), and for every
    other listed code;
  - a retry reuses the file's `ClientRequestId`, and a newly picked file gets a new one.
- [x] A drive (stubbed, no live SIS.Api) covers:
  - three files picked, of which one is too large and one is the wrong type: the two refused in the browser
    and only one request sent;
  - a `FILE_SERVER_UNREACHABLE` retried with the same id (assert the request bodies);
  - a `NOT_SET_UP` offering no retry;
  - a 200 re-reading `ByOwner`;
  - Add hidden when the probe lacks `CASH_CLOSE`.
- [x] 320's and 321's drives unchanged.
- [x] `typecheck`, `lint`, `build` and `npm test` green.

## Boundaries

- No count cap and no downscaling of photos (S3).
- No new core helper beyond what `api.upload` already gives. The feature builds the `FormData`, and `core/`
  does not learn the part names.
- Server messages are shown as they come, not re-translated. The client's own copy goes through `t()`.

## Done when

A collection accountant adds one or more slips to any store day from its drawer. A wrong type or an oversize
file is refused before it is sent. A flaky connection offers a retry that files the slip once, and every other
refusal says why in the server's words.

## Blocked by

- [321](321-a-days-slips-open-in-a-drawer-with-preview-and-download.md): the drawer and `storeDayOwnerKey`.
- BackOffice 2035: **done** (merged `da71a9621`).

## Open questions

- None. The retry codes, the size edge and the part names are all in the contract.

## Comments

**Done 2026-09-26 (AFK).**

**Contract.** Built against BackOffice 2035's `## Web contract` (Add slip). Both 2034 and 2035 are `status: done` on
`pricing2`. I cross-checked it against the code on `pricing2`:
- `AttachmentWebEndpoints.cs` and `AttachmentUploadHandler.cs` (the form is read by these part names; there is no
  `SourceDevice` on a web row);
- `AttachmentFormFields.cs`, which confirms the six parts;
- `AttachmentUploadResult.cs` and `AttachmentRefusal.cs` (codes and statuses);
- `AttachmentMessages.cs` (English + `Environment.NewLine` + Arabic).

**Drift, recorded.** The code has one refusal the contract's list does not name: 403 `CATEGORY_NOT_WRITABLE`. It is not
retryable, and a test pins that. There is no other drift, and the drive stubs exactly those shapes.

**What was built.**
- **`slip-upload.ts`** (pure):
  - `slipFileRefusal`: the extension OR the type is jpg/jpeg/png/pdf; `size <= 10,485,760`.
  - `pickSlipFiles`: a new id per picked file; a refused file is kept, named and never sent.
  - `canSendSlip`: the in-flight guard.
  - `keepsIdOnClose`.
  - `slipUploadForm`: exactly the six parts, `OwnerKey` taken from the drawer's day (`storeDayOwnerKey`'s).
  - `isRetryableUpload`: kind `network`, kind `server` (core's codeless 5xx = a non-JSON gateway answer), or the code
    `FILE_SERVER_UNREACHABLE`. **Never the status.**
- **`slip-upload-store.ts`**: a module-scoped zustand store, keyed by owner key, that does the sending, so a file's
  `ClientRequestId` outlives the drawer.
  - A retry reuses the id. A re-pick mints a new one.
  - Closing a drawer forgets its settled files and keeps those still sending or still retryable, with their ids.
  - On 200 it re-reads `slipsByOwnerKey` and invalidates `READY_GRID_KEY` and `COLLECTIONS_GRID_KEY` with
    `refetchType: 'none'`.
- **`api.ts`**:
  - `uploadSlip(form)` goes through `api.upload`. `core/` is untouched and never learns a part name.
  - The two grid key heads are spelled once there, and both Pages build their keys from them.
  - IDs come from `mintRequestId()` (`crypto.randomUUID()` wherever it exists; see HITL).
- **`SlipAdd.tsx`**:
  - Shown only when the shared probe's `categories` holds `CASH_CLOSE` (`canSeeSlips`), on any day (0 included) and on
    collected Collections rows (C3).
  - A multi-select picker, with no count cap.
  - A status row per file: Not sent + reason / Sending / Stored / Refused. A refusal shows the server's message as
    sent, English then Arabic. Retry appears only when retryable.
- **`SlipDrawer.tsx`**: Add sits above the list in every state. While a file is sending, the drawer is not
  dismissible: close is disabled (with a busy title), Escape and the backdrop are ignored, and a native close
  re-opens it.

**Proof.**
- **vitest.** `slip-upload.test.ts` and `slip-upload-store.test.ts`, 29 tests:
  - the file check, both edges;
  - the six parts, no `SourceDevice`, and `OwnerKey` from `storeDayOwnerKey`;
  - `isRetryableUpload` for every listed code, the bare 403 and the unknown arm;
  - retry id reuse and a new id on a re-pick;
  - the in-flight guard, and close/re-open keeping the id;
  - the invalidations after a 200, and none on a refusal.
- **Mutation checks.** Keying the retry on `statusCode === 503` failed "false for NOT_SET_UP — on the SAME 503".
  Admitting kind `unknown` failed the bare-403 case. Both were restored.
- **Drive.** `tools/slip-add-drive.mjs` passes **52/52** against stubbed doors. It covers:
  - three picked files: two refused in the browser, one request;
  - the six parts, parsed from the body;
  - the 10 MiB edge sent;
  - `FILE_SERVER_UNREACHABLE` retried with the same id (both bodies asserted);
  - no retry for `NOT_SET_UP`, `CAPTURE_REUSED` or a bare 403, and a retry for an aborted request and a non-JSON 502;
  - a 200 re-reading ByOwner and showing "Web · U900", with zero grid reads;
  - the drawer not dismissible in flight (close disabled, Escape ×2, backdrop);
  - a retryable failure surviving close/re-open and retrying under the same id;
  - Collections filing under the row's own day;
  - Add hidden for a probe without `CASH_CLOSE` and for a bare string `"CASH_CLOSE"`;
  - no raw keys and no page errors.
- **Unchanged drives, all green:** `slip-count-drive` 64/64, `slip-drawer-drive` 63/63, `ready-drive` 44/44,
  `collection-drive` 220/220, `collections-filters-drive` 44/44, `four-filters-drive` 80/80.
- **Gates.** typecheck clean; `npm test` 146 files / 2547 tests; lint (boundaries 653, contrast 129, palette) clean;
  build green.

**Review.**
- **/code-review:** one finding. A non-JSON 2xx/4xx lands in core's `unknown` arm and gets no Retry. It is kept on
  purpose, because the bare 403 is in the same arm and the retry may not read the status. It is pinned by a test and
  logged to HITL for the owner.
- **/standards-review, Standards:** no hard violations.
  - Taken: the store file renamed to `slip-upload-store.ts`; `keepsIdOnClose` extracted as a named predicate;
    `NO_UPLOADS`; the store test mocking only the send, so it uses the real keys.
  - Left:
    - a discriminated union for `SlipUpload`. The predicates own the valid combinations.
    - "10 MB" in the copy rather than interpolated. The cap is the contract's, and the copy waits on the owner's
      read.
    - CONTEXT.md entries for "store day" and "capture". They belong to `/domain-modeling`, not this ticket.
- **/standards-review, Spec:** nothing missing. Its one partial is the same non-JSON 2xx/4xx retry.

**Decisions logged** to `.afk/HITL-322.md`: the unknown arm, `mintRequestId`, the store, both grid keys, the copy, and
the bare-403 wording.

**Outstanding (not AFK-able).**
- The live walk against a real SIS.Api with the File Server key set. None is up, and every drive is stubbed.
- The owner's read of every new string (`slips.add.*`).
