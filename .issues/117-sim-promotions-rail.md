---
status: open
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

- [ ] `a promotion card prints its affected lines sorted and de-duplicated` — on the capture where one bonus buy touches two lines · **pure**
- [ ] `near-misses render as neutral cards in the same rail as the fires` — and a promo-off run says nothing was measured rather than showing an empty rail · **flow (Playwright, new `tools/sim-rail-drive.mjs`)**
- [ ] `hovering a promotion card tints only the lines it names` — the highlight agrees with the printed list · **flow (same drive)**

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
