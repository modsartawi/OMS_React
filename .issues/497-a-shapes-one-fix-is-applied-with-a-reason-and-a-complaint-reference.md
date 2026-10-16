---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2691-oms-react-pick-support-brief.md
blocked-by: 496
---

# 497 — A shape's one fix is applied with a reason and a complaint reference, and support gets the store's instructions

## What to build

The **Apply fix** button and dialog on the shared diagnosis panel (`core/pick-support`, from 496).
Read the brief's "`POST PickSupport/Delivery/{deliveryNo}/Fix`" and "The fix dialog" sections. The
server decides whether the fix still applies, and the client only sends the request and shows the
answer.

- **Button.** One "Apply fix" per shape card, drawn only with `canFixPickSupport`. There is none on
  `HEALTHY` or `UNKNOWN`. A delivery in two shapes gets two cards and two buttons.
- **Dialog.** Shows:
  - the shape code;
  - `explanationEn` / `explanationAr` and `fixEn` / `fixAr`, side by side;
  - the requests and documents the fix touches, each with its `action` tag.

  It has two inputs:
  - **Reason**: a required textarea, `maxLength` 512, with a hint that the first ~180 characters are
    what the document trail keeps;
  - **Complaint reference**: required, `maxLength` 40.

  Confirm stays disabled until both are non-blank after trimming.
- **Submit.** One POST `{ shape, reason, complaintRef }`, with Confirm disabled while it is in
  flight. There is no actor field: the cookie session is the actor.
- **On success:**
  - The panel takes the returned `diagnosis`. When it is `null`, the panel re-GETs the delivery. A
    `null` is never shown as a failure, and the dialog never offers to retry the fix.
  - The dialog shows `tellTheStoreEn` and `tellTheStoreAr` side by side, each with its own copy
    button.
- **On refusal:**
  - The dialog stays open and shows `errorCode` with `errorMessage` (`PICK-00225`, `PICK-00224`,
    `PICK-00003`, `PICK-00002`).
  - `PICK-00224` also offers "Refresh diagnosis".
  - A 403 shows "You do not have access to apply fixes".

## Spine reach

api (`Fix` call) · logic (confirm gate, success/refusal state) · dialog component · i18n EN/AR · test

## Proof (→ `tdd` red-green cycles)

- [x] `canConfirmFix`: blank or whitespace-only reason or reference keeps Confirm off; both present turns it on (vitest)
- [x] `fixOutcome`: a success with a diagnosis replaces the panel; a success with `diagnosis: null` asks for a re-read and is still a success; `PICK-00224` offers refresh, `PICK-00225` does not (vitest)
- [x] The drive (extend `tools/pick-support-drive.mjs`, LTR + RTL, stub emitting the brief's exact JSON) checks:
  - no button without `canFixPickSupport`, on HEALTHY or on UNKNOWN;
  - a double click sends one POST;
  - the body carries exactly `shape`, `reason` and `complaintRef`;
  - on success the panel turns HEALTHY and the timeline shows `SUPPORT_FIX`;
  - the `diagnosis: null` path re-GETs;
  - the tell-the-store copy buttons copy EN and AR verbatim;
  - a `PICK-00224` keeps the dialog open with Refresh;
  - a 403 shows its sentence.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- One new door, `Fix`, stubbed until 500.
- Business codes: `PICK-00224`, `PICK-00225`, `PICK-00003`, `PICK-00002`. The 403 has no body.
- Keys go into the `pick-support` namespace.
- Not built here: a free-form action, a state picker, or a "void this document" control (ADR 0085).

## Done when

The helpers and the drive are green. A stubbed fix on the STUCK delivery shows the store text in EN
and AR, and leaves the panel HEALTHY.

## Blocked by

[496](496-pick-support-finds-a-delivery-from-any-number-and-shows-its-diagnosis.md)

## Comments

**Done 2026-10-16 (AFK).** Built to the brief's "POST …/Fix" and "The fix dialog" sections.

- **Layout:** everything lives in `core/pick-support/`, so Document Details (499) gets the fix with the panel.
  - `fix.ts` holds the pure rules: `canConfirmFix`, `fixBody`, `fixOutcome` and the 512/40 widths.
  - `FixDialog.tsx` is the dialog. `ShapeBody.tsx` draws the explanation and fix (EN beside AR) and the action-tagged requests and documents. It was lifted out of the shape card so the dialog draws the same body.
  - `api.ts` gained `pickSupportApi.fix`.
  - `DeliveryDiagnosis` reads `canFixPickSupport` off the one shared OMS probe and holds the dialog, so the dialog outlives the card a fix removes.
- **Behaviour:**
  - Confirm is held by a ref as well as `disabled`, so a double click sends one POST.
  - On success the delivery's own read takes `diagnosis` at once. On `null` it is re-GET. Either way the dialog shows the store's EN/AR, each with its own copy button, and offers only Close.
  - The rest of Pick support (Resolve, and later the census) is re-read when the dialog CLOSES, not under it. A serial lookup that stops naming the fixed delivery would otherwise unmount the dialog before the store's text was copied. The /code-review found this, and the drive now checks it.
  - On a refusal the input is kept and the code is shown beside the server's sentence. `PICK-00224` offers Refresh diagnosis and disables Confirm. A bare 403 reads "You do not have access to apply fixes".
- **Proof:**
  - vitest: `fix.test.ts` has 12 tests. The full suite passes, 298 files and 5213 tests.
  - `tools/pick-support-drive.mjs` passes 178/178 LTR + RTL. 496's 106 checks still pass, and 497 adds 72. They cover:
    - HEALTHY and UNKNOWN with no button, and two shapes giving two buttons;
    - the dialog content, maxLength and the Confirm gate;
    - the double click sending one POST, and the exact body;
    - HEALTHY with `SUPPORT_FIX` on PD0000999 and DR0000123;
    - the null re-GET;
    - EN and AR copied verbatim;
    - the serial-lookup survival;
    - 00224 with Refresh, 00225 with no refresh, and the 403 sentence.
  - typecheck, lint (four gates) and build are green.
- **Decisions:** see `.afk/HITL-497.md`, which is not committed.
- **Outstanding, not this ticket's:**
  - the live Fix door on staging (ticket 500);
  - a human eyeballing the server's AR beside the EN in the dialog.
