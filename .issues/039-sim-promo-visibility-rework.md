---
type: wayfinder-map
status: open
---

# 039 — Simulation applied-promotion visibility rework

## Destination

An **approved visual direction** (sketches / an interactive artifact you sign off on) for reworking
how the POS Simulation screen presents **per-line pricing results and the promotions that fired** —
so that:

- a user can see, **without clicking each line**, that a promotion applied to it and roughly what kind;
- **buy→get promotions read as relationships** — "buy 1 get 1 free", "50% off the 2nd piece" show the
  trigger line and the benefit line as connected, not as two unrelated discounts;
- today's **full detail survives for advanced users** via progressive disclosure — the current
  condition cards / pricing-elements trace are one interaction away, not gone.

Reaching the destination = you approve a sketched direction. Writing the spec and building it are a
**separate later effort** (`/to-spec` → `/to-tickets`), out of scope here.

## Notes

- Domain: SIS.Api `Pricing/Simulate` result surface. Glossary in `CONTEXT.md`
  (envelope, guardrail, bonus buy / BBY). Speak its vocabulary in tickets and sketches.
- Skills every session consults: `/domain-modeling` (promo taxonomy), `/prototype` (the artifact),
  `/grilling` (lock the direction). This map is **design-only** — produce decisions and sketches,
  not production React.
- Current surface (the thing being reworked), all under `src/features/pricing/simulation/`:
  - `SimulationPage.tsx` — 7/5 split: left = inputs + per-line **results grid** (`columns.ts`, status
    dots only); right = `SimItemDetail` (selected line's condition cards) + `SimBonusBuyPanel`.
  - `SimBonusBuyPanel.tsx` — bottom-right tabs: **Applied Bonus Buys** (result-level grid), Potential
    Bonus Buys (+ Prerequisites), Pricing Elements (raw trace).
  - `SimItemDetail.tsx` / `ConditionCard.tsx` — the per-line green **PROMOTION**-badged cards.
  - `aggregate.ts` — client-side condition grouping (origin P|B → promotion).
- Data reality (settled while charting): the response **already carries** enough to reconstruct the
  relationship — `AppliedBonusBuy.affectedItemNumbers` (which lines a promo touched), `discountType`,
  per-line `conditions[]` with `bbyNumber` + `isBonusBuy` + `conditionOrigin`. It is **unused**, not
  missing. No backend change and no data-availability research is in scope; the taxonomy ticket only
  needs to *map* these existing fields to human promo shapes.

## Decisions so far

<!-- one line per resolved ticket; zoom the link for detail -->

## Not yet specified

<!-- graduates into tickets as the frontier advances -->

- **Direction lock / sign-off.** After the prototype produces an artifact, a short grilling to lock
  the chosen direction as "approved" (the destination). Graduates once a direction exists to lock.
- **Fate of the result-level Applied / Potential Bonus Buys tabs.** If per-line promo indication +
  a promo-relationship view land, do the bottom tabs stay, fold into the new view, or become a
  summary? Likely decided *inside* the prototype; ticket it only if it needs its own round.
- **Potential (didn't-fire) promotions' parity.** The pain is about *applied* promos; whether the
  "could have applied" promos get the same clarity treatment is a revisit after the applied
  direction lands.
- **New-design edge/empty states.** One promo spanning many lines, two promos stacked on one line,
  a promo whose benefit line isn't in the basket — sharpen once the base pattern is chosen.

## Out of scope

- **Header / input form, items-entry grid, manual-conditions grid** — untouched by this rework.
- **Backend / API contract changes** — data is present-but-unused (see Notes); no server work.
- **The React implementation** — this map ends at approved sketches; build is a later
  `/to-spec` → `/to-tickets` effort.
