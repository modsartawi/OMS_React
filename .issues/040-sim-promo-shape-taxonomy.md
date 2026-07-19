---
type: wayfinder-ticket
wayfinder: grilling
map: 039
status: open
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
