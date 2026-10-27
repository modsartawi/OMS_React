---
status: open
spec: BackOffice 3157 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)
blocked-by: 619
---

# 625 — "Why this priority": for an item, store and payer, the screen shows the deciding master, the skipped tiers and the ranked group with each item's source tier

## What to build

A leaf **IDF lookup** at `/insurance-rules/idf/lookup` (door 3168,
[brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md)). Inputs: item, store, payer, and
document type (optional); the search is kept in the URL so a lookup can be shared. `GET IdfPriority/lookup`
answers with:

- the deciding master (named, with its kind and version) and the item's priority and thresholds as
  "hard above N, reminder above M";
- the tiers skipped before it, in the fixed order (insurer + store list → insurer → operation pharmacy →
  general), each with its reason in the reader's language;
- the ranked IDF group: item number, description by language, priority, and the **source tier** of each row
  (shown wherever a priority is shown). The looked-up item's row is marked.

## Spine reach

model/api · logic (tier order, row marking) · component/route · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `lookup reads tiers in the fixed order and marks the looked-up item` · pure
- [ ] drive `tools/idf-lookup-drive.mjs` — an insurer-decided answer, a general fallback with three skipped tiers, a business refusal (unknown item) shows its message · flow

## Boundaries

New endpoint `GET IdfPriority/lookup` — stubbed. Keys in `insurance-idf`. Ungated until 628. The cash rule (cash
never forces a pick) is the server's; if the answer carries it, show it — don't recompute it.

## Done when

A stubbed lookup renders the deciding master, the skipped tiers and the ranked group with source tiers, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)
