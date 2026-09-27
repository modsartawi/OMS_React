---
status: done
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

- [x] `clampText` (the shared caption/note clamp): trimmed; cut at 200; a surrogate pair at the edge kept whole; the
      withdraw note's existing cases still pass through it. · pure (vitest)
- [x] `uploadForm`, with these cases:
      - the `SD_DOCUMENT` parts with a caption;
      - the same without one (no `Caption` part);
      - **the slip form byte-identical to today's six parts**;
      - retryability by code: `NOT_SET_UP` 503 not retryable, `FILE_SERVER_UNREACHABLE` retryable, a bare 403 not.

      · pure (vitest)
- [x] `order-attachments-drive` gains:
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

## Comments

**Built 2026-09-27 (AFK).** Decisions and wording are in `.afk/HITL-330.md`.

**Pre-flight.** BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. BackOffice 2077 is `status: open`
(expected); the drives keep stubbing `attachmentCategory` exactly as its `## Web contract` says.

**Open question: answered.** The unknown-document refusal is **`DOCUMENT_NOT_FOUND` (404)**:
`AttachmentBindCodes.DocumentNotFound`, mapped to 404 by `AttachmentUploadResult.LateAttachStatus`, and pinned by
`AttachmentLateAttachTests.UnknownDocument_IsRefused` for the till, the partner and the web. (It is not in
`AttachmentRefusal.cs`, which holds only the refusals several results share.) It shares 404 with `/Content`'s
`NOT_FOUND`, which is why every branch here is by code. It is shown as sent, with no retry.

**Contract cross-check (pricing2): no drift.** `AttachmentFormFields.cs` names the parts, `Caption` included (2056:
"any door may send it"); `SourceDevice` is the till's. `ATTACHMENT_TOO_MANY` and `DOCUMENT_ENDED` answer 409,
`CATEGORY_NOT_HELD` 403, `TOO_LARGE` 413, `UNSUPPORTED_TYPE` 415, a field-name 400 names its field. The server keeps
the first 200 characters of a caption (`Widths.Caption`); the web's clamp also keeps a surrogate pair whole.

**What was built.**
- **One clamp.** `clampText(text, max)` in `core/attachments/rules.ts`: trim, then cut to `max` without splitting a
  surrogate pair. `withdrawNote` is now `clampText(note, WITHDRAW_NOTE_MAX)`; its tests are unchanged and green, and a
  new case runs each of them through `clampText` too. `CAPTION_MAX` = 200 in `upload.ts`.
- **One builder.** `attachmentUploadForm` appends `Caption` between `Kind` and the file, only when it holds something
  after the clamp. The slip never has one, so its six parts are byte-identical (`slips.test.ts` unchanged and green; a
  second pin in `upload.test.ts`). The caption rides on the upload item (`pickAttachmentFiles(files, mint, caption)`,
  the store's `add(target, files, onStored, caption)`), so a retry sends the same words under the same id.
- **The panel.** The existing `captioned` flag (327) now also puts Add in its one-file mode: a labelled caption field
  (`dir="auto"`, no `maxLength`, so the one clamp trims before it cuts), then **Add prescription**, which picks ONE
  file and sends it.
  The field clears once the browser admits the file, and is kept when it refuses it. The upload row shows the caption.
  The slip passes nothing and keeps its multi-file, caption-less Add.
- **The order tab.** `addOffered` whenever the tab is drawn (read grant = upload grant; an ended order too).
  `onChanged` re-reads ByOwner once, and the badge follows the list. The tab forgets its settled upload rows when it
  unmounts, as the slip drawer's close does; a file in flight keeps its id in the store. No close guard: none was
  needed, since the panel stays mounted across tab switches (proven by the drive).
- **Words.** `document`: `attachments.add.captionLabel`, `attachments.add.captionHint` (with `{{max}}`).
  `attachments`: `add.hintOne`. All wait on the owner's read.

**Proof.**
- `npm test`: 153 files, **2629** tests green (58 new: `clampText` ×5, the form ×6, retryability by code ×3, a
  captioned pick, the store ×3). `typecheck`, `lint` (boundaries 672 files, contrast 129 pairs, palette 677 files) and
  `build` are clean.
- `order-attachments-drive` **152/152** (was 98). It parses each Upload's multipart body and asserts:
  - the seven parts in order, with no `SourceDevice`, and the posted Arabic `Caption` byte for byte as typed;
  - a blank caption sends the six parts;
  - a type refusal and a 10,485,761-byte refusal send nothing;
  - `ATTACHMENT_TOO_MANY` is shown exactly as sent, with no Retry and no re-read, and Add stays live;
  - `DOCUMENT_NOT_FOUND`, `DOCUMENT_TAKES_NO_ATTACHMENTS`, `ATTACHMENT_KIND_NOT_ACCEPTED`, `CATEGORY_NOT_HELD`,
    `TOO_LARGE`, `UNSUPPORTED_TYPE`, `NOT_SET_UP`, a field-name 400 and a bare 403 are shown with no Retry;
  - `FILE_SERVER_UNREACHABLE`, no answer and a codeless 502 each retry under the SAME `ClientRequestId` and caption;
  - exactly one ByOwner re-read after each 200, and the badge moves 6 → 7;
  - a send survives a tab switch;
  - a delivery's Add posts `OwnerKey=<attachmentOwnerNo>`.
- `document-rtl-drive` **53/53** (was 49): in both directions the Add button and the caption field sit at the region's
  START, an Arabic caption reads right-to-left in its field, and the POSTED `Caption` part is exactly as typed.
- The four slip drives pass **unedited**: `slip-count` 64/64, `slip-drawer` 63/63, `slip-add` 52/52, `slip-withdraw`
  68/68. The document drives: `detail` 39/39, `cards` 45/45, `rail` 25/25, `band` 34/34, `items` 23/23.
  `document-actions` still fails the same 3 checks it failed before this wave (7358a84; see HITL-327).

**Outstanding (not AFK's).** The owner's hand walk against a live SIS.Api (2071's Proof: Add with an Arabic caption,
a delivery's page) needs BackOffice 2077 served. The owner's read of the new words is also outstanding.

**Review.** `/code-review`: no correctness findings. `/standards-review`: no hard breaches. Applied: the caption
field's browser `maxLength` was removed, because it cut the raw text before the trim, and the builder's comment now
says it owns the clamp on the wire. The rest is recorded in `.afk/HITL-330.md` → "Review outcome".
