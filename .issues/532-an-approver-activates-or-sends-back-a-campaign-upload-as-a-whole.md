---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2839-oms-react-campaign-upload-brief.md
blocked-by: 530 (live: BackOffice 2837)
---

# 532 — An approver activates or sends back a campaign upload as a whole

## What to build

The brief's U3. Approvers see every deal's upload and open one beside what is live. They then activate
the whole upload as **one** ruleset version, or send it back with a note. **There is no per-campaign
approval and no edit.** The fix for a bad campaign is a new workbook. Contract: the 2839 brief
§ "Approvals → Uploads" and the 2737 brief's `Uploads/List|Load|Activate|SendBack` rows.

oms-react has **no Approvals screen** to add a tab to: draft approval is the workspace's
`ApprovalPanel`, per campaign. So this slice adds the uploads list as its own page in
`features/campaigns/uploads/`, at `/campaigns/uploads` with a menu leaf, and opens an upload at
`/campaigns/uploads/:dealCode`. 530's success line links here.

- **The list** (`Uploads/List`): one row per deal, newest upload first. Columns: `dealCode`, a `state`
  badge (`pending` / `sentBack` / `activated`, an unlisted state rendered as sent), `revision`,
  `campaignCount`, `skuCount`, the window (inclusive days), `uploadedBy`, `uploadedAt`, and for a reviewed
  upload `reviewedBy` / `reviewedAt` / `versionNo`. A state filter, `pending` by default, held in the URL.
- **The opened upload** (`Uploads/Load { dealCode }`):
  - the summary: deal, note, file name, uploader and time, stacking, counts per mechanic, generated
    Arabic names, SKU count, window, and the read's warnings as a list;
  - the last review (`reviewedBy`, `reviewedAt`, `reviewNote`, `versionNo`) when there is one;
  - the **campaigns grid**: `id`, compete/stacks from `competes`, and **new** (`live` null), **changed**
    (both present and different) or **unchanged** (equal). Opening one shows the uploaded `campaign` and
    the `live` one side by side as read-only JSON;
  - the **disabling** list, red: "Activating disables these N live campaigns." (`campaign` null, `live`
    the one switched off);
  - the **would-refuse** lines (`errors`) above the buttons when they are not empty. A stale-order line is
    plain text and comes first.
- **Activate** (`Uploads/Activate { dealCode, revision, note? }`, with the **loaded** revision): a confirm
  dialog repeats the counts and the disabling list. On success it shows "Version N is live: A campaigns
  activated, D disabled" from the reply, plus the checker's `warnings`, then refreshes the list and the
  upload.
- **Send back** (`Uploads/SendBack { dealCode, revision, note }`): a dialog with a required note. On
  success the upload shows `sentBack` and the note.
- **Refusals**, shown in the dialog the way draft approval shows them (`apiErrorMessage` + code), with the
  upload left as it was:
  - 403 `RULES_SELF_APPROVAL`;
  - 409 `RULES_UPLOAD_STALE`: offer a reload;
  - 409 `RULES_NOT_PENDING`;
  - 409 `RULES_ORDER_STALE`;
  - 400 `RULES_INVALID_CAMPAIGN`, with its `errors` details listed, one line each;
  - 400 `RULES_REASON_REQUIRED`;
  - 404 `RULES_UPLOAD_NOT_FOUND`, for a stale link;
  - 400 `RULES_BAD_REQUEST`;
  - a bare 403, meaning no grant: "You do not have access to this action".
- **Grants:** readers (03) see the list and the opened upload. The buttons are for approvers (06), but
  there is no probe, so the screen shows them and the 403 path is what guards them (a hiding probe is
  529's kind of BO ask, not this slice's).

## Spine reach

api (feature `api.ts`: List, Load, Activate, SendBack) · logic (campaign compare, list filter, refusal
view) · route + menu + pages + dialogs · i18n EN · test

## Proof (→ `tdd` red-green cycles)

- [ ] `compareCampaign`: `live` null → new; equal JSON with keys in a different order → unchanged; a changed value → changed; a disabling row → disabled (vitest)
- [ ] `uploadListFilter`: the default is `pending`; an unlisted state still lists under "all"; newest upload first is kept (vitest)
- [ ] `uploadRefusalView`: each code above maps to its message and its offered next step (reload for STALE, send back for ORDER_STALE / INVALID_CAMPAIGN), and the `errors` details are carried through (vitest)
- [ ] `tools/campaign-uploads-drive.mjs` gains: the list with three states and the filter in the URL; an opened upload with new, changed and unchanged campaigns and two disabling rows; side-by-side JSON; Activate's success line; a Send back without a note refused; `RULES_SELF_APPROVAL` and `RULES_UPLOAD_STALE` shown in the dialog with the upload unchanged. LTR and RTL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Doors: `Rules/Authoring/Uploads/List|Load|Activate|SendBack` (BackOffice 2837, built). Stubbed until 533.
- New routes `/campaigns/uploads` and `/campaigns/uploads/:dealCode` (static, beside `campaigns/:id`), and
  a menu leaf. Keys in `campaign-uploads`.

## Done when

The Proof boxes are ticked: on the running app (stubbed), an approver opens a pending upload, sees what it
changes and disables, activates it or sends it back, and every refusal reads in the dialog.

## Blocked by

[530](530-an-author-uploads-a-campaign-workbook-and-reads-its-all-or-none-report.md)

## Open questions

- **Where Uploads lives:** the brief says "a tab of Approvals", but oms-react has no Approvals list. This
  ticket's default is the own page above. Overrulable if the owner wants an Approvals page with Drafts and
  Uploads tabs (Drafts would need a pending-drafts list door HQ does not have).
