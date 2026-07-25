---
type: wayfinder-map
status: done
---

# 097 — The POS Simulation screen rework

## Destination

One `status: ready` spec, consumable by `/to-tickets`: **the reworked POS Simulation screen** —
the whole screen, input side and results side — rearranged on the POS design system
([082](082-pos-design-system-spec.md), shipped) into a denser, chip-led device that reclaims the
space today's eleven bordered cards spend on chrome.

Reached when that spec is `ready` and no decision blocks the build.

## Notes

**Domain:** oms-react back-office (see `CONTEXT.md`). The screen is
`src/features/pricing/simulation/` — `SimulationPage.tsx` plus ten components and four pure modules
(~2.7k lines), built by BackOffice spec 503 (tickets 013–016), extended by
[022 — cache reset](022-cache-reset.SPEC.md) and [043 — promo visibility](043-sim-promo-visibility-spec.md).

**Prior art to read, not to repeat.** This map is the Simulation twin of
[068 — POS palette + Document Details rework](068-pos-palette-and-document-detail-rework.md), whose
second spec [083](083-document-details-rework-spec.md) is the model for the destination's shape.
068 differs in one way that matters: it **replicated an external POS/WPF artifact**. This map has no
reference — see the fidelity ruling below.

**Owner rulings already taken (charting session, 2026-07-25)** — premises, not open:

- **Whole screen in scope.** Header form, items entry, manual conditions, actions, Net-Total tile,
  results grid, promo blocks, line detail, pricing-elements trace. One arrangement, one rework.
- **The input region collapses into a chip bar after Process** — the condensed run parameters
  (plant · sales org · channel · date · promo on) as chips that expand back to the form. This is
  where most of the reclaimed space comes from and it is the "nice chips" ask made concrete.
  *What* the chips say, and how expand/edit/staleness behave, is [102](102-sim-input-chip-bar.md).
- **Fidelity: fresh, from 082's vocabulary.** No external reference artifact. Design from the
  shipped design system (tokens, `severity.ts`, `StatusBadge`, the AG Grid theme, `core/ui/Button`'s
  family variants) and the device vocabulary 083 established — identity band, chip/pill rail,
  summary cards, clustered action bar. Borrow the grammar; do not copy the Document screen's regions.
- **Evidence first.** Every field and density rule derives from **captured live Simulate responses**
  ([098](098-simulate-payload-capture.md)), not from the model types. 073 built a rail on a synthetic
  payload and 078 invalidated it; that sequence is not repeated here.
- **Arrangement only — same scope line as 083.** Endpoints, `SimulateRequest`'s shape, the access and
  cache-clear gating, `promoView`'s derivation rules and the Process/Clear semantics are **untouched**.
  This map moves where things sit and how they read.
- **No numeric density target.** "Saving the space" is judged by eye on the prototype, not measured
  against a viewport. Recorded so no ticket invents a pass/fail number the owner did not set.
- **This map supersedes the two open 043 build tickets** — 049 (progressive disclosure) and 050
  (responsive hybrid). Both are closed `wontfix`; their questions are re-answered inside the new
  arrangement by [103](103-sim-deep-layers-placement.md) and [105](105-sim-responsive-arrangement.md),
  where disclosure and responsive layout are being redesigned anyway.

**Skills:** `/prototype` for every look-and-feel ticket (HTML asset beside the issue, as 041/042/073
did); `/grilling` for the vocabulary and placement decisions; `/research` for AFK inventories.
Standing rules apply to any code the spec later produces — especially zero-literal i18n and logical
Tailwind.

## Decisions so far

<!-- one line per resolved ticket -->

- [Capture live Simulate payloads](098-simulate-payload-capture.md) — eleven real payloads filed;
  the screen is **small** (1–3 lines, 1–5 raw conditions per line, zero statistical rows, 7
  pricing-element rows of which 3 are subtotals), a **missed promotion has no prerequisite data and
  no item linkage** so it cannot sit beside a line, one applied promotion **spans several lines**,
  and no per-line `E` exists on live data — failures arrive as whole-run 400s, only `W` rides a 200.
