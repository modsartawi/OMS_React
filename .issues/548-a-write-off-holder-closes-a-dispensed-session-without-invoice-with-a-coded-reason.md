---
status: done
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: 545 (live: BackOffice 3015 on branch spec2994)
---

# 548 — A write-off holder closes a dispensed session without invoice, with a coded reason

## What to build

HQ's one act on the prescription-session list (BackOffice spec 2994 story 72; hand-off in
`C:\Work\DMSCO\BackOffice-2994\.issues\3015-the-hq-list-and-close-without-invoice.md` — "Write-off" in "Judgement
calls").

- **Door** `POST PrescriptionSessionWeb/{sessionId}/WriteOff` `{ reason, note }` —
  `BackOfficeScreen[PrescriptionSessionWriteOff, 06]` only (its own controller; a viewer is refused). Answers the
  session read back, Written off. The actor is the signed-in user, never a body field.
- **"Close without invoice"** on a DISPENSED row of the Open tab (and the Owed view). A dialog:
  - coded `reason`: Payer refused / no coverage (`PAYER_REFUSED`), Sale lost or made outside the session
    (`SALE_LOST`), Goods never left the store (`GOODS_NEVER_LEFT` — say that the held units go to put-back),
    Other (`OTHER`);
  - `note` required for OTHER (client-side check), optional otherwise; Arabic must round-trip;
  - a confirm that names the session (`displayId`, holding store).
- **Refusals in the dialog** (never a generic toast): `PSES-00009` (not Dispensed, or something pending), `PSES-00220`
  bad reason, `PSES-00221` note required, `PSES-00222` no actor — each the envelope message plus its code.
- **On success** the row leaves the open list (re-read the list; the flag counts change) and a toast names the
  session, written off.
- Reason words come from core (shared with 547's end reasons).

## Spine reach

api · logic (write-off form: reason/note validity, refusal view) · dialog + row action · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] write-off form: OTHER without a note blocks; other reasons don't need one; the body sent is `{ reason, note }`
      trimmed; each PSES code maps to its refusal view; a bare 403 maps to "not granted" (vitest, pure)
- [x] drive script, LTR and RTL, against a stub: each reason written off, an OTHER with an Arabic note (the body
      carries it unchanged), `PSES-00009`, a bare 403 hiding the button, the row leaving the list
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3015, stubbed until 549. Role `HQ_PRESCRIPTION_SESSION_WRITE_OFF` (view + write-off) must be bound
  in Authz Admin for the live walk.
- Only DISPENSED rows offer it; the server stays the authority (`PSES-00009`).

## Done when

The Proof boxes are ticked: on the running app (stubbed), a write-off holder closes a dispensed session without
invoice with a coded reason (a note for Other), and every refusal shows in the dialog.

## Blocked by

- [545](545-hq-lists-open-prescription-sessions-across-stores-filters-them-and-opens-the-owed-list.md)

## Open questions

- **No write-off probe exists**, so the button can't be shown only to holders up front. Recommendation (settled for
  the build, overrulable): show it on every DISPENSED row; a bare 403 on the POST reads "you don't hold the write-off
  grant" in the dialog and hides the button for the rest of the page visit.
- **BackOffice follow-up (unfiled):** a `PrescriptionSessionWeb/Access` probe answering both grants (list Display,
  write-off Execute), so the menu leaf and the button can be gated like the dispatch board's. Record it under 549's
  BO asks; don't build around it.

## Comments

**2026-10-24 — built (stubbed; live walk is 549).** Open question settled as recommended: the button shows on every
DISPENSED row; a bare 403 says so in the dialog and hides the button on every row for the rest of the visit.

What was built:
- `api.ts` — `prescriptionSessionsApi.writeOff(sessionId, { reason, note })` → `POST PrescriptionSessionWeb/{id}/WriteOff`
  through `@/core/api`; returns nothing (the screen re-reads the list rather than reading the answer back).
- `write-off.ts` (pure) — `writeOffBlock` (no reason / OTHER without a note), `writeOffBody` (`{ reason, note }`, note
  trimmed, script untouched), `writeOffRefusal` (bare 403 → `notGranted`; any envelope code → `refused` with message +
  code, and words for `PSES-00009/00220/00221/00222`; no envelope → `failed`).
- `WriteOffDialog.tsx` — four coded reasons (radio), the put-back hint on Goods never left, the note (`dir="auto"`,
  `maxLength` 400 = `PrescriptionSessionWidths.EndNote`, required for Other), the confirm sentence naming
  `displayId` + holding store (each `Ltr`), refusals as an `ErrorBanner` in the dialog (envelope message, words, code
  `Ltr`); success → toast naming the session (`fsi`), close, invalidate `['prescription-sessions','open']`.
- `OpenRowAction.tsx` — the button (`OPEN_ROW_ACTION_ENABLED = true`); the dialog is portalled to `<body>` so AG Grid's
  cell key handlers never see the note's keys. `write-off-grant.ts` — the per-visit "not granted" flag (zustand),
  reset when the Open tab unmounts (one effect added to `OpenTab.tsx`).
- Copy in `prescription-sessions` EN + AR under `writeOff.*`.
- **Core words:** the reasons are 547's (`WRITE_OFF_REASONS`, `writeOffReasonWord` → `writeOffReason.*` in the core
  `prescription-session` namespace). 548 was built with its own identical block in parallel; on merging the
  integration tip it was dropped in favour of 547's (keys and words are 547's; my `write-off-words.test.ts` removed,
  547's `end-reason-words.test.ts` covers them).

Judgement calls (overrulable):
- The confirm is the dialog's own Write off button (no second "are you sure?" step); its sentence names the session and store.
- After a business refusal the dialog stays open with the note kept; the buttons stay. Only a bare 403 hides them.
- 545's drive check "no row action yet" now asserts the action on the DISPENSED row only; its To open checks point at
  546's `[data-ps-to-open]` (the placeholder is gone).

Proof:
- vitest: `write-off.test.ts` 17 new; full suite 6003/6003 (after merging 546 + 547).
- Drive `tools/prescription-sessions-write-off-drive.mjs` (`npx vite --port 5216 --strictPort`, then `DRIVE_PORT=5216
  node tools/prescription-sessions-write-off-drive.mjs`): **84/84** (LTR + RTL) — button on DISPENSED only (All + Owed),
  each of the four reasons written off (body `{ reason, note }` trimmed, toast, re-read, row leaves, Owed count drops),
  OTHER with an Arabic note carried unchanged, `PSES-00009` in the dialog, a bare 403 hiding every button. 545's drive
  still 112/112. Stubbed doors.
- `npm run typecheck`, `npm run lint` (4 gates) green.
