---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 613 — The insurance team uploads an SFDA or CHI edition, reads its diff and gap report, and a second user publishes it

## What to build

**Editions**: upload the SFDA list or CHI formulary, read the diff against the live edition and the rules
affected with back-test counts; a different user publishes; the gap report lists no-match / junk / GTIN mismatch /
withdrawn and exports for the master-file team; old editions read-only.

**HQ contract:** the brief's sections for BackOffice 3138. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [x] drive (stubbed) — upload → diff → uploader cannot publish → approver publishes

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Comments

**Built 2026-10-27** (`features/insurance-rules/editions`, ns `insurance-editions`; drive
`tools/insurance-editions-drive.mjs` 90/90 stubbed, LTR + RTL). Nothing met a live SIS.Api (BO 3138 unbuilt).

Guesses where the brief (HQ contract: editions) is silent — **618 reconciles**:

1. **History row** of `GET …/Editions?list=`: `{ id, list, fileName, rows, uploadedBy, uploadedAt, state:
   pending|live|retired, publishedBy, publishedAt }`, newest first. "Old" = `retired`.
2. **No per-edition door** in the brief, so an edition's page is `/insurance-rules/editions/:list/:id` and reads its
   row from the list's history.
3. **Diff**: `added / dropped / changed` read as a count OR an array (`diffCounts` takes either);
   `newlyUnmatched` as rows `{ item, itemName: {en,ar}, sfdaCode }` (or a count); `backtestFires` one number per rule.
4. **Gap row**: `{ kind: noMatch|junk|gtinMismatch|withdrawn, item, itemName, sfdaCode, gtin, detail }`, `detail`
   being the SFDA row's GTIN on a mismatch.
5. **Export door** spelled `GET …/Editions/{id}/Gaps/Export` (an .xlsx; filename from Content-Disposition, else
   `{id}-gaps.xlsx`).
6. **Uploader refusal** code `UPLOADER_CANNOT_PUBLISH` (409). The screen also disables Publish for the uploader
   (session `userId` == `uploadedBy`, case-insensitive) with the reason shown; the server stays the authority.
7. Publishing retires the list's previous live edition (stub behaviour); a confirm names the edition and list.
8. Upload accepts `.xlsx,.xls`; no access probe (a bare 403 reads "You do not have access") until 618.
