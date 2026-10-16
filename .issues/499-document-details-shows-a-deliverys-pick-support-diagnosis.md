---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2691-oms-react-pick-support-brief.md
blocked-by: 496
---

# 499 — Document Details shows a delivery's Pick support diagnosis

## What to build

The brief asks for a "Pick support **tab**" on `oms/delivery/:deliveryNo`. **Document Details has no
tabs** since spec 380: the activity spine and the facts column replaced them. The brief's tab is
therefore a folded **Pick support** section of the facts column, a `Disclosure` like Attachments,
and it renders the shared diagnosis panel from `core/pick-support` (496).

- The section is drawn only with `canOpenPickSupport`, and only when the page was opened as a
  **delivery**.
- It reads nothing until it is first opened. Its first opening calls
  `GET PickSupport/Delivery/{deliveryNo}`, like Attachments' first opening.
- The heading may carry a stuck marker once the diagnosis is read. Nothing is read before the
  section is opened.
- A `PICK-00002` shows the server's message inside the section. A 403 shows "You do not have access
  to Pick support".
- A link opens the full console (`/oms/pick-support?key={deliveryNo}`).
- The panel's fix dialog works here once 497 is in. A fix that succeeds also refreshes the page's own
  document load, because the delivery's picking state changed under it.

## Spine reach

route (existing Document Details) · facts column section · shared panel · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `pickSupportSectionGate`: shown only for a delivery and only with `canOpenPickSupport` (vitest)
- [ ] The drive checks:
  - the section is absent without the flag;
  - no `PickSupport/Delivery` call happens until it is opened;
  - opening it renders the stubbed diagnosis;
  - `PICK-00002` shows inside the section;
  - the console link carries `?key=`.

  Extend `tools/pick-support-drive.mjs`, or the Document Details drive if that is lighter. Run it
  LTR and RTL.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- No new door: `Delivery` from 496.
- The section must not slow the page's first render, and nothing is read until it is opened.
- Don't import `features/oms/pick-support` from `features/oms/document`: the shared code is in `core`.

## Done when

The gate helper and the drive are green, and a stubbed delivery's Document Details opens its Pick
support section with the diagnosis.

## Blocked by

[496](496-pick-support-finds-a-delivery-from-any-number-and-shows-its-diagnosis.md)
