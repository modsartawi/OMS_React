---
status: open
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

- [ ] `draft diff marks added, re-ranked, removed and unchanged rows against live` · pure
- [ ] `an edit refusal maps its rule to a message, raw code as fallback` · pure
- [ ] drive `tools/idf-draft-drive.mjs` — start, three edits, one refused, publish with a note makes one version;
  a second run discards (LTR + RTL) · flow

## Boundaries

Endpoints stubbed. A refusal is a business outcome, not an error toast. Hidden without the edit grant once 654 adds
the probe.

## Done when

Against stubs, edits build a draft that publishes as exactly one version, proofs green.

## Blocked by

[643](643-a-masters-page-lists-the-items-of-its-live-version-or-any-old-one.md)
