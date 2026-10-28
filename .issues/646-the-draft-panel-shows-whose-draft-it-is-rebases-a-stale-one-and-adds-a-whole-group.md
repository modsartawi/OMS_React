---
status: done
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 645
---

# 646 — The draft panel shows whose draft it is, rebases a stale one, and adds a whole group

## What to build

Two users must never publish conflicting edits. Doors BackOffice 3190
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- the panel header shows who owns the draft, when it started, when it last changed, and its base version;
- **someone else's draft:** Start is replaced by "Draft open by X since …"; Discard is offered (with a confirm that
  says it is someone else's work);
- **stale draft** (`isStale`): Publish is disabled and **Rebase** is offered; after rebase the diff refreshes;
- **Add group:** pick an IDF group and a priority; the result says how many were added and lists the members refused,
  each with its rule's message.

## Spine reach

api · logic (panel state: none / mine / someone else's / stale) · component · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `panel state from draft, user and staleness` · pure
- [x] drive `tools/idf-draft-drive.mjs` extended — someone else's draft, a stale draft rebased then published, a group add
  with two refused members · flow

## Boundaries

Endpoints stubbed. Spec 3185 OQ2 (draft expiry) may change the "someone else's" wording only.

## Done when

Against stubs, every panel state shows and behaves as above, proofs green.

## Blocked by

[645](645-a-masters-items-are-edited-in-a-checked-draft-and-published-as-one-version.md)

## Done 2026-10-28

- Pure: `draft.ts` — `draftPanelState(draft, userId)` (replaces 645's `draftPanelView`) → `none | mine | someoneElse |
  stale`, `draftEditable`, `draftStartRefusal(data)`, `groupAddResult(answer, lang)`; proof `draft-owner.test.ts`
  (12 green, the `panel state from draft, user and staleness` describe is the proof). Doors in `api.ts` slot 646
  (`idfDraftOwnerApi.rebase` / `.addGroup`) + `doors.test.ts` (646); keys in `i18n-keys.test.ts` (646), EN + AR under
  `draft` (AR plural six forms for `groupAdded`).
- UI: `DraftPanel.tsx` — header (owner `<bdi>` + "(you)", started / last changed `Ltr`, base version by its number from
  the versions query, counts); someone else's: "Draft open by X since …", no Start / Add / Add group / Publish, Discard
  with a confirm naming it as their work; stale: banner + **Rebase** (Publish already off); **Add a whole group** (group +
  priority → "N items added." + a table of the refused members, rule word + message); a refused Start renders
  `data { by, changedAt }`. `ItemsSection.tsx`: row Re-rank / Remove only on an editable (my) draft.
- Drive: `tools/idf-draft-drive.mjs` 104/104 (LTR + RTL; 645's 60 + 646's 44) against stubs (`// --- 646 ---` in
  `tools/idf-stubs.mjs`: rebase re-applies the edits on live; `IDF-CETI` group fixture with two refused members);
  `idf-items-drive` 60/60. Gates: typecheck, lint, `npm test` green.

### Decisions (overrulable)

- **Someone else's draft is read-only here but for Discard** — no add, re-rank, remove, group add, rebase or publish;
  the brief says the draft belongs to the master, so if the owner rules anyone with the edit grant may work on it,
  `draftEditable` is the one switch. A stale draft of someone else's shows as someone else's (Rebase is the owner's).
- Ownership compares the user id (`Auth/Me` `userId` from the session store) with `draft.by`, case-blind and trimmed;
  with no signed-in user nothing is "mine". `by` is rendered as free text (`<bdi>`), not `Ltr`.
- My stale draft still takes edits (only Publish is refused while stale, per the brief).
- "Since" = `startedAt` on the panel; the refused Start shows `changedAt` (what its `data` carries).
- A refused Start shows the owner inline and does NOT refetch the draft (the panel would replace the message at once);
  the next draft read (focus / reload) shows the panel as someone else's.
- Rebase and the group add answers are not relied on: success refetches `[...IDF_DRAFT_KEY, masterId]`; the new
  `baseVersionId` re-keys the base read so the diff follows. Rebase toasts success; its refusal shows inline.
- ⚠️ 654: the group add's answer is read the same whether it is `{ draft, added, rows }` or the draft spread with
  `{ added, rows }` (`groupAddResult`). One priority for every member, as the body has one; the group is typed (no picker
  from 652's groups door) like 645's Add form. An unknown group / bad priority is expected as a single-add-style rule
  refusal (`data { rule, … }`) and shown inline.
- Stub refusal codes invented `IDF-00051` (no draft); branching never reads codes.
