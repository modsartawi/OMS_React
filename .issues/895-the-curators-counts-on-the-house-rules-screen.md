---
status: done
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3691
---

# 895 — The house-rules screen shows how many readers changed each default, and to what

## What to build

BackOffice spec 3633 R30: beside each default reading on the house-rules screen, the count of readers holding their own
and the values shown by the server (only those held by 5 or more).

## Proof (→ `tdd` red-green cycles)

- [x] The counts draw beside their kind, with nothing for a hidden value · oms-react tests (`rules.test.ts`, "the curators' counts")

## Boundaries

Follows the contract written by BackOffice 3691.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3691

## Build notes

Built 2026-11-12 on `t895` (from `spec/3633`). Contract: `CopilotPromptWire.readerReadings` and its shapes in
`src/core/models/copilot.ts`, as BackOffice 3691 wrote it (absent with `Copilot:Answers:OwnReadings` off).
`readerCountRows` (`features/copilot/rules.ts`) always gives the four kinds in order and drops any value or `other`
under `minimumReaders`, so a hidden value can never be drawn even if the server sent one; `fromPromptWire` carries it
as `CopilotPrompt.readerCounts` only when sent. The screen draws a "Readers' own readings" section between the editor
and the history: each kind, its reader count, its values (codes named by `rules.readers.value.*`, a money base by its
model label, an unknown code as itself) and "Other values" when shown. Gate: typecheck, `npm test` 10312 passed, lint
green apart from the base's `door-shapes.test.ts` boundary violations.

## Comments

- The default-readings editor (874) is not built on this branch, so the counts sit in their own section, one row per
  kind, rather than beside an editable default. When 874 lands it may move each row beside its default.
- Only English strings were added (the Arabic `copilot.json` carries no `rules` words yet).
