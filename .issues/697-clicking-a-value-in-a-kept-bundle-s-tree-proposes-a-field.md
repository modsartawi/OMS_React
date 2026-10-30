---
status: open
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

- [ ] tree rendering model: nested arrays and choice types keep the node reference the door needs — pure
- [ ] click a value and get the form filled; click an existing field and be pointed at it; click a Patient field and see
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
