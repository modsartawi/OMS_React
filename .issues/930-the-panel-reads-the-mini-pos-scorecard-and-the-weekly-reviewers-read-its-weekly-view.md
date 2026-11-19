---
status: done
spec: BO 4063 (E:\Projects\BackOffice\.issues\4063-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4075
---

# 930 — The panel reads the Mini POS scorecard, and the weekly reviewers read its weekly view

## What to build

An OMS report over the 4075 endpoint:
- **The money test:** trial and control pharmacies side by side, the uplift, and the payback ratio against the
  1.2× bar, using the promoter cost the panel enters.
- **The supporting measures.**
- **The weekly view:** compliance-stop lines, and pharmacies under 50% paid for two weeks running.

Behind a report grant.

## Spine reach

UI → BackOffice SIS.Api (4075)

## Proof (→ `tdd` red-green cycles)

- [x] Component: the ratio coloured against 1.0× and 1.2×; the settling-in week shown as excluded · vitest
- [ ] Live walk against a SIS.Api with 4075 — **owed** (component tests only, see Comments)

## Boundaries

—

## Done when

The report renders the 4075 data correctly and its component tests are green.

## Blocked by

BO [4075](E:\Projects\BackOffice\.issues\4075-the-scorecard-computes-uplift-payback-and-the-supporting-measures-for-trial-against-contro.md)

## Comments

**2026-11-20, implementer (branch `t930`, worktree `E:\Projects\OMS_React-t930`)**, on `spec/4032-mini-pos`. Built
against the response contract in the `## Answer` of BackOffice 4075 (branch `spec4032`, read only). SIS.Api was not run.

- **Where.** `src/features/mini-pos/scorecard/` (page, `api.ts`, pure `scorecard.ts`, `ScorecardViews.tsx`, `access.ts`),
  wire shapes in `src/core/models/mini-pos-scorecard.ts`, namespace `mini-pos-scorecard` (en + ar). Route
  `/mini-pos/scorecard`, a fourth leaf in the Mini POS menu group on its own key `MiniPosScorecard:03` (added to
  `SCREEN_KEYS`); `MiniPosAdmin:03` alone does not open it. A blank date or offset is not sent, so SIS.Api's configured
  trial calendar answers.
- **Money test.** Trial and control side by side (sales, last year's, growth), the uplift in percentage points, sales from
  the uplift, trial margin rate, gross margin on the uplift, every pharmacy's own row. The payback ratio is coloured by
  `ratioBand`: >= 1.2 go (success), >= 1.0 the panel's (attention), below no-go (danger), on a meter with both bars
  marked; the verdict (go / panel / no-go / no-cost / no-base) is the server's, in words. The page states money is SAR
  net of VAT and cost is today's master cost.
- **Owner ruling 2026-11-20 (prorated cost).** The ratio's cost is labelled "Cost for the counted days (prorated)" with
  "Full cost entered" beside it. ⚠ The prorated figure is **not in the 4075 contract yet**: the page reads
  `inputs.countedPromoterCost` (and `inputs.countedDays` / `inputs.trialDays` for the "47/54 days" note), shows "Not sent
  by SIS.Api" while it is absent, and never computes it itself. The BackOffice fix pass must send those field names (or
  this model follows whatever it sends).
- **Settling-in.** `TrialWindow` shows the trial, the settling-in week struck through with "Excluded from the uplift",
  the counted window and last year's; none when `settlingInEnd` is null/blank/before the trial.
- **Weekly view.** Off-list MPOS lines: an alert "Compliance stop … stop everywhere" and every line highlighted, grouped by
  trial week (from `trxDate`, week 1 = `trialFrom`..+6); empty list = all-clear. Paid share: pharmacy x week grid, under
  half flagged (attention), pause flagged (danger), the pharmacies to pause named above it.
- **Supporting measures.** Per planned promoter hour (totals + per promoter/store), paid share, hold-to-billed (median /
  mean), refusals by reason and stage, resubmits, entry modes (typed share and median read flagged against the M16
  scanner triggers), serial fallbacks, return rate Mini POS vs ordinary.
- **Refusal.** `MINIPOS_SCORECARD_INVALID` shows its own title with the server's sentence; a bare 403 names the grant.
- **Tests.** `scorecard.test.ts` (31) + `i18n-keys.test.ts` + the menu test (four leaves; the scorecard alone for
  `MiniPosScorecard:03`). Mutation-checked red: `>` at 1.2x, settling-in never shown, pause not flagged. Whole suite
  833 files / 11293 tests green. Typecheck clean. Lint: grid-base, contrast, palette, controls, map-build OK; boundaries
  fails only on the 4 known insurance-rules violations.

**Owed / for the owner:**
1. **Live walk** against a SIS.Api with 4075 (and the grant seed applied). No stubbed drive was written.
2. **The prorated cost fields** (`countedPromoterCost`, `countedDays`, `trialDays`) from the BackOffice review fix pass.
