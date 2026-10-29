---
status: open
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

- [ ] `dataRoundTrip` — data → form → data is identical, including attributes as text, empty ICD and null codes;
      unknown keys are kept — pure
- [ ] drive: add a line in the form and see it in the JSON; edit the JSON quantity and see the form follow; the
      outcome refreshes — flow

## Boundaries

No new door. Keys in `insurance-playground` (en + ar).

## Done when

Request, patient and lines are edited as a form or as JSON with nothing lost either way. Vitest and drive are green.

## Blocked by

[678](678-the-outcome-refreshes-shortly-after-an-edit-a-stale-reply-is-dropped-and-kind-and-as-of-pick-what-runs.md)
