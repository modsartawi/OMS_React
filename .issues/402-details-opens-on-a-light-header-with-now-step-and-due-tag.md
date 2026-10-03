---
status: done
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

- [x] `dueTag reads Due n while amountDue > 0 and Paid at 0` · pure
- [x] `details header maps to the same now-step as the list row for the same delivery` (header-model mapping fed through 396's derivation: Created/Ready/Out/Delivered, pick-in-store skips Out, close R → Cancellation requested, C/N/X → Cancelled) · pure
- [x] `tools/document-header-drive.mjs`: light, dark and RTL; a moving, a cancelled and a cancellation-requested delivery; no dark slab; badge colour indigo vs red; All statuses discloses; the Delivery no. is isolated in RTL · flow (Playwright)

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

## Comments

**Built 2026-10-03 (AFK).** Judgement calls are in `.afk/HITL-402.md`.

- **`DocumentHeader.tsx`** replaces `IdentityBand.tsx`, and with it 083 D-3's pill rail
  (`StatusRail.tsx`). It is a light `--card` card; the `--brand-panel` slab is gone from
  Details (the login still uses that token).
  - **Line one:** Back chevron, then the number in Plex Mono 600 (one `Ltr`), then the now-step
    badge, then the due/paid tag, then the tags (Dawaa Now gold with navy ink, e-Rx, Overall
    code in mono). After those, at the inline end, come **All statuses** (the thirteen statuses
    plus provenance, kept from 083 D-3) and **Refresh**, which moved here from the retired rail.
  - **Line two:** order no., type, delivery doc, placed, store and document no. (the delivery's
    `refDocumentNo`). IDs are mono and isolated by kind; a type word is a `<bdi>`.
  - The command bar is untouched and sits directly beneath the header.
  - While a document loads or has failed, the header shows Back and the route id only, never
    the last record's facts.
- **Now-step colours.** Created and Ready are neutral, Out is primary, Delivered is success.
  Cancellation requested uses the `--fam-cancel-request` indigo as ink and edge on `--card`.
  Cancelled is `danger-800` on `danger-050`. Amber appears only on the Due tag. Every pair is
  one the contrast gate already measures (168 pairs, unchanged).
- **The model and logic.**
  - `@/core/oms/timeline` gains `headerTimelineNow(doc)`, the twin of `rowTimelineNow`.
  - The pure `header.ts` (`documentHeaderView`) composes the now-step, `dueTag`, the tags and
    `headerSubIds`.
  - `fields.ts` loses `bandCustomer` (the customer block is dropped). It gains
    `carriesPrescription`, and its `bandSubIds` becomes `headerSubIds`, which adds the document
    no. and marks IDs as mono.
  - No Log times are used (403 adds them).
- **i18n (`document`).**
  - `band.*` became `header.*`, plus `eRx`, `refDocumentNo`, `allStatuses`,
    `allStatusesCount` (a `<count>` slot) and `provenance`.
  - New: `step.*` (the six now-step words) and `dueTag.due` / `dueTag.paid`.
  - `rail.*` is retired.
  - The words live in `document`, not shared with `deliveries:status.*`, because 396 put the
    list's words in `deliveries`, not `common` (HITL).
- **Retired:**
  - `IdentityBand.tsx`, `StatusRail.tsx`, and `rail.ts` / `status-severity.ts` with their
    tests (the pill rail was their only reader).
  - `tools/document-band-drive.mjs` and `tools/document-rail-drive.mjs`. Their surviving
    checks moved into the new header drive.
  - Note for 404: its Proof line names `rail.test.ts`, which is gone. The card tests it means
    live in `fields.test.ts`.
- **Proof.**
  - `src/core/oms/timeline.test.ts` has the describe `details header maps to the same now-step
    as the list row for the same delivery`. It has 13 tests, run red first on the missing
    `headerTimelineNow`.
  - `src/features/oms/document/header.test.ts` covers `dueTag reads Due n while amountDue > 0
    and Paid at 0` over the captured payloads, plus the now-step per capture, the tags and the
    sub-ids.
  - `npm test`: 3463 passed.
  - **`tools/document-header-drive.mjs`: 292/292** in light/dark × LTR/RTL. It covers a moving
    (Out, Dawaa Now, Paid), a cancelled and a cancellation-requested delivery. It checks:
    - no slab and no pill rail;
    - line one's order and its inline-end group;
    - the badge ink and ground per state (indigo vs red, never amber);
    - "Due 103.10" with the amount one ltr isolate and a real space on screen. The first run
      found the space eaten by a flex container; it was fixed, and the drive now measures it;
    - the six sub-ids per capture, mono and isolated, and an Arabic type word reading RTL;
    - All statuses disclosing 13 + provenance;
    - Back mirroring under RTL;
    - the loading header.
- **Other drives re-run:**
  - `document-detail-drive` 39/39 (pill-rail table → now-step per capture).
  - `document-rtl-drive` 52/53. Its one failure is the pre-existing "inert inline box" check,
    with one more entry of the same cause (see HITL).
  - `document-cards` 45/45, `document-actions` 67/67, `document-items` 23/23,
    `return-dialog` 105/105.
  - `order-attachments` 244/244 (its Refresh locator now points at the header).
  - `deliveries-list` 362/362, `command-palette` 366/366.
  - `foundation` 1294/1302, the baseline. Its Details mono probe now accepts an isolated code.
  - `screen1-smoke` was not run: it hardcodes port 5199.
- `npm run lint`: four gates clean. `npm run typecheck` and `npm run build`: green.
- **Outstanding (not AFK):**
  - The owner's S4 sign-off (at 405).
  - A human eye on real Arabic copy.
  - The owner's call on the HITL items: the badge on the order-document route, the outlined
    indigo badge, document no. = `refDocumentNo`, and the e-Rx rule.
