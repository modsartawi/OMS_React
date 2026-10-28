---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 643, 644, 645, 646, 647, 648, 649, 650, 651, 652, 653
---

# 654 — The 3185 IDF screens call the live endpoints on staging

## What to build

Walk every 3185 screen against a staging SIS.Api once BackOffice 3187–3197 ship:

- reconcile every dated 3185 line under the [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)'s
  **Changes** into the model and the stubs;
- grants: the draft actions check the IDF edit grant (`canEditIdf`); general-master and group writes check the new
  general-edit grant (`canEditGeneral` on `GET IdfPriority/Access`); reads stay on the view grant;
- an owner walk: one master edited through a draft and published; a stale draft rebased; one general item set and
  cleared; a general upload previewed and applied; the change log filtered; a group added, imported, and a non-empty
  group refused on remove.

## Spine reach

api (live) · component (probes) · drive (live)

## Proof (→ `tdd` red-green cycles)

- [ ] the 3185 IDF drives run live on staging, green · flow
- [ ] owner walk recorded in this ticket

## Boundaries

Depends on BackOffice 3187–3197 deployed to staging, with their DDL and the `IDF_GENERAL_EDITOR` grant seed applied.
Never publish a master or apply a general upload on prod from a drive.

## Done when

Every 3185 screen works live on staging with its grants, drift reconciled, owner walk recorded.

## Blocked by

[643](643-a-masters-page-lists-the-items-of-its-live-version-or-any-old-one.md) to
[653](653-idf-groups-import-in-bulk-with-a-row-report-and-apply-only-on-confirm.md)

## Reconciled — 2026-10-28 (code half; the live walk is still open)

Checked against the BackOffice source on `pricing2` (`IdfPriorityWebEndpoints`, `IdfGeneralWebEndpoints`,
`IdfGroupWebEndpoints`, `IdfPriorityAdminModels`, `IdfGeneralAdminModels`, `IdfGroupAdminModels`, `IdfGroupWidths`,
`IdfGeneralAdminService(.Upload)`, `IdfGroupAdminService(.Upload)`), then the brief's `## Changes` (2026-10-28 lines).
The source and the brief agree; where the source's own doc comment lags its code it is noted below.

- **Grants (new).** `GET IdfPriority/Access` → `{ canViewIdf, canEditIdf, canEditGeneral }` is probed once
  (`idfAccessQuery`, `useIdfAccess`), fail closed (`idfGrants`: only an explicit `true` grants; pending / error = none).
  Draft actions (Start, Add, Add a group, row Re-rank / Remove, Rebase, Publish, Discard — someone else's too) follow
  `canEditIdf` through `draftActions`; without it the draft still reads and says it is view-only. Set item, a row's
  Edit / Clear, the General Upload block (upload + Apply), and every group write (Add, Edit, Remove, Import) follow
  `canEditGeneral`. Reads, exports and templates stay on view (the General Template moves into the action row when the
  Upload block is hidden). 619–627's master create / upload screens are not regated here (628's).
- **Entries (643/644).** Matched: the client never sends `pageSize` and pages by the door's own `pageSize` (default 50,
  max 500; the draft's base read asks 500). `IDF-00013` / `IDF-00037` need no client branch. The stub's refused export is
  now `IDF-00013`; its refused template a 500 (the real door never refuses it).
- **Drafts (645/646).** Drifted: a master with nothing live starts a draft with `baseVersionId ''` — `useDraft` read the
  entries with an empty id; now `draftBaseVersion` skips the base read (every row added). Rebase / add-a-group answers
  are read nested only (`{ draft, reapplied | added, rows }`; the spread fallback dropped), rows carry `edit`. Rebase now
  SHOWS its result: the re-applied count and a table of the dropped edits (item, edit, rule word, message), held in
  `OpenDraft` so it survives the panel leaving the stale state. Rule words: `notInDraft` added (`draftRuleWordKey`);
  `itemNotInGroup` was already there; the refusal is read from `data`. Publish is also off on an empty draft
  (`IDF-00033`). Stub codes now `IDF-00029/30/31/33/34/35/36`; a second start carries `data { draftId, by, startedAt,
  changedAt }`; rebase drops a re-rank whose item the live version no longer holds.
