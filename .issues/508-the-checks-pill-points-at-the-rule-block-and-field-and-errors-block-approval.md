---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 505
---

# 508 — The checks pill points at the rule, block and field, and errors block approval

## What to build

The builder's header carries a **checks pill** ("2 errors · 1 warning", or "All checks pass"). HQ validates the
draft on save (BackOffice 2758), and each message points at **rule → condition/effect → field**. Opening the pill lists them, and
clicking one expands the rule, opens the block's panel and focuses the field, where the message also shows.
**Errors block "Ask for approval"** (511 reads the same state), and warnings don't.

## Spine reach

model/api (`validate`) · logic (message → location, blocking verdict) · component (pill, field marks) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `checks_locateEachMessage_atRuleBlockField_byIds` · pure
- [x] `checks_errorsBlockApproval_warningsDoNot` · pure
- [x] drive: a stubbed error → pill → click → the field is focused with its message (stubbed) · flow

## Boundaries

Provisional validate endpoint (BackOffice 2758), stubbed. HQ's message text is passed through as data inside `<bdi>`, with the
labels around it from i18n.

## Done when

The drive jumps from the pill to the exact field, and the approval verdict follows errors only.

## Blocked by

[505](505-a-marketer-adds-and-edits-blocks-from-a-palette-with-undo-redo-cancel-save.md)

## As built

- **Model / api (PROVISIONAL):** `core/models/rule-campaign.ts` gains `RuleCheckMessage` (`severity`, `code`, HQ's `message`, and `ruleId` / `blockId` / `field` — null = campaign / rule / whole block) and `RuleCampaignChecks { messages }`. The door is `GET RuleCampaign/Campaigns/{id}/Validate` (`ruleCampaignApi.validate`, `ruleCampaignChecksQuery`) in `core/rules/api.ts`: HQ's checks of the SAVED draft. `rememberSavedDraft` invalidates it, so every Save asks again. A draft with problems is an answer; a refusal means the check could not be made (`apiErrorMessage`).
- **Logic (pure, `workspace/checks.ts`):** `locateCheck` finds a message BY ID on the rules as they are on screen — a condition (in a group too), an effect, a filter or a named value; a block moved since the save is found where it now is, one deleted is `gone` (its rule still named). `locateChecks` orders errors first. `indexChecks` indexes them once per answer/edit. `approvalVerdict` — errors block, warnings never do; a severity the client does not know counts as an error (fail closed on a provisional contract). `focusTarget` names the rule to expand, the panel / filter editor to open and the control to focus.
- **Components:** `ChecksPill` in the builder bar — "1 error" "3 warnings" / "All checks pass" / "Checking…" (also while HQ is re-asked after a Save) / "Checks unavailable" (door message + Try again). Opened, it lists each message with its crumbs (Rule n *name* › Condition n › field label) and HQ's text in `<bdi>`, the verdict line, and — while dirty — that these are the last save's checks. Escape or a click elsewhere closes it. A click expands the rule, opens the panel and focuses the field. `CheckNotes` shows HQ's messages at the panel field (EN + AR pairs under the pair), under a closed block (marked red / amber), and on filter, value, group and rule rows.
- **i18n:** `checks.*` in `campaign-workspace` (en only).

## Proof — as run

- vitest `checks.test.ts` (3, including the two named tests). Full suite: 315 files, 5326 tests, green. typecheck, lint (4 gates), build green.
- Drive `tools/campaigns-drive.mjs` (stubbed): **288/288**. Its 508 section is checks 53–61: pass / Escape; counts and the closed block's mark; list order, crumbs, non-jumpable campaign and gone messages, blocked verdict; click → rule expanded, panel open, `panel-<id>-amount` focused with the message at the field; warning → receipt label's English input; warnings-only verdict clear; stale note while dirty and a re-ask on Save; refused door.

## Outstanding

- Live door (BackOffice 2758 Validate) — ticket 520.
- Owner sign-off on the decisions in `.afk/HITL-508.md`.
