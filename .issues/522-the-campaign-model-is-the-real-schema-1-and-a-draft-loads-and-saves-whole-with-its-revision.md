---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md, § HQ contract: the rule builder (2758))
blocked-by: —
---

# 522 — The campaign model is the real schema 1, and a draft loads and saves whole with its revision

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17. 501–519
built on a per-resource REST shape the contract does not have. This is the **keystone**: every other re-point
ticket reads the model this one writes.

## What to build

Rewrite `src/core/models/rule-campaign.ts` to the brief's **campaign JSON (schema 1)** and re-point the draft
doors in `src/core/rules/api.ts`. Drop the `PROVISIONAL` marks on what this ticket covers.

**The model, as invented (left) vs the contract (right):**

| Invented | Real |
|---|---|
| `schedule { from, until, days: number[], hoursFrom, hoursTo }` | `window { from, until (exclusive), days: [sun..sat], hours { from, until } }`; hours **may cross midnight** (509 refused that, so lift the refusal) |
| `offlineOptOut` | `onlineOnly` |
| `budgets[].name: string`, `period` incl. `year` | `name {en, ar}`; period `lifetime\|day\|week\|month`, **no `year`** (510's question answered: drop it) |
| filter `{ cats, colls, skus, exclCats, scope }` | `{ id, name, categories, articles, exclude { categories } }`. A collection pick writes its lookup's `articles` into the filter. `scope` moves onto `discountItems` / `discountSession` effects |
| value `{ id, name, formula: string }` | `{ name, expr }`, the operator-first JSON expression (`["round", ["*", "$eligible", 0.10], 0, "halfUp"]`) |
| `when { mode, items: [{ id, type, says, … }] }` | conditions keyed by `check`, effects by `effect` (no `type`); a nested group is a catalogue block, not `RULE_GROUP_TYPE` |
| `bundle` via `itemParts` fields | `rule.bundle { lists: [{ filter, count }], sameAttribute?, max? }` |
| `description`, `tags`, `code` minted by HQ | none: the **author picks `id`** (at most 40 of `A-Z a-z 0-9 . _ -`). So 502's "HQ mints the code" ruling is void: Create asks for the id, and must refuse the static leaves (`priority`, `simulator`, `sessions`, `coupon-finder`, `customers`) |
| `status: draft\|waitingForApproval\|live\|disabled` | from `Drafts/Load` / `List`: `state: editing\|pending\|sentBack` + `campaignStatus: Published\|Disabled\|""` + `publishedVersionNo`. Rewrite `core/rules/campaign-state.ts` over those |
| `valueMap` absent | `valueMap { means, unit, entries }` (+ `ValueMaps/Upload`: ticket 523) |

**The doors (all POST):**

- `Rules/Authoring/Drafts/Load { campaign }` replaces `get(id)`. With no draft it answers the newest
  version, `revision 0`. 404 `RULES_DRAFT_NOT_FOUND`.
- `Rules/Authoring/Drafts/Save { campaign, features, revision, tree? }` replaces `saveDraft` **and every
  `Settings/*` PUT** (Details, Schedule, Audience, Features, Offline, Budgets). A settings page edits the
  loaded draft and saves the whole thing at its revision. **409 `RULES_DRAFT_STALE`**: say so and offer to
  reload. **409 `RULES_DRAFT_PENDING`**: the draft is frozen while it waits.
- `Rules/Authoring/Drafts/Delete { campaign, revision }` replaces `remove(id)`.
- Create (502) becomes a first `Drafts/Save` at `revision 0` with the chosen id. There is no create door.

## Spine reach

model (rewrite) · logic (campaign-state, sentence, filters, schedule, budget over the new shape) · api (draft
doors) · component (every builder and settings reader the compiler names) · test

## Proof (→ `tdd` red-green cycles)

- [ ] the pure suites in `core/rules/*.test.ts` and `features/campaigns/workspace/*.test.ts` re-written over
      schema 1 and green · pure
- [ ] `campaignState_readsStateAndCampaignStatus`: editing / pending / sentBack × Published / Disabled /
      never published · pure
- [ ] `tools/campaigns-fixtures.mjs` re-cut to real `Drafts/Load` replies (use 2734's five real campaigns
      from BackOffice `.scratch/proto/2734-rule-builder/`); `campaigns-drive` green stubbed · flow
- [ ] a stale save shows the reload offer (stubbed 409) · flow

## Boundaries

No lifecycle, simulate, coupons or support doors (523–528). ⚠ The ƒx helper (507) writes a text formula
today and the contract stores a JSON expression. Either the helper builds the array, or it keeps a text form
that a pure parser turns into the array. **Grill this before building**: it is the riskiest piece of the wave.

## Done when

No reader uses the invented campaign shape, a draft saves whole at its revision, and the drives are green
stubbed against real-shaped replies.

## Comments

### 2026-10-18: AFK session 1, partial, still open

**Done and green.** Typecheck is clean, vitest passes (339 files, 5585 tests) and all four lint gates are clean.

- **Model.** `core/models/rule-campaign.ts` is schema 1: `RuleCampaign` (`window` / `audience` / `budgets {name: {en, ar}}` / `onlineOnly` / `valueMap` / `rules`), rules with `filters`, `values {name, expr}`, `bundle`, `when[]` keyed by `check` and `then[]` keyed by `effect`. Alongside it are `RuleDraft` (the Drafts/Load reply), `RuleDraftSave`, `RuleDraftSummary`, `RuleValidation` / `RuleIssue` / `RuleOfflineVerdict` and the 2759 `RuleEvaluationTree`.
- **Doors and removals.** `core/rules/api.ts`: `load` / `save` / `deleteDraft` call `Rules/Authoring/Drafts/Load|Save|Delete`. These are removed: `get`, `create`, `saveDraft`, every `Settings/*` PUT, `remove`, `checkFormula` (Formula/Check), `validate` and `offlineVerdict`, with their queries and model types.
- **Logic.** `core/rules/campaign-state.ts` reads `state` + `campaignStatus` + the window, and `setAt` reads the never-set time. `core/rules/expr.ts` is the ƒx codec. `sentence`, `filters`, `schedule` (hours may cross midnight) and `budget` (no `year`) are rewritten over schema 1, all with vitest.
- **Builder.** Block keys are client-only Symbols. Checks point by `path` from `draft.validation`, and the ƒx text box goes through the codec. There is a bundle editor, a collection pick writes `articles`, and Save sends the whole draft at its revision, with the stale / pending banner.
- **Settings.** Details, Schedule, Audience, Features, Offline and Budgets each save the whole draft at its revision, with the same stale / pending handling.
- **Other screens.** The dashboard and approval panel read `state` / `campaignStatus` / `requested*` / `reviewed*` / `publishedVersionNo`. Delete draft calls `Drafts/Delete`. Create asks for the id (suggested from the English name, at most 40 of `A-Z a-z 0-9 . _ -`, the static leaves refused) and sends a first `Drafts/Save` at revision 0. The list, versions, coupons and priority read the new shapes; their doors are still the invented ones that 523–526 own.
- **Fixtures.** `tools/campaigns-fixtures.mjs` is re-cut: the 16 campaigns are Drafts/Load replies around schema-1 campaigns, based on the 2734 prototype and five-2702.json. It stubs the three draft doors with `RULES_DRAFT_STALE` / `RULES_DRAFT_PENDING` / `RULES_BAD_CAMPAIGN_CODE`.

**Remaining. The ticket stays open until all of it is done.**

1. **`tools/campaigns-drive.mjs`.** It was re-stubbed on the real draft doors and passes sections 1–46 (501–506, the features palette, 502 with the new id flow, and 507's codec and issue-at-path checks). It stops at 47: on WLCB's award the value picker `[data-panel-value-source="amount"]` stays disabled after a value is renamed to `cashback`. That is not diagnosed yet. The sections after it have never run against the new UI:
   - the rest of 507, then 508–512, 515 and 516;
   - the new 78b / 78c stale-save sections (Settings and the builder);
   - the Offline-from-`validation.offline` section.
   
   The drive's assumptions still to verify are listed in the fork-C notes in the session log: `[data-settings-day="thu"]`, the budget drawer's `nameEn`, `[data-settings-problem="hoursSame"]` and the 507 value-row selectors. Section 32 now refuses with `RULES_BAD_REQUEST`, because a `RULES_DRAFT_PENDING` refusal shows the client's own wording. That means the pending wording itself is not yet asserted.
2. **Drives outside the campaigns drive.** `tools/priority-drive.mjs`, `tools/simulator-drive.mjs` and `tools/simulator-fixtures.mjs` still read the old campaign shape (`c.id`, `features.points`, the GET campaign door, `c.rules`). Re-cut them to the new fixtures.
3. **Assertions dropped in the drive**, each with its reason:
   - "created by" became "last saved by" (the draft has no created stamp).
   - The amount wording on `discountItems` (2758's `kind` takes `percent` only).
   - 507's check-door assertions 44, 46, 49 and 51 (no Formula/Check door).
   - 508's order by code and its refused-checks case 60 (issues carry no code, and the checks come with the draft).
   - 509's description (none in schema 1).
   - 74, "hours ending before they start": now allowed, so `hoursSame` is asserted instead.
   - 78's refused verdict (no door).
   - 94 / 95: the version-1 prompt and "activated by".
4. **Reviews.** Run the review step (/code-review, then /standards-review) on the finished slice, then tick the Proof boxes and close the ticket.
5. **Known loose ends.**
   - `ChecksPill` is still wired with a never-failing source, so its retry branch is dead.
   - Issues read "gone" after a background re-read while edits are unsaved, until the next save.
   - A new filter's id is a UUID (`mintRequestId`).

**BO ask (log only):** none new. Ask A (a list door) still stands for 524.
