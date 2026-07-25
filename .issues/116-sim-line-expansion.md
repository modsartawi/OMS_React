---
status: done
spec: 110
blocked-by: 111, 115, 123
---

# 116 — A result line expands its rules and elements in place

## What to build

Give the line built by [115](115-sim-result-line.md) its depth, and **dissolve the two components that
hold it today** — the separate detail panel and the pricing-elements grid, along with the whole right
column they lived in.

**The disclosure grammar, in four sentences.** This run's data expands **in place**; anything fetched
fresh opens a **modal**. A disclosure opens inside a frame that already exists and is **never wider than
it**. Nothing behind a disclosure is a diagnosis — only trace hides. State that *changes* the run reveals
itself; state that *explains* it does not. **One idiom, exactly one level deep.**

**The expansion is one surface with three parts:**

1. **The money foot** — the figures [115](115-sim-result-line.md) took off the line, footing themselves:
   `net + tax = net total`, so the arithmetic stays checkable one click down.
2. **The rules** — the aggregated condition cards, built from the condition aggregator, which
   [111](111-sim-aggregate-conditions-under-test.md) has already put under test and which this slice makes
   the **sole** producer of the list. `ConditionCard`'s own second expansion is **retired**: rate and base
   come **out onto the card** (always visible, where they were behind an expand), the sub-records go, and
   the `×N` pill stays as the statement that the rule applied N times for the summed value.
3. **The elements trace** — a **sibling, not a nesting**, because the request flag was already the opt-in.
   It appears only when the run requested it.

**Closed at rest, any number open at once, nothing ever auto-opens** — so the Results frame's resting
height depends only on line count. The auto-selected first line's detail is a **deliberately accepted
loss**, signed for in the design ledger.

**The statistical control is retired but the distinction is not.** Zero statistical rows appeared on all
eleven captures, so the toggle has never rendered — but the aggregator's `isStatistics` flag is
load-bearing, and a statistical card carries a small neutral uppercase `STAT` key. No hue, no new
component. This is the one place the rework would otherwise be strictly worse.

**Three components dissolve, and with them the feature's last AG Grid.** The detail panel and the
elements panel fold into the expansion; the fixed-height grid becomes a **plain table** — thirty rows'
worth of chrome for seven rows, three of them subtotals. Removing it leaves the screen with **zero grids**,
so the AG Grid setup import and the column-definition builder go too, and the boolean flag cell loses its
grid-renderer signature (it stays as a plain component; the trace still has its flag columns).
`countStatistical` loses its only call site with the toggle and is **deleted**.

**One correction this slice carries** from the design pass: a `W` line's message rides **on the line**
(built in 115), **never in the expansion**.

## Spine reach

store/logic (the aggregator becomes the sole producer) · component (the expansion; three components
dissolve) · i18n · test (drive; the pure tests already exist from 111)

## Proof (→ `tdd` red-green cycles)

- [x] `a line expands in place inside the Results frame, never wider than it, and never auto-opens` — with any number of lines open at once · **flow (Playwright, new `tools/sim-density-drive.mjs`)**
- [x] `the expansion's money foot proves net + tax = net total` — on the captured baskets · **flow (same drive)**
- [x] `a statistical condition carries the neutral STAT key and no hue` — plus rate and base visible on the card at rest · **flow (same drive)**

Commission `tools/sim-density-drive.mjs` here — density and disclosure are one concern, and this drive
also measures 115's 34 px rows, no scroll box, and every-line-visible claims, which have no pure surface.

## What was built

`tools/sim-density-drive.mjs` (port 5200) — **33/33**, in six passes: density and nothing-auto-opens ·
expanding in place · the money foot on both `01-plain-multiline` and `05-pricing-elements` · the rules
(rate + base at rest, the STAT key) · the elements trace · the `W` line. `npm test` 233/233,
`typecheck`, `lint` and `build` clean; the built `SimulationPage` chunk no longer references
`ag-grid-theme` at all.

Four rulings this slice had to make, none of them contradicted by the ticket:

1. **A not-priced line has no money foot.** The wire sends `0` for net, tax and total on a `W` line, so
   footing them would say *priced at zero* one click below a line that says *did not price* — the exact
   claim 115 suppresses. There is no arithmetic to check, so there is nothing to foot. Driven.
2. **The elements trace gates per LINE, not per run.** The ticket words the opt-in at run level, but the
   Boundaries retire `bonus.elements.empty` — and a line with no trace rows in an elements run has
   nothing to say. Absent beats an empty pane; the retired key is the ticket agreeing.
3. **`AggregatedCondition.subs` stays** even though nothing renders it. It is how [111](111-sim-aggregate-conditions-under-test.md)
   proves the fold is lossless (every raw row in exactly one group, in first-appearance order) — an
   aggregator contract that outlives the surface that displayed it. `countStatistical` really is deleted.
4. **The right column survives as the promotions blocks' home.** The ticket asks for "the whole right
   column they lived in"; both components that made it a *detail* column are gone, but removing the
   column itself would move `SimPromoBlocks` — and [117](117-sim-promotions-rail.md), in this same wave,
   rebuilds exactly that column as the promotions rail at 66/34. Left standing rather than moved twice.

Also **deferred out**, deliberately: RTL mirroring of the new twisty. It is the screen's load-bearing
directional glyph now and an SVG chevron is the double-mirror trap [121](121-sim-rtl-mirroring.md) exists
to measure, so it ships un-transformed rather than guessed at.

## Boundaries

No API change. **i18n:** retire with their dissolving files (no sweep needed — each is referenced from
exactly one of them) `detail.title`, `detail.tiles.*`, `detail.showStatistical`, `detail.hideStatistical`,
`bonus.tabs.elements`, `bonus.elements.empty`. Retire **by sweep** (the call site survives in
`ConditionCard`) `detail.records` and `detail.subRate`. **Survives and moves rather than retiring:**
`detail.rulesTitle` and `detail.messagesTitle` already exist and are already the right words — so only
**one** sub-heading is genuinely new (`results.elementsTitle`), correcting the design ticket's "two new
sub-headings" in the direction of less work. It and `detail.stat` are already minted by
[123](123-sim-i18n-key-expand.md); call them, do not add keys here. The eleven `bonus.elements.*` column
labels and the two boolean labels **survive unchanged** — component churn, zero key churn.

**Concurrency:** this slice owns `tools/sim-density-drive.mjs` and **drive port 5200**.
[117](117-sim-promotions-rail.md) runs in the same wave on its own drive and port, so the two do not
collide. Work in a git worktree.

## Done when

Driving the app against the captured baskets: a line's twisty opens rules and (when the run requested it)
the elements trace in place, several lines open at once, nothing opens itself, the money foot foots, a
condition card shows rate and base without a second click, and no AG Grid remains anywhere in the
feature. `tools/sim-density-drive.mjs` green, `npm test` still green, `npm run typecheck` and
`npm run lint` clean.

## Blocked by

- [111](111-sim-aggregate-conditions-under-test.md) — the aggregator becomes the sole producer of the rule
  list here; its safety net goes in first, which is the whole point of sequencing it as prefactor.
- [115](115-sim-result-line.md) — there is no line to expand until the line exists, and the money foot
  receives exactly the figures 115 removes.
- [123](123-sim-i18n-key-expand.md) — `results.expandNet` / `.expandTax` / `.expandTotal` /
  `.elementsTitle` and `detail.stat` are minted there.
