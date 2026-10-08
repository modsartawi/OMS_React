---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2463-an-operator-deletes-a-coupon-import-uploaded-by-mistake-spec.md
blocked-by: BackOffice 2477 (live endpoint; build against the contract below with stubs meanwhile)
---

# 440 — An admin downloads what a coupon upload did with each code

Added to spec 2463 on 2026-10-08 (owner): "once the file is uploaded … can I redownload the result?
I only see added and skipped, so I want to know which is which." See the spec's *Amendment
2026-10-08*. The server half is BackOffice [2476](C:\Work\DMSCO\BackOffice\.issues\2476-the-coupon-engine-records-each-staged-codes-import-outcome.md)
(engine records each outcome) and [2477](C:\Work\DMSCO\BackOffice\.issues\2477-an-admin-downloads-an-uploads-per-code-result.md)
(the door). Builds on 439 on the same branch: it reuses 439's `Deleted` status and jobs-grid
actions.

## What to build

Work in `src/features/pricing/coupons` and `src/core/models/coupons.ts`.

**Model + api**
- `ImportJobResult` and `ImportJobResultLine` (contract below) in `core/models/coupons.ts`.
- `couponsApi.jobResult(jobId)` → `GET CouponsAdminWeb/Jobs/{jobId}/Result`.

**Jobs grid on the Import screen**
- A **Download result** action on Completed, Failed and Deleted rows. Pending and Processing rows
  have none. It sits beside 439's Retry/Delete in `jobActions`.
- While it loads, the row's action is busy and a second click does nothing. A refusal goes through
  the existing `notify.apiError` path.

**The file**
- CSV through `downloadCsv` (`@/core/util/download-file`). Columns: code, outcome, template.
  Headers and outcome words are localised; codes and template ids are written as-is, with no
  `fsi` ([bidi](../.claude/rules/bidi.md): never in an export).
- Outcome words: Added · Already in this template · In another template · Not processed · Unknown.
  The template column carries `heldByTemplateId` for the two skip kinds, empty otherwise.
- File name built from the template id and job id, e.g. `OMS000000619-06GHFEGG…-result.csv`.
- **A reconstructed result** (`reconstructed: true`, a job imported before SIS.Coupons.Core 1.0.8)
  is still downloaded, after a toast that says so. On a Deleted job the toast says its added codes
  show as Unknown, because they were rebuilt after the delete.
- A short summary toast after the save, from the lines: added, already in this template, in other
  templates (and how many templates), not processed.

All new strings are in English and Arabic.

## Wire contract (fixed by BackOffice 2477; build against it, do not change it here)

```ts
// GET CouponsAdminWeb/Jobs/{jobId}/Result       (404 unknown job; 409 still running)
interface ImportJobResult {
  jobId: string
  templateId: string
  status: 'Completed' | 'Failed' | 'Deleted'
  reconstructed: boolean
  lines: ImportJobResultLine[]    // every staged code, ordered by couponCode
}
interface ImportJobResultLine {
  couponCode: string
  outcome: 'Added' | 'AlreadyInTemplate' | 'InOtherTemplate' | 'NotProcessed' | 'Unknown'
  heldByTemplateId: string | null
}
```

## Spine reach

UI → app (the BackOffice 2477 endpoint)

## Proof (→ `tdd` red-green cycles)

Vitest, next to `helpers.test.ts`.

- [x] `jobActions`: Completed, Failed and Deleted rows offer Download result; Pending and
      Processing do not. 439's Retry/Delete expectations stay as they are.
- [x] `importResultCsv`: lines become rows with the localised outcome word and the holder template
      only on the two skip kinds; a code containing a comma or quote is escaped.
- [x] `summarizeImportResult`: the counts per outcome and the number of distinct holder templates.
- [x] `tsc`, `npm run lint` and the existing coupon tests stay green.
- [ ] **OWNER: the walk on staging**, after BackOffice 2477 is deployed and **before** 439's walk
      deletes job `06GHFEGGVDNRTFR8Q6VBGMGNA7`: download its result. It is reconstructed (a
      pre-1.0.8 job): 2,904 Added and 12,096 In another template, `OMS000000618`.

## Boundaries

oms-react only. Deploy after the SIS.Api that carries BackOffice 2477. No feature flag: the action
shows only on the `CouponsAdmin` screen. Until it lands, prove the screen against stubs.

## Done when

The helper tests are green and the build and lint pass. The owner walk closes it after deploy.

## Blocked by

BackOffice 2477, for the live endpoint only. The code can be built now against the contract.

## What was done (2026-10-08)

Built on `spec/2463-coupon-import-delete` on top of 439, against **stubs** of BackOffice 2477's
contract; nothing has run against a live SIS.Api. The owner walk is still open.

- Model + api: `ImportOutcome`, `ImportJobResult(+Line)` (status typed as the finished subset of
  `ImportJobStatus`); `couponsApi.jobResult`.
- Helpers (vitest, 24 coupon tests): `jobActions.download`, `importResultCsv`,
  `importResultFileName`, `summarizeImportResult`, `describeImportSummary` (Added always, the other
  outcomes only when they happened, and an Unknown line, which the ticket did not list but a
  rebuilt Deleted job needs).
- The file: UTF-8 BOM (so Excel renders the Arabic outcome words), CRLF, RFC-4180 quoting, no
  isolate, no formula guard and no `sep=,` line, so codes come out exactly as staged.
- Jobs grid: Download result on Completed, Failed and Deleted rows; while one loads every Download
  button is disabled. A rebuilt result warns first (the Deleted variant says its added codes show
  as Unknown) and is still saved; the summary toast lists one outcome per line.
- `src/app/global.css`: toast descriptions keep their line breaks (`white-space: pre-line`), an
  app-wide one-liner that only changes a description containing a newline.
- Drive: `tools/coupon-import-delete-drive.mjs` 65/65, LTR + RTL, stubbed (shared with 439).
  `npm test` 4129+, build and lint green.
- Reviews: correctness (summary never says "held by 0 templates"; docblock no longer claims the
  file uploads back as-is) and standards+spec (stale comment, status type), all fixed.

**Owner calls left open**
- The header row is a line like any other to the import parser. Re-uploading a trimmed result
  file needs its header row deleted first; a parser that skips a first line equal to the localised
  header would remove that step.
