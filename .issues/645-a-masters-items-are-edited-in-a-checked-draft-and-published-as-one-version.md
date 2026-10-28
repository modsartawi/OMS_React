---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 643
---

# 645 — A master's items are edited in a checked draft, and published as one version or discarded

## What to build

One item's change should need no file, and ten edits should make one version. A **draft panel** on the master page,
doors BackOffice 3189 ([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- **Start draft** (edit grant) copies the live items into the draft; the Items table then shows the draft, with each
  row marked added / re-ranked / unchanged against the live version, and removed rows listed;
- **Add** an item (item, group, priority), **re-rank** a row, **remove** a row. A refused edit shows the rule's
  message in the reader's language and leaves the draft as it was;
- **Publish** asks for a note and returns the new live version (list and Versions refresh); **Discard** asks to
  confirm;
- the draft is read from the server on load, so it survives closing the browser.

## Spine reach

model/api (draft doors) · logic (draft vs live diff) · component (draft panel) · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `draft diff marks added, re-ranked, removed and unchanged rows against live` · pure
- [x] `an edit refusal maps its rule to a message, raw code as fallback` · pure
- [x] drive `tools/idf-draft-drive.mjs` — start, three edits, one refused, publish with a note makes one version;
  a second run discards (LTR + RTL) · flow

## Boundaries

Endpoints stubbed. A refusal is a business outcome, not an error toast. Hidden without the edit grant once 654 adds
the probe.

## Done when

Against stubs, edits build a draft that publishes as exactly one version, proofs green.

## Blocked by

[643](643-a-masters-page-lists-the-items-of-its-live-version-or-any-old-one.md)

## Done 2026-10-28

- Pure: `draft.ts` + `draft.test.ts` (18 green — the two proofs are the `draft diff marks…` and `an edit refusal
  maps…` describes; also client paging of the draft, draft-vs-version choice, the add body). Doors in `api.ts` slot 645
  (`idfDraftApi`, `draftQuery`, `draftBaseQuery`) + `doors.test.ts` (645); keys in `i18n-keys.test.ts` (645), object
  `draft` EN+AR.
- UI: `DraftPanel.tsx` (panel, Add form, Publish + note, Discard confirm; `DraftMark`, `DraftRowActions` with Re-rank /
  Remove dialogs; `EditRefusal` inline), `useDraft.ts` (draft + base rows + diff, shared by panel and items),
  `ItemsSection.tsx` shows the draft when one is open, `MasterPage.tsx` one slot line (`{/* 645 · Draft */}`).
- Drive: `tools/idf-draft-drive.mjs` 60/60 (LTR + RTL) against stubs (`// --- 645 ---` in `tools/idf-stubs.mjs`);
  `idf-items-drive` 60/60 and `idf-upload-drive` 96/96 still green.

### Decisions (overrulable)

- **The diff seam (⚠️ flag for 654).** The draft door answers its rows only (the entries row shape, no per-row change,
  no removed list — brief "Spec 3185" + BO 3189 "Read the draft: its rows, with the same shape as the entries door"),
  so the server cannot mark rows for us as specced. The client reads the draft's **base version** (`baseVersionId`)
  whole through 3187's entries door, page after page at `pageSize=500` until `total` (or an empty page), and diffs
  with `draftDiff`. 654: if 3189 as built adds per-row marks / a removed list (or an unpaged base read), switch
  `useDraft` to it and drop `idfDraftApi.baseRows`; also confirm the entries door's `pageSize` max.
- The diff is against the **base version**, not the current live one — the same thing until a draft goes stale
  (646), and then the base is what the edits were made on.
- A row under another group than in the base is marked **Moved** (a fourth mark beside added / re-ranked /
  unchanged), the general upload preview's word.
- The draft door is unpaged, so the screen filters (item number / description, group) and pages (25) the draft rows
  itself, like the entries door. Removed rows matching the filter are listed after the **last** page.
- With a draft open, `?version` absent shows the draft (picker option "Draft (not published)" first) and the live
  version is named by id in the address; without a draft, 643's behaviour is unchanged. No new URL key.
- Edits answer is not specced: on success the draft query is refetched (the answer is ignored). Start posts `{}`.
- Add sends any numeric priority (2.5, 0) so the server's `badPriority` judges it; blank fields keep Add off.
- Re-rank and Remove each open a dialog (Remove asks first); a refusal shows in the dialog / under the Add form with
  the rule's word (raw code when unknown) and the message in the reader's language; a refusal without a rule shows the
  envelope message. Never a toast. Publish/discard/start refusals show the envelope message inline.
- Stubs: refusal codes `IDF-00028`..`IDF-00032` are invented (the brief names none); a published draft's rows are
  registered in `IDF_ENTRIES` so 643's door reads the new version.

### For 646

`draftPanelView(draft)` (draft.ts) is the panel's switch — grow it into `draftPanelState(draft, userId)` and branch in
`DraftPanel`; `OpenDraft` is where Rebase / Add a group go; `Publish` already disables on `draft.isStale`; `NoDraft`'s
start refusal shows only the message today (the `data { by, changedAt }` is 646's to render). Stubs: `state.drafts`,
`IDF-00029` = already open.
