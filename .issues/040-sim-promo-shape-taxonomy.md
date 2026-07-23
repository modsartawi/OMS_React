---
type: wayfinder-ticket
wayfinder: grilling
map: 039
status: done
blocked-by:
---

# 040 — Promo-shape taxonomy & response-field mapping

## Question

What are the **distinct promotion shapes** the reworked simulation must render clearly, and **which
fields in the `Pricing/Simulate` response distinguish each** and let us reconstruct the buy→get
pairing on a per-line basis?

The user named two shapes explicitly — "1 + 1 free" and "1 + 50% on the 2nd piece" — but the sketch
can only speak a vocabulary that exists. Before designing, pin down (via `/domain-modeling`, drawing
on the WPF harness and the SIS.Api pricing engine):

1. **Enumerate the shapes** a store user will actually see: BxGy-free, buy-x-get-%-off-Nth,
   threshold-spend discount, mix-and-match / group, straight line discount, header/basket-level
   discount, … — named in human terms, with the domain (BBY) term beside each.
2. **Map each shape to the response.** Which of `AppliedBonusBuy.discountType`, `affectedItemNumbers`,
   per-line `conditions[]` (`conditionOrigin` P|B, `isBonusBuy`, `bbyNumber`, `conditionRate`,
   `conditionRateUnit`, `conditionValue`), and `promotionDiscount` classify the shape and tie the
   **trigger line** to the **benefit line(s)**? Flag any shape the current response *cannot* cleanly
   express (would fall to the map's out-of-scope backend note if one surfaces).
3. **Per-line promo indicator vocabulary.** What is the minimal, human label/icon set the results
   grid could show per line ("promo applied", "free item", "% off") — the tokens the sketch renders.

Deliverable: a short taxonomy + field-mapping table (a linked markdown asset), and any additions to
`CONTEXT.md` this surfaces. This is the vocabulary the prototype (041) sketches against.

## Answer

Full taxonomy + field-mapping: **[040-sim-promo-shape-taxonomy.TAXONOMY.md](040-sim-promo-shape-taxonomy.TAXONOMY.md)**.
Glossary additions landed in `CONTEXT.md` (Bonus buy / Prerequisite–Reward / Discount type).

Gist:

1. **One shape, four kinds.** Every BBY is `prerequisite ("buy X") → reward ("get Y")`; the "kind" is
   which of **four discount types** the reward carries — `N` Free Goods (1+1), `%` Discount Percent
   (50%-off-2nd), `R` Fixed Discount, `P` Set Price. Buy and get can be **different products** and
   either side can be a **material grouping**, so a promo relates many buy lines to many get lines.

2. **Field mapping is asymmetric.** *Potential* promos already carry the rich structure
   (`Discount{P/R/%/N, value}`, `Prerequisites[]` with required-vs-found + `isMet`, AND/OR links,
   target type) — enough to draw both the relationship and the "why-not-fired" view. *Applied* promos
   are **flattened** (one row, summed value, raw SAP `discountType`, flat `affectedItemNumbers`, no
   buy/get split).

3. **The applied buy→get data is NOT missing — it's dropped.** The engine's `PcCondition` rows already
   carry `isPrerequisite` (buy), `isCondition` (get), and `conditionKey` (a per-fired-application key
   identical across a promo's buy+get rows → the join). `SimulationResultBuilder` simply doesn't project
   them. Per the map's chosen **"assume a backend enhancement"**, exposing buy→get is therefore a **pure
   projection pass-through** (copy 3 fields onto `SimulationResultCondition`; group `AppliedBonusBuy` by
   `conditionKey` into prereq/reward lists; normalise `discountType` to P/R/%/N) — no new derivation.
   The sketch (041) draws an **exact** relationship against this target shape.

4. **Per-line indicator vocabulary** for the results grid: role (`buy`/`get`/`buy+get`), kind (the four
   labels), promo identity (`promoNumber`/`offerId`/`description`), link (`conditionKey`), amount
   (per-line `conditionValue` + promo `totalDiscountValue`).

Not resolved here (carried into 041 as live design input): the user's own "shape" reference sketch —
still welcome, but the canonical structure above is sufficient to sketch against.
