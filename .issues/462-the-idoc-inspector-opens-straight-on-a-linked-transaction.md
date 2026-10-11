---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md
blocked-by: — (live: - (no door change))
---

# 462 — The IDoc inspector opens straight on a linked transaction

Follows BackOffice spec 2579 (`C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md`). BackOffice builds the doors in 2580-2585, in parallel. Until they land, build against stubs of the door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`), which is the only source of wire shapes. Use the spec's words: **behind**, **held for inventory**, **stuck**, **by design**, **double send**, **export accounting**, **rail** (legacy / new).

## What to build

The SAP export console's store-day rows link to
`/reports/idoc-inspector?store=<code>&trx=<trxNumber>`. Make the inspector honour that link:
when **both** parameters are present and non-blank, prefill the toolbar draft **and** promote it
to the lookup key, so the lookup runs once on open. Either one missing means an ordinary empty
screen (today's behaviour). After that, a Look up the user makes writes the key back to the URL,
so a lookup becomes a shareable link.

Keep `lookup-key.ts`'s rule that only a promoted key fires a request: the URL is just another
way to promote one. Do not import anything from `sap-export-console` (features never import
features); the link is only a URL.

## Spine reach

UI (inspector page, its lookup-key module)

## Proof (→ `tdd` red-green cycles)

- [x] `keyFromSearchParams(params)`: both present gives a key; either blank or missing gives none; values are trimmed (vitest, beside `lookup-key.test.ts`).
- [x] `tools/idoc-inspector-drive.mjs` extended (stubbed): opening `?store=X&trx=Y` issues exactly one lookup for X/Y with the toolbar filled; opening with only `store` issues none; a manual Look up updates the URL. The existing assertions stay green.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. No BackOffice change: the inspector doors are unchanged.

## Done when

The helper and the extended inspector drive are green.

## Blocked by

None. It can start immediately (the contract is published).

## Comments

**Done 2026-10-11 (AFK).** The issued key now lives in the URL through the core `useUrlQuery` hook (replace, not push). `keyFromSearchParams` and `searchParamsForKey` read and write `?store=&trx=`, and both go through `buildLookupKey`. So a link is only another way to promote a key, and a link missing either half is the landing screen. The draft is filled from a link on open. A change from outside (Back, the menu leaf, a pasted link) moves the draft with it. The echo of the user's own write does not (`reseedDraft`, decided on the key the page wrote). Nothing is imported from `sap-export-console`.

🚩 **One addition the ticket did not name.** The transaction query now also waits for the access grant, on the same probe key as the gate. A link fires on mount, before the gate draws, so a denied user opening one would otherwise still ask for the transaction. The drive asserts that it does not, and that check goes red with the gate removed.

Proof:
- vitest: `lookup-key.test.ts` 32/32 (16 new). Full suite 264 files, all passing.
- `tools/idoc-inspector-drive.mjs` on 5199: **143/145**, stubbed. 18 new assertions, all green. The two failures are the pre-existing leaf assertions ("the IDoc inspector leaf appears under it" / "the leaf points at /reports/idoc-inspector"), as measured before this ticket. 462 neither adds a failure nor fixes them.
- `npm run typecheck`, `npm run lint` (all four gates) and `npm run build`: green.

Decisions and the out-of-slice `/code-review` findings (in 461/463-465 code) are logged in `.afk/HITL-462.md`.
