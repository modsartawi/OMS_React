---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 702 — The review list shows monitor and not-evaluated items

## What to build

Stories 39, 46; A2, A13; door 3290. The existing review list gains two item kinds. A **monitor** item shows its rule, its
severity (info / action), its EN or AR text and the message's (source, id). A **not-evaluated** item names the answer
that a watcher or monitor failure left unread. Both can be filtered by kind and cleared with a note. Existing kinds and
their marks behave as before.

This is the first of the new kinds: 703 and 708 add theirs on the same shape, so an unknown kind must render, not throw.

## Spine reach

model/api (`reviewIn` for the new kinds) · store/logic (filter, clear) · component (rows) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] the wire row reads into each kind, and an unknown kind reads as a generic row — pure
- [x] filter to monitor items, open one, clear it with a note; a not-evaluated item reads as a failure, not a fire; the
      existing review drive stays green — flow

## Boundaries

No e-mail or push: the list is the inbox. Item text is `<bdi>`, and (source, id) is `Ltr`. Doors stubbed; 711 reconciles.

## Done when

The team reads payer outcomes and failed evaluations in one list and can clear them.

## Blocked by

None (can start immediately).

## Open questions

- The brief says "with clearing notes", while door 3293 only states a note on drift. Assume every new kind clears with a
  note and list it for 711.

## Comments

**2026-10-30, built on stubs** (`tools/fhir-rules-stubs-702.mjs`, `tools/insurance-fhir-702-drive.mjs`, port 5212). Never
against a live SIS.Api.

**Door shapes guessed, for 711 to reconcile** (door 3290 names the content but spells no wire):
- `GET InsuranceRules/Review` also returns item rows on the same row shape, in the same list, newest first, with
  `kind: monitor | notEvaluated`. `store` and `pharmacist` are empty on them.
- Added to a row: `text: { en, ar }`, `message: { source, id }`, `failure: watcher | monitor` (not-evaluated only),
  `cleared: { note, by, at } | null`. A monitor's severity reuses the row's existing `severity`, `info | action`, read
  case-insensitively.
- `notEvaluated` is spelled in camelCase; the spec writes "not-evaluated". Any other spelling reads as a generic row.
- `POST InsuranceRules/Review/{id}/Clear { note }`, note required, on a new door rather than on `POST Review/{id}`,
  whose body is a mark.
- The `kind` filter takes the new values, and the other filters apply to items the same way.

**Decisions (overrulable):**
- Every new kind clears with a required note (the ticket's open question, for 711). An unknown kind can also be opened
  and cleared, since it can only be a new kind; the server refuses if it disagrees.
- A cleared item stays in the list, reads Cleared with its note and who, and opens read-only. The door may instead drop
  it from the list, which 711 should check.
- An unheard severity shows no badge rather than a wrong one. An unstated failure still reads as a failure.
- An item row has no store, pharmacist, patient or line, so its detail spans those seven columns. The last column's
  heading changed from "Mark" to "Action", since it now holds Open as well.
- Unknown kinds render but are not offered as a filter, and `?kind=` with one is dropped.

**How 703 and 708 extend it:** add the name to `ITEM_KINDS`, a case in `detailOf` (`model.ts`), a case in `ItemDetail`
(`ReviewItems.tsx`) and `kind.<name>` in both locales. Pass their rows to `createReviewItemStubs(items, opts)`.

**Not shown yet:** the app's `lng` stays `en`, and the drive's RTL is direction only, so a monitor's Arabic text and the
new Arabic copy never appear on screen. The EN/AR choice is `saysIn`'s, and the Arabic keys are proved only by the
key-mirror test, so no one has read them in place.
