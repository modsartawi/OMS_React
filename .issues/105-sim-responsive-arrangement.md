---
type: wayfinder-ticket
wayfinder: prototype
map: 097
status: done
blocked-by: 101, 103, 104
---

# 105 — How the arrangement behaves across widths

## Question

**What happens to the device as the viewport narrows?** Today the screen is two nested grids —
`xl:grid-cols-[minmax(0,3fr)_auto_auto]` on top, `xl:grid-cols-[7fr_5fr]` below, with an inner
`lg:grid-cols-[3fr_2fr]` — so below `xl` everything simply stacks, and the promo blocks that were
beside their grid lines end up a screen away from them.

This ticket **supersedes [050](050-sim-responsive-hybrid.md)** (closed `wontfix`), which asked the
same question of the arrangement this map is replacing.

Settle, for the approved device:

1. **The breakpoints, and what each one does** — named as behaviour ("the rail unstacks above the
   work area"), not as a list of Tailwind prefixes. 083's precedent: one breakpoint at 900px, and
   the rail moves **above** the work area as a card grid rather than hiding behind a toggle, because
   the summary is the context the grid is read with.
2. **What must never be hidden behind a toggle**, at any width. Chips wrap; grids scroll; a study
   surface may collapse — but the map's premise is that hiding context on the narrow viewport that
   most needs orientation is backwards.
3. **The 047 cross-highlight when the blocks are no longer beside the grid.** The strongest reason
   this ticket is not cosmetic: a hover link between two regions that are now a scroll apart either
   needs a different expression or an honest statement that it degrades.
4. **The chip bar under pressure.** Chips wrap by nature, but a wrapping run-parameter bar that
   grows to three rows has re-spent the space it saved. Rule the overflow behaviour — wrap, scroll,
   or truncate to a count that expands.
5. **The tables.** Horizontal scroll vs column priority (drop the low-value columns first, per
   [104](104-sim-results-line-anatomy.md)'s ordering) — pick one rule and apply it to both the
   results table and the pricing-elements grid.
6. **The floor.** The narrowest width this screen supports at all. It is an internal back-office
   tool; if the answer is "1024px and no phone", record it so nobody builds a phone layout.

Draw the two or three widths in the prototype rather than describing them.

## Answer

**The arrangement is approved across widths.** Owner ruling, 2026-07-25, against
[`assets/105-responsive-arrangement.PROTOTYPE.html`](assets/105-responsive-arrangement.PROTOTYPE.html)
— [101](101-sim-screen-device-prototype.md)'s device drawn at **three work-area widths**
(1400 / 960 / 780) in both themes, on capture `05-pricing-elements`. Every recommendation was taken;
the rejected candidates stay behind their switches, drawn on the same data.

The capture choice is the ticket's own argument: `05` is the **only** 098 payload where a single
bonus buy discounts **both** lines (`affectedItemNumbers: [20, 10]`) *and* carries a pricing-elements
trace. So the cross-highlight and the second table are on screen simultaneously, which is exactly
what stacking threatens.

### 0 — The measurement, before any breakpoint: the work area, not the viewport

Every rule below is a **container query on the work area**, not a viewport media query. The app
shell's nav eats 200–260 px, so the viewport systematically lies about how much room the screen has —
a 1280 laptop with the nav open is a *960* screen. Tailwind 4's `@container` is the mechanism; the
build ticket declares the container on the page shell and nothing below it ever reads the viewport.
This is a change of kind from what the screen does today (`xl:` / `lg:` viewport prefixes) and it is
the reason the numbers here are unfamiliar.

### 1 — One breakpoint: **900 px of work area**

Above it the promotions rail sits **beside** the results at 66/34. Below it the layout stacks. Named
as behaviour: *the rail unstacks beside the work area as soon as the results column can still hold a
line.*

The number is **derived, not chosen**: [104](104-sim-results-line-anatomy.md) §8 measured column set B
at **~470 px** and 101 gave the rail a **250 px** floor, so *beside* is structurally possible from
~740 px. 900 leaves headroom rather than sitting on the limit. Rejected: **1140**, which keeps every
beside-layout roomy at the price that a 1280 or 1366 laptop with the nav open **never sees the
approved device** — the arrangement 099 approved would have become the exception rather than the rule.

Measured on the prototype, driven:

| Work area | Arrangement | Results column | Elements trace | Run strip |
|---|---|---|---|---|
| 1400 | beside, 66/34 | 900 px | full, 7 columns | 1 row |
| 960 | beside, 66/34 | 610 px | sheds `ctr` | 2 rows |
| 780 (floor) | stacked | 754 px | full | 2 rows |

### 2 — Stacked, the rail goes **above** the results

099 ruled "did the promotion fire?" the **first** read, so the verdict may not sit under the evidence
it explains. This is also 083's precedent — the summary moves above the grid rather than behind a
toggle, because it is the context the grid is read with. The rail becomes a **card row**
(`auto-fit, minmax(258px, 340px)`), not a full-width band: one fired promotion is one card-sized
card, not a stripe across the screen.

Consequence worth stating: the **order of the three frames changes with width**. Beside → Items,
then Results | Promotions. Stacked → Items, **Promotions**, Results.

### 3 — Nothing new hides at any width

At every supported width: the run strip's chips, the items grid, the promotions rail (fires **and**
near-misses), and a `W` line's message are all present and unfolded. The only things that hide are
the two [103](103-sim-deep-layers-placement.md) already ruled hideable — the line expansion and
manual conditions — and they hide **identically at all widths**. There is no width-triggered
disclosure anywhere on this screen: narrowing changes *arrangement*, never *disclosure*. The map's
premise — hiding context on the narrow viewport that most needs orientation is backwards — is
therefore satisfied by construction, not by vigilance.

### 4 — The cross-highlight: **the card prints its line list**, and hover tints on top

At every width the promotion card reads `000100000131 · ZB03 · lines 10 · 20`. The hover highlight
(047, `bbyNumber`, `primary-050` on the matching lines) is the **enhancement**, not the mechanism.

104 called the highlight "the only thing on screen that says which lines one promotion touched" after
098 found no item linkage on a missed promotion. A link that only exists on hover, between two regions
a scroll apart, is not that thing. The printed list is the honest degradation: it costs one line of
existing card text, it survives stacking, and it survives having no pointer at all. Switching the
prototype to hover-only and reading the 780 device is the evidence — the card goes silent about its
lines.

### 5 — The chip bar: wrap, **at most two rows**, never scroll, never truncate

100 forbids a truncated chip (a chip is an untruncated settled fact) and there are at most eight, so
truncation and overflow menus are both out. Scrolling is rejected for the same reason — a settled fact
pushed off the edge is hidden, not condensed.

The strip cannot fragment into three rows **by construction**: the tail — money readout + Process +
Clear + Wipe cache — travels as **one flex unit**, so the only break available is *chips row, then
tail row*. Driven: 1 row at 1400 (five chips **and** eight), 2 rows at 960 and 780. The second row is
therefore normal below ~1100, not an overflow state, and costs ~37 px.

### 6 — The tables: **shed, never scroll** — and the results table never reaches it

One rule for both, as the ticket demanded, but the two tables meet it very differently:

- **The results table never sheds and never scrolls.** The breakpoint is *derived from* set B's
  minimum, so the results column cannot drop below what the seven columns need — 610 px at the
  tightest beside-layout, 754 px stacked at the floor, against a ~470 px requirement. The drop order
  exists only as a contingency if the floor is ever lowered: **`was` first, then nothing** — `#`,
  item, qty ×unit, promotion, saved and net total are all load-bearing (104 §1).
- **The pricing-elements trace is the only table that can outgrow its column**, because it lives
  *inside* the results column at 66 %. It sheds **`ctr` first, then `unit`** — both are identifiers
  that repeat down the column, and **no number ever goes**. Driven: at a 610 px results column the
  trace sheds `ctr` and fits; under the rejected scroll rule it is 640 px inside a 546 px box.

Rejected: a horizontal scroller inside an expanding table row — a nested scroll region in a
disclosure, for a table 098 measures at 7 rows.

### 7 — The floor: **780 px of work area ≈ a 1024 px window**

A tablet in landscape with the nav open. Below it the app shell scrolls horizontally and **no further
arrangement exists**. This is an internal back-office tool run by an analyst at a desk: there is no
phone layout, there will not be one, and nothing in 098 or 099 suggests the loop is ever run on one.

### What this hands on

- **106** inherits three geometry rules to mirror, all already written logically: the 66/34 split
  (start/end, not left/right), the stacked order (block direction, unaffected by `dir`), and the
  chips-then-tail break.
- The **spec** inherits one new i18n key — the card's printed line list (`promotions.lines`, an
  interpolated list) — and the note that the container-query shell is a **structural** change from
  today's `xl:`/`lg:` viewport prefixes, not a restyle.
- **050 is now fully answered** and stays `wontfix`: it asked this question of the arrangement this
  map replaced.
