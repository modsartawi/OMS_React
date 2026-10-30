---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 695
---

# 697 — Clicking a value in a kept bundle's tree proposes a field

## What to build

Stories 5–8; 3262 V3; door 3283. An author opens a kept bundle as a tree and clicks a value, or a whole Money, Quantity
or code. The door returns the proposed path, where an array position became a `where()` on the element's own code, a
choice type became `ofType()` and a click inside `Claim.item` became a line field. The raw-mode form (695) opens filled
with it, so the same checks and Probe apply.

If the field already exists, the page points at it instead of offering a duplicate. A Patient field shows a warning,
does not refuse, and the warning travels with the proposal to the approver.

**Decision (overrulable):** the tree lives in `features/insurance-rules/fields`.

## Spine reach

model/api (tree by ref, node to path) · component (tree, click target) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] tree rendering model: nested arrays and choice types keep the node reference the door needs — pure
- [x] click a value and get the form filled; click an existing field and be pointed at it; click a Patient field and see
      the warning — flow (Playwright drive, on synthetic bundles only)

## Boundaries

**The path is the door's**, never derived in the browser. The tree is under the read grant and the door logs the read:
nothing from the bundle goes to storage, the URL beyond its ref, or the console. No patient data in any stub or
screenshot. Doors stubbed; 711 reconciles.

## Done when

An author adds a field without writing a path, and the proposed path is not tied to the clicked bundle's positions.

## Blocked by

695.

## Comments

**2026-10-30, built on stubs.** `bundle-tree.test.ts`; drive `tools/insurance-fhir-697-drive.mjs` 80/80, LTR and RTL, stubbed
and synthetic. The live door is 711's. The app's `lng` stays `en` under RTL, so the drive reads English there and the Arabic
words are proved by key parity only.

**Door shapes guessed (711 reconciles; 3283 spells none):**
- `GET InsuranceRules/Fields/Tree?ref=` → `{ ref, root }`; node `{ nodeRef, name, index?, choice?, fhirType, value?, pickable?, children? }`. `nodeRef` is opaque, and the door decides `pickable`.
- `POST InsuranceRules/Fields/Tree/Click { ref, nodeRef }` → `{ proposal: { path, moment, level, type, cardinality, system?, key? }, existing: { key, moment, level, label } | null, patient }`.
- The client sends nothing for the Patient warning. `patientWarning` is the door's flag on the proposal row (696; 3282 derives it from the path), so the approver's warning is not proved here: it rests on that door, and 711 checks it live.

**Overrulable decisions:**
- A bundle is opened by typing its ref, with `?bundle=<ref>` in the URL. No door lists kept bundles, so there is no picker.
- The tree opens fully expanded, and the author collapses what they don't need.
- The Patient warning stays on the form if the author then edits the path away from Patient. It errs towards warning, and the door decides.
- A raw-typed Patient path shows only what Compile's `warnings` say; `patientWarning` comes from the tree alone.
- The existing-field notice points at the catalog row with a "Show in the catalog" scroll, not a route.
- The tree query keeps nothing once the view is gone (`gcTime: 0`, no retry, no refetch on focus).
