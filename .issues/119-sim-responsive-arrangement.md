---
status: done
spec: 110
blocked-by: 116, 117
---

# 119 — The arrangement stacks the rail above the results below 900 px

## What to build

Make the device behave across widths, measured on the **work area** — the container
[113](113-sim-run-strip.md) declared — and **never on the viewport**. The nav eats 200–260 px, so the
viewport systematically lies about how much room the screen has: a 1280 laptop with the nav open is a
**960** screen. This replaces the feature's remaining viewport prefixes and is a change of *mechanism*,
which is why the numbers here are unfamiliar.

**One breakpoint: 900 px of work area** — and it is **derived, not chosen**. The rebuilt line needs
~470 px and the rail has a 250 px floor, so *beside* is structurally possible from ~740; 900 leaves
headroom rather than sitting on the limit. The rejected alternative (1140) would have kept every
beside-layout roomy at the price that a 1280 or 1366 laptop with the nav open **never sees the approved
device** — making the arrangement the exception rather than the rule.

- **Above 900:** the rail sits **beside** the results at 66/34.
- **Below 900:** the layout **stacks, and the rail goes above the results** as a card row, not a
  full-width band — one fired promotion is one card-sized card, not a stripe across the screen. The
  verdict may not sit under the evidence it explains. **Consequence worth building deliberately: the
  order of the three frames changes with width** — beside is Items → Results | Promotions; stacked is
  Items → **Promotions** → Results.
- **Floor: 780 px of work area ≈ a 1024 px window.** Below it the shell scrolls horizontally and no
  further arrangement exists. **No phone layout, ever** — this is an internal back-office tool run by an
  analyst at a desk.

**Nothing new hides at any width.** The strip's chips, the items grid, the rail (fires *and*
near-misses) and a `W` line's message are present and unfolded at every supported width. The only things
that hide are the two already ruled hideable — the line expansion and manual conditions — and they hide
**identically at all widths**. Narrowing changes **arrangement, never disclosure**.

**The strip cannot fragment past two rows.** Its four groups wrap as units and the money-and-controls tail
travels together; the status slot must never wrap away from the chips it is commenting on. **Chips never
scroll and never truncate** — their content is a bounded domain precisely so that is possible.

**Shed, never scroll**, for both tables:

- **The results table never sheds and never scrolls** — the breakpoint is *derived from* its minimum, so
  it cannot drop below what seven columns need. Its drop order exists only as a contingency if the floor
  is ever lowered: `was` first, then nothing.
- **The elements trace is the only table that can outgrow its column**, because it lives *inside* the
  results column at 66%. It sheds **`ctr` first, then `unit`, and never a number** — both are identifiers
  that repeat down the column. Rejected: a horizontal scroller inside an expanding table row.

**The shed order is a pure module** — a level-to-column-list function, not CSS (owner-confirmed while
writing the spec). That makes "no numeric column is ever shed" a one-line assertion across three levels,
and guards the rule most likely to be broken later by someone adding a column and dropping it into the
order without thinking.

## Spine reach

store/logic (the pure shed-order column list) · component (the shell's breakpoint and stacked order) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `the trace sheds ctr first, then unit, and never a number` — one assertion across all three levels · **pure** — `src/features/pricing/simulation/element-columns.test.ts`, 10 assertions. The "never a number" sweep runs over every level, and a second one guards the *order itself* (no `figure` can even be put in `SHED_ORDER`) so the edit that breaks the rule fails rather than the level that happens to reach the new column.
- [x] `below 900 px of work area the rail stacks above the results` — the frame order changes with width; the rail becomes a card row, not a band · **flow (Playwright, new `tools/sim-responsive-drive.mjs`)** — 47/47 on port 5203.
- [x] `nothing new hides at any supported width, and the strip never exceeds two rows` — chips never truncate, down to the 780 px floor · **flow (same drive)** — the two-row count is taken across the strip's 13 **leaf** parts (every chip, the slot, every money figure, every control), not its two group boxes, because a group-level count cannot exceed two by construction. That measurement found and fixed a real three-row fragmentation at 780: the tail measured ~808 px against a 780 px floor and wrapped internally.

Also verified green after the strip's restructure: `sim-strip-drive` 51/51, `sim-rail-drive` 31/31,
`sim-density-drive` 33/33, `sim-states-drive` 27/27. `typecheck`, `npm test` (250), `lint`, `build` green.

Commission `tools/sim-responsive-drive.mjs` here, driving the three measured work-area widths
(1400 / 960 / 780). This drive is also where 115's density claims — 34 px rows, no scroll box, every
line visible — are measured, since it is the one with the widths set up.

## Boundaries

No API change, no new i18n keys. This slice **removes** the feature's remaining `xl:`/`lg:` viewport
prefixes in favour of container queries — a mechanism change, not a class rename, and the reason it is
called out here rather than smuggled into a behaviour slice. Logical Tailwind utilities only, per the
standing rule; the RTL pass is [121](121-sim-rtl-mirroring.md)'s.

**Concurrency:** this slice owns `tools/sim-responsive-drive.mjs` and **drive port 5203**.
[118](118-sim-bby-details-affordance.md) runs in the same wave on its own drive and port. Work in a git
worktree.

## Done when

Driving the app at 1400, 960 and 780 px of work area: the rail is beside the results above 900 and above
them as a card row below it, the elements trace sheds `ctr` then `unit` with every number intact, the
strip stays within two rows with no truncated chip, and nothing that is visible at 1400 is hidden at 780.
The pure shed test and `tools/sim-responsive-drive.mjs` green.

## Blocked by

- [116](116-sim-line-expansion.md) — the elements trace is the only table that sheds, and it does not
  exist until the expansion does.
- [117](117-sim-promotions-rail.md) — there is no rail to stack until the rail exists.

## Comments

**Two things the build settled that the ticket left to it.**

**The card row is scoped to the stacked arrangement, by name.** Spec 110 gives the rail's card row as
`auto-fit, minmax(258px, 340px)` under "Below 900". Applied unconditionally, the 340 px maximum leaves
~130 px of dead space inside the 472 px rail *beside* the results at 1400. So the work-area container is
**named** (`@container/work`) and the card row queries `@max-[900px]/work` — the same breakpoint that
stacks it. Beside: one card filling its column, exactly as before. Stacked: a bounded card row. The rule
is the spec's, and it now applies exactly where the spec put it. One source for both lists
(`PROMO_CARD_ROW` in `promo-kind.ts`) so the fires and the near-misses cannot reflow at different widths
— the seam [117](117-sim-promotions-rail.md) closed.

**The two-row rule needed spacing to give, and it was allowed to.** At 780 the money-and-controls tail
measured ~808 px against a 780 px floor and wrapped internally — three rows. Nothing was hidden to fix
it: the tail's gaps and the buttons' padding tighten under `@max-[900px]/work` and every figure, every
control and the `⌃⏎` signpost survive at every width. 748 px at the floor, 32 px of slack. Padding is
arrangement; the rule the ticket protects is disclosure.

**`tight` is reached before the width runs out, and that is the design.** `traceLevel` picks the widest
level whose columns fit *comfortably*; at a 960 px work area the trace has ~580 px against `tight`'s
646 px and renders anyway, because the description column absorbs the squeeze. Below `tight` there is no
fourth level — the trace never answers a narrow column by dropping a figure or by scrolling.

**Left for [121](121-sim-rtl-mirroring.md):** nothing new. The slice added no physical utilities; the
shed order is direction-neutral, and `order-last` mirrors correctly.
