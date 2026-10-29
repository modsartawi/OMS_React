---
status: done
spec: BackOffice 3202 (D14: the screen lives in this console); doors BackOffice 3203, 3207
blocked-by: BackOffice 3207
---

# 663 — The sync delegate sees sent store scripts and each store's state on the Scripts page

## What to build

- **Scripts page** at `/admin/sync/scripts`, a `ConsoleNav` entry after Objects (a read: `ActionSync.Health.View`).
  - Reads `GET ActionSync/Scripts`. One row per script: title ("untitled (legacy)" for a legacy one), sender, sent
    at, target (all / chosen), store count, and the counts executed / pending / retrying / exhausted / withdrawn.
  - Opening a script reads `GET ActionSync/Scripts/Detail`: per store, its code, description, state, attempts, last
    attempt and last error. The SQL is shown read-only when the door returns it (grant holders only), and never
    otherwise.
- **Store page → Scripts tab** shows the new `title`, `attempts`, `state` and `createdAt` (blank for legacy).
- The labels follow `CONTEXT.md`: "store script", and "exhausted" for a store that used up its attempts.

## Spine reach

ui · api client · test · drive (stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `scripts-helpers.test.ts`: the state counts' labels, the legacy title, and the detail's state ordering
      (exhausted first)
- [x] `tools/sync-console-scripts-drive.mjs` (stubbed): the list, the detail, SQL absent when the door sends `null`,
      and the store page's Scripts tab fields
- [x] `npm run typecheck`, `npm test`, `npm run lint`

## Boundaries

No controls here: Send, Withdraw and Retry are 664.

## Done when

The proofs above hold.

## Blocked by

BackOffice [3207](C:/Work/DMSCO/BackOffice/.issues/3207-the-console-lists-sent-store-scripts-with-their-state-counts-and-only-a-grant-holder-reads-the-sql.md)

## Done (2026-10-29) — stubbed; live waits on BackOffice 3207

- `ScriptsPage` (`/admin/sync/scripts`, nav after Objects) off `GET ActionSync/Scripts?page=&pageSize=50`; a title
  opens `ScriptDetailModal` off `GET ActionSync/Scripts/Detail?scriptId=` — header, SQL in a read-only `<pre>` only when
  `sql` is a string (else a one-line note, never the text), per-store rows with the exhausted first
  (`orderScriptStores`: exhausted, retrying, pending, withdrawn, executed, unknown last; door order kept within).
- Store page Scripts tab: Title (legacy = "untitled (legacy)"), Sent at, State (the door's derived state; an older door
  with no `state` still reads Executed / Failed / Not run), Attempts. `wire.normaliseStoreScripts` fills a pre-3207 door.
- Proof: `scripts-helpers.test.ts` 14 + `wire.test.ts` +2 (mutation-checked); drive **36/36 stubbed**;
  typecheck, vitest, lint 5/5, build green.
- Review fixes (2026-10-29): an older door's store tab draws a blank title, not "untitled (legacy)" (`storeScriptTitle`);
  states read case-insensitively; the per-store grid is capped at 12 rows and virtualised; the detail is subscribed
  once; the count cells read the row's own count. +7 helper tests (red first), drive 81 → 89 (new checks red first).
- 🚩 Contract guesses (the doors are not built and the contract does not list them yet): state values lowercase
  (`executed|pending|retrying|exhausted|withdrawn`), `targetMode` `all|chosen` (read case-insensitively), the detail
  flat (header fields + `stores[]` + `sql`), the list paged by `page`/`pageSize`. The legacy title is the bundle's
  words, never the door's string.
- For 664: the list has no control column yet; the detail's footer and `buildScriptStoreColumns` are where Withdraw /
  Retry all and the per-row Retry go; `SCRIPTS_KEY` invalidates list + detail together. `canRunScripts` is not yet on
  the access model.
