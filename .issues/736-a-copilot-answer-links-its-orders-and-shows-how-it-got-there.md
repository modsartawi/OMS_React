---
status: done
spec: 734
blocked-by: 735
---

# 736 — A copilot answer links its orders and shows how it got there

## What to build

Spec 734 D10 and D11. Each answer shows:
- **Order links.** Every order or delivery number in `orderRefs` becomes a link to its delivery
  document, wherever it appears in the answer.
- **The trace.** A collapsed "How I got this" section lists each tool call in plain words, from a
  fixed tool → label map (for example "Looked up the order's timeline"), with its inputs and row
  count. A failed call is marked. An unknown tool name falls back to its raw name.
- **Served by.** The answer names the provider and model that served it (`servedBy`), because the
  model is switchable (D4).
- **Stopped early.** When `stoppedEarly` is set, a note says the copilot stopped before finishing.
- **The working state** names generic steps from the same label map.

Bidi:
- order numbers and trace inputs are `Ltr`;
- the answer around them stays `<bdi>`.

## Spine reach

logic (order-ref linking, trace rows) · component (answer, trace disclosure) · i18n (tool labels,
served-by, stopped-early) · test

## Proof (→ `tdd` red-green cycles)

- [x] `copilotAnswerModel_linksEveryOrderRef`: each `orderRefs` number found in the text becomes a
  link segment, and text without one stays plain · pure
- [x] `copilotTrace_labelsKnownToolsAndKeepsUnknownNames`: covers each of the nine D2/D21 tools,
  plus one unknown tool and a failed call · pure
- [x] `copilot-drive: answer-links-and-trace`: covers all of:
  - clicking a linked order opens its delivery document;
  - the trace expands and shows the stubbed calls;
  - "served by" is shown;
  - "stopped early" is shown;
  · flow

## Boundaries

No new door. Links use the existing delivery document route; `copilot` must not import the
`oms/document` feature.

## Done when

Both pure tests and the drive scenario are green.

## Blocked by

- [735](735-a-permitted-user-asks-the-oms-a-question-and-reads-the-answer.md)

## Resolution

Built 2026-11-03 on `spec/734-ask-the-oms` (commit 758f6a7d; review fixes in ed0e3911). All proofs pass against stubbed envelopes; the live walk is [740](740-ask-the-oms-and-the-sourcing-advisor-work-live-on-staging.md). Drives: copilot 177/177, sourcing advisor 100/100; 8,536 unit tests pass; lint shows only the 4 boundary violations already on main (insurance-rules aliases).
