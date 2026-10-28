---
type: spec
status: ready
---

# 639 — A get line's price or amount is set per N units (Per on Bonus Buy Maintenance)

Settled in the 2026-10-28 grilling that began as *"I can't say the price 100 is for the 4 pieces
(EA); the field is in the engine and the tables but not on the screen"* (example: OMS000002459,
"AVOGAIN 5% - 4 pcs @ 100 SAR"). The vocabulary is `CONTEXT.md`'s: **bonus buy**, **buy side / get
side**, **reward**, **discount type**, **BBY status**, and the term minted in that session, **Per**.
Decisions D1–D14 below are this file's own.

**Two halves.** The server half lives in BackOffice's bonus-buy maintenance layer and is **not filed
yet** (ask BO-1 under Further Notes). The **new engine is not touched**. The web half builds and tests
against a stub of exactly the wire in D1, and never invents a field beyond it.

## Problem Statement

A pricing user builds a bonus buy like "4 pieces for 100 SAR". On the Get panel they set Scale Type
Equal, Quantity 4, Discount Price 100. Nowhere on the screen can they say the 100 is for the four
units. When they save, every per-line price or amount is stored as being **per 1 unit**. The bonus
buy then prices at 100 SAR *each*, which is 400 SAR for the four, at every till once it is activated.
The text on the bonus buy says one thing and the till charges another, and nothing on the screen shows
the difference.

