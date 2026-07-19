---
type: wayfinder-ticket
wayfinder: prototype
map: 039
status: open
blocked-by: 040
---

# 041 — Sketch the reworked results-and-promo surface

## Question

**How should the reworked per-line results + applied-promotion surface look and behave?** Produce an
interactive artifact (via `/prototype`) the user reacts to — the core of this map's destination.

Design against the taxonomy from 040. The artifact must show, on realistic mock data covering the
shapes 040 enumerates (at minimum 1+1-free and 50%-off-2nd-piece):

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
