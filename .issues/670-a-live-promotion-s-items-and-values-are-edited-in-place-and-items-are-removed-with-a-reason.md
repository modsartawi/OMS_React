---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 668, 669 (live: BackOffice 3215)
---

# 670 — A live promotion's items and values are edited in place, and items are removed with a reason

## What to build

- **Edit** a sent promotion: add or remove items (paste again or edit rows), change values, max
  quantities, limits and display names. Save + re-send with a reason.
  - Before sending, the Check preview shows what changes on HungerStation: items leaving a part, a
    new part, a part switched off because it is left empty.
- **Remove items**: select rows on the detail → remove with a reason. They read inactive and stay
  visible.
- The editor **locks the name, stores, start and end** of a sent promotion. Changing any of them is
  the Replace flow (671); the locked fields say so ("Changing this replaces the promotion").
- Disabled while any part is Sending. The server refusal for an identity change while editing shows
  inline and points to Replace.

Wire shapes: the contract's edit and RemoveItems sections (added by BackOffice 3215).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `identityLocked`: name/stores/start/end locked once sent, everything else editable (vitest)
- [ ] drive (LTR + RTL), against stubs: edit preview shows a moved item and a switched-off part; edit and remove-items bodies with reason; disabled while Sending
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only.

## Done when

A live promotion edits and removes items from stubs, with the bodies matching the contract.

## Blocked by

[668](668-a-same-item-bundle-sheet-with-mixed-values-is-previewed-as-the-parts-it-will-be-sent-as.md),
[669](669-a-promotion-hungerstation-partly-refused-shows-what-did-not-take-per-store-and-a-part-is-resent.md)
