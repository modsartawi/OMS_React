---
status: done
spec: 639 (server half BackOffice 3181)
blocked-by: 640
---

# 641 — Each Discount Price or Discount Amount get line shows what the till will charge

## What to build

Under each `P`/`R` Get line, a one-line hint shows what the till will charge for the line's quantity
(spec 639 D10). The hint decides nothing: it doesn't refuse, colour the line or block anything (owner
ruling 2026-10-28, "hint without refuse").

- The total is `value / Per × quantity`, shown to two places. The rate is `value / Per`.
- The wording depends on the scale type:
  - Equal: `= 100.00 SAR for 4 EA`
  - From: `= 100.00 SAR for 4 EA, then 25.00 SAR each`
  - Up To: `= 100.00 SAR for up to 4 EA`
- Discount Amount uses the same three with "off" (`= 100.00 SAR off for 4 EA`).
- Uneven cases still show: Equal 4 / Per 3 → `133.33`, Equal 2 / Per 4 → `50.00`.
- Nothing shows while the value, quantity or Per is blank or not a number, or Per ≤ 0. Nothing shows
  on `%` or under Total Discount.
- **Bidi (D11).** Each amount and quantity is a machine value in a `<Trans>` slot, isolated with
  `Ltr`. The amount and unit are formatted as one value.

## Spine reach

logic (a pure hint function in the editor's pure half) · component (Get panel row) · i18n (`bonus-buy-maintenance` hint keys) · test

## Proof (→ `tdd` red-green cycles)

- [x] `the hint totals value / Per × quantity, worded by scale type` — Equal, From, Up To × P, R · pure, `editor.test.ts`
- [x] `the hint shows uneven rates without refusing` — 4/3 → 133.33, 2/4 → 50.00 · pure
- [x] `no hint for blank, non-numeric or Per ≤ 0 input, for % or under Total Discount` · pure
- [x] `bby maintenance drive: hint` — Equal 4 / P 100 / Per 4 shows `= 100.00 SAR for 4 EA`; changing Per to 1 shows `400.00`; switching to From adds the each-rate · flow

## Boundaries

- Client display only: no request change and no server door.
- The en keys only (the screen has no ar namespace).

## Done when

The hint shows as above on stubs, and typecheck, lint, vitest and the drive are green.

## Blocked by

[640](640-the-editor-reads-edits-and-saves-a-get-lines-per.md)

## Comments

- 2026-10-28 — Done — pure `perHint` (value / Per × qty to 2 places, Equal/From/Up To × P/R, From carries the rate) + a muted hint row under each P/R get line, amounts and quantities in `<Trans>` slots isolated with `Ltr`, commit 5f6b3c8e; typecheck, lint, vitest 7363/7363 and drive 231/231 (new step 49; one 5c column-filter timing flake on a first run, green on rerun) green; STUBBED (BackOffice 3181 not built). Judgement calls (OWNER DECISION, overrulable): (1) the hint sits in its own row under the line, text-end, muted like every hint on the screen, with no tone change ever; (2) the From rate on an amount reads "then 25.00 SAR off each"; (3) the quantity is shown as typed, so a fractional quantity shows (the server's BBY-QUANTITY decides); (4) "SAR" is the bonus buy's currency, so a BHD org would read BHD.
- 2026-10-28 — Review fixes, commit 802913cf (spec/639-get-line-per): the hint shows nothing for a quantity ≤ 0, a value < 0 or a Per that is not a whole number ≥ 1 (same rule as Curr/Pe); its amounts use grouped money via `formatMoneyIn` (`= 100,000.00 SAR`). Tests added; drive step 49 checks grouped money and Per 2.5; drive 233/233, typecheck, lint, vitest green; still STUBBED.
