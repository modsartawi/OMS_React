---
status: done
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

- [x] `lookup reads tiers in the fixed order and marks the looked-up item` · pure
- [x] drive `tools/idf-lookup-drive.mjs` — an insurer-decided answer, a general fallback with three skipped tiers, a business refusal (unknown item) shows its message · flow

## Boundaries

New endpoint `GET IdfPriority/lookup` — stubbed. Keys in `insurance-idf`. Ungated until 628. The cash rule (cash
never forces a pick) is the server's; if the answer carries it, show it — don't recompute it.

## Done when

A stubbed lookup renders the deciding master, the skipped tiers and the ranked group with source tiers, proofs green.

## Blocked by

[619](619-the-idf-masters-list-shows-each-masters-kind-scope-live-version-and-thresholds.md)

## Comments

**2026-10-27 — built (impl/3157-625).** `idf/lookup.ts` (types, URL query, `lookupView`), `idfLookupApi` +
`lookupQuery` in `idf/api.ts`, `idf/LookupPage.tsx` at `/insurance-rules/idf/lookup`, menu leaf `menu.idfLookup`,
`lookup` object in `insurance-idf` (EN + AR), `idfLookupStub` in `tools/idf-stubs.mjs`. Proof: `lookup.test.ts` 8/8
(+ 625's keys in `i18n-keys.test.ts`), drive `tools/idf-lookup-drive.mjs` 54/54 STUBBED (LTR + RTL); typecheck, test
(6946), lint green.

Decisions (overrulable; 628 reconciles with 3168):
- **Tier spelling** is this ticket's — the brief names none: `insurerStoreList | insurer | operationPharmacy |
  general` (`IDF_TIERS` in `lookup.ts`). Skipped tiers are SORTED into that order whatever the door sends; an unknown
  tier sorts last and shows its raw value. 626/627 should reuse `IDF_TIERS` and the `lookup.tier.*` words for any
  source tier they show.
- **Deciding tier** = the first tier (above general) not skipped; `decidingMaster: null` means the general master
  decided. Not re-resolved — only read off the answer.
- **The master is named by joining 619's masters list** on `masterId` (the lookup door sends no name); the version
  shows the live version's number when `versionId` matches it, else the version id. Ask 3168 to send the name and
  version number to drop the join.
- **The group keeps the door's order** (it is "ranked"); the screen does not re-sort it. The looked-up row is the one
  whose item number equals the search's (trimmed), marked `data-looked-up` / `aria-current`.
- **Cash rule** shown only if the answer carries `cashNeverForces: true` — a field the brief does not sketch; 628
  checks whether 3168 sends it (or drop it).
- **Search in the URL** via `useUrlQuery` (`item`, `store`, `payer`, `documentType`; blanks dropped); the door is
  asked only when item, store and payer are all given. Unknown item = business refusal shown via `apiErrorMessage`.
- **Review fixes (2026-10-27):** the deciding tier is derived from the answer (`decidingTierOf`), never from the
  skipped list: no deciding master → general; a store master → operationPharmacy; an insurer master → the answer's
  own `tier` when it carries an insurer one (⚠️ not in the brief; 628 reconciles), else insurerStoreList when 619's
  list has that master scoped to a store list, else insurer. It can no longer contradict the kind badge.