- [What the analyst reads the screen for, region by region](099-sim-region-question-inventory.md) —
  the loop is **set up once, run many**, so the header collapses to chips but the **items grid never
  does**; the first read is **"did the promotion fire?"**, making the promo surface primary and Net
  Total a confirming readout. **Arrangement D approved** ([prototype](assets/099-stack-order.PROTOTYPE.html)):
  run strip → items → a **66/34 split**, results left, a promotions rail right carrying fires *and*
  near-misses. **Nine frames become three** — Summary, Actions, Manual Conditions, the detail panel
  and the Pricing Elements panel all dissolve. **Retired outright:** the E/W count banner, the four
  detail tiles, the statistical toggle. **Rescued by the owner:** the procedure key and loyalty
  fields are *test levers*, and `itemConditionControl` is the **coupon lever** — `M` is what 098's
  unexplained `COUP01` `W` was missing; it becomes a dropdown. **`Clear cache` is a run control**,
  not an admin curio (fix bby → re-download → wipe → Process), and moves beside Process. A promo
  card gets a **Bonus buy details ▸** button gated on a `BbyInquiry` probe — the *affordance* is in
  scope, the *surface* is [060](060-bby-detail-modal-prototype.md) over unbuilt
  [058](058-bby-detail-endpoint-contract.md) endpoints.
- [The chip vocabulary](100-sim-chip-vocabulary.md) — a chip is a **settled fact, untruncated, that
  reads alone or carries a short uppercase key**. **Two kinds only:** neutral chip (`bg-muted`) and
  082's shipped `StatusBadge` — no new component, no new token. **Interactivity is regional:** the run
  strip is one hover target with `Edit ▾`; **no chip on this screen is ever clickable**, which is what
  makes "a chip is a readout" enforceable. Chip content comes from a **bounded domain** (code, date,
  enum label) so truncation is impossible by construction — **never money, never server free text**.
  Blank ⇒ no chip, so the strip is **five chips** ordinarily and eight when the test levers are set;
  promo is chipped in **both** states because promo-off blacks out the whole rail. An `ok` line
  carries **no mark at all**. **The screen's whole hue budget is two:** `success` on a fired
  promotion, `attention` on a `W` line — a near-miss is neutral, not `warn`. **Retires two forms the
  099 prototype drew:** the primary-tinted `Promotion on` and the dashed ghost.

- [The reworked screen as one device](101-sim-screen-device-prototype.md) — **the device is approved**
  ([prototype](assets/101-screen-device.PROTOTYPE.html), five states × three headlines × both themes,
  on 098's captures). **Headline A: the quiet strip — nothing is sticky**, because 098's density
  picture means nothing scrolls; Net Total keeps emphasis **by weight**, in the strip, beside disc /
  tax / ms. The strip **is** the collapsed input *and* the readout *and* the run controls, one row,
  expanding in place. **Frame budget: three** — Items, Results, Promotions — and **one** before the
  first Process. **Pre-run = form open + one sentence, no empty frames**, no recall and no worked
  example. **`SimMissedPromotions` is reinstated**, as neutral `○` cards in the same rail as the
  fires. Also settled: promo-off says "nothing was measured" rather than showing an empty rail, the
  400 banner **replaces** the work area, and the `W` badge takes the promo column's place since
  **the status dot column is gone**.

- [The input chip bar: collapse, expand, edit, and the stale run](102-sim-input-chip-bar.md) — the
  strip's behaviour is approved ([prototype](assets/102-input-chip-bar.PROTOTYPE.html), five states ×
  three chip sets × both themes). One **status slot** in the strip carries three states: **absent**
  when the results match the inputs, **`↻ Inputs changed`** when they do not, **`Processing…`** while a
  run is out — so staleness and in-flight are one form, not two, and the slot is the screen's only new
  component. **Staleness is neutral by force** (100 spent the hue budget) and is a **pure comparison of
  the current request against the request that produced the on-screen result** — the one testable seam
  here; it marks, it never re-runs, blocks or discards. **Determination fields chip even at their
  defaults** (098 finding 8: an invalid plant prices silently), levers only when set, and **no counts
  ever ride the strip**. The chip set **is** one button — one tab stop for nine inputs — with `Edit ▾`
  as its tail; the money readout **disappears while the form is open**. **Collapse on every Process,
  auto-expand never**: the 400 banner carries an explicit route instead. `Ctrl`+`Enter` processes from
  anywhere. In flight: **previous results stay**, spinner after **150 ms**, hairline on the strip's own
  edge, `Edit ▾` disabled not hidden. **Manual conditions open themselves when rows exist**, because
  098 finding 6 makes a silent manual condition the difference between an explicable run and a 400.

