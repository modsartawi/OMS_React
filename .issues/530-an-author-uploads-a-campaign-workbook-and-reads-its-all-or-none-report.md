---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2839-oms-react-campaign-upload-brief.md
blocked-by: — (live: BackOffice 2836)
---

# 530 — An author uploads a campaign workbook and reads its all-or-none report

## What to build

**Slice 0 of campaign uploads** (BackOffice ADR 0097, tickets 2836–2838, brief 2839, the brief's U1). A
marketer downloads the template, fills one workbook for one **deal**, uploads it, and reads what HQ made
of it. **The brief is the contract; read it whole before starting**, and the door-by-door shapes in
`C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md` § "HQ contract: campaign uploads
(2836-2838)". Its "rules the screens live by" are decided; don't re-derive them: all or none, a valid read
IS the approval request (no request door; the Note is a workbook row), one pending upload per deal, no
per-campaign edits, `windowUntil` inclusive, generated Arabic names flagged, and the words "campaign
upload", "deal", "campaign".

- **Model** `core/models/rule-upload.ts`, field for field from the contract: the read report, the issue
  row (`at`, sheet, row, column, message), the summary, the detail (`Load`), the activation. The detail
  and activation are types only; 532 uses them. The closed lists (mechanic, stacking, kind, state) are
  string unions plus `string`, so an unlisted value still parses and renders.
- **A body-bearing file request in `core/api`.** `api.blob` is GET-only, and its comment says to add a
  body-bearing binary request "when one exists". Both file doors are `POST`: `Template` (no body) and
  `ConvertBby` (multipart, 531). Add one POST blob request that takes an optional `FormData`, with the same
  send/401/failure tail as `requestBlob`. A refusal on a file door is the usual JSON envelope (400), so it
  throws the usual `ApiError`. The name comes from `Content-Disposition`, falling back to
  `campaign-upload.xlsx`.
- **Feature** `features/campaigns/uploads/` (namespace `campaign-uploads`, registered in `core/i18n.ts`,
  EN only like the area's other namespaces). Route `/campaigns/upload`, a static leaf declared beside
  `campaigns/:id` like `priority`/`simulator`. A menu leaf goes in the Campaigns group.
- **Step 1, get a workbook:** "Download the template" (`Rules/Authoring/Uploads/Template`), saved under
  the reply's name. 531 adds the convert button beside it.
- **Step 2, upload:** pick an `.xlsx`, then `Uploads/Read` (multipart `file`) through `api.upload`, with a
  busy state because a real week takes seconds. The three outcomes:
  - **400 `RULES_BAD_UPLOAD`**: the message and nothing else.
  - **200, `accepted: false`**: the all-or-none message, prominent ("Nothing was stored: the file has N
    errors. Fix every one and upload the whole file again."), then the report.
  - **200, `accepted: true, stored: true`**: the success line ("Waiting for approval — deal X, revision N.
    An approver activates it as one version."), the note it carries, and a link to the upload's page (532's
    route; a plain link until 532 lands).
- **Step 3, the read report** (both 200 outcomes):
  - header: `dealCode`, `stacking`, `note`, `revision` when stored;
  - tiles: the campaign count, **every** key of `mechanics` with its count, `skuCount`, and the window
    `windowFrom`–`windowUntil` as inclusive days (one isolated range, `formatRange`), or none when null;
  - errors and warnings as one AG Grid with `at`, sheet, row, column and message, filterable by sheet.
    Errors come first and are red, warnings amber. Row 0 reads "whole sheet"; an empty column reads "whole
    row". The warnings list is open: render whatever comes back;
  - the campaigns grid: `code`, `id`, sheet `row`, `mechanic`, `stacking`, a "generated Arabic" badge on
    `nameArGenerated`. A row opens its `campaign` JSON read-only (pretty JSON in a side panel).
    The builder's sentence view lives in `features/campaigns/workspace`, and a feature can't import
    another, so reusing it means first moving the renderer up to `core/rules`. That is out of this slice.
- **Grants:** no access probe exists. A bare 403 (no body) on any door reads "You do not have access to
  this action", never an empty report. A 401 is `core/api`'s.

## Spine reach

model (`core/models/rule-upload.ts`) · api (`core/api` POST blob + feature `api.ts`) · logic (issue
display, report view, success line) · route + menu + page · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `issueView`: `Campaigns!12:Value` → sheet Campaigns, row 12, column Value; `Items!40` → whole row; `Upload` / row 0 → whole sheet; errors sort before warnings (vitest)
- [ ] `readReportView`: `accepted:false` gives the all-or-none state with N = `errors.length`; `accepted:true, stored:true` gives the waiting state with revision and note; a null window gives no range; every `mechanics` key becomes a tile, unknown ones included (vitest)
- [ ] `windowDays`: `windowUntil` is shown as sent, the inclusive last day, never moved a day (vitest)
- [ ] the POST blob request: the name comes from `Content-Disposition`, with the fallback when it is absent; a 400 JSON refusal throws an `ApiError` with `RULES_BAD_UPLOAD` (vitest, `api` tests)
- [ ] `tools/campaign-uploads-drive.mjs`, LTR and RTL, against a stub that sends the contract's JSON (a refused read with errors on all three sheets and warnings, an accepted read with a generated Arabic name and three mechanics, a 400 `RULES_BAD_UPLOAD`, a bare 403, a template download). It checks the all-or-none message, the sheet filter, the badge, the JSON panel, and the saved file name
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: `Rules/Authoring/Uploads/Template` and `Uploads/Read` (BackOffice 2836, built). Stubbed until 533.
- Refusals: 400 `RULES_BAD_UPLOAD` and a bare 403.
- New namespace `campaign-uploads`, a new static route, and a new menu leaf.
- `core/api` gains one body-bearing blob request (used again by 531).

## Done when

The Proof boxes are ticked: a workbook uploaded on the running app (stubbed) shows the right one of the
three outcomes and its full report, and the template downloads under its server name.

## Blocked by

None. It can start immediately.

## Open questions

- **Route and menu:** this ticket assumes `/campaigns/upload` with a leaf in the Campaigns group (a tab of
  the list is the brief's alternative). This is an overrulable default.
