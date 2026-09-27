# HITL — ticket 330 (+ Add prescription: one file, an optional caption, a retry never files twice)

Pre-flight: BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. 2077 is `status: open` (expected, not a
blocker; the drives stub `attachmentCategory` per its Web contract, unchanged). 325/326/327 landed on spec324 and their
HITL notes were read.

## Contract cross-check (pricing2) — no drift
**Decision taken:** built to the code, which agrees with 2061's What to build:
- `AttachmentFormFields.cs`: the part names `ClientRequestId`, `OwnerKind`, `OwnerKey`, `Category`, `Kind`, `Caption`
  (2056, "any door may send it"), `File`; `SourceDevice` is till-only.
- The unknown-document refusal is **`DOCUMENT_NOT_FOUND` (404)** — `AttachmentBindCodes.DocumentNotFound`, mapped to 404 by
  `AttachmentUploadResult.LateAttachStatus` (not in `AttachmentRefusal.cs` itself, which holds only the shared
  refusals); pinned by `AttachmentLateAttachTests.UnknownDocument_IsRefused` (till, partner, web).
- `ATTACHMENT_TOO_MANY` and `DOCUMENT_ENDED` answer 409; `CATEGORY_NOT_HELD` 403; `TOO_LARGE` 413; `UNSUPPORTED_TYPE`
  415; a field-name 400 names the field; the rest of the late attach's refusals 400. The server clamps a caption to
  `OmsAttachment.Widths.Caption` = 200 (`CaptionOver200_IsClamped`), so the web's clamp is a courtesy that also keeps a
  surrogate pair whole (the server's `Substring` would not).
**Why:** the runner: "If ticket and code disagree, follow the CODE." They agree.
**Revisit if:** 2072 (the partner contract naming `DOCUMENT_NOT_FOUND`/`DOCUMENT_ENDED`) renames either.

## Q: Where does the one clamp live, and what is it called?
**Decision taken:** `clampText(text, max)` in `core/attachments/rules.ts`; `withdrawNote` now returns
`clampText(note, WITHDRAW_NOTE_MAX)` (its tests unchanged and still green), and the upload builder clamps the caption with
`CAPTION_MAX` (200) in `upload.ts`. Two named 200s because the server has two widths (`Widths.WithdrawNote`,
`Widths.Caption`) that could drift apart.
**Why:** the ticket names `clampText`; "generalise the withdraw-note rule 325 moved; do not write a second one".
**Revisit if:** one of the two server widths changes.

## Q: The caption-mode Add — what does the user do, in what order?
**Decision taken:** the Add region shows a "Caption (optional)" field above the **Add prescription** button; the user
types the caption, then presses the button and picks ONE file (`multiple` off); the pick sends at once with the caption.
The field clears once a file the browser admits is picked, and is kept when the browser refuses the file (the words are
for the next pick). The caption rides on the upload item, so a retry sends the same words under the same id, and the
upload row shows it under the file name. The input has `dir="auto"` and NO `maxLength` (unlike the withdraw note's
textarea): a browser `maxLength` cuts the raw text before the trim, so the one clamp — trim, then cut to 200 without
splitting a surrogate pair — is the only rule (the /standards-review spec axis's finding).
**Why:** the most conservative shape that reuses the slip's pick-and-send flow unchanged (no second step, no dialog);
"One file per Add, with an optional caption".
**Revisit if:** the owner wants pick-first-then-caption (a staged file with a Send button) or a modal.

## Q: Is the caption Add a separate panel flag?
**Decision taken:** no — the panel's existing `captioned` flag (327: "this owner's files carry a caption") now also puts
Add in its one-file, captioned mode. The slip passes nothing and keeps its multi-file, caption-less Add; the four slip
drives pass unedited (64/63/52/68). The caption words are two optional `AttachmentsPanelWords` fields read only in that
mode.
**Why:** HITL-327 left the flag for 330 to reuse; a second flag would be set identically by both callers.
**Revisit if:** an owner kind ever shows captions but must not take one (split the flag).

## Q: Close guard / leaving the page
**Decision taken:** no close guard (the ticket: "no twin here unless the build finds one is needed" — it did not: the
panel stays mounted across tab switches, proven by the drive, and a page left mid-send keeps the file under its id in the
store). The tab forgets its SETTLED upload rows when it unmounts (`clearSettled`, as the slip drawer's close does), so a
later visit does not show last visit's "Stored" rows. A file still in flight at leave is kept and, once it lands, shows
as Stored on the next visit until the tab is left again (the slip drawer's same behaviour).
**Why:** the slip rule, unchanged; no new mechanism.
**Revisit if:** the owner wants a "leave while sending?" prompt.

## Q: Test hook for the upload row's caption
**Decision taken:** `data-cell="upload-caption"` (the list's `data-cell="caption"` is 327's, and document-rtl-drive's
unscoped locator for it must stay unambiguous). The caption field is `data-testid="slip-add-caption"`, beside the frozen
`slip-add*` family.
**Why:** HITL-327: the panel keeps its `slip-*` hook names.
**Revisit if:** a hook-prefix parameter is ever introduced.

## Q: Wording (new; waits on the owner's read, map 1199)
**Decision taken:**
- `document`: `attachments.add.captionLabel` "Caption (optional)"; `attachments.add.captionHint` "Type the caption before
  you pick the file. Only the first {{max}} characters are kept." (`max` = 200, a named param). "Add prescription",
  "Add a prescription" (region) and "The file could not be sent." were drafted by 327 and are used unchanged.
- `attachments`: `add.hintOne` "One JPG, PNG or PDF file, up to 10 MB." (the slip's `add.hint` says "each").
Server refusals (English, then Arabic) are shown as sent.
**Why:** i18n-zero-literal; plain words; the ticket puts the caption label and hint in `document`.
**Revisit if:** the owner rewords any of them.

## FINDING (not 330's): `document-actions-drive` still fails 3 checks
Same three as HITL-327 (commit 7358a84 removed a command without updating the drive). The other six document drives,
the four slip drives and the order drive are green.

## Review outcome
- `/code-review`: no correctness findings. Two behaviours noted and kept: the caption clears on an admitted pick (a
  server refusal then needs it retyped; the refused row still shows it), and a file that lands after the page was left
  shows as Stored on the next visit (the slip drawer's same rule).
- `/standards-review`, standards axis: no hard breaches. Not applied: move the caption words to `attachments` — the
  ticket rules they go in `document`; bundle `captioned` + the two optional words — kept as HITL above; the
  `slip-add-caption` hook name — the frozen family; the double clamp — kept (the builder owns the wire, the pick's
  decides whether the item carries one), now said in the builder's comment. `CONTEXT.md` lacks "caption" and
  "prescription": a `/domain-modeling` pass, not this slice.
- `/standards-review`, spec axis: applied — the caption field's `maxLength` removed (see above). Not applied: the
  one `captioned` flag vs a separate "Add takes a caption" parameter (HITL above); the upload row's caption and the
  unmount `clearSettled` (small, logged); a captioned pick sends only the first file (the picker is single).
