---
status: done
spec: BackOffice 3202 (D9, D10, D11 and its "Changed after review" section); doors on BackOffice pricing2 5a89d2f40
blocked-by: —
---

# 673 — The Scripts page follows the final store script doors

## What to build

663 and 664 were built before the last BackOffice changes to the store script doors landed (spec 3202 "Changed after
review"). The screen works, but it is behind the doors in three places:

1. **A legacy script's exhausted stores can be retried.** The Retry door now accepts a legacy (hand-inserted)
   script's exhausted rows. Withdraw still refuses a legacy script (`LEGACY_SCRIPT`). `scriptControls` /
   `storeRetryOffered` hide Retry and Retry-all on every legacy script; offer them when the store is exhausted, and
   keep Withdraw hidden.
2. **Two new refusals have words.** `SCRIPT_NOT_ASCII`: the script has a non-ASCII character, and the door's message
   names its position and tells the sender to write Arabic as `NCHAR(...)` or `0x...` literals. `TITLE_TOO_LONG`:
   the title is over 200 characters. Add both to `SCRIPT_REFUSALS` with their `scriptCodes.*` wording.
   - The Send dialog may also warn before the preview when the SQL has a non-ASCII character, as it counts against
     8,000. The door stays the judge.
3. **Refused stores are read from the shape the doors send.** `refusedStoreCodes` reads `data.codes`, which was a
   guess. The doors send:
   - a chosen-store send refusal: `data: { unknown: string[], notEligible: string[] }` (one `errors[]` entry per
     code);
   - a retry refusal: `data: { notExhausted: string[] }`.

   Read those, keep the picker marking the refused stores, and keep the door's message shown as today.

Read the contract `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md` ("Store script
doors") at BackOffice `pricing2` for the exact shapes and wording. Where it disagrees with this ticket, the contract
wins.

## Spine reach

ui · api client · test · drive (stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `scripts-helpers.test.ts`:
  - Retry and Retry-all are offered on a legacy script's exhausted store, and Withdraw is not;
  - `SCRIPT_NOT_ASCII` and `TITLE_TOO_LONG` have keys;
  - `refusedStoreCodes` reads `unknown` + `notEligible`, and `notExhausted`;
  - an unknown shape still gives `[]`.
- [x] `tools/sync-console-scripts-drive.mjs` (stubbed):
  - a legacy script's exhausted row shows Retry;
  - a `SCRIPT_NOT_ASCII` refusal shows its words and keeps the dialog open;
  - a chosen-store refusal marks the refused stores in the picker.
- [x] `npm run typecheck`, `npm test`, `npm run lint`

## Boundaries

No BackOffice change: the doors are built (pricing2 5a89d2f40).

## Done (2026-10-29) — stubbed; no live SIS.Api walk

- **Legacy Retry**: `scriptControls` offers Retry all and `storeRetryOffered` the row Retry on a legacy script's
  exhausted stores; Withdraw stays hidden on it (`LEGACY_SCRIPT`). Withdrawn and no-grant cases unchanged.
  `scriptCodes.LEGACY_SCRIPT` and `scriptDetail.legacyNote` now say withdraw only / its exhausted stores can be retried.
- **Words**: `SCRIPT_NOT_ASCII` and `TITLE_TOO_LONG` added to `SCRIPT_REFUSALS` and `scriptCodes.*`;
  `TITLE_REQUIRED` no longer speaks of the width. The Send dialog warns (under the SQL counter) with the first
  non-ASCII character's position and code point (`firstNonAscii`); Preview is never disabled by it.
- **Refused stores**: `refusedStoreCodes` reads `data.unknown` + `data.notEligible` (unknown first) and
  `data.notExhausted`; the guessed `data.codes` and any other shape read `[]`. The picker marks a refused store
  (danger chip, "Refused" note), matched case-insensitively as HQ matches codes; the door's message still shows.
- **Found on the way (contract wins)**: the Detail door sends no state counts, but the detail's controls read the
  list's counts off it — against the real door Withdraw and Retry all would never show. `ScriptDetail` is now the
  contract's own shape, and the modal counts the detail's stores (`scriptStateCounts`). The drive's detail stub now
  sends the contract shape (no counts); mutation-checked: removing the count turns the drive red.
- Vitest 7712/7712 (scripts-helpers 50), typecheck, lint 5/5. `tools/sync-console-scripts-drive.mjs` 105/105
  stubbed (was 81).

## Done when

The proofs above hold.

## Blocked by

None — can start immediately.
