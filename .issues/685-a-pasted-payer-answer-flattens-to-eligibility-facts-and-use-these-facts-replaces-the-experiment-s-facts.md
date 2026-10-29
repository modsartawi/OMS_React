---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 16, 17)
blocked-by: 683
---

# 685 — A pasted payer answer flattens to eligibility facts, and "Use these facts" replaces the experiment's facts

## What to build

A **Flatten** panel in the Data pane:
- paste a payer's raw eligibility response;
- pick the source: **nphies** or **bupa**;
- optionally give the member id and the policy;
- **Flatten** → `POST InsuranceRules/Playground/Flatten` `{ source, response, memberId, policy }` → the fact list
  (`key`, `type`, `value`, `unit`), shown as rows with keys and values in `Ltr`.

**"Use these facts"** replaces the experiment's eligibility facts with the list. That is a replace, not a merge: the
facts are the payer's answer. An edit the user makes to a fact **afterwards** is kept. A later Flatten replaces again
only when the user presses Use again. A response that does not parse as JSON is said in words and never sent.

## Spine reach

model/api (Flatten door) · store/logic (facts → eligibility block) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `useFacts` — the flattened facts become the `eligibility` block keyed as a rule names them (number, text, flag,
      date, with unit); prior facts are replaced; an edit after Use survives a re-render — pure
- [ ] drive: paste a stubbed nphies answer, Flatten, Use, and see `benefit[66].approvalLimit` = 10000 SAR in the form
      and JSON; the outcome refreshes — flow

## Boundaries

New door `POST InsuranceRules/Playground/Flatten` (BackOffice 3247). The brief's spec body names only `{ response }`
while its contract names `source`, `memberId` and `policy`; build to the contract and note the drift for 691.

## Done when

A payer answer flattens and becomes the experiment's facts, and later edits are kept. Vitest and drive are green.

## Blocked by

[683](683-history-reference-rows-eligibility-facts-and-the-coverage-payer-are-edited-in-the-form-and-an-empty-section-reads-none.md)
