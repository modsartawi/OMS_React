---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 615 — The insurance team reads metrics per rule, store and pharmacist, sees flagged rules, and ranks payer rejections

## What to build

**Metrics** per rule, store, pharmacist and day (labelled "estimate" on SAR protected); **flags** with their
reason; the **rejection report** by code, payer and same kind, ranked by SAR, marking where a live guard exists.

**HQ contract:** the brief's sections for BackOffice 3141. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [x] drive (stubbed) — `tools/insurance-metrics-drive.mjs` 100/100 STUBBED (LTR + RTL)

## Boundaries

Charts per the repo's existing chart choice. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Comments

**2026-10-27 — built on `impl/3126-615`.** `/insurance-rules/metrics` (`src/features/insurance-rules/metrics/`), three
tabs on one local window (`?tab&by&from&to&payer`, last 30 local days by default): Metrics per rule / store /
pharmacist / day (tiles, fires bar by severity, outcome mix, override rate, SAR protected labelled "estimate",
rejections after a pass, median time added; per day a hand-rolled SVG chart, the app has no chart library), Flags
(noisy / silent / jump with the numbers behind each, thresholds from `Settings/Flags`), Rejections (ranked by SAR,
live-guard mark, totals with the SAR no live guard covers, payer filter). Proof: `model.test.ts`, `query.test.ts`,
`i18n-keys.test.ts` (en/ar mirror); drive `tools/insurance-metrics-drive.mjs` 100/100 STUBBED (LTR + RTL). Typecheck,
lint, vitest green. Stubs: section `// --- 615 ---` in `tools/insurance-rules-stubs.mjs` (`insuranceMetricsStub`).

**Guesses where the brief is silent (618 reconciles):**
- Metrics row: `{ key, name: {en,ar}|null, fires: { refuse, override, warn }, shadowFires, outcomes: { removed, changed,
  overridden, acknowledged, exception }, overrideRate (0–1 of OVERRIDE fires)|null, sarProtectedEstimate,
  rejectionsAfterPass, timeAddedMedianMs|null }`. `key` = rule id / store code / pharmacist id / local day.
- `by=day` added (story 31); the brief spells only `rule|store|pharmacist`.
- Flag row: `{ ruleId, name, kind, since, fires, overridden, previousAverage|null, lastFired|null }`; flag settings
  `{ noisyOverrideRate, noisyMinFires, windowDays, silentDays, jumpFactor }`. Settings are read-only here (no PUT
  screen built; the brief's `PUT …/Settings/Flags` is left for a later ticket).
- Rejection row taken literally from the brief, with `code` and `words` as two nullable fields.
- Window cap 366 days (brief names none); the Flags tab is not windowed (the flag job keeps its own).
- No access probe; a bare 403 on any read shows "You do not have access".


**2026-10-27 — 3126 review (P5).** The Flags tab now edits the thresholds: "Edit the thresholds" → a form (noisy rate
as a whole percent, counts / days whole from 1, jump factor above 1, `metrics/flag-settings.ts` + its test) → `PUT
InsuranceRules/Settings/Flags` with the whole settings (GUESS: answered with the settings as saved). Stub + drive
step 6b. **Owner ruling needed:** 615 draws its own `metrics/DayChart.tsx` beside the OMS
`features/oms/delivery-statistics/SeriesChart.tsx` (a feature may not import another; the OMS chart was not moved to
core). Rule whether to lift one shared chart to core or keep both.
