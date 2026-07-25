---
type: spec
status: ready
---

# 110 — The POS Simulation screen rework

Synthesized from wayfinder map [097](097-simulation-screen-rework.md), whose eleven tickets
([098](098-simulate-payload-capture.md)–[109](109-sim-i18n-churn-and-test-seams.md)) are all resolved.
Every ruling below traces to a resolved ticket and its approved prototype; this spec restates them as
one buildable whole and adds nothing that was not decided there.

## Problem Statement

A pricing analyst opens **POS Simulation** to answer one question — *did the promotion fire, and what
did the basket cost after it?* — and then answers it again, and again: swap a material, bump a
quantity to cross a threshold, toggle promo off, re-run. It is one workflow, **set up once, run many**.

The screen fights that loop.

- **It spends its space on chrome, not answers.** Eleven bordered frames and seven headings hold
  content that measures, on eleven captured live runs, at 1–3 result lines and 0–2 promotions. The
  determination fields — plant, sales org, distribution channel, pricing date — are typed once at open
  and never touched again, yet keep a full form's worth of screen for the whole session.
- **It buries the primary answer and headlines the confirming one.** Net Total is a `3xl` figure
  top-right; whether the promotion fired is in a right-hand column, below the fold on a laptop.
- **Its money columns contradict their own arithmetic.** The line prints *subtotal · promo · gross ·
  tax · net* — the post-discount figure **before** the discount, the pre-discount figure **after** it,
  under labels that name neither. Tax is 15.0% of net on every line of every capture, so a column of
  it carries no per-line information, and on an undiscounted line `gross ≡ net`, so the majority of
  lines spend five money columns on **two** independent numbers.
- **It goes silent when its results stop describing its inputs.** Change a field, don't press Process,
  and the screen still shows the previous run's total with no mark of any kind.
- **A `W` line prints five zeros**, because that is what the wire sent — saying *priced at zero* when
  the truth is *did not price*.
- **The near-miss surface is commented out**, so "why didn't it fire?" has no answer on screen at all.
- **A promotion that touches two lines says so only on hover**, between two regions that can be a
  scroll apart — and after the capture pass found a missed promotion carries **no item linkage**, that
  hover is the only thing on the screen that links a promotion to its lines.
- **The one control the real loop needs is filed as an admin curio.** A bonus buy edited in SAP will
  not fire with its latest version until the pricing cache is wiped, so the true iteration is
  *fix → re-download → wipe cache → Process* — and `Clear cache` sits away from Process.

## Solution

Rearrange the whole screen — input side and results side — on the shipped POS design system
([082](082-pos-design-system-spec.md)) into a denser, chip-led device. **No behaviour changes**:
endpoints, the `SimulateRequest` shape, the access and cache-clear gating, the promo-view derivation
rules and Process/Clear semantics are untouched. What moves is where things sit and how they read.

**Eleven frames and seven headings become three and three — and one and one before the first Process.**

- **A run strip replaces the header form, the Summary tile and the Actions card.** One unframed row:
  the run's determination as chips (`PLANT P001 · ORG 1000 · CHAN 20 · 25 Jul 2026 · PROMO on`), a
  status slot, the money readout, and the run controls as a terminal cluster — `▶ Process`, `Clear`,
  `⛁ Wipe cache` together, because all three are the run loop's verbs. The chip set **is** the control:
  one tab stop, ending in `Edit ▾`, expanding **in place** back to the full form. Nothing is sticky —
  at the density the captures show, nothing scrolls.
- **The status slot ends the silence.** One slot, three states: **absent** when the results match the
  inputs, **`↻ Inputs changed`** when they do not, **`Processing…`** while a run is out. Staleness and
  in-flight become one form rather than two inventions, and staleness *marks* — it never re-runs,
  blocks or discards.
- **Items never collapse.** They are the instrument retyped every run, the opposite lifetime from the
  determination fields. Manual conditions stay a disclosure inside the Items frame, **self-opening
  whenever rows exist**, because a silently-defaulted manual condition is the difference between an
  explicable run and an inexplicable 400.
- **The verdict comes to eye level.** Results and a promotions rail sit side by side at 66/34, the rail
  carrying fires **and** near-misses. Net Total keeps emphasis by weight, in the strip, beside
  discount, tax and calc time.
- **The line is rebuilt around the corrected arithmetic**: `# · item · qty ×unit · promotion · was ·
  saved · net total`. Seven columns, three of them money. `was`/`saved` are **blank on an undiscounted
  line**, not `0.00`. Net, tax and the arithmetic move into the expansion, which foots itself. The unit
  price is promoted onto the line as the cheapest check on a price-master problem. A `W` line
  **suppresses its money and reads `not priced`**, with its `[070]` message on the line itself.
