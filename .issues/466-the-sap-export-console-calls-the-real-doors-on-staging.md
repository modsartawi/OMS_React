---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md
blocked-by: 461, 462, 463, 464, 465 (live: BackOffice 2580-2585 deployed, the grant seeded, the rollup worker on)
---

# 466 — The SAP export console calls the real doors on staging

Follows BackOffice spec 2579 (`C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md`). BackOffice builds the doors in 2580-2585, in parallel. Until they land, build against stubs of the door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`), which is the only source of wire shapes. Use the spec's words: **behind**, **held for inventory**, **stuck**, **by design**, **double send**, **export accounting**, **rail** (legacy / new).

## What to build

The live half, after the precedent of 450 / 455 / 460.

- `tools/sap-export-live-drive.mjs`: run every page against a real SIS.Api, local first, then
  staging. Read-only except one Recompute of one store-day.
- Fix any drift: amend the BackOffice contract first (in that repo, by its owner), then the model.
- **Owner walk**: a consultant holding `SapExportConsole` opens the fleet, a behind store, a
  store-day, follows a row into the inspector, and reads the runner card. Someone without the
  grant sees no menu leaf.

## Spine reach

UI -> live SIS.Api

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/sap-export-live-drive.mjs` green against a local SIS.Api carrying the 2580-2585 build.
- [ ] The same drive green on staging. **OWNER**
- [ ] The owner walk signed off. **OWNER**

## Boundaries

Needs the BackOffice wave merged and deployed. Not an AFK ticket: excluded from the overnight runner.

## Done when

The live drive is green on staging and the owner walk is signed off.

## Blocked by

[461](461-the-sap-export-console-opens-on-a-store-day-s-unfinished-transactions.md), [462](462-the-idoc-inspector-opens-straight-on-a-linked-transaction.md), [463](463-the-fleet-page-shows-every-store-s-export-health.md), [464](464-the-store-page-shows-its-export-facts-the-30-day-strip-and-a-recompute.md), [465](465-the-runner-card-the-double-send-list-and-identity-breaks.md).
