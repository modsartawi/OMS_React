---
status: open
spec: BO 2737 (brief § HQ contract: the rule builder (2758))
blocked-by: 522
---

# 523 — The builder reads the real catalogue, Validate, lookups, value maps and budgets

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17.

## What to build

Re-point the rest of 2758's doors in `src/core/rules/api.ts` (every one is POST):

- **`Rules/Authoring/Catalogue { features }`** replaces `GET RuleCampaign/Catalogue`. A block is `{ kind,
  type, group, name {en,ar}, sentence {en,ar}, feature, offline, open, path, fields, example }`, and the
  sentence names its fields in braces. A block of a feature the campaign lacks is **not listed**, so 505's
  ruling (leave such blocks out of the palette) now matches the server. Ask the catalogue again when the
  features change. `example` gives a new block its defaults, which answers 504/505's open question.
- **`Rules/Authoring/Validate { campaign, tree? }`** replaces `GET …/Validate`, `GET …/OfflineVerdict` **and**
  `POST RuleCampaign/Formula/Check`. An issue is `{ severity, rule, ruleId, block, index, field, where,
  message, path }`. The checks pill (508) points by `path`, Offline (509) reads `offline { safe, onlineOnly,
  reasons: [{code, en, ar}] }`, which is null while errors stand, and the ƒx helper (507) shows Validate's
  issues on the value's path. **There is no per-formula check door**: the helper validates the whole draft
  (debounced) and filters the issues to its path.
- **`Rules/Authoring/Lookups/{lookup} { q, campaign? }`** replaces the six GETs. The kinds are `categories`,
  `collections`, `materials` (q ≥ 3, else `RULES_BAD_LOOKUP`), `stores`, `audiences`, `valueMaps` and
  `budgets`. **There are no `countries` or `channels` lookups**: Audience (509) keeps a fixed list for those.
  Ask BO, or check the catalogue's `campaign.audience` field `values`.
- **`Rules/Authoring/ValueMaps/Upload { campaign, csv }`**: new. It answers the campaign with its map
  replaced, which the builder then saves as the draft.
- **`Rules/Authoring/Budgets { campaign? }`** replaces `BudgetUsage`. A row is `{ …, declared, limitValue,
  periodKey, used, held, overshoot, counters }`. `held` is new, so show it beside used.
- **`Rules/Authoring/Budgets/SetLimit { campaign, budget, limit }`** replaces the PUT. It answers `{
  limitValue, previousLimit, countersAbove }` and not the campaign, so refetch the budgets. 404
  `RULES_BUDGET_NOT_FOUND`.

## Spine reach

api · logic (checks by `path`, catalogue-driven palette/sentence) · component (palette, panel, checks pill,
ƒx, offline, budgets drawer) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `checks_pointByPath`: an issue's `path` finds rule → block → field, including inside a group · pure
- [ ] `sentence_fillsBraceFields` from a real catalogue block · pure
- [ ] drives re-stubbed with real-shaped Catalogue / Validate / Lookups / Budgets replies, all green · flow

## Done when

No builder or settings reader calls an invented 2758 door, and the drives are green stubbed.
