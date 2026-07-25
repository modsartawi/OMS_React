---
status: done
spec: 110
blocked-by: —
---

# 123 — The simulation namespace carries every new key before any slice needs it

## What to build

**The expand half of an expand–contract, applied to the locale file.** A small, mechanical ticket that
exists for one reason: `src/locales/en/simulation.json` is touched by nine of the twelve rework slices,
which makes it the single worst merge-conflict hotspot and the thing that stops the waves from actually
running in parallel.

Add **all 17 new keys at once**, and **leave every retired key exactly where it is**. Unused keys are
harmless — nothing renders them — so this change is safe to land before a single component moves, and
after it every other slice only *reads* the file rather than editing it.

The keys, with their values, from the ledger:

**The result line and its expansion** — `results.pos` (`#`), `results.was` (`Was`), `results.saved`
(`Saved`), `results.netTotal` (`Net total`), `results.expandNet` (`Net`), `results.expandTax` (`Tax`),
`results.expandTotal` (`Net total`), `results.unitPrice` (an accessible name for the `× 91.26` under the
quantity), `results.fired` (`fired` — the `✔` is a glyph), `results.notPriced` (`not priced`),
`results.elementsTitle` (the expansion's elements sub-heading).

**The expansion's statistical mark** — `detail.stat` (`STAT`).

**The promotions rail** — `promotions.lines` (interpolated, the card's printed line list),
`promo.bbyDetails` (`Bonus buy details`), `promo.notMeasured` (the promo-off sentence).

**The run strip** — `strip.netTotal` (`Net total`), `strip.edit` (`Edit ▾`), `strip.stale`
(`Inputs changed` — the `↻` is a glyph), the seven uppercase chip keys `strip.key.plant` (`PLANT`),
`.org` (`ORG`), `.chan` (`CHAN`), `.proc` (`PROC`), `.loy` (`LOY`), `.tier` (`TIER`), `.elem` (`ELEM`),
and `strip.promoOn` / `strip.promoOff` (`PROMO on` / `PROMO off` — whole keys, because the state is not
a code and so is not a value slot).

**Two constraints that are cheap now and expensive later:**

- **The uppercase keys must be authored in the JSON value, never produced by a CSS `uppercase`
  transform.** A transform is a **no-op on Arabic script**, so it would leave these looking un-keyed
  rather than visibly needing a translator's decision when the Arabic effort comes.
- **Mint nothing that collides.** In particular do **not** reuse `results.net` for the expansion's net
  figure — that key is occupied today by a *different* number, and a key that resolves to plausible
  English about the wrong figure is strictly worse than a raw key, which is at least visibly broken.
  That is exactly why the money keys are minted fresh rather than renamed in place.

**Do not retire anything here.** The contract half is [121](121-sim-rtl-mirroring.md)'s close-out, once
every call site has moved.

## Spine reach

i18n

(No component, logic or test reach — this is the expand step of a wide refactor, named as such so it is
not mistaken for a slice. It is deliberately the one ticket that owns this file.)

## Proof (→ `tdd` red-green cycles)

- [x] `every new key parses and resolves` — the namespace loads and each new key returns its value rather than its own name · **flow (script: load the JSON, assert each key path present and non-empty)**

Verify with `npm run typecheck` and `npm run build`. There is nothing to render yet — that is the point.

**Done 2026-07-25.** `src/features/pricing/simulation/i18n-keys.test.ts` (vitest, 69 cases) asserts every
new key resolves non-empty, every retiring key still resolves, the uppercase inventory is authored in the
value, `promotions.lines` carries its `{{lines}}` slot, and the new key set is disjoint from the retiring
one. `npm test` 137/137 green, `npm run typecheck` green, `npm run lint` green. `npm run build` fails
**only** on a concurrent session's in-flight [112](112-bby-detail-modal-to-core.md) file move
(5 dangling `core/bonus-buy` imports) — no error touches the locale file or the simulation feature.

**Ledger follow-up, 2026-07-25 (from slice [113](113-sim-run-strip.md)).** One key the ledger missed,
added here so the file keeps one owner: **`strip.done`** (`Done ▴`) — the chip set's label while the form
is open. The ledger had minted `strip.edit` (`Edit ▾`) alone, but the control reads `Done ▴` expanded
(spec 110, "The run strip"). 18 keys, not 17. Also noted: 113 retired `header.title`, `summary.title` and
`actions.title` with the frames they titled, so `i18n-keys.test.ts` now asserts those three are **absent**
while the rest of the retiring set stays present for 121.

**Ledger follow-up, 2026-07-25 (from slice [120](120-sim-non-result-states.md)).** Four more keys the
ledger did not anticipate, added here so the file keeps one owner:

- **`banner.routeItems`** and **`banner.routeSettings`** — the whole-run 400 banner carries the route to
  the fault (spec 110 stories 69–70). The ledger kept `banner.failed` but minted nothing for the route,
  which did not exist before 120.
- **`manual.count_one` / `manual.count_other`** — the count on the manual-conditions disclosure label
  (story 25). A plural pair rather than a bare `{{count}}`, so the pill reads as a phrase.

22 keys, not 18. `manual.empty` and `manual.itemHint` both keep their call sites inside the new
disclosure. One key **lost** its call site and joins the retiring set for 121 to sweep:
**`results.empty`** — the work area no longer draws a framed "No priced lines yet." box before a run, it
draws one line of `summary.noResult`.

## Boundaries

No API, no component, no nav, no test-runner change. **This ticket owns `src/locales/en/simulation.json`
for the duration of the rework's expand phase** — later slices call `t()` against these keys and must not
add keys of their own. If a slice discovers it needs a key this ledger missed, add it here in a follow-up
edit rather than in the slice, so the hotspot stays a single owner.

Sub-hour, mechanical. **Land it first** — it gates most of the rework, and every wave after it becomes
concurrently runnable because of it.

## Done when

All 17 keys are present in the `simulation` namespace with the values above, every retired key is still
present and untouched, uppercase is authored in the values, and `npm run typecheck` + `npm run build` are
green.

## Blocked by

None — can start immediately, and should. [111](111-sim-aggregate-conditions-under-test.md) and
[112](112-bby-detail-modal-to-core.md) touch entirely different files and can run alongside it.
