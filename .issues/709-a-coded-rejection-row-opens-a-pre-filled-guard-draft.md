---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 709 — A coded rejection row opens a pre-filled guard draft

## What to build

Stories 49, 51; A10; door 3292. On the rejection report (Metrics), a row with a payer reason code offers **open as guard
draft**. It opens the guard editor with the payer, the item kind and the code in `codes.nphies` filled in, and the usual
back-test and approval follow. A row with no code does not offer it.

## Spine reach

model (coded row) · store/logic (row to draft) · component (row action, editor seed) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] row to draft: payer, item kind and code; a codeless row offers nothing — pure (`rejection-draft.test.ts`)
- [x] open a draft from a row, see it filled, save it; nothing is saved until the author does — flow, stubbed (`tools/insurance-fhir-709-drive.mjs`, LTR + RTL)

## Boundaries

Follow how templates and "Open in playground" seed an editor, rather than a new route shape. No new approval path. Doors
stubbed; 711 reconciles.

## Done when

A pattern of rejections becomes a guard draft in a few clicks, through the usual gates.

## Blocked by

None (can start immediately).

## Comments

2026-10-30, build. Everything is stubbed; no live SIS.Api.

**Door shapes guessed (711 reconciles):**

- 3292's spine says "rejection report → draft endpoint", but spells no shape. The client calls no such door: the row seeds
  the editor through router state and the author's Save is the existing `PUT InsuranceRules/Guards/Draft`. If 3292 builds
  an endpoint, this is the thing to reconcile.
- `GET InsuranceRules/Rejections` is read as already built: `code`, `payer`, `sameKind` (an E-code). Whether `code` stays
  the field after 3288's reason codes is 3288's to say.
- The payer as `{ check: "request", field: "payer", anyOf: [payer] }`, assuming the report's `payer` is the value the engine
  reads as `$request.payer`. The stub's report says `TAWUNIYA` and the example request says `0001100041`, so **this needs
  checking**: a name here would give a guard that never fires.

**Overrulable decisions:**

- The kind is an item list, not a block: `factFields` records that SIS.Rules reads an item field only as a list's attribute
  filter (3132). The rule gets `{ check: "line", inList }` on a list that is exactly that E-code, reused if the draft has
  one, else a new `kind-<E-code>` named by the code in both languages. So saving a seeded draft may also add a list.
- A code in the conflict shape (`ER`) still goes in `codes.nphies`, as the ticket says, and the editor's own check holds
  the save until the author moves it. The report's codes may be NCPDP as well as NPHIES (`RejectionRow.code`), so this can
  happen; it is driven.
- The name and message stay empty for the author. Channels, severity (OVERRIDE) and `onUnknown` are a new rule's defaults.
- A row with a live guard still offers the action; only the code decides.
- Router state only, with no storage fallback as the playground has: `history.state` survives a reload. Not driven.

**A bug fixed on the way:** Cancel on any new rule (not only a seeded one) left the author on "rule not found" at
`guards/new`. The navigate was held by the leave guard, which the cancelled state then unmounted. It now moves once the
state is clean, using the existing `moveTo`.
