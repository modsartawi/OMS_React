---
status: open
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3685, BackOffice 3686
---

# 892 — Assumption lines under an answer are tappable, and the offer line keeps a reading on Keep

## What to build

BackOffice spec 3633 R15 to R17: each assumption line opens the other readings the server listed; choosing one re-asks
the question with it stated. The offer line under a corrected answer, the server's words, with Keep and Not now, and
its confirmation. An answer's "as you prefer" line is drawn as the server wrote it.

## Proof (→ `tdd` red-green cycles)

- [ ] A line lists its alternatives and a choice sends the re-ask · oms-react tests
- [ ] Keep and Not now send their requests; Keep shows the confirmation · oms-react tests
- [ ] An answer with no offer and plain lines draws as today · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3685 and 3686.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3685, BackOffice 3686
