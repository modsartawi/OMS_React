---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3586-copilot-answers-you-can-trust-and-a-next-step-spec.md
blocked-by: BackOffice 3601
---

# 873 — The empty panel shows the reader's starters, or the two fixed examples when there are none

## What to build

BackOffice spec 3586 A52, A53, "The web half"; ticket 3601.

- The panel's empty state reads the starters door and shows the reader's starters, in the panel's language.
- A tap asks the starter at once, and the request says the question came from a starter.
- A starter marked as having a blank to fill is put in the question box for the reader to complete, not asked.
- When the door returns none, or fails, the panel shows its two fixed examples as today.

## Proof (→ `tdd` red-green cycles)

- [x] Starters from the door are shown in the panel's language · oms-react tests (`starters.test.ts` startersFromTheDoor_areShownInThePanelsLanguage)
- [x] A tap builds a request with the starter's text and the origin "starter" · oms-react tests (`starters.test.ts` aTap_buildsARequestWithTheStartersText_andTheOriginStarter)
- [x] A starter with a blank fills the question box and sends nothing · oms-react tests (`starters.test.ts` aStarterWithABlank_fillsTheQuestionBox_andSendsNothing)
- [x] No starters, or a failed read: the two fixed examples are shown · oms-react tests (`starters.test.ts` noStarters_orAFailedRead_showsTheTwoFixedExamples)

## Boundaries

Switched by the server (`Copilot:Answers:Starters`).

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3601