- **One disclosure idiom, exactly one level deep**: this run's data expands in place; anything fetched
  fresh opens a modal. The line expansion is one surface with three parts — money foot, rules, elements
  — closed at rest, any number open at once, nothing ever auto-opens.
- **A promotion card prints its line list** (`lines 10 · 20`), with the hover cross-highlight as the
  enhancement rather than the mechanism, so the link survives stacking and survives having no pointer.
- **Both promotion cards carry `Bonus buy details ▸`**, gated on a probe and shipping dark until the
  backend endpoint exists.

## User Stories

1. As a pricing analyst, I want the determination fields I set once to collapse into a row of chips
   after Process, so that the screen spends its space on the run's answers rather than on inputs I am
   not going to touch again this session.
2. As a pricing analyst, I want the plant, sales org, channel and date chipped **even when they hold
   their defaults**, so that a run priced against an invalid plant — which prices silently — is
   readable without my expanding anything.
3. As a pricing analyst, I want a lever I have not set to show **no chip at all** rather than a muted
   empty one, so that the strip's contents are facts about this run and never placeholders.
4. As a pricing analyst, I want a procedure key or loyalty tier I *have* set to announce itself as a
   chip, so that a stray lever silently rewriting the pricing procedure cannot make a run inexplicable.
5. As a pricing analyst, I want the promotion flag chipped in **both** its states, so that a blacked-out
   promotions rail on a promo-off run never reads as "nothing fired".
6. As a pricing analyst, I want the whole chip set to be one click target ending in a visible `Edit ▾`,
   so that the way back to the form is discoverable without my having to learn that a chip is clickable.
7. As a keyboard user, I want the chip set to be a single tab stop for all nine inputs behind it, so
   that tabbing past a collapsed form costs one keystroke rather than nine.
8. As a pricing analyst, I want expanding the strip to replace the collapsed row **in place**, so that
   the results below stay where my eye left them.
9. As a pricing analyst, I want the money readout to disappear while the form is open, so that a total
   is never shown beside inputs that no longer describe the run that produced it.
10. As a pricing analyst, I want `Esc` to collapse the form and return focus to the chip set, so that
    focus is never lost to the document.
11. As a pricing analyst, I want `Ctrl`+`Enter` to Process from anywhere including inside the items
    grid, so that the tweak-one-field-and-re-run loop is mouse-free.
12. As a pricing analyst, I want the strip to collapse on **every** Process including one that fails,
    so that the screen never moves itself while I am starting to read an error.
13. As a pricing analyst, I want a `↻ Inputs changed` mark the moment any input differs from the request
    that produced the on-screen result, so that I can never mistake an older basket's total for this one.
14. As a pricing analyst, I want a stale run marked in the strip **and** confirmed once above the
    results, so that the mark is visible both where the change happened and where the stale numbers are.
15. As a pricing analyst, I want staleness to be neutral rather than amber, so that it reads as "older"
    rather than promising a fault where there is none.
16. As a pricing analyst, I want a stale run to keep its results readable, undimmed and undiscarded, so
    that I can still compare the previous total against the one I am about to produce.
17. As a pricing analyst, I want an item-row or manual-condition edit to count as an input change, so
    that staleness describes the whole request rather than only the header.
18. As a pricing analyst, I want the previous results to stay on screen while a run is out, so that a
    184 ms round trip is not a flicker of nothing.
19. As a pricing analyst, I want the spinner to wait 150 ms before appearing, so that an ordinary run
    never flashes one.
20. As a pricing analyst, I want the in-flight bar to run along the strip's own edge, so that waiting
    introduces no new region and no layout shift.
21. As a pricing analyst, I want `Edit ▾` disabled rather than hidden while a run is out, so that the
    strip does not reflow twice on every Process.
22. As a pricing analyst, I want `Clear cache` beside Process rather than filed as an administrative
    control, so that the fix → re-download → wipe → Process loop happens in one place.
23. As a pricing analyst, I want the items grid to stay permanently open and never join the strip, so
    that the thing I retype every run is always a working surface.
24. As a pricing analyst, I want the manual-conditions disclosure to **open itself whenever rows exist**,
    so that a condition defaulted to an item number the server rejects can never sit silently behind a
    closed twisty.
25. As a pricing analyst, I want the manual-conditions label to carry a count when non-empty, so that I
    can see there is something there without opening it.
26. As a pricing analyst, I want `itemConditionControl` kept as a permanent, labelled column, so that I
    can price a coupon — which carries no base price — by setting it to `M`.
27. As a pricing analyst, I want the promotion verdict beside the lines it explains rather than below
    them, so that the screen's first question is answered at eye level.
