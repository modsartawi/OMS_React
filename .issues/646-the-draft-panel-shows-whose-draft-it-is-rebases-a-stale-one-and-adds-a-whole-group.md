---
status: open
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

- [ ] `panel state from draft, user and staleness` · pure
- [ ] drive `tools/idf-draft-drive.mjs` extended — someone else's draft, a stale draft rebased then published, a group add
  with two refused members · flow

## Boundaries

Endpoints stubbed. Spec 3185 OQ2 (draft expiry) may change the "someone else's" wording only.

## Done when

Against stubs, every panel state shows and behaves as above, proofs green.

## Blocked by

[645](645-a-masters-items-are-edited-in-a-checked-draft-and-published-as-one-version.md)
