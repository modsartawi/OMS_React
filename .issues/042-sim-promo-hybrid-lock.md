---
type: wayfinder-ticket
wayfinder: prototype
map: 039
status: done
blocked-by: 041
---

# 042 — Consolidate the B+C hybrid & lock the direction

## Question

Ticket 041 chose a **B + C hybrid** — B's flat grid as the anchor, C's plain-language buy→get blocks
as how promotions present. This ticket makes that one concrete artifact and gets **explicit sign-off**
= the map's destination.

Iterate the sketch ([041-...PROTOTYPE.html](041-sim-results-promo-sketch.PROTOTYPE.html)) into a single
consolidated direction and settle the compositional questions the mix leaves open:

1. **Grid ↔ blocks layout.** Where do C's promo blocks live relative to B's flat grid — a right-hand
   panel replacing the rail, a strip above/below the grid, or a mode the user toggles into? How do the
   two stay linked (hover/click cross-highlight via `conditionKey`, in both directions)?
2. **Applied Bonus Buys tab fate — make it concrete.** 041 implies it folds into the statement blocks.
   Confirm it's gone as a tab, and that nothing it showed (offer id, promo no., remaining usage, total
   discount) is lost — decide where each field lands in a block.
3. **Didn't-fire promos.** Final placement/treatment of the unmet-prerequisite ("why not") view in the
   hybrid — inline with the blocks, or a separate section.
4. **Progressive disclosure end-to-end.** One coherent path from the block → today's condition cards →
   the pricing-elements trace (the Advanced layer), so the analyst path is unbroken.
5. **Confirm buy→get legibility** on the hard cases (cross-product reward, grouping→set-price, same-SKU
   1+1) — the specific confusion that started map 039 — and get the user's "approved".

Deliverable: the consolidated artifact (link it) + the user's sign-off recorded. On approval the map's
destination is reached; per the map, the endpoint is **approved sketches** (the user chose sketches-only,
so no `/to-spec` — the build is a separately-scoped later effort that also carries the applied-BBY
projection change noted in 040).

## Answer

**APPROVED — direction locked.** Consolidated hybrid: **[042-...PROTOTYPE.html](042-sim-promo-hybrid-lock.PROTOTYPE.html)**
(published: https://claude.ai/code/artifact/90692d1e-3e01-4aa1-9153-0c9bf0af2252). This is map 039's
destination; the map is complete.

Resolutions to the five open questions:

1. **Grid ↔ blocks layout → responsive (all three).** The build targets **side-by-side** on wide
   back-office screens, **stacked** (promo blocks as headline over the grid) when narrower, and a
   **compact Lines/Promotions toggle** on the smallest — chosen by width, not a manual switch. Grid and
   blocks are linked by **bidirectional cross-highlight keyed on `conditionKey`**.
2. **Applied Bonus Buys tab → folded into the blocks, nothing lost.** Each promo block carries the BBY
   key, promo no., offer id, remaining usage, total discount, description + savings (verified). The tab
   as a separate grid is gone; the flat per-line grid stays for column parity.
3. **Didn't-fire → own "Could have applied" section** under the blocks, with the unmet-prerequisite
   meter (found vs min) and the would-save figure.
4. **Progressive disclosure → block → "Pricing detail" (today's condition cards) → Advanced toggle adds
   the pricing-elements trace.** Analyst path unbroken.
5. **Buy→get legibility → confirmed** on same-SKU 1+1, 50%-off-2nd, cross-product free reward (tagged
   "reward"), and grouping→set-price ("Any 2 from a category → item at set price").

Hand-off (the later BUILD effort inherits): the approved hybrid sketch + the [taxonomy](040-sim-promo-shape-taxonomy.TAXONOMY.md)
(040) + the small **applied-BBY projection** change (surface `isPrerequisite`/`isCondition`/`conditionKey`
+ normalised `discountType` on the applied result). New-design edge/empty states (many-line promo,
stacked promos on one line, benefit line absent from basket) are refinements for that build/spec, not
blockers to the approved direction.
