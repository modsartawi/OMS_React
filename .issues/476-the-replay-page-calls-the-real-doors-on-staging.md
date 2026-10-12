---
status: open
spec: 470
blocked-by: 471, 472, 473, 474, 475
---

# 476 — The replay page calls the real doors on staging

## What to build

The live walk for spec 470, run once the BackOffice receipt replay half (not yet specified) is deployed
to staging, the till carrying the inherited replay mark is installed on a test store's register, and
`ActionSync.Replay` is granted to the walker.

- Extend `tools/sync-console-live-drive.mjs` with a `replay` section behind `--write`, and add its inputs
  (source store and receipt, target test store and register) to `sync-console-live-inputs.json`. It
  pushes one replay and asserts the result's shape and the recent list.
- The owner then walks it:
  1. Open a real staging receipt's JSON and press Replay….
  2. Push it into the test store.
  3. Find the new receipt number at that store's till and return it.
  4. Confirm that neither the replayed sale nor its return reaches HQ `RetailTrx`, and that no IDoc or
     legacy export picks them up.
  5. Confirm that the audit feed shows "Replayed a receipt".

## Spine reach

UI → app (BackOffice replay doors, live)

## Proof (→ `tdd` red-green cycles)

- [ ] Live drive `replay` section green on staging.
- [ ] Owner walk signed off, including the return at the till and the HQ / SAP absence check.

## Boundaries

Live only. It writes one sale and one return into a **test** store's database. Never point it at a store
the business trades from.

## Done when

The live section is green and the owner walk is signed off.

## Blocked by

[471](471-copy-json-copies-on-plain-http-and-says-so-inside-the-drawer.md),
[472](472-a-tester-pastes-a-sale-pushes-it-into-a-store-and-sees-its-new-receipt-number.md),
[473](473-every-replay-refusal-and-preflight-warning-reads-in-plain-words.md),
[474](474-replay-in-the-receipt-drawer-opens-the-replay-page-with-the-json-filled-in.md),
[475](475-the-replay-page-lists-recent-replays-and-the-audit-feeds-say-replayed-a-receipt.md)
(live: the BackOffice receipt replay spec and its doors, unwritten).

## Open questions

- Which store is the test store for the walk? It needs a NewPos register running the new till build.

## Comments

- 2026-10-12: the server half is now BackOffice spec **2630** (`C:\Work\DMSCO\BackOffice\.issues\2630-receipt-replay-server-half-spec.md`, draft, 4 owner questions open). Contract changes from it, for the oms page: new refusal `REPLAY_OFF` (409, push door off until the till release ships); new removed kind `orderLink`; HTTP codes per its refusal table. Both currently fall to generic words/the raw code.
