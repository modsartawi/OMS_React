---
status: open
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

- [ ] vitest on the pure modules:
  - the file check: accepted types by extension and by type, the size edge (10,485,760 passes, +1 refuses) and
    an unknown type;
  - the form builder: exactly the six parts, no `SourceDevice`, and the owner key from 321's function;
  - `isRetryable`: true for a network failure, a non-envelope answer and `FILE_SERVER_UNREACHABLE`; false for
    `NOT_SET_UP` **on a 503** (the mutation check is to branch on status and see it go red), and for every
    other listed code;
  - a retry reuses the file's `ClientRequestId`, and a newly picked file gets a new one.
- [ ] A drive (stubbed, no live SIS.Api) covers:
  - three files picked, of which one is too large and one is the wrong type: the two refused in the browser
    and only one request sent;
  - a `FILE_SERVER_UNREACHABLE` retried with the same id (assert the request bodies);
  - a `NOT_SET_UP` offering no retry;
  - a 200 re-reading `ByOwner`;
  - Add hidden when the probe lacks `CASH_CLOSE`.
- [ ] 320's and 321's drives unchanged.
- [ ] `typecheck`, `lint`, `build` and `npm test` green.

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