- [The anatomy of a result line](104-sim-results-line-anatomy.md) — the line is approved
  ([prototype](assets/104-result-line.PROTOTYPE.html), five baskets × three column sets × both
  themes). **Column set B, the verdict:** `# · item · qty ×unit · promotion · was · saved · net total`
  — **seven columns, three of them money**, and `was`/`saved` are **blank on an undiscounted line**.
  The captures overturned the grid before it was redrawn: today's money order **contradicts the
  arithmetic** (`gross + promo = net`, `net + tax = netTotal`), **tax is 15.0% of net everywhere** so
  it carries no per-line information, and `gross ≡ net` on a plain line — both move into the
  expansion. **The unit price is promoted onto the line** (`× 91.26`), the cheapest check on a
  price-master problem. **One promotion slot, four states** — `✔ fired` / `W` badge / neutral
  `MANUAL` chip / em-dash — and a **W line suppresses its money and says "not priced"** rather than
  printing the five zeros the wire sent. **A discount keeps its sign but loses its red** (a third hue
  spent on good news). **No totals row:** the lines foot to the header **exactly on all nine
  captures**, which is why *one* readout suffices. **The cross-highlight survives and matters more** —
  after 098's no-item-linkage finding it is the only thing on screen that says which lines one
  promotion touched. Row **34 px**, **no scroll box** — every line of every captured basket visible at
  once; the retired `max-h` and `@[820px]` card fallback are what the reclaim bought.

- [Where the deep layers live](103-sim-deep-layers-placement.md) — **the disclosure grammar is four
  sentences**: this run's data expands in place / anything fetched fresh opens a modal; a disclosure
  opens **inside a frame that already exists and is never wider than it**; **nothing behind a
  disclosure is a diagnosis — only trace hides**; state that *changes* the run reveals itself, state
  that *explains* it does not. **One idiom, exactly one level deep**, plus the bonus-buy modal as the
  single principled exception (other record, other endpoint, other grant). The line expansion is
  **one surface with three parts** — money foot, rules, elements — **closed at rest, any number open
  at once, nothing ever auto-opens**, so the Results frame's resting height depends only on line
  count. **`ConditionCard`'s own expansion is retired**: rate/base come *out* onto the card, the
  sub-records go, the `×N` pill stays. **The elements trace is a sibling, not a nesting** — the
  request flag was already the opt-in — and the `h-72` AG Grid becomes a plain table, dissolving
  `SimBonusBuyPanel`. **The statistical *control* is retired but the *distinction* is not** (a neutral
  `STAT` key, no hue, no new component) — the one place the rework would otherwise be strictly worse.
  **Corrects 101 and 104:** a `W` line's `[070]` message rides on the line, never in the expansion.
  The **ledger is signed**: the auto-selected first line's detail is the accepted loss, the `×N`
  sub-records the only irrecoverable one, offset by three things now free at rest that were not.

