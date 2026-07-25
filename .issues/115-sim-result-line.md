---
status: open
spec: 110
blocked-by: 113, 123
---

# 115 — The result line reads its money in the corrected order

## What to build

Rebuild the results table around the arithmetic the pricing engine actually performs. Today's line
prints *subtotal · promo · gross · tax · net* — the post-discount figure **before** the discount, the
pre-discount figure **after** it, under labels that name neither. The captures decided the new set
before a pixel was drawn: `grossValue + promotionDiscount = netValue`, then `netValue + taxValue =
netTotal`; **tax is 15.0% of net on every line of every capture**, so a column of it carries no per-line
information; and on an undiscounted line `grossValue ≡ netValue`, so the majority of lines spend five
money columns on **two** independent numbers.

**The verdict: `# · item · qty ×unit · promotion · was · saved · net total`** — seven columns, three of
them money.

- **`was` and `saved` are blank on an undiscounted line** — a faint `·`, **not `0.00`**. They are the
  read-only-on-a-surprise columns.
- **Net, tax and the arithmetic move into the expansion** ([116](116-sim-line-expansion.md) builds it);
  this slice stops printing them on the line.
- **The unit price is promoted onto the line**, under the quantity — the analyst's cheapest sanity check
  on a price-master problem, and it costs no column.
- **`net total` is the only emphasised figure on the line.** The material description is the widest
  column and reads first, but the emphasis is money, because the loop's question is "what did this cost
  after the promotion".
- **A discount keeps its sign but loses its red.** Every real discount is negative and today's grid
  paints it destructive — a **third hue, spent on good news**. Neutral, end-aligned, tabular figures.

**The promotion slot: one slot, four states** — `✔ fired` (the hue budget's first spend), a `W`
`StatusBadge`, a neutral `MANUAL` chip, or an em-dash. Fired and MANUAL can co-occur and stack.

**There is no status column.** A healthy line carries **no mark at all**, so a dot column would spend
colour on "nothing is wrong" three times to surface the one case that matters. The `W` badge takes the
promotion slot's place — and the two can never collide, because a line that failed to price never fires
a promotion. **The E/W count banner stays retired**: on this evidence it would be a warning-only banner
over a three-line table where the badge is already in view.

**A `W` line suppresses its money.** The captured `COUP01` line returns `0` for unit price, gross, net,
tax and total. Printing those says *priced at zero*; the truth is *did not price*. The line reads
em-dashes and an italic `not priced`, **with its `[070]` message on the line itself** — never hidden in
the expansion. This is the one place the screen deliberately does not print what the wire sent.

**No totals row.** The lines foot to the header exactly on all nine priced captures — which is the reason
*one* readout suffices, not a reason to print it twice a few hundred pixels below the strip.

**Density: 34 px rows, two text rows** (description over material, quantity over unit price), and **no
scroll region** — the existing `max-h-[32rem]` and the `@[820px]` card fallback both go. Every line of
every captured basket is visible at once, and the Results frame is as tall as its content. Selection is a
3 px inline-start edge plus a subtle fill — no checkbox, no row highlight that would compete with the
promotion cross-highlight — and **a re-run clears it**, because condition keys are not stable across runs
and a stale expansion is worse than an extra click.

**The line's money projection is a pure module** producing `{ was, saved, netTotal, notPriced, promoSlot }`
from a result line. This is the rework's highest-risk rule, because every failure mode is a
*plausible-looking number*.

## Spine reach

store/logic (the pure line projection) · component (the results table) · i18n (the money renames) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `an undiscounted line renders was and saved blank rather than 0.00` — on the plain-line captures · **pure**
- [ ] `a W line suppresses all five zeros the wire sent and reports not priced` — the `COUP01` capture · **pure**
- [ ] `the promotion slot resolves to exactly one of four states, with fired and MANUAL able to stack` · **pure**

Verify the rendered result by driving the app against the captured baskets — the density rules (34 px,
no scroll box, every line visible) belong to [119](119-sim-responsive-arrangement.md)'s drive, which has
the widths to measure them at.

## Boundaries

No API change.

**Concurrency:** pure tests only — no drive, no port. The density claims (34 px rows, no scroll box,
every line visible) are measured by [119](119-sim-responsive-arrangement.md)'s drive, which has the
widths set up. Work in a git worktree.

**i18n — the rename set, and the collision to refuse.** All new keys are already minted by
[123](123-sim-i18n-key-expand.md); this slice **retires** the old ones as their call sites move. The
natural rename of
`results.subtotal` is `results.net`, but **that key is occupied today, by `netTotal`**. A rename onto an
occupied key is the one shape the zero-literal rule cannot protect: a half-finished sweep leaves a key
that resolves, renders plausible English, and is about the **wrong number** — strictly worse than a raw
key, which is at least visibly broken. **So all five money keys are retired and minted fresh**:
`results.gross`→`results.was`, `results.promo`→`results.saved`, `results.net`→`results.netTotal`,
`results.subtotal`→`results.expandNet`, `results.tax`→`results.expandTax`. Also retired here:
`results.status`, `results.promoNone.mark` and `.label`, `results.material` and `results.description`
(the merged Item column has one header), `banner.counts` (the E/W banner), and `status.ok` (a healthy
line renders no label). New: `results.pos`, `.was`, `.saved`, `.netTotal`, `.unitPrice`, `.fired`,
`.notPriced`. The `MANUAL` chip **reuses `detail.badge.manual`** — one key, two call sites.
[121](121-sim-rtl-mirroring.md)'s close-out asserts the five retired money keys are gone from JSON *and*
call sites; do not leave that to it, it is the backstop.

## Done when

Driving the app against the captured baskets: a plain line shows blank `was`/`saved`, a discounted line
shows both with the discount neutral, the `W` line reads `not priced` with its `[070]` message on the
line, no status column or totals row exists, and every line of every basket is visible without a scroll
box. All three pure tests green, `npm run typecheck` and `npm run lint` clean.

## Blocked by

- [113](113-sim-run-strip.md) — the frame budget and the work-area container are established there, and
  the results table is one of the three surviving frames.
- [123](123-sim-i18n-key-expand.md) — the seven new `results.*` keys are minted there.
