---
status: open
spec: 639 (server half BackOffice 3181)
blocked-by: —
---

# 640 — The editor reads, edits and saves a get line's Per

## What to build

On Bonus Buy Maintenance, a Get line with a **Discount Price** or **Discount Amount** has a **Per**
box beside its value. It defaults to 1 and is a core/ui numeric input. Its unit is the line's own
unit (EA when the line names none), shown and never picked. The box is absent on a Discount Percent
line and while **Total Discount** is on. It follows the line's discount type as the type changes.

- **Curr/Pe** reads `SAR / 4 EA` when Per > 1. At 1 it reads as today, and a price keeps its ex-VAT
  mark.
- **Round trip (D1, D7).** A read's `pricingUnit` fills the box, and a read's 0 on a P/R line opens
  as 1. Save and Check send `pricingUnit` as a number on P/R lines and 0 on `%` and under Total
  Discount. A blank box goes up as 0 so the server refuses it; the client never pre-validates.
- **New lines (D12).** Every line the editor creates (add line, paste materials, a generated coupon
  material line) starts at Per 1.
- **Status rules.** A Per edit marks the form dirty through `formChanged`, so Mark Tested and leaving
  the page treat it like any edit. Per is locked like every input on a bonus buy that isn't Planned.
- **Refusal (D2).** `BBY-PRICING-UNIT` is listed like every other refusal (code, English, Arabic),
  with an en fallback key.
- **Upload note.** The dialog's OMS-only-columns note names column 25 `PER` (blank means 1), next to
  23 and 24.

## Spine reach

model (get-line wire type) · logic (editor state, `fromDocument`/`toRequest`, Get layout, Curr/Pe) · component (Get panel row, upload note) · i18n (`bonus-buy-maintenance`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `a get line's Per round-trips read → state → request` — Per 4 stays 4; a read's 0 on P/R opens as 1; `%` and Total Discount send 0; a blank sends 0 · pure, `editor.test.ts`
- [ ] `the Per column shows only on Discount Price and Discount Amount lines, never under Total Discount` · pure
- [ ] `curr/pe reads currency / N unit when Per is above 1` — extends the existing curr/pe block · pure
- [ ] `new, pasted and generated lines start at Per 1; a Per edit makes formChanged true` · pure
- [ ] `bby maintenance drive: Per` — a stubbed read with `pricingUnit: 4` shows `SAR / 4 EA`; an edit reaches the Save body; switching to % and turning on Total Discount each hide the box; a stubbed `BBY-PRICING-UNIT` is listed; the upload note names column 25 · flow, `tools/bby-maintenance-drive.mjs`

## Boundaries

- The doors are BackOffice 3181 (Save, Validate, read), stubbed with exactly spec 639 D1/D2.
- Use the core/ui numeric control so the control ratchet for `pricing/bonus-buy-maintenance` doesn't
  grow.
- No hint here (641).
- No change to the BBY Inquiry detail or the simulator.

## Done when

On stubs, Per opens, edits, saves and is refused exactly as above, and typecheck, lint, vitest and
the drive are green.

## Blocked by

—
