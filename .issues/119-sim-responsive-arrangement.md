---
status: open
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

- [ ] `the trace sheds ctr first, then unit, and never a number` — one assertion across all three levels · **pure**
- [ ] `below 900 px of work area the rail stacks above the results` — the frame order changes with width; the rail becomes a card row, not a band · **flow (Playwright, new `tools/sim-responsive-drive.mjs`)**
- [ ] `nothing new hides at any supported width, and the strip never exceeds two rows` — chips never truncate, down to the 780 px floor · **flow (same drive)**

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
