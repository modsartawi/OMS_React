---
status: open
spec: BO 2737 (brief § HQ contract: approval, versions, order, copy and templates (2759))
blocked-by: 522
---

# 524 — The list, dashboard, versions, priority, copy and templates call the 2759 doors

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17.

## What to build

Re-point 501–503 and 511–513 (all POST):

- **Approval (511):** `Approvals/Request { campaign, revision, note }` with the **note required**, so the
  ask needs a note box that cannot be left empty. Then `Approvals/Activate { campaign, revision, note? }`,
  `Approvals/SendBack { …, note }` and `Approvals/Disable { campaign, note }`. Surface `RULES_SELF_APPROVAL`
  (403), `RULES_NOT_PENDING`, `RULES_ORDER_STALE` and `RULES_NOT_LIVE` by code. `Approvals/List` answers `{
  draft, live }`, which gives the approver the live snapshot 511 asked for. Show it. `Approvals/History` is
  the dashboard's trail.
- **Versions (512):** `Versions/List { campaign }`, `Versions/Load { versionNo, campaign }` (answers `{
  version, ruleset, campaign }`) and `Versions/Restore { campaign, versionNo, revision }`. **There is still
  no `draftChanged` flag**, so 512's "a live campaign's Restore always asks" default stands. A `Drafts/Load`
  with `source: published` means no draft exists, so Restore need not ask then.
- **Priority (513):** `Rules/Authoring/Order` (POST, no body) answers `{ versionNo, tree: { groups, order },
  campaigns }`. **There is no order save**: the edited `tree` goes out with a draft's `Drafts/Save`. Priority
  therefore needs a draft to carry it. Grill this before building. The contract answers 513's overwrite
  question: Activate refuses with `RULES_ORDER_STALE`. Groups are `mode: stackable|first|highest, scope:
  session|item`.
- **Copy (502):** `Drafts/Copy { from, campaign, name? }`. The author picks the new id, as in 522.
- **Templates (503):** `Templates/List` answers `placeholders: [{ name, label {en,ar}, path, default }]`, and
  `Drafts/FromTemplate { template, campaign, name?, values }` creates the draft. That answers 503's
  placeholder question: labels are `{en, ar}`, and a value is JSON at a path. The `{{key}}` text fill goes.
  There is **no "disabled template"** in the contract, so 503's disabled card goes.
- **List (501):** ⚠ **no list door**. The list has to be built from `Drafts/List` (drafts with `state`),
  `Order.campaigns` (live), and the live ruleset's windows from `Versions/Load` for scheduled / running /
  expired. A disabled campaign that has no draft is in **none** of these, so this needs BO ask **A** (see
  520). Build the composition behind one `ruleCampaignApi.list()` either way, so the BO door slots in later.

## Spine reach

api · logic (list composition, approval states from `state`/`campaignStatus`) · component (list, dashboard,
approval panel, versions, priority, create/copy/template dialogs) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `campaignList_composesDraftsLiveAndWindows` (and a disabled-without-draft case, held open on ask A) · pure
- [ ] `approval_branchesOnRefusalCode` for the five codes · pure
- [ ] campaigns drive re-stubbed with real-shaped 2759 replies, green · flow

## Done when

No 501–503 / 511–513 reader calls an invented door, and the drives are green stubbed.