The field already exists. SAP calls it `KPEIN` (the condition's pricing unit). It is stored on every
get-side condition, and the new engine already divides a price or amount by it. Only the maintenance
screen, its save request and its upload file cannot set it.

There is a quieter version of the same bug. A bonus buy that came from SAP with a pricing unit above 1
is shown correctly on the BBY Inquiry. If it is opened in the editor and saved, its pricing unit is
silently rewritten to 1, because the editor's read never carries it.

## Solution

Each Get line with a Discount Price or a Discount Amount gets a **Per** box, defaulting to 1, beside
its value. The line then reads `100 SAR / 4 EA`. The unit is always the line's own unit. Under the
line, a hint shows what the till will charge for the line's quantity (`= 100.00 SAR for 4 EA`), so a
mismatch between Per and the quantity is visible before Check. The hint never refuses anything. A
percent line and a Total Discount have no Per.

The editor's read returns the stored Per, so opening and saving a bonus buy keeps it. The bonus-buy
upload file takes an optional column 25 `PER`. A missing or blank value means 1.

## User Stories

1. As a pricing user, I want a Per box on a Discount Price get line, so that I can say "100 SAR for 4 EA" instead of "100 SAR each".
2. As a pricing user, I want a Per box on a Discount Amount get line, so that I can say "10 SAR off per 2 EA".
3. As a pricing user, I want Per to default to 1 on a new line, so that a simple per-unit price needs no extra typing and behaves exactly as today.
4. As a pricing user, I want the Per box absent on a Discount Percent line, so that I am never asked for a number the engine ignores.
5. As a pricing user, I want the Per box absent while Total Discount is on, so that the bundle total and a per-N rate are never confused.
6. As a pricing user, I want the Per box to follow a line's discount type as I change it, so that switching P → % hides it and % → P shows it again at its kept value or 1.
7. As a pricing user, I want the Per unit shown as the line's own unit (EA when the line names none), so that I never pick a second unit the engine would ignore.
8. As a pricing user, I want the Curr/Pe cell to read `SAR / 4 EA` when Per is above 1, so that the rate reads the way SAP shows it.
9. As a pricing user, I want the Curr/Pe cell unchanged (`SAR`, ex VAT on a price) when Per is 1, so that the common case stays uncluttered.
10. As a pricing user, I want a hint under each Discount Price line showing the total for the line's quantity (`= 100.00 SAR for 4 EA`), so that I can see what the till will charge before I Check.
11. As a pricing user, I want the same hint on a Discount Amount line (`= 100.00 SAR off for 4 EA`), so that a per-N discount is just as readable.
12. As a pricing user, I want the hint worded by scale type (Equal "for 4 EA", From "for 4 EA, then 25.00 SAR each", Up To "for up to 4 EA"), so that it never claims a fixed total where the reward scales.
13. As a pricing user, I want the hint to appear even when Per and the quantity do not divide evenly (Equal 4, Per 3 → 133.33), so that an odd rate is visible but not blocked.
14. As a pricing user, I want no hint while the value, the quantity or Per is blank or not a number, so that I never see a nonsense total.
15. As a pricing user, I want the server to refuse a Per that is zero, negative or fractional, with its own code and message, so that a bad rate never reaches a till.
16. As a pricing user, I want that refusal listed like every other Check/Save refusal (code, English, Arabic), so that it reads like the rest of the editor.
17. As a pricing user, I want an existing bonus buy to open with its stored Per, so that what I see is what the tills price.
18. As a pricing user, I want saving a bonus buy to keep each line's Per unless I change it, so that an SAP-sourced rate of 4 is never quietly reset to 1.
19. As a pricing user, I want a Per change to count as an unsaved edit, so that Mark Tested and leaving the page treat it like any other change.
20. As a pricing user, I want Per locked like every other input on a bonus buy that is not Planned, so that the status rules are unchanged.
21. As a pricing user, I want Per to work on a material grouping get line, so that "any 4 of these for 100" is possible.
22. As a pricing user, I want lines pasted from a material list to arrive with Per 1, so that pasting never invents a rate.
23. As a pricing user, I want to put Per in column 25 of the upload file, so that a promotion of many "N for X" bonus buys can be loaded in one go.
24. As a pricing user, I want a blank or missing column 25 to mean Per 1, so that every file that uploads today uploads unchanged.
25. As a pricing user, I want a file that uses column 25 to be allowed to leave columns 23 and 24 blank, so that I don't have to invent a score or loyalty tiers just to reach Per.
26. As a pricing user, I want a bad column-25 value refused with its row number, like every other upload refusal, so that I can fix the file.
27. As a pricing user, I want the upload dialog's note on OMS-only columns to name column 25 too, so that I know it exists and that SAP won't load a file that uses it.
28. As a tester, I want the simulator to price a Per-4 bonus buy at the per-4 rate, so that Mark Tested checks what the till will do. This needs no change, because the simulator runs the same engine.
29. As a marketing user, I want the BBY Inquiry detail to keep showing "per 4 EA" as it does today, so that both screens agree.
30. As a pricing user fixing OMS000002459, I want to take it Back to Planned, set Per 4, Mark Tested and Activate, so that it finally charges 100 SAR for the four.

## Implementation Decisions

**Wire (the seam both halves build to)**

- **D1 — `pricingUnit` on the get line.** The Get-panel line in the `BonusBuy/Save` and
  `BonusBuy/Validate` body, and in the `bonusBuy` a read returns, gains `pricingUnit: number`.
  - A missing field on save means 1, so an older client and every existing caller are unaffected.
  - A read always sends it: the stored value for a Discount Price or Discount Amount line, and 0 for
    a percent line or a line under Total Discount.
  - No unit field is added. The stored pricing-unit unit is always the line's own unit, defaulting to
    EA, so it is derived and never sent.
- **D2 — new refusal `BBY-PRICING-UNIT`.** It is returned for a `P`/`R` line, outside Total Discount,
  whose Per is not a whole number ≥ 1. Like every refusal it carries a code, English and Arabic. The
  client never pre-validates Per; a blank box goes up as 0 and the server refuses it, following the
  editor's existing "blank amount is 0" rule.

**Server (BackOffice maintenance layer only, ask BO-1)**

- **D3 — the builder writes Per.** For a per-line `P`/`R` it stores the line's Per as the condition's
  pricing unit, with the line's unit as the pricing-unit unit. `%` and Total Discount keep writing 0
  and a blank unit, exactly as today.
- **D4 — the read returns Per.** The editor's read maps the stored pricing unit into D1's field, which
  closes the silent rewrite to 1.
- **D5 — upload column 25 `PER`.** It is optional, and a blank or missing value means 1. The most
  columns allowed rises from 24 to 25. Columns 23 and 24 may be blank when 25 is present. A value
  that isn't a whole number ≥ 1 is refused per row. It applies to the row's get side under the same
  P/R rule as D3.
- **D6 — the new engine is not touched.** It already loads the condition's pricing unit and computes
  `value / Per × units rewarded` for `P` and `R`, where 0 means "the lines together". The legacy
  engine is out of scope.

**Web (oms-react, `features/pricing/bonus-buy-maintenance` + `core/models`)**

- **D7 — model.** The get-line wire type gains `pricingUnit`. The editor's get-line state gains `per`
  as the string the input holds, like every other amount. `fromDocument` reads it, using 1 when the
  read carries 0 on a P/R line. `toRequest` sends it as a number on P/R lines and 0 otherwise, and a
  blank goes up as 0 (D2).
- **D8 — layout.** Per joins the get reward columns (discount type, value, Per, Curr/Pe). It is shown
  only on a `P`/`R` line, and the Total Discount layout that already drops the reward columns drops
  it too. The box is a core/ui numeric input, so the control ratchet is not raised.
- **D9 — Curr/Pe.** The existing Curr/Pe helper takes Per and the line's unit and returns
  `SAR / 4 EA` when Per > 1, and today's result when Per is 1. A price keeps its ex-VAT mark.
- **D10 — the hint is a pure function.** It takes the discount type, value, Per, quantity, unit and
  scale type, and returns either nothing or a key plus formatted values.
  - The total is `value / Per × quantity`, rounded to two places for display.
  - Equal → `for`. From → `for, then each`, which also carries the per-unit rate `value / Per`.
    Up To → `for up to`.
  - The R variants say "off".
  - It returns nothing when any input is blank or not a number, or Per ≤ 0.
  - It decides nothing: no refusal, no colour change, no blocking.
- **D11 — i18n + bidi.** New keys sit in the `bonus-buy-maintenance` namespace: the Per column
  header, the per-unit Curr/Pe form, the hint sentences, the `BBY-PRICING-UNIT` refusal fallback and
  the updated `upload.omsColumns` note. Each amount and quantity in a hint is a machine value isolated
  through a `<Trans>` slot (bidi rule). The Curr/Pe `SAR / 4 EA` is formatted as one string and
  isolated once. There is no Arabic namespace for this screen, so the keys are en-only, like the rest
  of it.
- **D12 — paste and new lines.** Every line the editor creates (add line, paste materials, a
  generated coupon material line) starts at Per 1.
- **D13 — dirty tracking needs no new code.** `formChanged` compares the requests, so a Per edit marks
  the form dirty by construction.
- **D14 — no route, menu, store or namespace changes.** The BBY Inquiry detail and the simulator
  already render the stored pricing unit and need no change.

## Testing Decisions

- A good test drives external behaviour: state in, request or layout or text key out. It never pokes
  internals.
- **Pure tier (vitest, the primary seam).** These extend `editor.test.ts`, following its existing
  `describe` blocks (prior art: "curr/pe shows % for percent…", "editor state maps to the
  BonusBuy/Save request and back", "total discount swaps the reward columns…"):
  - The read → state → request round trip keeps Per 4. A read's 0 on a P/R line becomes 1. `%` and
    Total Discount send 0. A blank Per sends 0.
  - The layout shows Per only on P/R lines and never under Total Discount.
  - Curr/Pe at Per 1 vs Per > 1, with and without a unit.
  - The hint for each scale type × P/R, with the uneven cases (Equal 4 / Per 3 → 133.33, Equal 2 /
    Per 4 → 50.00), and nothing for blank, non-numeric or Per ≤ 0 inputs.
  - Paste and new lines start at Per 1. A Per edit makes `formChanged` true.
- **Upload tier (vitest).** `upload.test.ts` needs nothing new client-side: the file goes up as bytes
  and is never parsed. Only the note's key changes.
- **Flow tier (Playwright drive).** Extend `tools/bby-maintenance-drive.mjs` on stubbed envelopes:
  - Open a Planned bonus buy whose read carries `pricingUnit: 4` and see `SAR / 4 EA` and the hint.
  - Edit Per and check the Save body carries it.
  - Switch to `%` and see the box disappear.
  - Turn on Total Discount and see it disappear.
  - A stubbed `BBY-PRICING-UNIT` refusal is listed.
  - The upload note names column 25.
- **Server tier (BackOffice, BO-1's own tests).** The builder writes Per for P/R and 0 otherwise. The
  validator refuses 0, negative and fractional Per. The read round-trips it. Upload column 25 is
  parsed, a blank means 1, and a bad value is refused per row.
- **Live walk (its own ticket, after BO-1 deploys).** Fix OMS000002459 as story 30 describes and price
  four units in the simulator: expect 100.00 SAR for the four. Then price six units on a From-scale
  copy: expect 150.00.
- No RTL. This feature doesn't bootstrap it; the existing tiers cover it.

## Out of Scope

- Any change to the new engine (`Pricing.Core`), and anything to do with the legacy engine.
- An editable pricing-unit unit different from the line's unit, since the engine never reads it.
- Per on the buy side. SAP's pricing unit is a get-side condition field only.
- Per on a Total Discount. Its "lines together" meaning (pricing unit 0) stays as it is.
- Refusing or warning on a Per that doesn't divide the quantity (ruled: hint without refusing).
- Migrating existing bonus buys. OMS-saved ones carry 1, which is unchanged. OMS000002459 is fixed by
  hand through the normal Planned → Tested → Activated path.
- An Arabic namespace for Bonus Buy Maintenance.
- The campaign-upload workbook converter (ticket 531's SAP-file → workbook path).

## Further Notes

- **BO-1 = BackOffice 3181 (filed 2026-10-28):** the maintenance-layer half: D1–D5 on `BbyGetLine`, the container
  builder, the validator, the editor read and the upload file.
  Web half = oms 640–642. Until it ships, the web half runs on stubs.
- **Evidence (2026-10-28):**
  - The builder hard-codes pricing unit 1 for a per-line P/R and 0 under Total Discount.
  - The new engine's price and fixed-amount paths both divide by the condition's pricing unit,
    falling back to the line count at 0.
  - The engine takes get lines one per unit, so `value / Per × units` is the till's total.
  - The BBY Inquiry detail already renders "per N UoM" from the same column.
- **The upload's 25th column breaks SAP's file shape**, as columns 23 and 24 already do. The dialog's
  note says so.