- [How the arrangement behaves across widths](105-sim-responsive-arrangement.md) — the arrangement is
  approved across widths ([prototype](assets/105-responsive-arrangement.PROTOTYPE.html), three
  work-area widths × both themes, on capture 05 — the only one where a bonus buy touches *both* lines
  *and* carries a trace). **Width is measured on the work area, not the viewport** (`@container`, not
  `xl:`/`lg:`) — the nav eats 200–260 px, so a 1280 laptop is a 960 screen. **One breakpoint, at
  900 px, and it is derived not chosen**: 104's ~470 px line + the rail's 250 px floor make *beside*
  possible from ~740, so the approved 66/34 device survives on every laptop and only a tablet stacks.
  Stacked, the rail goes **above** the results as a card row — the verdict may not sit under its
  evidence. **Nothing new hides at any width**: narrowing changes arrangement, never disclosure. The
  cross-highlight is **backed by a printed line list on the card** (`lines 10 · 20`) with hover as the
  enhancement, so it degrades honestly once the card is a scroll from its lines. The strip **cannot
  fragment past two rows** — the money-and-controls tail travels as one unit — and chips never scroll
  or truncate. **Shed, never scroll**, for both tables; the results table never reaches its own rule
  because the breakpoint is derived from it, so only the elements trace ever sheds (`ctr`, then
  `unit`, never a number). **Floor: 780 px of work area ≈ a 1024 window — no phone layout, ever.**

- [Mirroring and bidi for the reworked arrangement](106-sim-rtl-mirroring.md) — **the mirroring half is
  empty; the bidi half is 13 wrappers** ([audit](assets/106-sim-rtl-audit.md), instrument
  `tools/sim-rtl-drive.mjs`: 180 state combinations × both directions, 18/18). Every region mirrors and
  **not one physical-utility fix is owed** — the sweep found zero physical utilities, because 095 shipped
  the vocabulary and 101/102/104 were authored after it, so **nothing is named for the `dir`-switch
  effort**. **No region wants to resist mirroring**, where 080 needed four owner rulings. 28 of 36
  digit+space runs reorder, each repaired by isolating the whole value — all `core/ui/Ltr`, no new
  component. **Three guesses overturned:** the **buy→get sentences are innocent** (bidi W7 — a Latin word
  opening the run immunises its numbers), **the raw server promo title is the offender instead** (and
  cannot be re-worded), and money+currency breaks **only** with a literal space. **080's predicate is
  measurably not exact and must stay dumb** — no run-local predicate can be, so the drive asserts it stays
  a superset. **Icons:** `›`/`‹` self-mirror (measured off pixels) and `›` is now the *load-bearing*
  twisty — the SVG double-mirror trap is live; `Bonus buy details ▸` and `buy → get` are two real faults
  needing flipped lucide SVGs; `▶ Process` ruled not to mirror. **The hand-built table already paid its
  cost — zero RTL-specific code** (it is hand-built today, so the rework inherits it), and it is the
  cheaper side: no third-party exemption, no drift. **Question 5's premise expired** — 103 dissolves the
  feature's only AG Grid, so the screen ends with **zero** grids and `enableRtl` has no call site here.

- [The bonus-buy details affordance on a promo card](108-sim-bby-details-affordance.md) — **both cards
  carry it, the modal opens in place, form A confirmed**
  ([prototype](assets/108-bby-affordance.PROTOTYPE.html) → [approved state](assets/108-bby-affordance.APPROVED.html)).
  The near-miss is the *stronger* case, not the weaker one — 098's no-prerequisites finding means the
  modal is the only route to a miss's rules, so if the affordance is ever cut back it is **kept on the
  miss**. Navigation is rejected: `BonusBuyInquiryPage` reads **no search params**, so deep-linking
  would mean adding behaviour to another feature's screen. `DetailModal`'s whole surface is
  `{ bbyNumber, onClose }`, so the modal option is a **file move, not an API redesign** — it and seven
  siblings graduate to `@/core/`, a **named exception to arrangement-only** that changes no behaviour
  and no pixel. **The finding that changed a state:** `bonusBuyInquiryApi.access()` degrades an
  unreachable probe to *granted*, which would put a failing button on every card today — so Simulation
  gates on **`probed && screenAllowed`**, unknown means absent, and **the affordance ships dark** until
  `Bby/Detail` exists. The control is last on the card, below the amount, never a chip; the rail renders
  from `promoView` and **never waits** on the third probe.