28. As a pricing analyst, I want near-misses shown as neutral cards in the same rail as the fires, so
    that "why didn't it fire?" has an answer on the screen at all.
29. As a pricing analyst, I want a near-miss to read as neutral rather than as a warning, so that the
    screen's colour still means what it says.
30. As a pricing analyst, I want a promo-off run to say **nothing was measured** rather than show an
    empty rail, so that switching promotions off is never confused with promotions not firing.
31. As a pricing analyst, I want each promotion card to print the lines it touched, so that the link
    survives the card being a scroll away from those lines and survives my having no pointer.
32. As a pricing analyst, I want hovering a promotion card to tint its lines, so that the linkage is
    immediate when a pointer is available.
33. As a pricing analyst, I want the result line to read `# · item · qty ×unit · promotion · was · saved
    · net total`, so that the money on the line follows the arithmetic the engine actually performs.
34. As a pricing analyst, I want `was` and `saved` **blank** on an undiscounted line, so that the money
    columns are read only when there is a surprise in them.
35. As a pricing analyst, I want net and tax in the expansion rather than on the line, so that a column
    that is the same multiple on every line stops competing with the figures that differ.
36. As a pricing analyst, I want the expansion's money foot to prove `net + tax = net total`, so that
    the arithmetic is still checkable one click down.
37. As a pricing analyst, I want the unit price under the quantity, so that a price-master problem is
    visible without my opening anything.
38. As a pricing analyst, I want net total to be the only emphasised figure on the line, so that the
    number the loop is about finds my eye.
39. As a pricing analyst, I want a discount to keep its sign but lose its red, so that colour on this
    screen never marks good news.
40. As a pricing analyst, I want a healthy line to carry **no status mark at all**, so that the one
    unhealthy line is the only coloured thing on the screen and finds my eye unaided.
41. As a pricing analyst, I want a `W` line to show its badge in the promotion slot, so that the status
    costs no column of its own.
42. As a pricing analyst, I want a `W` line to read `not priced` with em-dashes instead of the five
    zeros the wire sent, so that the screen never claims a line priced at zero when it did not price.
43. As a pricing analyst, I want a `W` line's `[070]` message on the line itself rather than in its
    expansion, so that a failure is never something I have to go looking for.
44. As a pricing analyst, I want no E/W count banner, so that a count is not printed over a three-line
    table where the flagged line is already in view.
45. As a pricing analyst, I want no totals row under the lines, so that the total is stated once rather
    than duplicated a few hundred pixels below the strip.
46. As a pricing analyst, I want every line of my basket visible at once with no scroll box, so that a
    basket the size the captures show is read without scrolling.
47. As a pricing analyst, I want the selected line marked by an inline-start edge rather than a row
    highlight, so that selection never competes with the promotion cross-highlight.
48. As a pricing analyst, I want a re-run to clear the selection, so that a stale expansion never shows
    the previous run's conditions against the new run's lines.
49. As a pricing analyst, I want a line's rules to expand **in place inside the Results frame**, so that
    reading one line's detail never covers the lines around it.
50. As a pricing analyst, I want the expansion closed at rest and never auto-opening, so that the
    Results frame's resting height depends only on how many lines I priced.
51. As a pricing analyst, I want any number of lines open at once, so that I can compare two lines'
    rules side by side.
52. As a pricing analyst, I want a condition card's rate and base always visible on the card, so that
    the two figures I always want are not behind a second expansion.
53. As a pricing analyst, I want a statistical condition marked with a neutral `STAT` key, so that the
    distinction survives even though the toggle that reported it is gone.
54. As a pricing analyst, I want the pricing-elements trace as a plain table beside the rules rather
    than a fixed-height grid, so that seven rows are not shown in a box sized for thirty.
55. As a pricing analyst, I want the elements trace to appear only when the run requested it, so that
    the request flag stays the opt-in it already is.
56. As a pricing analyst, I want `Bonus buy details ▸` on a fired promotion card, so that the promotion's
    own record is one click from the basket it fired on.
57. As a pricing analyst, I want that control on the **near-miss** card too, so that a promotion with no
    prerequisite data on the wire still has a route to its rules.
58. As a pricing analyst, I want bonus-buy details to open as a modal in place, so that I never lose the
    basket I am investigating.
59. As a pricing analyst, I want the control absent when its grant cannot be confirmed, so that I am
    never given a button that fails when clicked.
60. As a pricing analyst, I want the promotions rail to render immediately and never wait on the
    details probe, so that the verdict is not delayed by a permission check.
61. As a pricing analyst on a 1280 laptop with the nav open, I want the approved side-by-side device
    rather than a stacked fallback, so that the arrangement is the rule and not the exception.
