---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner walk 2026-10-29
blocked-by: 612, 656
---

# 660 — The simulator shows the request and HQ's reply as JSON

## What to build

On the simulator's result, two JSON buttons (656's `JsonButton`): **Request**, the body POSTed to
`InsuranceRules/Guards/Simulate` exactly as sent, and **Reply**, HQ's answer exactly as it came (lines, fired guards
with their severity, codes and words, unknowns, the trace with its values as HQ's text `"true" | "false" | "unknown"`),
before the screen reads it. `simulatorApi.simulateWithReply` keeps the reply beside the read result.

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] `tools/insurance-simulator-drive.mjs` step 3b, LTR + RTL: Request equals the POSTed body; Reply holds both lines
      and the trace values as text — 126/126
- [x] tsc, lint, simulator vitest 26/26

## Boundaries

Read-only. Rules: `i18n-zero-literal` (EN + AR), `bidi` (the JSON is one left-to-right island).

## Done when

After a simulation, Request and Reply each open their JSON and copy it.
