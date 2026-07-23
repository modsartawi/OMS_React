---
type: wayfinder-map
status: done
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

> **DESTINATION REACHED (map done).** The B+C hybrid is approved and locked — see
> [Consolidate the B+C hybrid & lock the direction](042-sim-promo-hybrid-lock.md)
> ([approved sketch](042-sim-promo-hybrid-lock.PROTOTYPE.html)). The build effort inherits: this sketch +
> the [taxonomy](040-sim-promo-shape-taxonomy.TAXONOMY.md) + the small applied-BBY projection change (040).

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
- Data reality (**revised by ticket 040**): the buy→get relationship is *computed but discarded*, and
  the applied↔potential split matters. *Potential* promos already carry the full structure
  (`Prerequisites[]`, `isMet`, `Discount{P/R/%/N}`). *Applied* promos are flattened — the engine's
  `PcCondition` rows hold `isPrerequisite`/`isCondition`/`conditionKey` (the buy↔get join) but
  `SimulationResultBuilder` drops them. Surfacing applied buy→get is a **pure projection pass-through**
  (no new derivation) — hence the "assume a backend enhancement" decision below. Speak the taxonomy in
  [040-sim-promo-shape-taxonomy.TAXONOMY.md](040-sim-promo-shape-taxonomy.TAXONOMY.md).

## Decisions so far

<!-- one line per resolved ticket; zoom the link for detail -->

- [Promo-shape taxonomy & response-field mapping](040-sim-promo-shape-taxonomy.md) — every promo is one
  shape `prerequisite→reward` × 4 discount kinds (Free Goods / % / Fixed / Set Price); buy & get may be
  different products or material groupings. Applied buy→get is **dropped, not missing** (`PcCondition`
  has `isPrerequisite`/`isCondition`/`conditionKey`) → exposing it is a pure projection pass-through, so
  the sketch draws an **exact** relationship. Taxonomy asset:
  [040-...TAXONOMY.md](040-sim-promo-shape-taxonomy.TAXONOMY.md).
- [Sketch the reworked results-and-promo surface](041-sim-results-promo-sketch.md) — 3 directions built
  & flip-tested ([artifact](041-sim-results-promo-sketch.PROTOTYPE.html)); user chose a **B + C hybrid**:
  keep B's flat grid as the analyst anchor + `conditionKey` cross-highlight, present promotions as C's
  plain-language buy→get blocks (Applied tab folds in). Consolidation + sign-off → ticket 042.
- [Consolidate the B+C hybrid & lock the direction](042-sim-promo-hybrid-lock.md) — **APPROVED** ✓
  ([sketch](042-sim-promo-hybrid-lock.PROTOTYPE.html)). Flat grid + plain-language buy→get blocks;
  layout **responsive** (side / stacked / compact by width); Applied-tab fields fold into blocks with
  none lost; didn't-fire gets its own section; disclosure block→cards→pricing-elements. **Destination.**

## Not yet specified

<!-- graduates into tickets as the frontier advances -->

<!-- Empty — destination reached. Direction lock, tab-fate, and potential-parity resolved in ticket 042.
     New-design edge/empty states (many-line promo, stacked promos on one line, benefit line absent) were
     handed to the later build/spec effort, not blockers to the approved direction. -->
_None — map complete._

## Out of scope

- **Header / input form, items-entry grid, manual-conditions grid** — untouched by this rework.
- **The React implementation** — this map ends at approved sketches; build is a later
  `/to-spec` → `/to-tickets` effort.
- **Building the applied-BBY projection change** — the decision (040) accepts one small server-side
  projection (surface `isPrerequisite`/`isCondition`/`conditionKey` + normalised `discountType` on the
  applied result). *Designing against* that target shape is in scope; *implementing* it belongs to the
  later build effort alongside the React work. (This supersedes the charting-time "no server work"
  assumption, which 040 found to be wrong.)
