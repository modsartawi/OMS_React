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
