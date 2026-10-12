---
status: done
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

- [x] ~~`tools/sap-export-live-drive.mjs` green against a local SIS.Api~~ — waived by the owner: the script was never written; the doors were proven live on the deployed host instead (below).
- [x] Live on the deployed host (`172.23.27.111:8099`), every page read real doors. **OWNER**
- [x] The owner walk signed off (2026-10-12). **OWNER**

## Boundaries

Needs the BackOffice wave merged and deployed. Not an AFK ticket: excluded from the overnight runner.

## Done when

The live drive is green on staging and the owner walk is signed off.

## Blocked by

[461](461-the-sap-export-console-opens-on-a-store-day-s-unfinished-transactions.md), [462](462-the-idoc-inspector-opens-straight-on-a-linked-transaction.md), [463](463-the-fleet-page-shows-every-store-s-export-health.md), [464](464-the-store-page-shows-its-export-facts-the-30-day-strip-and-a-recompute.md), [465](465-the-runner-card-the-double-send-list-and-identity-breaks.md).

## Outcome

**2026-10-12 — owner walk on the deployed build (`http://172.23.27.111:8099`), signed in as 14419.**
Driven through Claude in Chrome; no Playwright script ran (the session cookie is HttpOnly, as in 469).

- **Fleet** `/reports/sap-export`: 52 stores (2 pages), runner card, KPI strip, "Numbers as of 2026-10-12 23:02".
- **Store** `/store/1000`: header, label chips, export facts (under SAP, counter row present, watermark 139,003, opened 2024-10-01), 30-day strip, Recompute button.
- **Store-day** `/store/1000/day/2026-10-12`: 272 → 294 transactions (L1 Exported 153, L9 above the watermark, N3 waiting to seal 12), export accounting **Agrees**.
- **Row → inspector**: opened straight on `store=1000&trx=00014630710020`, Processed, AGG + FI documents, not batched.
- **Recompute** of 1000 / 2026-10-12: pressed by the owner (the agent's click was refused by the permission gate); owner reported it done.

No contract drift seen. The owner closed the ticket with these left open, unruled:

1. Runner card shows **Up** for the legacy uploader (Never ran, backlog 3,458) and the census rollup (Never ran, backlog 1,334), both "Inferred — no heartbeat yet" — contradicts the card's own "Down means work is due and no cycle ran". The rollup worker had not run.
2. "Hours past day end" reads **-1** for every row of a day that has not ended yet; blank is likely better.
3. No store was behind, stuck or held that night, so the "behind store" leg was walked on a waiting-only store.
4. The no-grant check (no menu leaf without `SapExportConsole`) was not walked in this session.
5. `tools/sap-export-live-drive.mjs` does not exist.
