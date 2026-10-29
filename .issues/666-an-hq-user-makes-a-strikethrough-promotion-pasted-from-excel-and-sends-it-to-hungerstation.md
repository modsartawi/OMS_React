---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 665 (contract + live: BackOffice 3211)
---

# 666 — An HQ user makes a strikethrough promotion pasted from Excel and sends it to HungerStation

## What to build

The promotion **editor** for the strikethrough type, plus Send and Refresh.

- **Chain first.** It picks the **HungerStation chain**, and the stores and materials that follow are
  that chain's.
- **Header:**
  - internal name;
  - display name in **English and Arabic**, both required;
  - HS reason (Competitiveness by default, Overstock, Delisting, Expiring soon, NMR, Trading);
  - optional per-order limit and total-uses limit;
  - start and end as **Saudi local** date + time. Start defaults to now, end to 23:59 of the day
    picked. Never convert to UTC: send the wall time as the contract spells it;
  - the default discount (subtype + value) that blank cells take.
- **Stores picker** (`GET Promotions/Stores?chain=`): every **HungerStation store** of the chain
  ticked by default; search and untick. Removed stores never appear, paused ones do (they still sell
  on HungerStation). A note says the list is **frozen when sent**, and that a store onboarded later
  does not join.
- **Items** through `core/import/ImportDialog` with a strikethrough column spec:
  `Material, Subtype, Value, MaxQty`.
  - Source: rows copied from Excel and pasted (tab-separated), or a picked `.tsv` / `.txt`.
  - A header row is skipped and said on screen.
  - A blank Subtype/Value takes the header default.
  - A repeated material keeps its last row and the repeat count is shown.
  - More than 20,000 materials is refused before anything is sent.
  - Rows name **our material number**, never the HS SKU.
- **Save draft** (create / update), any number of times. Nothing reaches HungerStation.
- **Send** with a mandatory reason (`core/reason/`). The promotion then reads **Sending**, and edits
  are disabled until it settles.
- **Refresh** on the detail asks HungerStation now and re-reads.
- Refusals inline: the BackOffice 3211 codes (`DHS-00016`…, from the contract), `DHS-00008` for the
  reason, and a material with no HungerStation SKU named on its row.

Wire shapes: the contract asset's Promotions sections (save, read, stores, Send, Refresh).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `strikethroughColumns` parse: header skipped, blank cells → default, repeats last-wins counted, 20,001 refused, non-numeric material kept for the server to answer (vitest)
- [x] `localWindow`: start defaults to now, end to 23:59 of the chosen day, end ≤ start flagged, and the value sent is the wall time typed (vitest)
- [x] drive (LTR + RTL), against stubs: paste → preview grid → save → body field for field; Send body with reason; Sending disables edit; Refresh re-reads; refusals inline
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. Stubs emit exactly the contract's fields.

## Done when

A strikethrough pasted from Excel saves, sends and reads back from stubs, with the bodies matching the
contract.

## Blocked by

[665](665-an-hq-user-lists-hungerstation-promotions-and-reads-one-with-its-parts-stores-items-and-sends.md)

## Open questions

- 555's material import already reads `.xlsx`. Spec 3201 left `.xlsx` upload out of scope because it
  assumed a new library. If 555's reader feeds `ImportDialog`'s multi-column path with **no new
  dependency**, should the editor accept `.xlsx` too? Owner's call. The default is paste + `.tsv` only.

## Comments

- 2026-10-29 (built, `impl/666`): **done against stubs only — no BackOffice door exists and the
  contract asset (BackOffice 3211) has not been written**, so "done" is vitest + typecheck + lint +
  the drive against stubbed envelopes (real `errors[]` shape), never a live call.
  - **Built:** `PromotionEditor` (side sheet on `?edit=new` / `?edit=<id>`, "New strikethrough" on the
    list): chain first → header (internal name, EN + AR display names, HS reason default
    Competitiveness, optional per-order / total-uses limits, Saudi-local start/end, default
    subtype + value) → stores picker (`GET Promotions/Stores?chain=`; all ticked by default, search,
    untick, paused stores badged, the frozen-at-send note) → items via `core/import/ImportDialog`.
    Save draft (POST, then PUT) and Send each take a reason through the HungerStation `ReasonDialog`;
    a sent promotion hands over to the detail (Sending), and the editor is locked unless the status is
    `draft`. The detail gains **Edit draft** (drafts) and **Refresh** (anything sent; no body; its answer
    replaces the cached detail).
  - **Pure modules (vitest):** `strikethrough-columns` (`readStrikethrough`: header skip, blank →
    `null` = takes the default, last-row-wins counted, cap 20,000 reported never truncated,
    non-numeric material kept, an unreadable subtype/value/maxQty flagged on its line),
    `local-window` (Saudi now as a fixed +03:00 shift, end = 23:59 of the picked day, wall time sent
    as `yyyy-MM-ddTHH:mm:00`, end ≤ start / past / incomplete flagged), `promotion-form` (form ⇄ save
    body, store toggling with "all"), `row-refusals`.
  - **Core change:** `ImportDialog` gained two optional props — `read` (a feature's own reading: lines +
    note + refused) and `apply` / `applyLabel` (hand the lines back instead of posting) — and
    `ImportLineError` became a union with a `CELL` code (`import.problem.cell.<column>`). The two
    existing imports are untouched in behaviour (their tests pass; one test narrowed for the union).
  - **Drive** `tools/hungerstation-promotions-drive.mjs` § 666 (blocks 6–9, its own section; the write
    doors filled as `open(…, { doors: doors666() })` overrides, the DOORS table untouched for 669's
    merge). Body field for field, model-key check on the save body, Send `{ reason }`, Refresh no body,
    DHS-00019 / 00008 / 00018 inline, 20,001 refused, typed chain, RTL. **133/133** (82 of 665 + 51 new); **183/183** after merging 669. Vitest 7726 green; typecheck + lint green.
  - 🚩 **Assumptions for the contract (BackOffice 3211):** (1) **chain source** — spec 3201 names no
    chain read for the promotions grant; `Chains` rides `canManageStores`. The editor offers `Chains`
    when that grant is held, otherwise the chains seen on the list as suggestions over a free-typed
    key, and the stores door answers an unknown chain with DHS-00006 (inline). **BO ask:** carry the
    chain keys on `Promotions/Stores` without `chain=`, or a `Promotions/Chains` read. (2) a Send
    refused for its checks (DHS-00018) carries the Check answer (`HungerStationPromotionCheckResult`)
    as the envelope `data`; rows with refusals are marked on their row (`NO_SKU` etc. are the server's
    words). (3) the save body carries `null` for a blank subtype / value and the server resolves the
    default, the read answering resolved values. (4) `allStores: true` sends `storeCodes: []`.
    (5) Save draft carries a reason, as every write does (DHS-00008) — one reason per save may prove
    heavy for a draft built over many sittings; owner's call.
  - **Open (unchanged):** `.xlsx` via 555's reader — default kept to paste + `.tsv` / `.txt`.
