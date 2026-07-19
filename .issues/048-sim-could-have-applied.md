---
status: open
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

- [ ] a potential-but-unfired promotion appears in "Could have applied" with its found-vs-required meter · component (RTL, when runner lands)
- [ ] the would-save figure and reason render on expand · component (RTL, when runner lands)
- [ ] a run where every promotion fired shows no "Could have applied" section · component (RTL, when runner lands)

Runner not installed — verify via `npm run typecheck` + drive `npm run dev`: run a basket that
under-shoots a promotion's minimum against live `SIS.Api`, confirm it appears with the meter + reason.

## Boundaries

Folds in the **Potential Bonus Buys tab**. New `simulation` i18n keys (section title, meter labels,
reason templates). No endpoint change.

## Done when

Missed promotions render in a "Could have applied" section with the unmet-prerequisite meter + would-
save, and are absent when nothing was missed, verified in the running app; typecheck green.

## Blocked by

[047](047-sim-promo-blocks.md) — the section lives beneath the fired-promotion blocks.
