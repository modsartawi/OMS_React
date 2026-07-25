---
type: wayfinder-ticket
wayfinder: prototype
map: 097
status: done
blocked-by: 098, 101
---

# 104 — The anatomy of a result line

## Question

The results region is the screen's work area, and its unit is **one priced line**. Under
[101](101-sim-screen-device-prototype.md)'s device, **what does a line look like, and what does it
carry?**

`SimResultsGrid` is a hand-built table today, not AG Grid (the page's own comment records this) —
so the row is fully ours to shape, and none of the AG Grid constraints 083 worked under apply.

1. **The columns, and their order.** Today: status dot, item, material, quantity, the money set, and
   046's promo column. Against [098](098-simulate-payload-capture.md)'s real values, which of these
   earn width and which are read only on a surprise. 083's ruling that the eye should land on a
   *name* rather than a number is a candidate precedent, not a given — an analyst may genuinely be
   scanning a money column here.
2. **Status.** Today an `E`/`W`/`OK` dot per line, plus a separate count banner above the grid.
   Two surfaces for one fact. Does the line carry a severity chip ([100](100-sim-chip-vocabulary.md)),
   does the banner survive, and does the grid offer a way to see only the bad lines?
3. **The promo column.** 046 renders kind + role per line, and 047 renders the fired promotions as
   buy→get blocks with a bidirectional hover cross-highlight keyed on `conditionKey`. The
   cross-highlight is one of the screen's best ideas and is easy to lose in a rearrangement —
   confirm it survives the new geometry, and say what it looks like if the blocks are no longer
   beside the grid.
4. **Money legibility.** Tabular figures, alignment, and whether a discount carries its sign — 083
   found every real discount was negative and its grid disagreed with the tab beside it. Check the
   same question against our payloads rather than assuming.
5. **Selection.** One line drives the detail region ([103](103-sim-deep-layers-placement.md)). How
   the selected line is marked, and whether selection survives a re-run of the same basket.
6. **A totals row.** The header already carries net total, discount and tax. Does the line table
   foot itself as well, and if so does it agree with the header — the two are computed from
   different fields and [098](098-simulate-payload-capture.md) can say whether they match.
7. **Density.** Row height, and how many lines are visible at rest. This is the region the reclaimed
   space is being reclaimed *for*; say what it bought.

Draw it in the prototype with a real basket, including a line with an error, a line in a fired
promotion (both buy and get roles), and a line with neither.

## Answer

**The line is approved.** Owner ruling, 2026-07-25, against
[`assets/104-result-line.PROTOTYPE.html`](assets/104-result-line.PROTOTYPE.html) — five real baskets ×
three column sets × both themes, every figure transcribed from
[098](098-simulate-payload-capture.md)'s captures. The prototype's defaults *are* the ruling; the
rejected candidates stay behind their switches, drawn on the same data.

The ticket asked for "a line with an error" and could not get one: **098 produced no per-line `E`
anywhere**. The error case drawn is therefore the evidenced one — a `W`.

### What the captures decided before anything was drawn

Four facts, each checked against all nine priced payloads, and each of which overturns something the
grid does today:

1. **The money order does not follow the arithmetic.** The chain on every line is
   `grossValue + promotionDiscount = netValue`, then `netValue + taxValue = netTotal`. Today's grid
   prints *subtotal(`netValue`) · promo · gross · tax · net(`netTotal`)* — the post-discount figure
   **before** the discount, the pre-discount figure **after** it, under labels that name neither.
   No column order can be argued without fixing this first.
2. **Tax is 15.0% of net on every line of every capture.** A column that is the same multiple
   everywhere carries no per-line information.
3. **On an undiscounted line `grossValue ≡ netValue`.** So a plain line — the majority of lines in
   the corpus — spends five money columns on **two** independent numbers.
4. **The lines foot to the header exactly.** Σ `netTotal`, Σ `promotionDiscount`, Σ `grossValue` and
   Σ `taxValue` equal the header's to the penny on **all nine** captures. 098's "identical line,
   different pennies" (finding 10) is a **cross-run** artefact and does *not* mean the on-screen
   lines fail to reconcile with the on-screen total.

### 1 — The columns: **B, the verdict**

`# · item · qty ×unit · promotion · was · saved · net total` — **seven columns, three of them money.**

- **`was` and `saved` are blank on an undiscounted line** (a faint `·`, not `0.00`). They are the
  "read only on a surprise" columns the ticket asked for, and the switcher makes the cost visible:
  on capture 03, set A prints ten money figures of which line 20 contributes five that say nothing.
- **`net`, `tax` and the arithmetic move into the expansion**, on fact 2 and fact 3 — the expansion
  foots itself (`net + tax = total`) so the chain is still readable, one click down.
- **The eye lands on `net total`**, the only bold figure on the line. 083's "land on a name" precedent
  was explicitly reconsidered and *not* followed: the material description is the widest column and
  reads first left-to-right, but the emphasised figure is money, because 099 ruled Net Total the
  confirming readout of a loop whose question is "what did this cost after the promotion".
- **The unit price (`netPrice`) is promoted onto the line**, under the quantity as `× 91.26`. It is
  not on the screen today, it is the analyst's cheapest sanity check on a price-master problem, and
  it costs no column. Dropped in set A, where the gross column already carries the same story.
- Rejected, recorded because they are the ones that come back: **A, the full ledger** — five money
  columns in the corrected order, for an analyst genuinely scanning a money column; it is the set to
  return to if that analyst turns out to exist, and it needs ~640 px of table before it stops
  scrolling. **C, one figure** — net total alone; rejected because "did it fire, and for how much"
  stops being readable at rest, which is 099's first question.

### 2 — Status: **no column, one badge, no banner**

101's ruling holds and the evidence hardens it. An `ok` line carries **no mark at all** (100), so
there is no status column; a `W` line carries 082's `StatusBadge` in **the promotion slot** — the two
can never collide, because a line that failed to price never fires a promotion. The E/W count banner
stays retired: on this evidence it would be a **W-only** banner over a 1–3 line table where the
badge is already in view.

**Seeing only the bad lines is not a feature this screen gets.** A filter over three lines costs more
than it saves; the `W` line is the only coloured thing on the screen and finds the eye unaided.

### 3 — The promotion slot, and the cross-highlight

One slot, one of four states: **`✔ fired`** (success, the hue budget's first spend), **`W`** badge,
a neutral **`MANUAL`** chip, or an em-dash. Fired + MANUAL can co-occur and stack.

**The cross-highlight survives, and matters more than it did.** Capture 05 carries one bonus buy
against items 10 *and* 20 — two materials, one summed discount — and after 098 finding 2 the rail is
screen-level, so **the highlight is the only thing on the screen that says which lines a promotion
touched**. Geometry: the rail sits beside the results at 34%, so it is a lit line ↔ a lit card, both
in view, exactly as 047 built it (`bbyNumber`, sharpened by `conditionKey` when 044 lands). Drawn
live in the prototype on the fired basket.

### 4 — Money legibility

Tabular figures throughout, all money end-aligned. **A discount keeps its sign but not its colour:**
098 confirms every real discount is negative, and today's grid paints it `text-destructive` — a
**third hue**, spent on good news. Under set B the column is labelled `saved` and carries the
magnitude; under set A it is labelled `promo` and carries the signed value. Both neutral.

### 5 — A `W` line suppresses its money

`04b` #10 `COUP01` returns `0` for `netPrice`, `grossValue`, `netValue`, `taxValue` and `netTotal`.
Printing those says *priced at zero*; the truth is *did not price*. The line reads em-dashes and an
italic **not priced**, with `[070] Mandatory condition 'VKP0' …` in its expansion and the fix one row
up in Items. This is the one place the screen deliberately does not print what the wire sent.

### 6 — Selection: the marked line, and what a re-run does

The selected line is marked by a **3 px `primary` inline-start edge plus a `card-2` fill** — no
checkbox, no row highlight that competes with the cross-highlight's `primary-050` tint (the two are
drawn together in the prototype and stay distinguishable). **Whether selecting and expanding are the
same gesture is [103](103-sim-deep-layers-placement.md)'s grammar to name** — this ruling holds
either way; the prototype draws them as one because that is the cheaper assumption to retract.

**A re-run clears the selection.** Consistent with [102](102-sim-input-chip-bar.md)'s "collapse on
every Process": the new result is new lines, `conditionKey` is not stable across runs (098 finding 4),
and a stale expansion showing the previous run's conditions is worse than an extra click.

### 7 — No totals row

Ruled **off**, with the row drawn behind a switch so the duplication is visible rather than argued.
Fact 4 says the lines *do* foot to the header exactly — which is the reason **one** readout suffices,
not a reason to print it twice. 101 kept the money in the run strip and rejected the totals row as a
*replacement*; adding it back as a *duplicate* a few hundred pixels below is strictly worse. Revisit
only alongside 101's sticky-band question, and in [105](105-sim-responsive-arrangement.md).

### 8 — Density: what the space bought

**Row: 34 px at rest, two text rows** (description over material, quantity over unit price). No
scroll region and no `max-h` — 098's corpus is 1–3 lines, so **every line of every captured basket is
visible at once**, and the results frame is as tall as its content. Today's `max-h-[32rem]` scroll box
and the retired `@[820px]` card fallback both go: at 66% of a normal window set B needs ~470 px and
fits without either. What the reclaim bought is not more lines — it is the **promotions rail beside
the lines**, and the expansion opening in place without pushing anything off screen.

### What this hands on

- [105](105-sim-responsive-arrangement.md) — set B's ~470 px is the number where the 66/34 split has
  to stack; set A's ~640 px is what a returning ledger would need.
- [106](106-sim-rtl-mirroring.md) — the line is one grid with end-aligned money and a start-edge
  selection mark; those three are what mirror.
- [103](103-sim-deep-layers-placement.md) — the expansion is drawn only as far as its foot
  (`net + tax = total`, unit price); its contents and the disclosure grammar are that ticket's.
- **For the spec:** the money columns are a rename, not just a reorder — `results.subtotal` /
  `results.gross` / `results.net` no longer describe what they label, and `results.status` /
  `results.promoNone.*` retire with the status column. One line of i18n churn for the fog patch that
  is already accumulating.

## Comments

**2026-07-25 — one correction and one confirmation from [103](103-sim-deep-layers-placement.md)**,
resolved the same day in a concurrent session.

- **Corrected — §5.** The `[070]` message does **not** sit in the expansion. 103 ruled the expansion
  closed at rest, which would make the `W` badge a pointer to something you must fetch — the exact
  failure 099 retired the E/W count banner for. `pricingStatusMessages` therefore ride on the line,
  always visible. The rest of §5 stands unchanged: badge in the promotion slot, suppressed money,
  italic *not priced*.
- **Confirmed — §6.** Selecting and expanding **are** one gesture, as the prototype drew them. The
  3 px `primary` inline-start edge + `card-2` fill is the **open-line** mark, and several lines may
  carry it at once; there is no separate "current line".
