---
status: open
spec: 380
blocked-by: 401
---

# 402 — Delivery details opens on a light header with the now-step badge and the due/paid tag

## What to build

The first S4 slice. Delivery details (`DocumentDetailsPage`, route `oms/delivery/:deliveryNo`) loses
its dark identity slab and opens on a **light `--card` header** that says where the delivery is now
and what is owed (spec 380 **D2**, ruled in [371](371-the-delivery-details-record-page.md) §1 and
[369](369-how-a-deliverys-state-maps-to-timeline-steps.md) §1).

- **Line one:**
  - Back chevron (Esc arrives in 405, so this slice only adds the button);
  - the Delivery no. in Plex Mono 600;
  - the **now-step badge**, from the shared `@/core` timeline derivation (396) fed from
    `SdDocumentHeaderModel`;
  - the **due/paid tag** (`Due n` while `amountDue > 0`, `Paid` at 0);
  - the tags (Dawaa Now as a gold fill with navy ink, e-Rx, the Overall code);
  - **All statuses** at the end, keeping 083 D-3's disclosure of the thirteen statuses plus
    provenance.
- **Line two:** the sub-ids (order no., type, delivery doc, placed, store, document no.), with IDs in
  mono.
- **Drop** the 083 identity band's customer block and its dark ground. Customer facts move beside
  the spine in 404. Until then the existing summary rail still shows them, so nothing is lost
  mid-step.
- **The now-step colours:**
  - Cancellation requested is **indigo** (`--fam-cancel-request`).
  - Cancelled is danger red.
  - Amber is never the state colour.
- **The command bar (083 D-10) is untouched.** It sits directly beneath the header.

The derivation's details-side input is a mapping from `SdDocumentHeaderModel` to the same input the
list row feeds (396). This slice adds that mapping, **without Log times**, which arrive in 403. The
reference implementation is `__prototype__/derive.ts` on branch `prototype/371-delivery-details`
(`bf0754d`, variant D).

## Spine reach

model (header → timeline input mapping) · logic (`@/core` timeline: now-step + `dueTag()`) ·
component (header card, replacing `IdentityBand`) · i18n (`document`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `dueTag reads Due n while amountDue > 0 and Paid at 0` · pure
- [ ] `details header maps to the same now-step as the list row for the same delivery` (header-model mapping fed through 396's derivation: Created/Ready/Out/Delivered, pick-in-store skips Out, close R → Cancellation requested, C/N/X → Cancelled) · pure
- [ ] `tools/document-header-drive.mjs`: light, dark and RTL; a moving, a cancelled and a cancellation-requested delivery; no dark slab; badge colour indigo vs red; All statuses discloses; the Delivery no. is isolated in RTL · flow (Playwright)

## Boundaries

- **No new endpoint.** It reads today's `Delivery/{no}` header.
- **i18n (`document`):** the now-step words (shared with the list's Status words where 396 put them
  in `common`; reuse those, don't duplicate), `dueTag.due` (`Due {{amount}}`), `dueTag.paid`, and the
  header labels.
- **Logical Tailwind.** The mono IDs go through `Ltr` by kind (F24).
- **Retires** `IdentityBand.tsx`'s use of the rail token (the 362 hand-on).

## Done when

The record page opens on the light header with the correct now-step badge and due/paid tag in light,
dark and RTL, the command bar unchanged beneath it, and the drive green.

## Blocked by

- 401 — R/C/N from the list open that dialog on Delivery details (end of S3; the step order per R1)
- 396 — the `@/core` timeline derivation this slice feeds (transitively done)
