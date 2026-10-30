---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 9-11, 21)
blocked-by: 678
---

# 682 — The form and the JSON edit one dataset: request, patient, lines and their attributes

## What to build

The Data pane gets a **Form | JSON** switch over **one** dataset. An edit in either one shows in the other, and
switching never loses anything.

The form covers:
- **request:** channel, store, payer, policy, class, pharmacist, and `attributes` (registry field values, as text);
- **patient:** birth date, gender, id type, and `attributes`;
- **lines:** add, remove and reorder. Each line has item (SKU), quantity, unit, days supply, ICD (several), price,
  eCode, dCode, sfdaCode, idfPriority, and `attributes`.

Attributes are key → text pairs. A value is text even when it looks like a number (ADR 0117: typed when read). The
JSON **is** the door's `data` shape.

A JSON key the form does not know survives a trip through the form untouched. The form shows a note that the JSON
holds more than it can show.

## Spine reach

store/logic (form model ⇄ data JSON) · component (form) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `dataRoundTrip` — data → form → data is identical, including attributes as text, empty ICD and null codes;
      unknown keys are kept — pure
- [x] drive: add a line in the form and see it in the JSON; edit the JSON quantity and see the form follow; the
      outcome refreshes — flow

## Boundaries

No new door. Keys in `insurance-playground` (en + ar).

## Done when

Request, patient and lines are edited as a form or as JSON with nothing lost either way. Vitest and drive are green.

## Blocked by

[678](678-the-outcome-refreshes-shortly-after-an-edit-a-stale-reply-is-dropped-and-kind-and-as-of-pick-what-runs.md)

## Comments

- 2026-10-30 (682 built, branch `impl/3243-682`). vitest: `data-form.test.ts` (12: `dataRoundTrip` + form edits + lines
  add/move/remove), `experiment.test.ts` +1 (Form sends `data`), `i18n-keys.test.ts` +1. Drive
  `tools/insurance-playground-form-drive.mjs` 52/52 (LTR + RTL); 677 drive 116/116, raw 52/52, reads 46/46 still green.
  typecheck, lint, test (7948), build green. No new door, no stub section.
- **Layout for 683:** `data-form.ts` is the pure model. `formFromData(data) → DataForm | null` (null = a shape the form
  cannot hold: `request`/`patient` not an object, `lines` not a list of objects), `dataFromForm(form)`, `addLine` /
  `moveLine` / `removeLine`, `formFromText` / `formText`. Every section keeps the object it was read from (`base`);
  writing back spreads it, so unknown keys and key order survive, and a field whose text is unchanged is written
  back AS IT WAS (a number attribute, a text quantity). Only edited fields are parsed: number fields
  (`NUMBER_FIELDS`) become numbers when they read as one, else stay text; cleared → null; ICD splits on commas or
  spaces; attributes are always text. `more[]` lists the paths the form does not show (today `history`, `reference`,
  `eligibility`, `payer`). **683 adds a section:** its key to `FORM_SECTIONS`, a field on `DataForm`, a branch in
  `formFromData` / `dataFromForm`, and a `SectionBox` in `DataFormView.tsx`.
- `DataPane.tsx` keeps the form the user is typing in beside the text it wrote (`own`), so a half-typed attribute row
  or `"E11, "` survives; any other change to the data text (JSON tab, kind switch) re-reads the form from it.
- **Decisions (overrulable):** tabs are Form | JSON | Raw but **JSON stays the default tab** (every earlier drive opens on
  the data box). A new line is `{ line: max+1, item: null, quantity: 1, …nulls, icd: [], attributes: {} }`; moving a
  line keeps its `line` number (it is the line's id, not its position). `idfPriority` is a number field. Gender and
  ID type are free text (no option list: the form must not lose a value it does not know). An attribute row with an
  empty key is not written. Data that does not parse, or a shape the form cannot hold, shows a problem in words
  on the Form tab; the JSON tab stays the way to fix it.

