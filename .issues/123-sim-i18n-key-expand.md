---
status: open
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

- [ ] `every new key parses and resolves` — the namespace loads and each new key returns its value rather than its own name · **flow (script: load the JSON, assert each key path present and non-empty)**

Verify with `npm run typecheck` and `npm run build`. There is nothing to render yet — that is the point.

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
