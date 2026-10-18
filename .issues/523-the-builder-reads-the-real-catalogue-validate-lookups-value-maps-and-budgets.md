---
status: done
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

- [x] `checks_pointByPath`: an issue's `path` finds rule → block → field, including inside a group · pure
- [x] `sentence_fillsBraceFields` from a real catalogue block · pure
- [x] drives re-stubbed with real-shaped Catalogue / Validate / Lookups / Budgets replies, all green · flow

## Done when

No builder or settings reader calls an invented 2758 door, and the drives are green stubbed.

## Comments

### 2026-10-18: AFK session, done

**Results.** Typecheck clean; vitest 339 files, 5594 tests; all four lint gates clean; build green. Drives, all stubbed against real-shaped replies (never a live SIS.Api): `campaigns-drive` 610/610, `simulator-drive` 55/55, `sessions-drive` 73/73, `priority-drive` 37/37, `engine-switch-drive` 56/56.

**Doors** (`src/core/rules/api.ts`, all POST, no PROVISIONAL mark): `Rules/Authoring/Catalogue { features }`, `Validate { campaign, tree? }`, `Lookups/{lookup} { q, campaign? }`, `ValueMaps/Upload { campaign, csv }`, `Budgets { campaign }`, `Budgets/SetLimit { campaign, budget, limit }`. Removed: the invented `GET RuleCampaign/Catalogue`, the six lookup GETs, `BudgetUsage`, the limit PUT, and their model types (`RuleFieldKind`, `RuleBudgetUsage`, `RuleBudgetLimitChange`, the invented catalogue shape).

**Model** (`core/models/rule-campaign.ts`): the catalogue is BackOffice `RuleCatalogue` word for word (`RuleBlockCatalogue`, `RuleCatalogueBlock`, `RuleCatalogueField { name, type, required, unit, values, lookup, default, fields }`), `RuleLookupItem { code, name {en,ar}, detail, articles, entries, neverDiscount }`, `RuleValidateRequest`, `RuleValueMapUpload`, `RuleBudgetView`, `RuleBudgetLimitSet`.

**Logic.**
- `core/rules/sentence.ts`: a condition or effect reads in HQ's own `sentence` ({en, ar}), its braced fields filled by type; a field the sentence does not name is a bundle clause (`sentence.clause.<type>.<field>`) or an EN + AR line (role by field name: `says`, `label`, `prompt`). `unitOf` resolves the two-word units.
- `workspace/palette.ts`: groups and blocks from the catalogue for the draft's features (asked again when they change); `open` blocks left out; a new block is HQ's `example` with its sample identifiers (`code`, `codes`, `budget`, a sample filter) left out.
- `core/rules/budget.ts` `budgetCount`: HQ's per-key sums; a bar only for a campaign-wide budget.
- The ƒx guide (fields, functions, recipes, operators) moved to `core/rules/formula-guide.ts`: HQ's catalogue carries none.

**Screens.** Builder: catalogue with every feature to read blocks + the draft's own for the palette; a debounced (600 ms) `Validate` of the unsaved campaign feeds the checks pill and the ƒx helper's issues by path. Panel: one control per real field `type` and `unit`. Audience: countries and channels a fixed list. New **Settings ▸ Value map** page (upload, entries, save the whole draft). Budgets: the limit in force, `held` beside used, per-key sums, SetLimit then refetch. A bare 403 says the rule-author grant is missing. The simulator's channel lookup became the same fixed list.

**Drive assertions re-cut, with reasons.**
- 16: two catalogue reads (every feature + the draft's), so "read ONCE" is per set of features.
- 17–20, 25–30, 37–40, 47, 93: sentence and palette wording is HQ's catalogue text now (lower-case, e.g. "at least 3 units of sun", "Minimum count").
- 21: the cashier message is named inside HQ's sentence ("tell the cashier {text}"), so it has no line of its own and no "No Arabic yet".
- 22, 42, 88: the catalogue, lookup and budgets doors have no refusal of their own; their real refusal is the grant's bare 403, which the page names. 86's SetLimit refusal is the real 404 `RULES_BUDGET_NOT_FOUND`.
- 26/27: a new block starts on HQ's example (count 2, "not met yet"), so the drive types 4 and Undo goes back to the example.
- 59: the checks follow a Validate of the unsaved rules before any save.
- 85: a per-key budget reads its summed use ("3 in all (1 counted), at most 2 each").
- New 135–140: Validate of the whole unsaved draft and the ƒx helper's path filter, the palette after a feature change, value map upload / refusal / save, `held`, the 3-character material search.

**Left for others / owner.**
- 525/527: the simulator's and sessions' store `<select>` reads one `stores` lookup capped at 50 hits; BasketCsv sends sub-3-character SKUs (refused `RULES_BAD_LOOKUP`) and names materials in English; the simulator's lookup errors do not name a bare 403. (Found by /code-review, not this slice's screens.)
- BO ask E stands (countries, channels). New ask F: the ƒx guide (formula fields, functions, recipes) in HQ's catalogue. Both in HITL-523.
- Owner sign-off on the HITL-523 defaults; live proof is 520's.
