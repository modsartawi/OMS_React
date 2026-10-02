---
status: open
spec: 380
blocked-by: 393, 383
---

# 396 — Each delivery row shows its derived Status

## What to build

This is Slice 0 of S3. The **Delivery timeline** derivation becomes a pure module in `@/core`, and
the Deliveries grid gains a **Status** column in second place, showing a dot and a word.

- **One input, two models.** Both `DeliveryDocumentModel` (the list row) and `SdDocumentHeaderModel`
  (the Details header) map to **one derivation input**. The derivation is pure, so the Delivery
  inspector (397) and Delivery details (402–403) share **the derivation, not a component**. S4
  extends the input with Log rows for step times.
- **Steps:** Created → Ready → Out for delivery → Delivered. Pick-in-store (`deliveryType 'P'`)
  skips Out.
- **Reached:**

  | Step | Reached when |
  |---|---|
  | Created | always |
  | Ready | `readyStatus` is R or C |
  | Out for delivery | `deliveryStatus` is O |
  | Delivered | `deliveryStatus` is D |

- **A cancellation replaces the next step.** The steps already reached stay done, and the step
  where the delivery stopped becomes one of:
  - **Cancellation requested**: `closeStatus` R. It is final, drawn in **indigo**
    (`--fam-cancel-request`), never amber.
  - **Cancelled**: `closeStatus` C, N or X, drawn in red.

  The later steps are **dropped**.
- **Rewind marker.** On the row variant it comes from `rescheduled` / `rescheduledTime`.
- **Inspector-variant times** come from row fields only: Created ← `entryTime`, Out ←
  `outForDeliveryTime`, Delivered ← `actualDeliveryTime`. No other step has a time.
- **Due/paid tag.** It reads `Due n` while `amountDue > 0` and `Paid` at 0.
- **The Status column** shows the **current state** word: Created, Ready, Out for delivery,
  Delivered, Cancellation requested or Cancelled. Its value isolates through the core base
  `defaultColDef` (383).

The rest of the grid is unchanged here.

**Implements:** spec 380 **D1** (the row variant: steps, reached, cancellation, rewind marker,
row-field times, due/paid tag) and **L10** (the Status column).

**Rulings:** [369](369-how-a-deliverys-state-maps-to-timeline-steps.md) §1–§4 (amended by 368 to
indigo), [367](367-what-the-inspector-shows-for-a-selected-delivery.md) (shared derivation, not a
component), [368](368-the-deliveries-list-as-one-screen.md) §1 and §3, and the evidence in
[369-delivery-state-sources.md](assets/369-delivery-state-sources.md). The prototype's
`__prototype__/derive.ts` on branch `prototype/371-delivery-details` (`bf0754d`) and the list's on
`prototype/368-deliveries-list` (`9b7f32c`, variant A) hold a working draft.

## Spine reach

model (one timeline input type in `@/core`, with mappers from both models) · store/logic (pure
`timeline()` and `dueTag()`) · component/route (the Status column in the deliveries columns) · i18n
(`deliveries:status.*` words, shared step words wherever both features read them) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `timelineReachedSteps`: each reached rule, pick-in-store skipping Out, and Delivered completing
  · pure
- [ ] `cancellationReplacesNextStep`: `closeStatus` R gives indigo Cancellation requested in place of
  the next step with the later steps dropped. C, N and X give Cancelled. X after delivery reads
  Created → Ready → Out → Cancelled · pure
- [ ] `rowVariantTimesAndDueTag`: only `entryTime`, `outForDeliveryTime` and `actualDeliveryTime`
  feed times. The rewind marker comes from `rescheduled`. The due tag reads `Due 72.50` vs `Paid`
  · pure
- [ ] `tools/grid-theme-drive.mjs` or a new `tools/deliveries-list-drive.mjs`: the Status column
  sits second, shows the six words with the right dot colours (indigo for requested), and reads
  correctly in light, dark and RTL · flow (Playwright)

## Boundaries

- No new API endpoint. The fields are already on `DeliveryDocumentModel`.
- New `deliveries:status.*` keys.
- The pure module lives in `@/core` (for example `@/core/oms`), and both features import it from
  there.

## Done when

The pure timeline is green on both model mappers, and the Deliveries grid shows the derived Status
column in all three modes.

## Blocked by

- [393](393-a-key-is-a-field-on-a-command.md): S2 ships first.
- [383](383-every-grid-mirrors-under-rtl-and-isolates-its-values.md): the core base `defaultColDef`.
