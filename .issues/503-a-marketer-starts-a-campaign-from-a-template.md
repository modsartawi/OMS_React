---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 502
---

# 503 — A marketer starts a campaign from a template

## What to build

The Create campaign dialog gets a **From a template** tab: a list of templates (3-for-2, spend-and-get,
points-back… as in the prototype's `sampleTemplates()`), each with a one-line description. Picking one
asks for its **placeholders** (the category, the threshold, the percent…), using the builder's field
pickers where they exist and plain typed inputs otherwise. Then it creates a draft with the
template's rules filled in and opens it.

## Spine reach

model/api (`templates`, create-from-template) · logic (placeholder fill) · component (tab) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `fillTemplate_replacesEveryPlaceholder_andLeavesNoneUnset` · pure
- [x] drive: template → placeholders → a draft whose rules read the filled values (stubbed) · flow

## Boundaries

Provisional templates endpoint (BackOffice 2759), stubbed.

## Done when

The drive creates a campaign from a template against stubs.

## Blocked by

[502](502-a-marketer-creates-a-campaign-from-a-name-and-features-or-copies-one.md)

## Open questions

- **How a template stores placeholders** is undecided in BackOffice 2759. Default (2759's): a template is a campaign
  draft with named placeholder values that the dialog fills. Build that shape, and adjust when 2759 decides otherwise.

## Comments

**Done 2026-10-16 (AFK).** The brief still has no contract section, so this is built on PROVISIONAL shapes. Ticket 520 re-points them: `RuleCampaignTemplate`, `RuleTemplatePlaceholder`, `RuleTemplateDraft` and `RuleCampaignFromTemplate` in `src/core/models/rule-campaign.ts`, and `GET RuleCampaign/Templates` plus `POST RuleCampaign/Templates/{id}/Create` in `src/core/rules/api.ts`.

- **The tab** (`features/campaigns/list/FromTemplate.tsx`): Create campaign now has two tabs, **Blank campaign** (the default, and where a reopened dialog lands) and **From a template**. The templates are read only when the tab first opens. Each one shows both names, its one line, and "Asks for: …". A draft template is marked and cannot be picked. Picking one asks for its placeholders:
  - a typed number, with its bounds as one isolate;
  - the **builder's item picker** for a pick (categories or collections);
  - a list for a choice.

  The dialog shows the name the draft will have, in English and Arabic. Problems are reported at their field once Create has been tried. Create with nothing picked asks for a template. A refusal is shown in the dialog, verbatim, with the values kept; an edit clears it. A template whose draft uses a key it does not ask for is reported straight away. The footer's Create sends whichever tab is open, and its pending state covers both.
- **The fill** (pure `template-form.ts`): `templateFormFor` (defaults), `templateProblems` (required, plain decimal only, inclusive bounds, a choice must be one of its options), `templateValues` (typed), and `fillTemplate`. `fillTemplate` replaces `{ placeholder: key }` marks whole and `{{key}}` inside strings. If any mark is left without a value, it refuses and names the keys; it never changes the template. A formula only gets text substituted and is never parsed (ADR 0089).
- **Graduated to core:** `LookupPicks` → `src/core/rules/LookupPicks.tsx` (with `RULE_INPUT`), and `useDebounced` → `src/core/util/use-debounced.ts`. The list feature now needs them too. Enter in the picker's search no longer submits an enclosing form, and Escape clears it without closing an enclosing dialog.
- **Proof:** `template-form.test.ts` has 8 tests, including the named one. The drive `tools/campaigns-drive.mjs` has a new 503 section (checks 100–106), served by the stubbed `TEMPLATES` (the prototype's three) and `createFromTemplate` in `tools/campaigns-fixtures.mjs`. The draft opens with its rules reading the filled threshold, percent, both categories, and both the not-met and receipt-label pairs. The whole drive passes **495/495** on port 5199, stubbed. Gates green: typecheck, `npm test` (323 files, 5420 tests), lint (all four gates) and build.
- **Reviews:** `/code-review` and `/standards-review` were both run. Fixed:
  - Enter in the item search submitted the form.
  - Escape in it closed the dialog.
  - Create with nothing picked did nothing visible.
  - A broken template was only reported after Create.
  - The picker's label was not isolated.
  - A stale template copy was used after a refetch; the dialog now reads the picked template from the live query.
  - `Number()` accepted `0x1E` / `1e2`.
  - The legend showed the name in one language only.
  - A template draft could not carry an audience (the prototype's tier template has one).

  Left as is, with reasons in the HITL doc: the `{ placeholder }` key collision; marks not being visible in the types; single-language template labels; and core reading the `campaign-workspace` namespace.
- **Decisions** are logged in `.afk/HITL-503.md`.
- **Outstanding (not AFK's):** a live-door check (ticket 520, BackOffice 2759); an eyeball of the Arabic rendering of the filled EN + AR pairs; and the owner sign-off on the placeholder-storage default (the open question) and on the client filling the draft.
