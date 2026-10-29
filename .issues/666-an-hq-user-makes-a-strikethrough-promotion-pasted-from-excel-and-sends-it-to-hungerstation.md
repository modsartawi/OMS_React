---
status: open
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

- [ ] `strikethroughColumns` parse: header skipped, blank cells → default, repeats last-wins counted, 20,001 refused, non-numeric material kept for the server to answer (vitest)
- [ ] `localWindow`: start defaults to now, end to 23:59 of the chosen day, end ≤ start flagged, and the value sent is the wall time typed (vitest)
- [ ] drive (LTR + RTL), against stubs: paste → preview grid → save → body field for field; Send body with reason; Sending disables edit; Refresh re-reads; refusals inline
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

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