62. As a pricing analyst on a tablet, I want the promotions rail **above** the results when the layout
    stacks, so that the verdict never sits under the evidence it explains.
63. As a pricing analyst, I want nothing new to hide as the window narrows, so that narrowing changes
    arrangement and never disclosure.
64. As a pricing analyst, I want the strip never to fragment past two rows, so that the money and the
    run controls always travel together.
65. As a pricing analyst, I want chips never to scroll or truncate, so that a chip is always readable
    whole.
66. As a pricing analyst, I want the elements trace to shed identifier columns rather than scroll
    sideways, so that a nested scroll region never appears inside a disclosure.
67. As a pricing analyst, I want no numeric column ever shed from the trace, so that narrowing never
    costs me a figure.
68. As a pricing analyst, I want the whole-run 400 banner to **replace** the work area rather than push
    it down, so that a failed run does not leave a previous run's results below an error.
69. As a pricing analyst, I want the 400 banner to point at where the fault is — Items, or the run
    settings — so that I know where to go without re-reading the whole screen.
70. As a pricing analyst, I want the banner's route to the run settings to open the form **on click**
    rather than automatically, so that I choose when the screen moves.
71. As a pricing analyst, I want no money readout at all on a failed run rather than a zeroed one, so
    that a run with no total does not print one.
72. As a pricing analyst, I want Items to stay exactly where it was when a run fails, so that I correct
    the offending line in place.
73. As a first-time user, I want the pre-run screen to be the open form, the Items frame and one line of
    text, so that I am not shown empty frames, skeletons or a fictional sample basket.
74. As an Arabic-locale user, I want every region to mirror, so that the screen reads right-to-left
    without a separate layout.
75. As an Arabic-locale user, I want codes, quantities and money to keep their internal order inside
    mirrored text, so that a digit run is never reordered into a different number.
76. As an Arabic-locale user, I want directional chevrons and the buy→get arrow to point the way the
    text runs, so that the disclosure and the promotion sentence stay readable.
77. As a maintainer, I want the retired translation keys gone from the locale file in the same change
    that removes their call sites, so that no key renders raw to a user.
78. As a maintainer, I want the five old money keys provably absent from both the JSON and every call
    site, so that no half-finished sweep can leave a key resolving to plausible English about the wrong
    number.
79. As a maintainer, I want the screen's colour budget to remain exactly two hues, so that the rule the
    design system states is true of the screen as built.
80. As a maintainer, I want the rules with a pure surface tested in `vitest` and the rules without one
    proved by a drive, so that no test asserts a re-implementation of the thing it is testing.

## Implementation Decisions

### Scope line — arrangement only, with one named exception

Endpoints, the `SimulateRequest` shape, the access probe, the cache-clear grant and its confirm, the
promo-view derivation rules, and Process/Clear semantics are **untouched**. No new endpoint is
consumed and no new envelope code is handled — the existing `ApiError` taxonomy and the whole-run 400
path stay as they are.

**The one named exception** is structural, not behavioural: the bonus-buy `DetailModal` and seven
siblings graduate from the `bonus-buy-inquiry` feature to `@/core/`, because the import boundary
forbids a feature importing another feature. This changes no behaviour and no pixel. Per
[feature-structure](../.claude/rules/feature-structure.md), **i18n stays flat and feature-named
regardless of folder** — the `bonus-buy-inquiry` namespace registration and every `t('bonus-buy-inquiry:…')`
call site are unchanged. Slice it as its own ticket ahead of the card work.

### The run strip

One unframed row, four wrap groups in source order: **chip set · status slot · money · run controls**.
The status slot must never wrap away from the chips it comments on. Nothing is sticky.

- The chip set is **one `<button>`** wrapping chip `<span>`s and ending in an `Edit ▾` tail, carrying
  one `aria-expanded`. Individual chips have no hover state, no cursor change, and are never buttons —
  anywhere on this screen. Expanded, the control reads `Done ▴`.
- Expansion replaces the collapsed row **in place**; Process / Clear / Wipe cache move to the form's
  footer while it is open, and the money readout is **removed, not moved**.
- Focus: expand → Plant; `Esc` → collapse with focus back on the chip set; `Ctrl`+`Enter` → Process
  from anywhere, signposted on the button (`▶ Process ⌃⏎`).
- Collapse on **every** Process including a 400. Auto-expand never.
- In flight: previous results stay; spinner after **150 ms**; an indeterminate hairline on the strip's
  own bottom edge; inputs, `Clear` and `⛁ Wipe cache` lock on the existing pending flag; `Edit ▾`
  disabled rather than hidden; `▶ Process` becomes a disabled `Processing…`.

