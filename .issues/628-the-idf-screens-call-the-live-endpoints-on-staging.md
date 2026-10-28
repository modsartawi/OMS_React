---
status: open
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619, 620, 621, 622, 623, 624, 625, 626, 627
---

# 628 — The IDF screens call the live endpoints on staging

## What to build

Walk every IDF leaf against a staging SIS.Api once BackOffice 3161, 3162, 3166, 3167, 3168 and 3169 ship:

- reconcile every dated line under the [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)'s
  **Changes** into the model and the stubs;
- add the access probes: each leaf checks the IDF view grant, and the write actions (create / edit master, upload,
  publish, restore, exception changes, store-list changes) check the IDF write grant — following the probe pattern
  618 lands for the group;
- an owner walk: upload a sample with a bad row, fix it, publish, restore; one lookup per tier.

## Spine reach

api (live) · component (probes) · drive (live)

## Proof (→ `tdd` red-green cycles)

- [ ] the IDF drives run live on staging, green · flow
- [ ] owner walk recorded in this ticket

## Boundaries

Depends on BackOffice 3161, 3162, 3166, 3167, 3168, 3169 deployed to staging, and on the grant names they mint.
Never publish a master on prod from a drive.

## Done when

Every IDF leaf works live on staging with its grants, drift reconciled, owner walk recorded.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md) to
[627](627-the-idf-swap-report-groups-by-master-store-and-payer-and-exports-to-excel.md); BackOffice 3161, 3162,
3166, 3167, 3168, 3169

## Open questions

- IDF requests (stories 15–17) are not minted: they wait on spec 3157 open question 1.

## Comments

- 2026-10-28 — **Reconcile half done on `fix/628-idf-reconcile` (not merged); the staging walk and the owner walk
  remain, so this stays open.** Every leaf now speaks the doors as the brief's `## Changes` lines describe them
  (BackOffice door code read where a line was terse):
  - **Masters (3161):** `payerCode` → `insurerCustomerId` in the model, the form, the body and every Payer column (EN
    "Insurer customer id" / AR "رقم عميل شركة التأمين", placeholder `0001100336`, sent trimmed and never upper-cased —
    the cause of `IDF-00005` on every create). Overlap is `IDF-00015`; the refusal names the clash from
    `clashingNameEn/Ar` and lists `sharedStores`. Versions show `entryCount`; `isLive` is always read. Upload accepts
    `.xlsx/.txt/.tsv/.csv` (not `.xls`), shows `lineCount`, and its rules are `unknownItem | notInInsurerItems |
    unknownGroup | itemNotInGroup | badPriority | duplicateItem` (`itemNotInGroup` from the 3157 review, with an EN/AR
    word).
  - **Store lists (3162):** `{ code, nameEn, nameAr, isPilotList, storeCodes, addedTime }`; create posts
    `{ code, nameEn, nameAr }` (code checked client-side: plain ASCII, no comma, ≤ 26), rename puts
    `{ nameEn, nameAr }`; the delete button and `remove` door are gone (3162 builds none). Refusals show
    `IDF-00016`'s `badStoreCodes` and `IDF-00015`'s clash.
  - **Exceptions (3166):** `allStores` (column + checkbox, default off = pilot stores only); DELETE sends `{ reason }`
    in the BODY (`api.delWithBody`); Nphies claim type must be a whole number; reason ≤ 400; key hints per kind.
  - **Lookup (3168 + 3166):** tiers are `insurerAtStoreList | insurer | store | general` (+ `exceptionMaster`); the
    deciding tier is read off `sourceTier`; the master is named from the answer; the item, IDF group and insurer
    are shown; `skippedTiers[].reason` / `masterId` are carried (word fallback when the server text is blank); the
    `exception` row is shown; the cash line comes from `documentTypeCanForcePick === false`. `payer` is optional (the
    insurer customer id), and `subDocumentType` / `nphiesClaimType` are new optional fields.
  - **Events (3167):** `{ page, pageSize, total, rows }` with the built row (store + till, trx, `insurerCustomerId`,
    scanned / dispensed item, source tier, master + version, decision, outcome + `allCandidatesDearer` reason,
    scanned / dispensed unit price **per base unit**, `durationMs`); `alternativeTaken` is a live outcome in the filter.
  - **Swap report (3169):** `{ from, to, rows, totals }` with the fixed counts (events, reminders, of which all
    candidates dearer, forced picks, alternatives taken, cancelled, abandoned, exception skips, pre-auth refusals),
    price difference **per base unit** at 3 dp, average time from `averageDurationMs`, a Total footer, an empty master
    read as General; the fallback export name is the door's (`idf-swap-report-yyyyMMdd-to-yyyyMMdd.xlsx`).
  - **Stubs + drives:** `tools/idf-stubs.mjs` reshaped to the built doors and `IDF-0000n` codes; all six IDF drives
    re-pointed and green on a separate Vite (86 + 60 + 96 + 46 + 54 + 94 checks). `doors.test.ts` pins every
    request body / query. `typecheck`, `lint` (five gates) and the full `vitest` run (517 files) are green.
  - Not verified against the live SIS.Api: the doors are cookie-gated, so the staging and owner walks below are
    still the proof.
