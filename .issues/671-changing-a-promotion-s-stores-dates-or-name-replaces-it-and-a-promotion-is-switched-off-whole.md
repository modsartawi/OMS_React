---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 668, 669 (live: BackOffice 3216)
---

# 671 — Changing a promotion's stores, dates or name replaces it, and a promotion is switched off whole

## What to build

- **Replace**: a dialog to change the name, stores, start or end of a sent promotion, with a reason.
  It says in words what happens: "HungerStation sees a new promotion. The current one is switched
  off first; if that is refused, nothing changes."
  - On success, the old promotion reads **Replaced** with a link to the new one, and the new one links
    back.
  - On a refused switch-off, the refusal names the part and the old promotion is shown unchanged.
- **Switch off** the whole promotion, with a reason and a confirmation in words. It then reads
  **Switched off**. Nothing is deleted.
- The list gains the **Scheduled** and **Ended** filters (from the window) and a **store** filter
  ("which promotions are live on this store").
- Both actions are disabled while any part is Sending.

Wire shapes: the contract's Replace, SwitchOff and list-filter sections (added by BackOffice 3216).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `replaceNeeded`: true exactly when name/stores/start/end differ from what was sent (vitest)
- [ ] drive (LTR + RTL), against stubs: replace body + both links; refused switch-off shows the part and leaves the old unchanged; switch-off body; Scheduled/Ended/store filters ⇄ URL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The order (switch off first) is the server's; the page only words it.

## Done when

Replace and switch-off work from stubs, with the bodies matching the contract.

## Blocked by

[668](668-a-same-item-bundle-sheet-with-mixed-values-is-previewed-as-the-parts-it-will-be-sent-as.md),
[669](669-a-promotion-hungerstation-partly-refused-shows-what-did-not-take-per-store-and-a-part-is-resent.md)
