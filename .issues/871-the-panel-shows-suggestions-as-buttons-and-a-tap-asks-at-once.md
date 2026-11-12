---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3586-copilot-answers-you-can-trust-and-a-next-step-spec.md
blocked-by: BackOffice 3598
---

# 871 — The panel shows suggestions as buttons, and a tap asks at once

## What to build

BackOffice spec 3586 A46, A49, "The web half"; ticket 3598.

- The answer's `suggestions[]` are shown as buttons under the answer, up to 3.
- A tap asks the suggestion's text at once as a normal question in the same conversation, and the request says the
  question came from a suggestion. A typed question says it was typed.
- Only the latest answer's suggestions can be tapped.
- An answer with no `suggestions` renders exactly as today.

## Proof (→ `tdd` red-green cycles)

- [x] An answer with three suggestions shows three buttons under it · oms-react tests (the panel's answer tests) · `answer.test.ts` `anAnswerWithThreeSuggestions_showsThreeButtonsUnderIt`, `suggestions_showAtMostThree_andABlankOrMalformedOneIsLeftOut`
- [x] A tap builds a request with the suggestion's text and the origin "suggestion"; a typed question has the origin "typed" · oms-react tests · `conversation.test.ts` `aTappedSuggestion_isAskedWithItsText_andTheOriginSuggestion_aTypedQuestionSaysTyped`, `conversation-store.test.ts` `aTypedQuestionSaysTyped_aTappedSuggestionSaysSuggestion_inTheSameConversation`
- [x] Suggestions of an earlier answer are shown but cannot be tapped · oms-react tests · `conversation.test.ts` `onlyTheLatestAnswersSuggestions_canBeTapped`, `answer.test.ts` `anEarlierAnswersSuggestions_areShownButCannotBeTapped`
- [x] No `suggestions`: the answer renders as today · oms-react tests · `answer.test.ts` `anAnswerWithNoSuggestions_rendersAsToday` (a guard: green on its first run, the defensive read was built in the first cycle)

## Boundaries

Switched by the server (`Copilot:Answers:Suggestions`). The panel does not check a suggestion: the server already did.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3598
