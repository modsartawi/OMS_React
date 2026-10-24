---
status: open
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

- [ ] write-off form: OTHER without a note blocks; other reasons don't need one; the body sent is `{ reason, note }`
      trimmed; each PSES code maps to its refusal view; a bare 403 maps to "not granted" (vitest, pure)
- [ ] drive script, LTR and RTL, against a stub: each reason written off, an OTHER with an Arabic note (the body
      carries it unchanged), `PSES-00009`, a bare 403 hiding the button, the row leaving the list
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

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
