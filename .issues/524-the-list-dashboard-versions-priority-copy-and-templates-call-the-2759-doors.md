---
status: done
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

- [x] `campaignList_composesDraftsLiveAndWindows` (and a disabled-without-draft case, held open on ask A) · pure
- [x] `approval_branchesOnRefusalCode` for the five codes · pure
- [x] campaigns drive re-stubbed with real-shaped 2759 replies, green · flow

## Done when

No 501–503 / 511–513 reader calls an invented door, and the drives are green stubbed.

## Comments

### 2026-10-18: AFK, done

**Results.**
- Typecheck is clean.
- Vitest passes: 340 files, 5616 tests.
- All four lint gates are clean, and the build is green.
- Drives, all stubbed against real-shaped 2759 replies, never a live SIS.Api:
  - `campaigns-drive` 625/625
  - `priority-drive` 50/50
  - `simulator-drive` 55/55
  - `sessions-drive` 73/73

**What moved.** Every reader below now calls a real 2759 door. The invented `RuleCampaign/Campaigns` list, `/Copy`, `/Templates`, `/Roles`, `/{id}/AskForApproval|Activate|SendBack|Disable`, `/Versions/*` and `RuleCampaign/Order` GET + PUT are gone, with their model types.
- **List (501).** `ruleCampaignApi.list()` composes `Drafts/List` + `Order` + `Versions/Load { versionNo }` through the pure `core/rules/campaign-list.ts`.
  - A draft over a campaign published once and absent from the order reads Disabled.
- **Approval (511).**
  - `Approvals/Request` sends `{ campaign, revision, note }` with the note required.
  - `Activate` / `SendBack` take `{ campaign, revision, note }`; `Disable` takes `{ campaign, note }`, note required.
  - Refusals are said by code (`approval.ts` `approvalRefusal`), with Reload / Send back offers.
  - `Approvals/List` puts the live campaign beside a pending draft. `Approvals/History` is the dashboard's trail.
  - With no roles door, the acts follow the state.
- **Versions (512).** `Versions/List | Load | Restore` at the draft's revision, or 0.
  - With no draft, Restore runs at once.
  - A disable is listed as a version with nothing to read.
  - The version's note is the author's request note.
- **Priority (513).** The live `Order` tree (`groups[].campaigns`, `order[]`, names `{en, ar}`). Save rides an editing draft's `Drafts/Save` with `tree` (`CarrierDialog`), says the order goes live at that draft's activation, and keeps showing the saved order.
- **Copy (502).** `Drafts/Copy { from, campaign, name }` from a dialog where the author picks the id. The id rules moved to `core/rules/campaign-id.ts`.
- **Templates (503).** `Templates/List` placeholders `{ name, label {en, ar}, path, default }`. `Drafts/FromTemplate { template, campaign, name, values }` sends JSON by placeholder name.
  - The `{{key}}` fill, the bounds, the name preview and the disabled card are gone.

**Fixtures.** `tools/campaigns-fixtures.mjs` serves the 2759 doors: `draftsList`, `orderOf` + `TREE`, `rulesetOf`, `copyDraft`, `TEMPLATES` + `fromTemplate`, `approval` + `approvalsList` + `HISTORY`, and `versionsOf` / `loadVersion` / `restoreVersion`. A live copy is kept per context under a Symbol, never on the wire. SUMMER-FLASH (disabled) now has a draft: without one it could not be listed or loaded.

**Drive assertions re-cut, with reasons.**
- **14.** Copy asks for the id and names. "<name> (copy)" was HQ-minted, and the author now types it.
- **100–105.**
  - No draft-template mark (2759 has none).
  - No bounds hint or out-of-bounds refusal (placeholders carry no bounds; HQ refuses with `RULES_BAD_TEMPLATE`).
  - No name preview, and the "not met" message and label are not filled: the `{{key}}` fill goes, and texts stay as the template wrote them.
  - A refused templates door is a bare 403.
- **63–68.**
  - The author is offered Activate / Send back on a pending draft (no roles door).
  - 67's refusal is the real `RULES_SELF_APPROVAL` for the author who asked, replacing an injected `RULE_CAMPAIGN_SELF_APPROVAL`.
  - Disable needs a note.
  - After a disable with no draft, the list no longer counts the campaign (BO ask A). It was "disabled 2".
- **70.** The refused-roles section is deleted with the Roles door. It is replaced by `RULES_ORDER_STALE` → Send back, and by a bare 403 that names the approver grant.
- **94.** No ask with no draft (the ticket).
- **96.** The refusal is `RULES_VERSION_NOT_FOUND`, not an invented code.
- **97.** The disabled hold is replaced by the disable version and Restore into the disabled campaign's draft. The refused versions read is a bare 403.
- **98.** The version note is the request note.
- **Priority 9.** "HQ re-keys the new group" is deleted: there is no order save and no re-key, and the draft keeps the client ids.

**Open, not mine.**
- **BO ask A (now wider).** A disabled campaign with no draft is in no list door, and `Drafts/Load` answers it 404 (HITL-524).
- **BO ask B.** Access probes and roles belong to ticket 529.
- Live proof against SIS.Api belongs to ticket 520.
- Owner sign-off is owed on the settled defaults applied: the Priority carrier, the list composition, and Copy's id dialog (see `.afk/HITL-524.md`).
