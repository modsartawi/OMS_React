---
status: done
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619
---

# 622 — An IDF upload is checked row by row, and Publish stays disabled until the report is clean

## What to build

A master's page (`/insurance-rules/idf/masters/:masterId`, opened from the list) with an **Upload** step (doors
3161, [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)):

- pick a file (item, IDF group, priority) and send it to `POST IdfPriority/masters/{id}/uploads`; the upload
  publishes nothing;
- the row report lists every failing row: line, item number, the rule broken, and the message in the reader's
  language (`messageEn` / `messageAr`). The server checks in this order: unknown item · item not in the insurer's
  ItemCustomer rows · unknown IDF group · priority not a whole number ≥ 1 · item listed twice;
- **Publish is all-or-nothing**: the button is disabled unless the report's `ok` is true, and asks for a note;
  `POST …/uploads/{uploadId}/publish { note }` returns the new live version, which the page and the list then show;
- a new upload replaces the previous report.

## Spine reach

model/api (multipart, as 613's edition upload does it) · logic (publishability) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `an upload is publishable only when ok and no row failed` · pure
- [x] drive `tools/idf-upload-drive.mjs` — a failing file shows its row report with Publish disabled; a clean file publishes with a note and the live version moves · flow

## Boundaries

New endpoints `…/uploads`, `…/uploads/{id}/publish` — stubbed. A refused publish is a business outcome (show its
message). Keys in `insurance-idf`. Ungated until 628. Line and item numbers are machine values; server messages are
free text (`<bdi>`).

## Done when

Against stubs, a dirty upload cannot be published and a clean one publishes a new live version, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)

## Open questions

- Spec 3157 OQ4 (is the Insurance Item Master the insurer's `ItemCustomer` rows?) changes only the server's rule
  and message; the screen renders whatever rule the report names.

## Comments

**2026-10-27 — built (impl/3157-622).** `idf/upload.ts` (report types, `isPublishable`, `rowMessage`, `uploadForm`),
`idfUploadApi` under the 622 slot (`api.upload` multipart part `file`, as 613; publish `{ note }` → `IdfMasterVersion`),
`MasterPage.tsx` at `idf/masters/:masterId` (header: name, kind, payer / store list, thresholds, live version; the
Upload step; `{/* 623 · Versions */}` slot under it), the list's name cell links to it. Keys under `upload` (EN + AR,
Arabic plural six forms). Proof: `upload.test.ts` 7/7, `i18n-keys.test.ts` + 2; drive `tools/idf-upload-drive.mjs`
56/56 STUBBED (LTR + RTL), stub `idfUploadStub` in `tools/idf-stubs.mjs` (report by file name: `dirty` / `notok` /
clean).

Decisions (overrulable):
- **Publishable = `ok` AND no rows** — if the server's flag and its rows ever disagree, nothing publishes.
- **The note is required** (Publish off on a blank note); "asks for a note" read as must-give.
- **No single-master door**: the page finds the master in `GET IdfPriority/masters`; a publish invalidates `IDF_KEY`
  so the page and the list both show the new live version. 628 may want `GET …/masters/{id}`.
- **Picking a new file clears the report**; a publish clears the consumed report and the note.
- **Rule codes guessed** (`unknownItem`, `notInItemCustomer`, `unknownGroup`, `badPriority`, `duplicateItem`) — a code
  without a key renders raw in `Ltr`; 628 reconciles the spelling with BackOffice 3161.
- Line and item number in `Ltr`; the message in `<bdi>`, by reader language with an English fallback.

