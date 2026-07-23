---
status: done
spec: 043
blocked-by: 047
---

# 048 — aMissedPromotionShowsWhyItDidNotFire

## What to build

A **"Could have applied"** section under the fired-promotion blocks surfaces the near-misses — the
promotions that could apply but did not — so a user diagnoses an absent offer without hunting through a
separate tab. Driven by `promoView(result).missed`, each entry shows:

- the promotion in plain language with its kind chip;
- the driving **unmet prerequisite** as a found-vs-required meter (found qty/value vs required
  qty / min value) — the data `potentialBonusBuys[].prerequisites[]` + `isMet` already carries;
- the **would-save** figure — the discount it would have granted had the prerequisite been met;
- a short plain-language reason ("basket has 50.00 of the 100.00 minimum").

Collapsed by default, expandable to the meter + reason, mirroring the sketch's treatment.

## Spine reach

component ("Could have applied" section) · i18n (`simulation` keys) · test (app-drive)

## Proof (→ `tdd` red-green cycles)

- [x] a potential-but-unfired promotion appears in "Could have applied" with its found-vs-required meter · component (RTL, when runner lands)
- [x] the would-save figure and reason render on expand · component (RTL, when runner lands)
- [x] a run where every promotion fired shows no "Could have applied" section · component (RTL, when runner lands)

Runner not installed — verified via `npm run typecheck` + `npm run build` (both green) + a Playwright
drive of the real `SimMissedPromotions` against fabricated `promoView().missed` shapes (a scratch Vite
entry, since the live SIS.Api's 044 projection is unlanded), mirroring ticket 047. 13 assertions
passed: section title + near-miss count, collapsed-by-default, the would-save figure, the value-based
found-vs-required meter (progressbar + `50.00 of 100.00` + reason "basket has 50.00 of the 100.00
minimum"), the qty-based variant ("1 of 3" / material subject), the skip-reason path (no meter), and
the section absent entirely when nothing was missed. Harness kept in the session scratchpad, not
committed.

## Boundaries

Folds in the **Potential Bonus Buys tab**. New `simulation` i18n keys (section title, meter labels,
reason templates). No endpoint change.

## Done when

Missed promotions render in a "Could have applied" section with the unmet-prerequisite meter + would-
save, and are absent when nothing was missed, verified in the running app; typecheck green.

## Blocked by

[047](047-sim-promo-blocks.md) — the section lives beneath the fired-promotion blocks.

## Comments

- **Potential Bonus Buys tab folded in.** `SimBonusBuyPanel` was the tabbed potential+prerequisites+
  elements panel; its Potential Bonus Buys + Prerequisites grids (and their `buildPotentialBonusColumns`
  /`buildPrereqColumns` builders + `bonus.potential.*`/`bonus.prereq.*` i18n keys) are removed, folded
  into the new "Could have applied" section. The panel is now the Pricing Elements trace alone (the
  spec's "Advanced layer"; ticket 049 moves it into the block disclosure).
- **Would-save reads on the collapsed row, not gated behind expand.** The Proof says "the would-save
  figure and reason render on expand"; it renders in the always-visible collapsed header so a user
  scans near-misses by potential savings without opening each — and it is still visible on expand (the
  header stays). The meter + reason are what expand reveals. A deliberate UX improvement over the literal
  wording; standards + spec review both flagged it as better, not a defect.
- **Meter dimension.** When a prerequisite carries a minimum *value* it shows the value meter (money),
  else the *quantity* meter; a prereq with neither (a pure accumulation block) shows no bar and reads
  the server `skipReason`. Spec 043 allows either dimension. The divide-by-zero on a zero target is
  guarded (`hasTarget`).
