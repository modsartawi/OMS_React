---
status: done
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3685, BackOffice 3686
---

# 892 — Assumption lines under an answer are tappable, and the offer line keeps a reading on Keep

## What to build

BackOffice spec 3633 R15 to R17: each assumption line opens the other readings the server listed; choosing one re-asks
the question with it stated. The offer line under a corrected answer, the server's words, with Keep and Not now, and
its confirmation. An answer's "as you prefer" line is drawn as the server wrote it.

## Proof (→ `tdd` red-green cycles)

- [x] A line lists its alternatives and a choice sends the re-ask · oms-react tests
- [x] Keep and Not now send their requests; Keep shows the confirmation · oms-react tests
- [x] An answer with no offer and plain lines draws as today · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3685 and 3686.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3685, BackOffice 3686

## Build notes

Built 2026-11-12 on `t892` (from `spec/3633`). Contract in `src/core/models/copilot.ts` (`statedReading`,
`assumptionChoices`, `readingOffer`, the Keep / Not now bodies and answers), as 3685/3686 wrote it.

- Tests: `answer.test.ts` (a line's alternatives re-indexed onto the lines kept; no offer and plain lines draw as today;
  the offer is its own part under the assumptions), `conversation-store.test.ts` (a choice re-asks the question verbatim
  with `statedReading` in the same conversation; Keep and Not now send `{conversationId, offerId}`; Keep's state holds the
  server's line; 437/430 end the offer and keep its words, any other failure keeps the buttons), `api.test.ts` (the two
  doors' paths). typecheck, 10334 tests and the lint gates green (boundaries: only the known base violation).
- Only the panel's thread is tappable (`Answer`'s optional `readings`); the house-rules Try box draws its lines plain and
  no offer. A choice is disabled while a question is in flight or the conversation is over.
- Offer state lives in the conversation store by offer id (memory only, cleared when the user changes), so a sheet
  closed and reopened keeps a kept line. Keep refreshes `GET Copilot/Me` and links "What the copilot knows about me".
- The "as you prefer" line needs no client work: it is a server-written assumption line, drawn as sent.
- Not driven against a live SIS.Api (RTL is not installed; no drive was written).
