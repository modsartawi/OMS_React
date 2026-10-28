---
status: done
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

- [x] `only a non-live version can be restored` · pure — `versions.test.ts` 5/5 (+ `i18n-keys.test.ts` 2 for 623)
- [x] drive `tools/idf-upload-drive.mjs` (extend) — restore v1 with a note → v3 appears live, v1 still listed · flow — 96/96 **STUBBED** (LTR + RTL; 40 new checks), port 5209

## Boundaries

New endpoints `…/versions`, `…/versions/{id}/restore` — stubbed. Keys in `insurance-idf`. Ungated until 628.

## Done when

Restore adds a new live version against stubs and the history keeps every version, proofs green.

## Blocked by

[622](622-an-idf-upload-is-checked-row-by-row-and-publish-stays-disabled-until-the-report-is-clean.md)

## Comments

**2026-10-27 — built (impl/3157-623).** `idf/versions.ts` (`IdfVersion`, `canRestore`, `versionRows`), `idfVersionsApi` +
`versionsQuery` under the 623 slot, `VersionsSection.tsx` mounted in MasterPage's `{/* 623 · Versions */}` slot, keys
under `versions` (EN + AR), stub `idfVersionsStub` (`IDF_VERSIONS`) in `tools/idf-stubs.mjs`. Drive 96/96 STUBBED.

Decisions (overrulable):
- **Which is live**: the server's `isLive` when it sends one, else the master's `liveVersion.versionId` — the brief
  only says "the live one marked"; 628 reconciles the field with 3161.
- **History newest first by `number`**, whatever order the door sends.
- **The note is required** (confirm off on a blank note), as 622's publish.
- **Restore is an inline panel** under the table (not a modal), one version at a time; it closes on success.
- A restore **invalidates `IDF_KEY`**: header, history and masters list all move to the new live version.
- The drive restores BUPA's v1 while v3 is live, so the new version is **v4** (the ticket's "v3" assumed a two-version
  history); v1 stays listed unchanged and restorable again, v3 becomes restorable.
- A publish (622) also shows up in the history (the stub appends the master's new live version).