**The status slot is the only new component the rework adds.** A dashed neutral pill (`bg-muted`,
dashed `border-strong`) — deliberately *not* a chip, because it changes while you read it, which is
what the chip test excludes.

**The chip set is a pure module.** It maps the request to `{ key, value }` **tokens, not translated
strings** — keeping it node-testable and keeping the i18n rule intact. Rules: determination fields chip
**always, even at defaults**; levers and flags chip **only when set**; promotion chips in **both**
states; the date chip carries **no key**. Five chips ordinarily, eight with the levers, nine with the
elements flag.

**The staleness predicate is a pure module**: the current `SimulateRequest` compared against the
request that produced the on-screen result. Every input counts — header fields, both checkboxes, item
rows, manual-condition rows. `''`, `null` and `undefined` on an optional field must **not** read as a
change, or the mark sticks on permanently. It marks only: no re-run, no block on Process, no discard.

### Frames, and what dissolves

**Three frames — Items, Results, Promotions — and one before the first Process.** The run strip, the
400 banner, manual conditions and the per-line detail get **no frame**. `Summary` and `Actions` dissolve
into the strip; `Manual Conditions` folds into Items; the detail panel and `Pricing Elements` fold into
the open result line.

Components that **dissolve**: `SimItemDetail` and `SimBonusBuyPanel` (into the line expansion), plus
`bonus-columns.ts` and `BoolCell`'s AG-Grid signature — the trace becomes a plain table. **This removes
the feature's last AG Grid**, so the screen ends with zero grids and `enableRtl` has no call site here.
Components that **survive**: `SimHeaderForm` (as the strip's expansion), `SimItemsEntry`,
`SimManualConditions`, `SimResultsGrid` (rebuilt as a hand-built table), `SimPromoBlocks`,
`SimMissedPromotions` (**reinstated** — it is commented out today), `ConditionCard`.

### The result line

`# · item · qty ×unit · promotion · was · saved · net total` — seven columns, three of them money, row
**34 px** at rest, two text rows (description over material, quantity over unit price), **no scroll box
and no `max-h`**. The `@[820px]` card fallback is retired.

- `was` ← `grossValue`, `saved` ← `promotionDiscount` (magnitude, neutral), `net total` ← `netTotal`
  (the only bold figure). `was`/`saved` render **blank** — a faint `·`, not `0.00` — on an undiscounted
  line. `netValue`, `taxValue` and the arithmetic move to the expansion's self-footing money row.
- **One promotion slot, four states**: `✔ fired` (`success`), a `W` `StatusBadge` (`attention`), a
  neutral `MANUAL` chip, or an em-dash. Fired + MANUAL co-occur and stack. There is no status column —
  a line that failed to price never fires a promotion, so the two can never collide.
- **A `W` line suppresses all five zeros the wire sent** and reads em-dashes plus an italic
  `not priced`, with its `[070]` message on the line.
- Selection: a 3 px `primary` inline-start edge plus a `card-2` fill, distinguishable from the
  cross-highlight's `primary-050` tint. A re-run clears it.
- **The line's money projection is a pure module** producing `{ was, saved, netTotal, notPriced,
  promoSlot }` from a result line.

### Disclosure

**Four sentences, one idiom, exactly one level deep.** This run's data expands **in place**; anything
fetched fresh opens a **modal**. A disclosure opens inside a frame that already exists and is never
wider than it. Nothing behind a disclosure is a diagnosis — only trace hides. State that *changes* the
run reveals itself; state that *explains* it does not.

The line expansion is **one surface, three parts** — money foot, rules, elements — **closed at rest,
any number open at once, nothing ever auto-opens**. `ConditionCard`'s own second expansion is retired:
rate and base come out onto the card, the sub-records go, the `×N` pill stays. The statistical
*control* is retired, the *distinction* survives as a neutral uppercase `STAT` key.

The bonus-buy modal is the **single principled exception** — other record, other endpoint, other grant.

### Responsive arrangement

**Every rule is a `@container` query on the work area, not a viewport media query** — the nav eats
200–260 px, so a 1280 laptop is a 960 screen. The build declares the container on the page shell and
nothing below it reads the viewport. This replaces today's `xl:`/`lg:` prefixes and is a change of
*mechanism*, not a class rename.

**One breakpoint, 900 px of work area**, derived not chosen (a ~470 px line + a 250 px rail floor make
*beside* possible from ~740). Above: 66/34, results then rail. Below: stacked, with the rail **above**
the results as a card row (`auto-fit, minmax(258px, 340px)`) — so the frame order changes with width.
**Floor: 780 px of work area ≈ a 1024 window. No phone layout, ever.**

**Shed, never scroll.** The results table never sheds and never scrolls (the breakpoint is derived from
it); its contingency drop order is `was` first, then nothing. The elements trace is the only table that
can outgrow its column: it sheds **`ctr` first, then `unit`, and never a number** — expressed as a
**pure column list** (`level → ColumnId[]`), not as CSS, so the "no number is ever shed" rule is
assertable. **Nothing new hides at any width.**

### RTL

Confirmed by audit at 180 state combinations × both directions: **the mirroring half is empty** — zero
physical utilities to fix, because the vocabulary shipped before these regions were authored. The work
is **bidi isolation: 13 `core/ui/Ltr` wrappers**, no new component. 28 of 36 digit+space runs reorder,
each repaired by isolating the whole value.

Three findings that fix the wrapper placement: the buy→get **sentences are innocent** (a Latin word
opening the run immunises its numbers); the **raw server promotion title is the offender instead**, and
cannot be re-worded; money+currency breaks **only** with a literal space. `›`/`‹` self-mirror and `›` is
now the load-bearing twisty — the SVG double-mirror trap is live. `Bonus buy details ▸` and `buy → get`
need flipped lucide SVGs; `▶ Process` does **not** mirror. The in-flight hairline's animation is the one
physical-direction exception on the strip.

### The bonus-buy details affordance

Both cards carry it — **the near-miss is the stronger case**, since a missed promotion has no
prerequisite data on the wire, so the modal is the only route to its rules. If it is ever cut back it is
kept on the miss. The control is last on the card, below the amount, and is **never a chip**.

**The gate is `probed && screenAllowed`.** The existing inquiry access call degrades an unreachable
probe to *granted* — correct for that screen, wrong here, since reused verbatim it puts a failing button
on every card. Unknown means **absent**, and the affordance **ships dark** until the detail endpoint
exists. The rail renders from the promo view and **never waits** on the probe.

Navigation was rejected: the inquiry page reads no search params, so deep-linking would mean adding
behaviour to another feature's screen.

### i18n — the ledger

Mechanically checked in [109](109-sim-i18n-churn-and-test-seams.md): 157 leaf keys diffed by script
against every call site. **22 retirements, 6 renames, 17 new keys** in the `simulation` namespace.

- **9 retire with a dissolving file** (`detail.title`, `detail.tiles.*`, `detail.showStatistical`,
  `detail.hideStatistical`, `bonus.tabs.elements`, `bonus.elements.empty`) — delete the file, no sweep.
- **13 retire by sweep** through surviving files, where a stale `t()` renders raw to users:
  `results.status`, `results.promoNone.*`, `results.material`, `results.description`, `banner.counts`,
  `summary.title`, `actions.title`, `header.title`, `status.ok`, `detail.records`, `detail.subRate`,
  and `summary.elapsed` — which is **already dead today** and should go with them.
- **6 renames**, all stating both names: `results.gross`→`results.was`, `results.promo`→`results.saved`,
  `results.net`→`results.netTotal`, `results.subtotal`→`results.expandNet`,
  `results.tax`→`results.expandTax`, `summary.netTotal`→`strip.netTotal`.

**The collision to refuse.** The natural rename of `results.subtotal` is `results.net` — but that key is
**occupied today, by `netTotal`**. A rename onto an occupied key is the one shape the zero-literal rule
cannot protect: a half-finished sweep leaves a key that resolves, renders plausible English, and is about
the wrong number — worse than a raw key, which is at least visibly broken. **So all five `results.*`
money keys retire and are minted fresh**, behind a build assertion no partial sweep can pass.

**New keys** cover the line (`results.pos`, `.was`, `.saved`, `.netTotal`, `.expandNet`, `.expandTax`,
`.expandTotal`, `.unitPrice`, `.fired`, `.notPriced`, `.elementsTitle`), the expansion (`detail.stat`),
the rail (`promotions.lines` interpolated, `promo.bbyDetails`, `promo.notMeasured`) and the strip
(`strip.netTotal`, `strip.edit`, `strip.stale`, the seven `strip.key.*` uppercase keys, and
`strip.promoOn`/`strip.promoOff` as whole keys). In-flight **reuses `actions.processing`** — one string,
two places, one key. The promotion slot's `MANUAL` chip **reuses `detail.badge.manual`**.

**A correction to 103, in the direction of less work:** `detail.rulesTitle` and `detail.messagesTitle`
already exist, are already the right words, and only move — so **one** expansion sub-heading is genuinely
new, not two.

**The uppercase inventory** — the seven `strip.key.*`, `detail.badge.*` (3), `detail.stat` and
`promo.free` — must be **authored in the JSON value, never applied by a CSS `uppercase` transform**, since
a transform is a no-op on Arabic script and would leave the key looking un-keyed rather than visibly
needing a translator's decision. Arabic copy itself stays out of scope.

### One live contradiction to fix

`BoolCell` paints its true-flag check `text-success`, and it survives into the elements trace. Left as
is, the expansion spends `success` on "this row is statistical" and the two-hue budget is **not true of
the built screen**. It goes neutral. Free alongside: `BoolCell`'s `mode: 'met'` branch (the
`text-danger` X) has **no call site today**, so the third hue leaves with dead code rather than needing
a ruling.

## Testing Decisions

**What makes a good test here.** Assert the rule's external behaviour on real data, not the shape of the
code that implements it. Every pure seam below has a ready-made fixture in the eleven captured payloads
under `.issues/assets/098-simulate-payloads/`, and tests should use them rather than synthetic objects —
the map's own precedent is that a rail built on a synthetic payload was invalidated by the captures.

**The tier ruling stands: no React Testing Library.** 083's ruling holds and this spec does not overturn
it (owner-confirmed while writing this spec). `vitest.config.ts` stays `environment: 'node'`,
`include: ['src/**/*.test.ts']` — `.tsx` deliberately unreachable. The reasoning is evidenced rather than
inherited: the rework's real regression risk is concentrated in projections that need no DOM (blank
rather than `0.00`; a `W` line's suppressed zeros), and the rules that *would* need a DOM need a real
browser anyway — layout is computed by the engine and bidi is the browser's own algorithm. RTL remains
the hardening ticket's to add.

### Tier 1 — pure, in-memory (`vitest`, already bootstrapped by ticket 090)

Six seams. Five are new modules — and they are seams **only because** they are extracted as modules; a
rule inlined into a `.tsx` is unreachable by a node-environment runner.

| Seam | Status | What the tests pin |
|---|---|---|
| **`aggregateConditions`** | **exists, untested** | the composite grouping key; the two-pass index (non-statistical first); `count > 1` folding with base and value summed; distinct non-empty `bbyNumbers`; `isStatistics` surviving the fold, now load-bearing for `STAT` |
| **The staleness predicate** | new | no prior run ⇒ not stale; a changed lever is as stale as a changed determination field; item and manual-condition row edits count; reordering otherwise-equal rows; **`''` vs `null` vs `undefined` must not read as a change** — the false positive that sticks the mark on permanently |
| **The result-line money projection** | new | `was`/`saved` blank — **not `0.00`** — on an undiscounted line; a `W` line suppresses all five zeros and reports `notPriced`; the promotion slot resolves to exactly one of four states, with fired + MANUAL able to stack |
| **The run-strip chip set** | new | five chips ordinarily, eight with levers, nine with the elements flag; blank ⇒ **no chip**; determination fields chip **at their defaults**; promo chips in both states; nothing outside the bounded domain reaches a chip |
| **The elements shed order** | new | `ctr` sheds first, then `unit`, and **no numeric column is ever shed** — one assertion across three levels |
| **The card's printed line list** | new | sorted, de-duplicated projection of the promotion's affected item numbers |

**`aggregateConditions` is the one seam testable *today*** — it exists, it is pure, and it is untested
while 103 grows its blast radius. It is where the build lands red-green before any rework exists.
`countStatistical` is **dead code** once the statistical toggle retires (its only call site is the
dissolving `SimItemDetail`) and goes with it rather than gaining a test.

**Prior art:** the document feature's five pure test files (`commands`, `fields`, `items`, `rail`,
`status-severity` — 772 lines) are the model, built under the same 083 ruling.

### Tier 2 — component (RTL)

**None.** Not installed, deliberately. See the ruling above.

### Tier 3 — flow (Playwright drives under `tools/`)

Manual-run tools, not CI gates, per the repo's convention: `npx vite --port 5199` in one shell,
`node tools/<x>.mjs` in another. **Four focused drives plus the one that already exists** — matching the
existing per-concern pattern (`document-band` / `-cards` / `-items` / `-rail` / `-actions-drive.mjs`), so
each stays runnable alone while its build ticket is in flight rather than forcing an all-or-nothing run.

| Drive | Proves | Status |
|---|---|---|
| `sim-rtl-drive.mjs` | mirroring and bidi — 180 state combinations × both directions | **exists, green** |
| strip behaviour | collapse on every Process, auto-expand never, one tab stop, `Ctrl`+`Enter`, the 150 ms spinner, `Edit ▾` disabled-not-hidden, `Esc` focus return | to build |
| responsive arrangement | the 900 px `@container` breakpoint, the rail **above** when stacked, the strip never past two rows, chips never truncating, the trace's shed | to build |
| density and disclosure | 34 px rows, no scroll box, every captured line visible at once, nothing auto-opens, any number open at once, never wider than its frame | to build |
| bby gate | the affordance across all three probe states, including **absent when unprobed** | to build |

**The hue budget is a drive assertion on computed styles**, not a lint: `npm run lint`'s colour-literal
and contrast gates already guard *which values* may be used, but *which token is spent where* — the
`BoolCell` `text-success` contradiction above — is only visible in a rendered tree.

### The standing gates

`npm run typecheck` throughout (the fast loop), `npm run build`, and `npm run lint`'s three gates —
import boundaries (load-bearing here: the `@/core/` graduation exists precisely to satisfy them),
token contrast, and colour literals.

## Out of Scope

- **Any behaviour change** — endpoints, the `SimulateRequest` shape, the access probe, the cache-clear
  grant and its confirm, Process/Clear semantics. The map's founding ruling.
- **The promo-view derivation rules** (spec 043's pure model: lines, blocks, missed, degradation path).
  This work arranges its output; it does not re-derive it.
- **The backend projection** [044](044-sim-applied-bby-projection.md) — the structural `Applications[]` /
  `DiscountKind` split, blocked in its own repo. The arrangement must read correctly on both the degraded
  and the split path, which is a design constraint here, not a task.
- **The design system itself** ([082](082-pos-design-system-spec.md)) — consumed, never re-declared. No
  new token is minted; the rework adds exactly one new component (the status slot).
- **Arabic copy and font metrics.** The mirroring *mechanics* are in scope and specified; the translation
  is not. Recorded pressure points for that later effort: the 250 px rail, the uppercase chip keys, the
  34 px row.
- **React Testing Library.** Owner-confirmed for this spec; it remains the hardening ticket's to add.
- **Recalling the last run**, and a worked-example basket. Both offered and declined at
  [101](101-sim-screen-device-prototype.md) — the first is real behaviour and outside the scope line, the
  second occupies space with fiction. The first can be proposed as its own ticket.
- **A sticky run strip.** Rejected on the captured density; it is one CSS declaration on an
  already-correct arrangement, so it is a reversible non-decision if larger baskets ever appear.
- **Filtering the results to only bad lines.** A filter over three lines costs more than it saves.
- **The defects the capture pass turned up** — a negative quantity returning HTTP 500, a 99999 quantity
  hanging the engine, an invalid plant pricing silently, manual conditions defaulting to an item number
  the server rejects, and a flat −5.00 from a manual 5%. All are behaviour, not arrangement; they are
  recorded in [098](098-simulate-payload-capture.md)'s answer and need their own build tickets outside
  this spec.

## Further Notes

**The evidence base.** Every density and field ruling derives from eleven captured live Simulate
responses, not from the model types — a deliberate correction to an earlier effort where a rail built on
a synthetic payload was invalidated by real data. The captures are in the repo
(`.issues/assets/098-simulate-payloads/`) and should be the fixtures for both the pure tests and the
drives. The picture they give: **1–3 lines, 1–5 raw conditions per line, zero statistical rows, 7
pricing-element rows of which 3 are subtotals, and no per-line `E` anywhere** — failures arrive as
whole-run 400s, only `W` rides a 200.

**Three of the captures' findings shaped the arrangement more than any design argument:** a missed
promotion carries **no prerequisite data and no item linkage**, so it cannot sit beside a line and the
card's printed line list is the only honest link; **an invalid plant prices silently**, which is why the
determination chips are always present; and **`COUP01`'s unexplained `W`** turned out to be an unset
`itemConditionControl`, which is what rescued that column from deletion.

**What the reclaim actually bought** is worth stating so it is not traded away in the build: not more
lines, but the **promotions rail beside the lines**, and the line expansion opening in place without
pushing anything off screen.

**The ledger of what the rework loses**, signed at [103](103-sim-deep-layers-placement.md): the
auto-selected first line's detail is an accepted loss; the `×N` sub-records are the only irrecoverable
one, and only on runs that did not request elements. Against that, three things are free at rest that
were not before — a `W` line's message, a condition's rate and base, and the near-miss cards.

**This spec supersedes** the two open build tickets from spec 043 — 049 (progressive disclosure) and 050
(responsive hybrid), both closed `wontfix` — whose questions are re-answered inside the new arrangement.

**Suggested slicing hint for `/to-tickets`** (not binding): the `@/core/` graduation is a structural
precondition with no design content and should be its own ticket ahead of the card work; and
`aggregateConditions`'s tests can land before any rework exists, so they make a natural tracer-bullet
first slice.
