---
status: done
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619
---

# 624 — IDF exceptions: rows keyed by document type, sub-document type or Nphies claim type skip, remind or use a named master, with a reason on every change

## What to build

A leaf **IDF exceptions** at `/insurance-rules/idf/exceptions` (doors 3166,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)):

- the rows: key kind (document type | sub-document type | Nphies claim type), key, handling (skip | reminder |
  master, the master named in the reader's language), reason, by, at;
- add, edit and delete a row; each asks for a reason (`POST`, `PUT …/{id}`, `DELETE …/{id}`, each with `{ reason }`);
- "master" handling requires picking a master from 619's list.

The seed (SABIC skips; TCS offline, GOSI and delivery insurance skip) is server data; the screen shows whatever rows come.

## Spine reach

model/api · logic (exception form) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `exception form requires a reason, and a master only for master handling` · pure
- [x] drive `tools/idf-exceptions-drive.mjs` — list, add a reminder row, switch it to a master, delete with a reason · flow

## Boundaries

New endpoints `IdfPriority/exceptions` — stubbed. Keys in `insurance-idf`. Ungated until 628. Not 614's guard
exceptions (`/insurance-rules/exceptions`) — the menu label says "IDF exceptions".

## Done when

Exceptions can be listed, added, edited and deleted with reasons against stubs, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)

## Open questions

- Spec 3157 OQ2 (what "dedicated handling" means per exception; how GOSI and delivery are recognised) may add key
  kinds or handlings. The screen follows the brief's three key kinds and three handlings until 3166 says otherwise.

## Comments

**2026-10-27 — built (impl/3157-624).** `idf/exceptions.ts` (types, `exceptionFormProblems`: key and reason always,
a master only for "master"; `exceptionBody` sends `masterId: null` unless "master"; `formFromException` opens an
edit with a BLANK reason, so every change records its own), `idfExceptionsApi` + `exceptionsQuery()` under the 624
slot of `idf/api.ts` (key `IDF_EXCEPTIONS_KEY`), `ExceptionsPage.tsx` at `/insurance-rules/idf/exceptions` (plain
table; add/edit dialog, delete dialog asking a reason; master picker = 619's `mastersQuery()`, names by language
via `masterName`, `fsi` in the native `<option>`), menu leaf `menu.idfExceptions` (icon `ListX`), keys in
`insurance-idf` → `exceptions` (EN + AR; Arabic "master" = 619's قائمة رئيسية). Proof: `exceptions.test.ts` 6/6,
`i18n-keys.test.ts` +2, drive `tools/idf-exceptions-drive.mjs` 46/46 STUBBED (LTR + RTL; stubs `// --- 624 ---`
in `tools/idf-stubs.mjs`); typecheck, test (6942), lint green.

Decisions (overrulable; 628 reconciles with 3166):
- **DELETE's reason rides as `?reason=`**: `api.del` takes no body (house rule in `core/api.ts`), so the brief's
  `DELETE …/{id}` `{ reason }` is sent on the query string. 3166 must read it there, or 628 widens `core/api`.
- **POST / PUT body** is the whole row: `{ keyKind, key, handling, masterId | null, reason }` (the brief names only
  `{ reason }`).
- A row whose master is not in 619's list shows its `masterId` (Ltr) instead of a name.
- No client-side duplicate-key check: a clash is the server's to refuse (its envelope message is toasted).
- **Review fixes (2026-10-27):** the dialog's master `<select>` keeps a fallback `<option>` (in `fsi()`) for a
  `masterId` the list does not hold, as the master form and the events filter do. Not drive-proven: the stub has
  no exception naming an unknown master (typecheck + read).
