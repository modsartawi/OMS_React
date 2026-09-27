---
status: open
spec: 324
blocked-by: 327
---

# 330 — + Add prescription files one file with an optional Arabic caption, and a retry never files it twice

## What to build

**+ Add prescription** in the Attachments tab (spec 324 → "Add prescription"). It shows whenever 327's gate admits:
on the web the read grant is the upload grant. It shows on an ended order too.
- **One file per Add, with an optional caption.** This is a new mode of the shared panel's Add. The slip drawer
  keeps its multi-file, no-caption Add.
- **The caption** is trimmed and cut to 200 characters without splitting a surrogate pair. This is **one pure clamp
  shared with the withdraw note**: `withdrawNote` from 325 is generalised, not copied. Arabic is sent as typed.
- **The browser's check** is the slip one, before anything is sent: jpg/jpeg/png/pdf by extension **or** type, at most
  10,485,760 bytes.
- **The form**, `POST AttachmentWeb/Upload`, has these parts, in this order:
  - `ClientRequestId`;
  - `OwnerKind=SD_DOCUMENT`;
  - `OwnerKey=<attachmentOwnerNo>`;
  - `Category=<attachmentCategory>`;
  - `Kind=PRESCRIPTION`;
  - `Caption` (**only when not empty**);
  - the file.

  It has **no `SourceDevice`**. It is the same builder the slip uses; with no caption, the slip's six parts stay
  byte-identical.
- **On a delivery's page** the Add files onto the **owner** (`attachmentOwnerNo`), never the delivery's number.
- **Retry.** A retry keeps the file's `ClientRequestId`, held in the lifted upload store keyed by
  `SD_DOCUMENT` + owner key. Retryable = network, a codeless 5xx, or `FILE_SERVER_UNREACHABLE`, **by code, never by
  status**.
- **Refusals shown as sent** (English, then Arabic), **with no retry**:
  - `TOO_LARGE`, `UNSUPPORTED_TYPE`;
  - `CATEGORY_NOT_HELD`;
  - `DOCUMENT_TAKES_NO_ATTACHMENTS`, `ATTACHMENT_KIND_NOT_ACCEPTED`;
  - `ATTACHMENT_TOO_MANY` (the cap of 10 is the server's: no client cap, no pre-disabled Add);
  - the unknown-document refusal;
  - `NOT_SET_UP`;
  - a field-name 400.
- **After a 200:** re-read ByOwner. The badge follows the new list (327's number), and `onChanged` fires.
- **In flight.** The panel stays mounted across tab switches, so switching tabs mid-send loses nothing. Leaving the
  page mid-send is covered by the store keeping the id. The slip drawer's close guard has no twin here unless the
  build finds one is needed.

**Words:** "Add prescription", the caption label and its hint go in `document`. Generic upload words stay in
`attachments`.

## Spine reach

model/api · store/logic · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `clampText` (the shared caption/note clamp): trimmed; cut at 200; a surrogate pair at the edge kept whole; the
      withdraw note's existing cases still pass through it. · pure (vitest)
- [ ] `uploadForm`, with these cases:
      - the `SD_DOCUMENT` parts with a caption;
      - the same without one (no `Caption` part);
      - **the slip form byte-identical to today's six parts**;
      - retryability by code: `NOT_SET_UP` 503 not retryable, `FILE_SERVER_UNREACHABLE` retryable, a bare 403 not.

      · pure (vitest)
- [ ] `order-attachments-drive` gains:
      - Add with an Arabic caption (the posted `Caption` part asserted, unchanged);
      - a local type/size refusal with no request sent;
      - `ATTACHMENT_TOO_MANY` shown with no retry;
      - a failed-then-retried send keeping its `ClientRequestId`;
      - a delivery's Add posting `OwnerKey=<owner>`;
      - one ByOwner re-read after a 200.

      `slip-add-drive` stays unmodified and green. · flow

## Boundaries

- **Endpoint:** `AttachmentWeb/Upload` (existing; 2061's contract is its **What to build**, since it has no
  `## Web contract` heading).
- **Codes:** as listed above.
- **i18n:** new `document` keys; maybe new `attachments` keys for the caption mode.

## Done when

On a stubbed order, a user adds a PDF with an Arabic caption and sees it listed with the badge moved on, a retry
reuses its id, and the pure tests and drives are green.

## Blocked by

[327](327-opening-the-attachments-tab-lists-the-orders-files-once.md)

## Open questions

- **The unknown-document refusal's code.** The spec says to cross-check it in 2061's tests
  (`C:\Work\DMSCO\BackOffice\.issues\2061-a-file-is-attached-to-an-order-after-it-is-created.md` and its test class).
  Pin the exact code before the drive stubs it.
