---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 704 — Aliases are proposed and approved

## What to build

Story 60; D7, D11; door 3294. A screen lists aliases (payer, wrong URL → canonical URL) with their state. A grant holder
proposes one, for example TAKAFUL's misspelled UCUM URL, and someone who is not the author approves it. An alias is
applied when matching codings and UCUM units, and the screen says that the kept bundle itself is never rewritten.

## Spine reach

model/api (aliases, propose, approve) · store/logic (form rules, who may act) · component (list, form) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] the form refuses an empty or identical wrong and canonical URL; who may approve — pure
- [x] propose as one user, approve as another; the pair reads correctly under `ar` — flow (stubbed; RTL direction with English words, see Comments)

## Boundaries

An approved alias reaches a published rule only through a re-pin draft (705). A URL pair is `formatPair`-style one
isolated value or words between isolated values, never two isolates glued. Doors stubbed; 711 reconciles.

## Done when

A payer's quirk can be named once and approved by a second person.

## Blocked by

None (can start immediately).

## Comments

**2026-10-30, built on stubs (`tools/insurance-fhir-704-drive.mjs`).** Screen: `/insurance-rules/aliases`, feature
`features/insurance-rules/aliases`, namespace `insurance-aliases`.

Door shapes guessed from 3294, which spells none (711 reconciles):

- `GET InsuranceRules/Aliases` → `[{ id, payer, wrongUrl, canonicalUrl, state: 'proposed' | 'approved', proposedBy, proposedAt, approvedBy, approvedAt }]`
- `POST InsuranceRules/Aliases { payer, wrongUrl, canonicalUrl }` → the row
- `POST InsuranceRules/Aliases/{id}/Approve {}` → the row
- Refusal codes `INSALIAS_EXISTS`, `INSALIAS_SELF_APPROVAL`, `INSALIAS_NOT_FOUND`
- `payer` is the SAP customer id from `GET InsuranceRules/Insurers`, the same id the class lists name

Overrulable decisions:

- No reject action: the ticket and door name only propose and approve. A wrong proposal stays proposed until 711 or the door adds one.
- URLs compare exactly, so a pair differing only in case is allowed: a case slip is a quirk an alias may name.
- A duplicate (payer, wrong URL) is left to HQ's refusal, not checked in the form.
- The author sees a reason in place of Approve. With no known user or author, the row reads the same way. A reader without the grant has no probe (the `approval.ts` precedent) and meets the bare 403 in words.
- The URLs sit in two columns, each its own isolate; the approval confirmation puts words between two `fsi` values.

⚠ `core/i18n.ts` pins `lng` to `en`, so the flow's RTL pass flips direction with English words. The pair's isolation and
reading order are driven under RTL. The Arabic file is proved only as mirroring the English keys (`aliases/i18n-keys.test.ts`):
its words have not been seen rendered and await an Arabic sign-off.
