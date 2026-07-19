---
type: wayfinder-ticket
wayfinder: prototype
map: 039
status: done
blocked-by: 040
---

# 041 — Sketch the reworked results-and-promo surface

## Question

**How should the reworked per-line results + applied-promotion surface look and behave?** Produce an
interactive artifact (via `/prototype`) the user reacts to — the core of this map's destination.

Design against the taxonomy from 040
([040-...TAXONOMY.md](040-sim-promo-shape-taxonomy.TAXONOMY.md)). Key facts it settled that this sketch
assumes:
- One shape — `prerequisite ("buy X") → reward ("get Y")` — × **four discount kinds**: Free Goods (1+1),
  Discount Percent (50%-off-2nd), Fixed Discount, Set Price. Draw the **kind** as a property of the get side.
- Buy and get may be **different products**, and either side may be a **material grouping** (category),
  so the relationship is potentially many-buy-lines ↔ many-get-lines across distinct basket rows.
- The applied buy→get link is **exact, not heuristic**: the map accepted a small backend projection that
  surfaces `isPrerequisite`/`isCondition` roles + a shared `conditionKey` (the buy↔get join) on the
  applied result. Mock your data with those fields present and draw the connector from `conditionKey`.
- Surface all four user intents 040 confirmed: *right promo fired*, *which items got the benefit*,
  *discount amount correct*, and *why a promo did NOT fire* (the potential side already carries
  `Prerequisites[]` + `isMet`).

The artifact must show, on realistic mock data covering the shapes 040 enumerates (at minimum 1+1-free
and 50%-off-2nd-piece, with at least one cross-product / grouping reward):

1. **Per-line promo indication at a glance** — a user sees which results-grid lines a promo touched,
   and roughly what kind, *without* selecting the line.
2. **Buy→get as a relationship** — the trigger line and the benefit line(s) read as connected
   (grouping, a promo-group row/card, a connector — the prototype explores the options), not as two
   unrelated discount amounts. This is the specific confusion the user called out.
3. **Progressive disclosure** — a lean default view for casual users, with today's full detail
   (aggregated condition cards, statistical toggle, pricing-elements trace) one interaction away for
   advanced users. Decide *how* the simple↔advanced split reads (expand-in-place, a detail rail, a
   density/mode toggle) by showing it.
4. **Results-grid + detail reshaping** — in scope (per map 039): the sketch may restructure the
   per-line grid and the right-hand detail/bonus-buy panels together, and should take a position on
   whether the result-level Applied/Potential Bonus Buys tabs stay, fold in, or become a summary.

Keep it a **throwaway sketch** — rough, cheap, reactable; not production `features/pricing` code.
Explore 2+ directions where the pattern is genuinely open (esp. how buy→get is drawn) so there's
something to choose between. Link the artifact from this ticket.

Resolution records the direction(s) explored and which the user leaned toward; **locking it as
approved** is the follow-up that graduates from the map's fog.

## Answer

Artifact: **[041-...PROTOTYPE.html](041-sim-results-promo-sketch.PROTOTYPE.html)** (published:
https://claude.ai/code/artifact/e7fca556-ac34-4276-8240-67ff83cc1507). Three structurally-distinct
directions built on one realistic basket (same-SKU 1+1, 50%-off-2nd, cross-product free reward,
grouping→set-price, a plain line, and a didn't-fire promo), each drawing buy→get from the shared
`conditionKey` and keeping today's detail behind an Advanced toggle:

- **A — Promo bands:** the results grid regroups into per-promo bands; Applied tab dropped.
- **B — Flat grid + linked rail:** today's dense flat grid kept intact + a glanceable promo column;
  Applied tab reborn as buy→get cards that cross-highlight their grid lines on hover.
- **C — Statement:** no grid; plain-language promo blocks ("Buy 1, Get 1 Free" → items → FREE/−50%).

**Chosen direction: a B + C hybrid.** Keep **B's flat grid as the anchor** (advanced users lose no
density or column parity) with the glanceable promo column + `conditionKey` cross-highlight, and
present the promotions themselves as **C's plain-language buy→get blocks** rather than a raw grid/tab.
This satisfies both halves of the destination at once — the relationship reads in human terms for the
casual user, while the full grid + Advanced detail stays for the analyst.

Implied by the choice (to be made concrete + signed off in the follow-up): the result-level **Applied
Bonus Buys tab folds into the statement-style promo blocks**; the flat grid stays; the **didn't-fire**
promo keeps the C/B unmet-prerequisite treatment. Buy→get legibility (incl. cross-product & grouping)
to be confirmed at the lock.

(One fix during the session: a single-quoted JS string containing "Didn't" broke the switcher; fixed,
re-verified all three variants render, republished.)
