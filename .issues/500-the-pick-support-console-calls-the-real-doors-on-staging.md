---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2691-oms-react-pick-support-brief.md
blocked-by: 496, 497, 498, 499 (live: BackOffice 2687–2690 + 2731 deployed; HQ scripts 010, 012, 011 and the PickSupport grant seed run; a support user bound to OMS_PICK_SUPPORT)
---

# 500 — The Pick support console calls the real doors on staging

## What to build

The console runs against the real SIS.Api doors on staging, with no stub.

- `tools/pick-support-live-drive.mjs`, precedent `delivery-statistics-live-drive.mjs`. Run it
  signed in as a user bound to `OMS_PICK_SUPPORT`, and again as one bound to `OMS_PICK_SUPPORT_VIEW`
  only.
- Every field the stubbed drives asserted is present on the live responses. List any drift from
  the brief in the comments, and fix the model in the same ticket.

## Spine reach

live doors · test

## Proof

- [ ] Resolve each key kind (order, delivery, till transaction, picking document, donor request, serial) on one seeded delivery; an unknown key gives the server sentence
- [ ] The census lists the seeded stuck delivery, and the store and shape filters narrow it
- [ ] One fix on a seeded stuck delivery:
  - the panel turns HEALTHY;
  - the timeline shows `SUPPORT_FIX` on the picking document and on the donor request;
  - a second press is refused with `PICK-00224`.
- [ ] The view-only user sees no Apply fix button, and gets a 403 sentence if they POST by URL
- [ ] Arabic read *(owner, not AFK)*: with the UI language set to Arabic, read the console (Search, Stuck now, the diagnosis panel, the fix dialog) and the Document Details section. The 496–499 drives' "RTL" passes run `dir="rtl"` with the EN bundle and match English copy, so they prove direction and isolation only — no drive has rendered a single `ar/pick-support.json` key. This read is the only check of the Arabic wording.
- [ ] Owner walk: one of the three incident deliveries (8006777365, 8006775505, 8006766074) is cleared through the console, and the store is told with the console's text *(owner, not AFK)*

## Boundaries

- Staging only. The production clear is the owner's walk.
- No new UI. A drift between the brief and the live doors is fixed in the model and the drives.

## Done when

The live drive is green on staging and the owner walk is recorded.

## Blocked by

[496](496-pick-support-finds-a-delivery-from-any-number-and-shows-its-diagnosis.md), [497](497-a-shapes-one-fix-is-applied-with-a-reason-and-a-complaint-reference.md), [498](498-support-sees-every-delivery-stuck-now-filtered-by-store-and-shape.md), [499](499-document-details-shows-a-deliverys-pick-support-diagnosis.md)
