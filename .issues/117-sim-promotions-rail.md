---
status: done
spec: 110
blocked-by: 115, 123
---

# 117 — The promotions rail shows fires and near-misses beside the lines

## What to build

Bring the screen's **primary** answer to eye level. The first read after a run is *"did the promotion
fire?"* — the ×1 → ×2 loop **is** a promo experiment — yet today that answer sits in a right-hand column
below the fold while net total takes a `3xl` figure top-right.

**The arrangement: a 66/34 split** — the results table left, a promotions rail right, the rail carrying
**fires and near-misses in the same column**. The rail appears after a run only; it is held apart as its
own frame so the results never shift when it grows or shrinks.

**Near-misses are reinstated.** The missed-promotions component exists but is **commented out of the
page** today, so "why didn't it fire?" has no answer on screen at all. It returns as **neutral `○` cards
in the same rail as the fires** — a near-miss is **neutral, not a warning**: the hue budget is two, spent
on a fired promotion and a `W` line, and a near-miss is neither.

**A promo-off run says nothing was measured.** Switching promotions off blacks out the whole rail, so an
empty rail must never be shown — it would read as "nothing fired" when the truth is "nothing was
measured". This is also why the promotion flag is chipped in both states up in the strip.

**The card prints the lines it touched.** At every width a promotion card names its bonus buy, its
condition type, and its line list (`lines 10 · 20`). The captures found a bonus buy that discounts **two
lines with one summed discount**, and — decisively — that a **missed promotion carries no item linkage at
all**, which is why the rail is screen-level rather than sitting beside a line. The hover cross-highlight
survives and matters more than it did, but it is the **enhancement, not the mechanism**: a link that only
exists on hover, between two regions that can be a scroll apart, is not the thing that says which lines a
promotion touched. The printed list is the honest degradation — it costs one line of existing card text,
it survives stacking, and it survives having no pointer at all.

**The printed line list is a pure module**: a sorted, de-duplicated projection of the promotion's affected
item numbers. The promo-view model that produces those numbers is **out of scope and untouched** — this
slice arranges its output, it does not re-derive it.

The bonus-buy details control is **not** part of this slice; [118](118-sim-bby-details-affordance.md)
adds it, and the rail must render immediately without waiting on its probe.

## Spine reach

store/logic (the pure line-list projection) · component (the rail, the split, near-misses reinstated) ·
i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `a promotion card prints its affected lines sorted and de-duplicated` — on the capture where one bonus buy touches two lines · **pure** — `promo-lines.test.ts` 6/6. The rule earns its keep on `05-pricing-elements`, whose wire sends `[20, 10]`; a second assertion pins that wire order so the sort cannot pass vacuously if the server ever starts sorting.
- [x] `near-misses render as neutral cards in the same rail as the fires` — and a promo-off run says nothing was measured rather than showing an empty rail · **flow (`tools/sim-rail-drive.mjs`, port 5201)** — 31/31
- [x] `hovering a promotion card tints only the lines it names` — the highlight agrees with the printed list · **flow (same drive)** — proved on the capture where the promotion touches a **strict subset** (1 of 2 lines), so "exactly" is a real claim; plus the near-miss case, which tints nothing because the wire sends it no item linkage at all

## Answers

**The rail sits beside the RESULTS, which moved Items up.** The 66/34 split is between the
two frames it is about, so they are siblings in one grid: they align at the top, and
`items-start` keeps each as tall as its own content — the rail grows and shrinks without
ever shifting or stretching the lines it explains. Items therefore takes the full width
above the split rather than being squeezed into two thirds to make room for a frame that
describes a run rather than an input. The three frames of spec 110 are unchanged in
number; only the arrangement is.

**The tile was never the hue problem — the meter was.** The first pass swapped the
near-miss kind glyph for `○` on the reasoning that the glyph spent a hue. It did not:
ticket 088 retired the per-kind colour map, so `KIND_CHIP` has been neutral since. The
real correction is the found-vs-required meter's fill, `bg-attention` → a neutral ink.
`○` stays, because a promotion that did not fire has no fired shape to draw and the two
card kinds must be told apart to share a column — but the condition type it would have
applied is **named in words** (`promo.kindTag.*`, the same vocabulary a fired card's Get
box spells) rather than lost with the glyph, which is this ticket's own "names its
condition type" line and reads better than a glyph besides.

**The meter is unprovable on the corpus.** All four near-misses in the eleven captures
carry `prerequisites: []` — the wire has never sent one — so the found-vs-required meter
has no evidence to render against and the drive asserts the honest fallback (`missed.noReason`)
instead. Its neutrality is covered by a whole-card hue scan that re-runs over the expanded
card. Recorded here rather than left as a silent gap in the drive.

**What is still transitional.** `SimItemDetail` and `SimBonusBuyPanel` sit full-width
**below** the split rather than inside it — they are [116](116-sim-line-expansion.md)'s to
dissolve, and keeping them out of the split means neither the results nor the rail is
measured against a frame that is on its way out. The screen therefore still carries more
than three `h2`s until 116 lands; the drive asserts the rail has exactly one heading
rather than counting the screen's, so it fails on a defect of its own rather than on 116's
landing.

**One sibling drive repaired.** [114](114-sim-status-slot.md)'s stale-note check walked
`results.parentElement`, which the new grid moved. It now **measures** that the note sits
above the results rather than assuming it is a sibling — the same rule, and one that
cannot break on the next rearrangement either. Strip 51/51, states 27/27, both green
untouched otherwise.

**Left for [121](121-sim-rtl-mirroring.md).** The `promotions.lines` key sits in a
second namespace group one letter from the `promo.*` family every other key on the card
uses — a rename worth folding into the key close-out, not worth a boundary breach here
(123 minted it; this ticket calls it). The card's CSS-uppercased micro-labels
(`SAVED`, `WOULD SAVE`, `ITEMS`) are the same audit's.

## Boundaries

No API change; the promo-view derivation rules are untouched. The arrangement must read correctly on both
the degraded and the split backend projection path — a design constraint, not a task here. **i18n:**
`promotions.lines` (interpolated) and `promo.notMeasured` are already minted by
[123](123-sim-i18n-key-expand.md); call them, do not add keys here. The existing `promo.*` and `missed.*`
key families survive unchanged. Stacking behaviour at narrow widths belongs to
[119](119-sim-responsive-arrangement.md); build the beside layout here.

**Concurrency:** this slice owns `tools/sim-rail-drive.mjs` and **drive port 5201** — a drive of its own,
not an extension of [116](116-sim-line-expansion.md)'s, precisely so the two can run in the same wave.
Work in a git worktree.

## Done when

Driving the app against the captured baskets: after a run the rail sits beside the results at 66/34
carrying both fired and near-miss cards, each card prints its line list, hovering a card tints exactly
those lines, and a promo-off run states that nothing was measured instead of showing an empty rail. The
pure test and the extended drive green, `npm run typecheck` clean.

## Blocked by

- [115](115-sim-result-line.md) — the cross-highlight needs lines to light, and the 66/34 split is
  measured against the rebuilt line's width.
- [123](123-sim-i18n-key-expand.md) — `promotions.lines` and `promo.notMeasured` are minted there.