- [The i18n churn and the testing seams](109-sim-i18n-churn-and-test-seams.md) — the ledger is
  **mechanically checked**, not remembered: 157 leaf keys diffed by script against every call site in the
  feature. **22 retirements, and the split is the finding** — only **9** leave by deleting
  `SimItemDetail` and `SimBonusBuyPanel`; **13 are sweeps** through surviving files, where a stale `t()`
  renders raw. **Nine were banked by no ticket**, including `summary.elapsed`, which is **already dead
  today**. **6 renames**, and one **collision refused**: `results.subtotal`→`results.net` would land on an
  occupied key labelling a *different* number, so all five `results.*` money keys retire and are minted
  fresh behind an assertion no partial sweep can pass. **17 new keys**, including the strip's closed chip
  vocabulary — **four keys for the ordinary five chips**, seven with the levers, the date chip keyed by
  nothing — and the **twelve uppercase keys** 106 flagged, with the constraint that the case be authored
  in the value, never a CSS transform. **Six pure seams, four of them new** (104's money projection —
  blank-not-`0.00`, the `W` line's suppressed zeros — and 100's chip set are the ones that make eyeballed
  claims assertable); **`aggregate.ts` is testable today and untested**, so it is the one seam a build can
  land red-green before any rework exists. **Five drives** for the rules with no pure surface at all,
  `sim-rtl-drive.mjs` already green. **Corrects 103** (only *one* expansion sub-heading is new, not two)
  and catches a **live contradiction**: `BoolCell`'s `text-success` check spends the hue budget a third
  time, so 100's "two hues" is not yet true of the built screen.

## Not yet specified

- ~~**The per-line detail region.**~~ **Answered by [099](099-sim-region-question-inventory.md):**
  the tiles and the statistical toggle are retired, and what remains (≤3 aggregated condition cards
  + the message list) **opens on the result line itself** — the separate panel and the whole right
  column are gone. [104](104-sim-results-line-anatomy.md) designs the expansion;
  [103](103-sim-deep-layers-placement.md) designs the disclosure.
- ~~**The pre-run and in-flight states.**~~ **Cleared by [101](101-sim-screen-device-prototype.md):**
  pre-run is the run form open, the Items frame, and one sentence — no empty frames at all. The
  **in-flight** shape is no longer a fog patch of its own; it folds into
  [102](102-sim-input-chip-bar.md), which owns the strip that owns Process, alongside staleness.
- ~~**i18n churn and the testing seams.**~~ **Resolved by
  [109](109-sim-i18n-churn-and-test-seams.md)** — see Decisions so far.

**The fog is clear.** No patch remains between here and the destination: the arrangement is settled
region by region, the churn and the proof strategy are inventoried, and nothing is left to decide before
the spec is written. **No open tickets, no fog — the map is complete**, and the hand-off is `/to-spec`
(the destination is a spec) then `/to-tickets`.

## Out of scope

- **Any behaviour change** — endpoints, `SimulateRequest`, the access probe, the cache-clear grant
  and its confirm, Process/Clear semantics. The ruling above.
- **`promoView`'s derivation rules** (spec 043's pure model: lines, blocks, missed, degradation
  path). This map arranges its output; it does not re-derive it.
- **The backend projection** [044](044-sim-applied-bby-projection.md) — the structural
  `Applications[]` / `DiscountKind` split, still blocked in its own repo. The arrangement must read
  correctly on both the degraded and the split path, which is a design constraint, not a task here.
- **The design system itself** ([082](082-pos-design-system-spec.md)) — consumed, never re-declared.
  A ticket that needs a new token states the need; it does not mint a value.
- **The defects [098](098-simulate-payload-capture.md) turned up while capturing** — a negative
  quantity returning HTTP 500, a 99999 quantity hanging the engine, an invalid plant pricing
  silently, `SimManualConditions` defaulting to an item number the server rejects, and the flat −5.00
  from a manual `5%`. All are behaviour, not arrangement; they are recorded in 098's answer so they
  survive, and they need their own build tickets outside this map.
- **Arabic copy and font metrics**, as 083 ruled. The mirroring *mechanics* are
  [106](106-sim-rtl-mirroring.md); the translation is not this effort.
