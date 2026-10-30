---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692
---

# 698 — Publish shows its warnings: a channel that never answers, a flagged field and missing Arabic

## What to build

Stories 19, 67; J14, D5, L14; doors 3284, 3293, 3297. Before asking for approval or publishing, the author sees each
warning the door returns: "on bupa this condition is always unknown", a field flagged by drift, and Arabic text that
would show an English label or a bare code. Each warning names the rule and the fact. None of them stops the publish. A
refusal such as `overridesPayer` on a payer key (story 47) stays a refusal and reads differently from a warning.

## Spine reach

model/api (warning shapes on Validate / publish) · store/logic (warning against refusal) · component (checks pill,
publish step) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] warnings never disable publish; a refusal does — pure
- [ ] one rule with all three warnings publishes after they are shown; a payer-key override is refused — flow

## Boundaries

The warnings are the door's, computed by no client rule. An unrecognised warning kind still shows its server text. Doors
stubbed; 711 reconciles.

## Done when

An author cannot publish without having been shown what the rule cannot do, and nothing a warning says blocks them.

## Blocked by

692.

## Comments
