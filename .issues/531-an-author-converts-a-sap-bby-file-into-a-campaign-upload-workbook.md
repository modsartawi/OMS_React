---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2839-oms-react-campaign-upload-brief.md
blocked-by: 530 (live: BackOffice 2838)
---

# 531 — An author converts a SAP BBy file into a campaign upload workbook

## What to build

The brief's U2. SAP's BBy file is **never uploaded**: it is converted into our workbook, which the author
reviews, completes and then uploads with 530's step 2. Contract: the 2839 brief § "Campaigns → Upload"
step 1, and the 2737 brief's `Uploads/ConvertBby` row.

- On 530's page, beside "Download the template": **"Convert a SAP BBy file"**. It picks a `.txt`, calls
  `Rules/Authoring/Uploads/ConvertBby` (multipart `file`) through 530's POST blob request, and saves the
  returned `.xlsx` under the reply's name (`<DealCode>.xlsx`).
- After a conversion, the **next step in words**: open it and review it (the proposed DealCode, the names,
  every PRICE value), read its `Convert notes` sheet if it has one, then upload it below. The conversion
  stores nothing, and its notes live only in the workbook, so the screen says that and shows nothing else.
- **400 `RULES_BAD_UPLOAD`** (no BBy row, more than one SAP deal number, not a `.txt`, over 10 MB): the
  server's message. A bare 403 reads "You do not have access to this action".
- Words: "convert a SAP BBy file", never "BBy upload" for our workbook and never "import".

## Spine reach

api (feature `api.ts` over 530's POST blob) · component (button, picker, next-step copy) · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/campaign-uploads-drive.mjs` gains: a conversion saves under the stubbed `Content-Disposition` name; the next-step copy shows after it; a 400 `RULES_BAD_UPLOAD` shows the server's message and no next step; the picker accepts `.txt` only. LTR and RTL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: `Rules/Authoring/Uploads/ConvertBby` (BackOffice 2838, built). Stubbed until 533.
- Keys in `campaign-uploads` only.

## Done when

A `.txt` picked on the running app (stubbed) saves the converted workbook under the server's name and
shows the next-step copy, and a refused file shows the server's message.

## Blocked by

[530](530-an-author-uploads-a-campaign-workbook-and-reads-its-all-or-none-report.md)
