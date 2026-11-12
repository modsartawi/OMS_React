---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3586-copilot-answers-you-can-trust-and-a-next-step-spec.md
blocked-by: BackOffice 3600
---

# 875 — A curator writes starters in both languages, each with its "Try" proof

## What to build

BackOffice spec 3586 A51, A52, A56, "The web half"; ticket 3600.

- The house-rules screen gains the starters: a list for each kind of reader (executive, operations), at most 6 each,
  every starter in English and Arabic, at most 200 characters.
- Each starter has a "Try". It runs the starter through the existing trial door and shows the answer. The screen keeps
  the tool call that answered it as the starter's proof and sends it with the save.
- Editing a starter's text clears its proof. A starter without a proof cannot be saved, and the screen says which one.
- A starter marked as having a blank for the reader to fill needs no proof.
- Starters save, show in the history and roll back with the house rules.
- A refusal that names a starter marks that starter.

## Proof (→ `tdd` red-green cycles)

- [x] A successful try keeps the answering tool call as the starter's proof; a try that answered with no lookup, or "can't answer", keeps none · oms-react tests (the house-rules tests) · `rules.test.ts` `trialProof_keepsTheLastSuccessfulToolCall_noLookupOrCannotAnswerKeepsNone`, `applyTrial_setsTheTriedStartersProof_onlyWhileItsTextIsTheOneTried`
- [x] Editing a proven starter's text clears its proof · oms-react tests · `editStarter_aTextChangeInEitherLanguageClearsTheProof_anUnchangedTextKeepsIt`
- [x] The save is blocked while a starter has no proof, naming it; a starter with a blank is exempt · oms-react tests · `starterIssue_blocksTheSaveWhileAStarterHasNoProof_namingIt_aStarterWithABlankIsExempt`
- [x] A seventh starter for one kind cannot be added; 201 characters or a missing language blocks the save · oms-react tests · `addStarter_aSeventhForOneKindCannotBeAdded_201CharactersOrAMissingLanguageBlocksTheSave`
- [x] The save request carries every starter with its proof, beside the two texts · oms-react tests · `saveRequest_carriesEveryStarterWithItsProof_besideTheTwoTexts`, `aStoredStartersProof_comesBackUnchangedOnASave_andTheHistoryShowsAndRestoresTheStarters`
- [x] A refusal naming a starter marks that starter · oms-react tests · `starterOfField_aRefusalNamingAStarterMarksThatStarter_orItsKindsList`

The screen (`CopilotRulesPage` + `StartersEditor`) was checked by `typecheck` only: no drive was run (Playwright is not
installed on this machine, and `tools/copilot-rules-drive.mjs` does not cover the starters yet).

## Boundaries

The server checks every proof again at save; the screen's own checks are for the curator's convenience.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3600
