---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 636
---

# 637 — The simulation's basket loyalty groups are picked with the same picker

## What to build

In the Simulation header form, the loyalty-group text field becomes the core `LoyGroupPicker` (from 636):
the simulated basket's groups are chosen from the defined groups and sent as today's `loyGroups` string
(blank → `null`, unchanged). The run chips and staleness keep reading the same string.

Decision D3: without the view-groups grant the field stays today's **free text** (a simulation is a test,
not a write), not read-only.

## Spine reach

component (`SimHeaderForm` field) · logic (form value ⇄ picker) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `simulate request carries picked groups as the comma string; none → null` · pure
- [x] `simulation loyalty-group picker drive` — pick two groups, run, chip shows them; free text without the grant · flow

## Boundaries

List door only (3174, stubbed). No server change for simulation.

## Done when

On stubs, a simulation runs with picked groups, falls back to text without the grant, and the gates are green.

## Blocked by

[636](636-bonus-buy-maintenance-picks-loyalty-groups-from-the-defined-groups-and-shows-the-unknown-and-inactive-group-findings.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit e55fdaa4.
- 2026-10-28 — Owner: shared change — `core/ui/MultiSelect` marks its Escape handled and `SimRunStrip` ignores a handled Escape (else Escape closed the whole form).
- 2026-10-28 — Owner: free text sends what was typed, trimmed, not upper-cased; the picker sends upper-case. The LOY run chip is still not isolated for RTL (pre-existing).
- 2026-10-28 — sim-strip drive's "<150 ms no spinner" check is flaky on this machine (fails on the base too).
