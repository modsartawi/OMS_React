---
status: open
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

- [ ] `an upload is publishable only when ok and no row failed` · pure
- [ ] drive `tools/idf-upload-drive.mjs` — a failing file shows its row report with Publish disabled; a clean file publishes with a note and the live version moves · flow

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
