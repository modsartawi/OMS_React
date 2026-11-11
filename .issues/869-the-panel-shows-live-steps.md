---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3558-the-copilot-answers-in-15-seconds-without-losing-quality-spec.md
blocked-by: BackOffice 3565
---

# 869 — The panel shows live steps

## What to build

BackOffice spec 3558 D12, D17, ticket 3565. The panel sends a `requestId` with each question and, while it waits, polls
`GET Copilot/Ask/{requestId}/Steps` about every second, showing the latest step's words ("Reading the model…",
"Running the query…", "Writing the answer…") in the working state, in both languages. A 404 keeps today's single
working state.

## Proof (→ `tdd` red-green cycles)

- [x] Steps replace each other in the working state as they arrive · oms-react tests — `steps.test.ts` liveSteps_replaceEachOtherAsTheyArrive
- [x] Polling stops when the answer lands or the panel closes · oms-react tests — liveSteps_stopWhenTheServerSaysDone, liveSteps_stopWhenTheAnswerLandsOrThePanelCloses; stops after 3 failed reads with no step ever read (review c1141035)
- [x] A 404 shows today's working state · oms-react tests — liveSteps_a404ShowsNoStep_soTodaysWorkingStateStays_andPollingGoesOn

## Boundaries

Switched by the server (`Copilot:Speed:*`): with the switch off the panel sees today's answer and behaves as today.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3565

## Build notes (2026-11-11)

Built on branch `spec/3558-copilot-speed` (68bf720b; review c1141035, 7b632a99).
