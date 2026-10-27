---
status: open
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

- [ ] `exception form requires a reason, and a master only for master handling` · pure
- [ ] drive `tools/idf-exceptions-drive.mjs` — list, add a reminder row, switch it to a master, delete with a reason · flow

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
