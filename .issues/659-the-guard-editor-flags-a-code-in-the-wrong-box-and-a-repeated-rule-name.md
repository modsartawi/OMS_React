---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner walk 2026-10-29
blocked-by: 608
---

# 659 — The guard editor flags a code in the wrong box and a repeated rule name

## What to build

Found on the owner's walk: the NPHIES code `AD-2-4` was typed into the **Conflict** box, and two rules of the draft
carried the same name, so the wrong one was edited. HQ's reader takes any text as a code and any name, so the editor
checks these itself, as the author types (`@/core/insurance-rules/rule-checks`):

- a NPHIES-shaped code (`AD-2-4`, `N-DC-067`) in Conflict, or a two-character conflict code (`83`, `ER`) in NPHIES,
  is an error under the codes and **holds Save**;
- a code of neither shape only warns (a payer may use one this list does not know);
- a rule whose English or Arabic name (trimmed, any case) another rule of the draft already has gets a warning under
  the names, naming those rules.

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] `rule-checks.test.ts`: codes in the wrong box hold the save, right codes and empty boxes pass, odd shapes warn;
      same-named rules found per language, never the rule itself, a blank name matches nothing
- [x] mutation: dropping the NPHIES-in-Conflict test fails 2 tests
- [x] `tools/insurance-guard-editor-drive.mjs` 106/106; tsc, lint, insurance-rules vitest 595/595

## Boundaries

Client-side only; HQ's Validate is unchanged. Rules: `i18n-zero-literal` (EN + AR, Arabic six plural forms), `bidi`.

## Done when

The editor refuses to save AD-2-4 in Conflict and warns when another rule has the same name.
