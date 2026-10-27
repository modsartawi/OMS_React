---
status: open
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 622
---

# 623 — A master's version history shows who, when and a note, and Restore makes a new version

## What to build

On the master's page (622), a **Versions** section from `GET IdfPriority/masters/{id}/versions` (3161,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)): number, by, at, note, with the live
one marked. Any earlier version offers **Restore**, which asks for a note and calls
`POST …/versions/{versionId}/restore { note }`. **Restore never overwrites**: the result is a new version at the
top, now live; the restored one stays in the list unchanged. The live version offers no Restore.

## Spine reach

model/api · logic (which rows may restore) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `only a non-live version can be restored` · pure
- [ ] drive `tools/idf-upload-drive.mjs` (extend) — restore v1 with a note → v3 appears live, v1 still listed · flow

## Boundaries

New endpoints `…/versions`, `…/versions/{id}/restore` — stubbed. Keys in `insurance-idf`. Ungated until 628.

## Done when

Restore adds a new live version against stubs and the history keeps every version, proofs green.

## Blocked by

[622](622-an-idf-upload-is-checked-row-by-row-and-publish-stays-disabled-until-the-report-is-clean.md)
