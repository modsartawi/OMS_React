---
status: done
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

- [x] `timelineReachedSteps`: each reached rule, pick-in-store skipping Out, and Delivered completing
  · pure
- [x] `cancellationReplacesNextStep`: `closeStatus` R gives indigo Cancellation requested in place of
  the next step with the later steps dropped. C, N and X give Cancelled. X after delivery reads
  Created → Ready → Out → Cancelled · pure
- [x] `rowVariantTimesAndDueTag`: only `entryTime`, `outForDeliveryTime` and `actualDeliveryTime`
  feed times. The rewind marker comes from `rescheduled`. The due tag reads `Due 72.50` vs `Paid`
  · pure
- [x] `tools/grid-theme-drive.mjs` or a new `tools/deliveries-list-drive.mjs`: the Status column
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

## Comments

**Built 2026-10-03 (AFK).** Judgement calls are in `.afk/HITL-396.md`.

- **`@/core/oms/timeline.ts`** is the pure D1 derivation. `TimelineInput` is the one input,
  with two mappers: `timelineInputFromRow` (`DeliveryDocumentModel`) and
  `timelineInputFromHeader` (`SdDocumentHeaderModel`).
  - `timeline()` returns the steps, each with a state (`done`/`current`/`next`/`later`/
    `requested`/`cancelled`), a time and a marker. `timelineNow()` returns where the delivery
    stands. `rowTimelineNow(row)` gives the Status word's key. `dueTag()` returns
    `{ paid }` or `{ paid: false, amount: '72.50' }`, and the surface supplies the words.
  - Codes are read trimmed and case-blind. Pick-in-store is the header's `P` or the list's
    description `PickInStore` (the list sends descriptions).
  - A close on a delivered delivery replaces Delivered.
  - The rewind marker sits on **Created**, the step every rewind falls back to (DRSC and DCHC
    clear the ready and delivery statuses, DRBK writes S/B). It shows **only with a time**
    (369 §3), which holds while the row's `rescheduled` flag stays set after the delivery moves on.
    The header mapper names the rewind from `lastAction`, but carries no times and so shows no
    marker until S4 feeds the Log.
  - The slot-window expectation is **not** in the output. The surface attaches `deliveryWindow()`
    to the `next` step (397/402).
- **Status column (L10):** `colId: 'status'`, second after Delivery no. Its value is the
  translated word (`deliveries:status.*`), so the floating filter, sort, Ctrl+C and the xlsx
  export all read the same word. `StatusCell` draws a dot and the word through the core
  `BdiCell`, so the value is isolated by the core base.
  - Dots: `--ink-3` (Created, Ready), `--primary`, `--success`, `--fam-cancel-request` (indigo,
    368 §3, never amber) and `--danger`.
  - Words: `--muted-foreground`, `--primary`, `--success-800`, `--fam-cancel-request` and
    `--danger-800`.
  - New contrast pair: `--fam-cancel-request` on `--card` at BODY (150 pairs, clean).
- **Proof.**
  - The three cases are `describe` blocks in `src/core/oms/timeline.test.ts`, 30 tests in all.
    They ran red first (module missing), and the marker rule ran red again after the review.
  - The new **`tools/deliveries-list-drive.mjs`** (S3's list drive, for 397–401 to extend) runs
    **44/44** in light/dark × LTR/RTL, with eight stub rows (Arabic customer names under RTL).
    It checks:
    - Status is second in reading order.
    - Each row shows its word, its dot token and its ink, at ≥ 4.5:1.
    - The value sits in a `<bdi>` with no isolate characters.
    - The dot is at the reading start, and two-word states read in order under RTL.
    - The floating filter narrows on the word.
  - The other runs:
    - `grid-theme-drive.mjs`: 125/125.
    - `foundation-drive.mjs`: the grids part all passed, the screens part 492/492. Its only
      failures are the 8 recorded at 393 (stale topbar check; the bell's wall-clock drift).
    - `npm test`: 3339 passed.
    - `npm run lint`: four gates clean.
    - `npm run typecheck` and `npm run build`: green.
- **Left for later slices:**
  - A saved view from before this slice restores with `applyOrder`, so Status lands where AG Grid
    puts an unnamed column, not second. 400 owns the view store and its import.
  - The Status column sorts alphabetically by word, not in lifecycle order. No order was asked
    for.
  - The six step words live in `deliveries` only. When Details (402) draws steps, decide whether
    they move to a shared home or `document` gets its own.
