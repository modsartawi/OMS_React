---
status: done
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 620
---

# 621 — A user creates or edits an insurer or store master, scoped to a store list too, and an overlapping scope is refused naming the clashing master

## What to build

From the IDF masters list (619), create a master or edit one (`POST IdfPriority/masters`, `PUT …/{id}`; doors
3161/3162, [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)):

- kind: insurer (payer code, optionally scoped to a store list) or store (a store list, picked from 620's lists);
- EN and AR name, both required;
- thresholds "hard above N, reminder above M", defaulting to 4 and 1; whole numbers, and the form refuses a
  reminder threshold above the hard one before sending;
- an overlapping scope comes back refused with the clashing master named; the form shows that message and keeps
  the input.

The form's help states the fixed resolution order (insurer + store list → insurer → operation pharmacy → general)
so the author sees where this master sits. Kind is fixed after create.

## Spine reach

model/api · logic (master form validation) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `master form defaults thresholds to 4 and 1 and refuses reminder above hard` · pure
- [x] `master form requires a payer for insurer and a store list for store` · pure
- [x] drive `tools/idf-masters-drive.mjs` (extend) — create insurer, insurer+list and store masters; edit one; an overlap refusal names the clash · flow

## Boundaries

New endpoints `POST/PUT IdfPriority/masters` — stubbed. The overlap refusal's code is 3162's to spell (pick it up
from the brief's Changes). Keys in `insurance-idf`. Ungated until 628 (a 403 on save shows "no access").

## Done when

A master is created and edited against stubs and an overlap refusal shows the clashing master, proofs green.

## Blocked by

[620](620-the-team-keeps-named-store-lists-and-the-pilot-list-cannot-be-deleted.md)

## Comments

**2026-10-27 — built (impl/3157-621).** `master-form.ts` (form, `newMasterForm` 4/1, `formFromMaster`,
`masterFormProblems`, `masterBody`, `clashingMasterId`, `OVERLAPPING_SCOPE`), `idfMasterFormApi` under 621's slot in
`idf/api.ts`, `MasterFormDialog.tsx` opened from `MastersPage` (New master + a per-row Edit), keys under `masterForm`
(EN + AR), `idfMasterFormStub` in `tools/idf-stubs.mjs`. Proof: `master-form.test.ts` 10/10 (cycle 2 went green on
first run: cycle 1's implementation already covered payer / list / names), own `it` in `i18n-keys.test.ts`; drive
`tools/idf-masters-drive.mjs` 82/82 STUBBED (LTR + RTL, port 5208); typecheck, test, lint green.

Decisions (overrulable; 628 reconciles against BackOffice 3161/3162):
- **Overlap refusal spelled `OVERLAPPING_SCOPE`**, the clash carried as `data.clashingMasterId` — the brief's Changes
  spell neither. The dialog shows the server message, the code, and "Clashes with <name> (<id>)" named from the list;
  without `data` it still shows the message (which names the clash).
- **One body for POST and PUT** `{ kind, payerCode, storeListId, nameEn, nameAr, hardThreshold, reminderThreshold }`;
  PUT still carries `kind` (the form locks it); a store master sends `payerCode: null`; payer code upper-cased.
- **Thresholds are whole numbers ≥ 0** (619 already shows a 0 reminder); equal thresholds are allowed — only a
  reminder ABOVE the hard one is refused.
- **Resolution-order help** is an ordered list of the four tiers with "This master" on the tier the form currently
  sits (insurer + list / insurer / store); it moves as the author picks a list. No arrows (RTL-safe).
- **Masters list shows the store list's 620 name** (`<bdi data-store-list-id>`), falling back to the id in `Ltr`
  while the lists load or when the list is unknown. 619's drive checks updated accordingly.
- Refusals stay in the dialog with the input kept; a bare 403 on save reads "You do not have access to change IDF
  masters." (ungated until 628). Success toasts and invalidates every IDF query (`IDF_KEY`).