- **General row (647).** Matched: the list keys off `kind === 'general'`, never null fields; the stub row now has the
  door's real shape (`insurerCustomerId ''`, `storeListId ''`, `hardThreshold 4`, `reminderThreshold 1`), and the masters
  drive stays green (no thresholds drawn).
- **Single edit (648).** Drifted: the group box now refuses more than 8 characters (`groupTooLong`, EN+AR). Stub codes
  `IDF-00039` / `IDF-00040` / `IDF-00041`; a clear answers the item row with `idfNumber ''`, `priority 0`.
- **General upload (649).** Drifted: after a partial or empty apply the same upload can be confirmed again
  (`canConfirmApply`) — Apply stays on beside the kept report, with a hint; a full apply turns it off. Stub: a failed
  batch leaves the upload confirmable, a re-confirm writes the rest; `applied` counts only the items written (an
  unchanged line is skipped, as 3193's `ApplyBatchAsync` does); codes `IDF-00042` / `IDF-00043`.
- **Change log (650).** Drifted: sides are read by the row's `entity` from the keys the services write — an item's
  `{ idfNumber, priority }` (none when the item was in no group), a group's `{ idfNumber, description, dosageForm }`
  drawn as its description · dosage form (it used to be mistaken for an item pair because it carries `idfNumber`);
  the string / guess paths are gone. Rows gain `idfNumberBefore` / `idfNumberAfter`; the stub filters on them as the door
  does. `IDF-00044`; export name `idf-general-changes….xlsx`.
- **Groups (652).** Drifted: number max 8 (was 26 — form, tests, EN+AR copy), description max 300 and dosage form max 50
  checked in the form. A refused remove (`IDF-00047`, `data { idfNumber, itemCount, entryCount }`) now says which holds
  the group — items and/or live rankings, each with its count — and Remove stays off when either count is above 0
  (`removeRefusal`, `removeRefusedForGood`). Group writes send no reason (matched). Stub codes `IDF-00045/46/47`.
- **Groups import (653).** Drifted: rules add `descriptionTooLong`, `dosageFormTooLong` (EN+AR words, the door's order);
  `action` may be `''`; the report reads `lineCount`; apply reads `{ added, updated, unchanged }` and the toast and result
  show unchanged too. Stub codes `IDF-00048` / `IDF-00049`.
- **Fixtures.** `IDF-PARA-500` (12 characters, longer than any real group) is `IDF-PARA` in every stub, drive and test.

In the BackOffice source but not in the brief (none breaks the client): `IdfGroupWebEndpoints`' remarks still say
`IDF-00047` carries `data { idfNumber, itemCount }`, but `IdfGroupHasItemsException.FailureData` sends `entryCount`
too (the brief is right); the draft door marks no rows, so the client keeps its base-version diff; publishing a draft
takes an optional note (the client still asks for one); a general apply's `applied` counts only changed items; a group's
change-log snapshot repeats its `idfNumber`.

Proof: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and the nine 3185 drives on stubs (items,
export, draft, general, general-upload, changes, groups, upload, masters) on port 52680 — 60/60, 36/36, 146/146,
112/112, 76/76, 60/60, 126/126, 96/96, 86/86 (new checks: draft 11 rebase result, 16 empty start, 17 no `canEditIdf`;
general 14 no `canEditGeneral`; general-upload 4 re-confirm; groups 15 live rankings, 16 unchanged, 17 no grant). The live twin,
`tools/idf-3185-live-drive.mjs` (read-only), is written but NOT run: it waits on the sign-in with the owner.
