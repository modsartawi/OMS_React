---
status: done
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

- [x] `useFacts` — the flattened facts become the `eligibility` block keyed as a rule names them (number, text, flag,
      date, with unit); prior facts are replaced; an edit after Use survives a re-render — pure
- [x] drive: paste a stubbed nphies answer, Flatten, Use, and see `benefit[66].approvalLimit` = 10000 SAR in the form
      and JSON; the outcome refreshes — flow

## Boundaries

New door `POST InsuranceRules/Playground/Flatten` (BackOffice 3247). The brief's spec body names only `{ response }`
while its contract names `source`, `memberId` and `policy`; build to the contract and note the drift for 691.

## Done when

A payer answer flattens and becomes the experiment's facts, and later edits are kept. Vitest and drive are green.

## Blocked by

[683](683-history-reference-rows-eligibility-facts-and-the-coverage-payer-are-edited-in-the-form-and-an-empty-section-reads-none.md)

## Comments

- 2026-10-30 (685 built, branch `impl/3243-685`). vitest: `flatten.test.ts` 10 (the body, the reply read, Use =
  replace not merge, the form shows 10000 SAR, an edit after Use survives a re-read); `i18n-keys.test.ts` +1. Drive
  `tools/insurance-playground-flatten-drive.mjs` 60/60 LTR + RTL; form 80/80 and raw 52/52 still green. typecheck,
  lint, test (8019), build green. Stub section `// --- 685 ---` (`NPHIES_ANSWER`, `store.flattens`).
- **Layout:** pure `playground/flatten.ts` — `flattenBody` (the answer must parse as ONE JSON object, else `invalid`
  and nothing is sent; blank member id / policy → null), `flattenFactsIn` (drops facts with no key or type),
  `eligibilityOf`, `applyFacts(dataText, facts)` (the proof's `useFacts`; renamed so it does not read as a React hook).
  `FlattenPanel.tsx` sits under the Data pane's box through a new `JsonPane` `after` slot; shown on Form and JSON,
  `hidden` (not unmounted) on Raw so its answer survives a tab switch. Use writes the data box once; the form re-reads
  it like any other change, so a later edit is the data's own and a later Flatten replaces nothing until Use again.
- **🚩 Drift for 691:** the brief's spec body names only `{ response }`; built to its CONTRACT
  `{ source: nphies|bupa, response, memberId, policy }` → `{ facts: [{ key, type, value, unit }] }`. Fact → block
  `{ type, <type>: value, unit }`; the unit is written only when the payer gave a non-empty one. A bare 403 says "no
  access" in the panel; a `PLAYGROUND_*` refusal shows its message and code.
- **Decisions (overrulable):** `response` is sent as parsed JSON (an object), not as text; an array or scalar answer
  is refused client-side. Use on a data box that does not parse says so and changes nothing. The value and its unit
  are one ltr isolate (`10000 SAR`). nphies is the default source.
