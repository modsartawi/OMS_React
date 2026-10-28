---
status: done
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

- [x] `a get line's Per round-trips read → state → request` — Per 4 stays 4; a read's 0 on P/R opens as 1; `%` and Total Discount send 0; a blank sends 0 · pure, `editor.test.ts`
- [x] `the Per column shows only on Discount Price and Discount Amount lines, never under Total Discount` · pure
- [x] `curr/pe reads currency / N unit when Per is above 1` — extends the existing curr/pe block · pure
- [x] `new, pasted and generated lines start at Per 1; a Per edit makes formChanged true` · pure
- [x] `bby maintenance drive: Per` — a stubbed read with `pricingUnit: 4` shows `SAR / 4 EA`; an edit reaches the Save body; switching to % and turning on Total Discount each hide the box; a stubbed `BBY-PRICING-UNIT` is listed; the upload note names column 25 · flow, `tools/bby-maintenance-drive.mjs`

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

## Comments

- 2026-10-28 — Done — Per box, Curr/Pe `SAR / 4 EA`, pricingUnit round trip, BBY-PRICING-UNIT fallback key and upload note col 25 on branch ticket/640-get-line-per, commit 670c0a7d; typecheck, lint, vitest 7348/7348 and drive 220/220 (new step 48) green; STUBBED (BackOffice 3181 not built). Judgement calls (OWNER DECISION, overrulable): (1) a read's 0 opens as 1 on every line, % included, so switching % → P shows 1; the Per header stays in the grid on non-Total-Discount layouts and only the cell is empty on a % line; (2) the en fallback is shown only when the server sends BBY-PRICING-UNIT with no English text — a worded refusal is shown as sent; (3) no generated-coupon get line exists (coupon material is a Buy-line act), so D12 is covered by add line + paste; (4) drive step numbered 48 because 45–47 were already taken.
- 2026-10-28 — Review fixes, commit 802913cf (spec/639-get-line-per): one shared `refusalText` so the upload rows get the BBY-PRICING-UNIT en fallback too; Per counts only as a whole number ≥ 1, so Curr/Pe reads plain for 0.5/2.5; `num()` delegates to `boxNumber`; the Curr/Pe rate is built by the new core `formatRate` and isolated once; get-grid widths are a map. typecheck, lint, vitest 7373/7373 (pre-ticket-comment run) and drive 233/233 green; still STUBBED.
