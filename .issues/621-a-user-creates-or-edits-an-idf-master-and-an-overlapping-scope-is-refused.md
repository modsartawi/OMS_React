---
status: open
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

- [ ] `master form defaults thresholds to 4 and 1 and refuses reminder above hard` · pure
- [ ] `master form requires a payer for insurer and a store list for store` · pure
- [ ] drive `tools/idf-masters-drive.mjs` (extend) — create insurer, insurer+list and store masters; edit one; an overlap refusal names the clash · flow

## Boundaries

New endpoints `POST/PUT IdfPriority/masters` — stubbed. The overlap refusal's code is 3162's to spell (pick it up
from the brief's Changes). Keys in `insurance-idf`. Ungated until 628 (a 403 on save shows "no access").

## Done when

A master is created and edited against stubs and an overlap refusal shows the clashing master, proofs green.

## Blocked by

[620](620-the-team-keeps-named-store-lists-and-the-pilot-list-cannot-be-deleted.md)
