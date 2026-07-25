---
status: wontfix
spec: 110
blocked-by: 116, 121
---

# 122 — The screen spends two hues and carries no retired key

> **Merged into [121](121-sim-rtl-mirroring.md) (2026-07-25) — not abandoned, absorbed.** Both were
> trailing audits over the same finished markup, and 121 already blocked on everything this ticket did,
> so keeping them separate bought a whole extra wave in the build order and nothing else. The hue fix
> and the key-ledger assertions are now 121's close-out section, unchanged. The body below is kept for
> the record; work it from 121.

## What to build

The close-out. Each earlier slice retires its own keys as it goes; this ticket proves the ledger is
**complete** rather than mostly done, and fixes the one place the built screen would otherwise contradict
a rule the design system states.

### The hue budget — a contradiction that is currently live

The screen's whole hue budget is **two**: `success` on a fired promotion, `attention` on a `W` line. A
near-miss is neutral, staleness is neutral, a discount is neutral, and a healthy line carries no mark at
all.

The boolean flag cell paints its true-flag check `success`, and that component survives into the elements
trace. Left as is, the expansion spends `success` on *"this row is statistical"* and the two-hue statement
is **not true of the built screen**. Make it neutral.

**Free alongside:** the flag cell's `met` mode — the red X branch — has **no call site**, so a third hue
leaves with dead code rather than needing a ruling. Delete it.

### The key ledger — proving it closed

The ledger was checked mechanically against the locale file (157 leaf keys diffed against every call
site), so it can be re-checked the same way. Assert:

- **The five retired money keys appear in neither the locale JSON nor any call site** —
  `results.subtotal`, `results.promo`, `results.gross`, `results.tax`, `results.net`. This is the
  anti-collision assertion and it is the reason those keys were minted fresh rather than renamed in
  place: the natural rename target was **occupied by a different number**, and a half-finished sweep
  leaves a key that resolves, renders plausible English, and is **about the wrong number** — strictly
  worse than a raw key, which is at least visibly broken. **No partially-swept state can satisfy this
  assertion.**
- **Every retirement in the ledger is gone** — the 9 that left with dissolving files and the 13 that
  needed a sweep, including **`summary.elapsed`, which was already dead before this rework began** and
  should not survive it.
- **No `t()` call site in the feature resolves to a missing key**, and no locale key in the `simulation`
  namespace is unreferenced (allowing for the dynamic key families, which are reached by prefix).
- **The uppercase keys are authored in their JSON values, not produced by a CSS `uppercase` transform** —
  the seven `strip.key.*`, the three `detail.badge.*`, `detail.stat` and `promo.free`. A transform is a
  **no-op on Arabic script**, so it would leave these looking un-keyed rather than visibly needing a
  translator's decision when that effort comes.

Keep the check as a small script beside the existing `tools/` gates so it can be re-run, rather than a
one-time manual pass — the whole argument for this ticket is that the ledger is *checkable*.

## Spine reach

component (the flag cell's hue) · i18n (the ledger assertion) · test (script + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `no retired simulation key remains in the locale file or any call site` — the five money keys named explicitly, plus the full retirement list and the already-dead orphan · **flow (script gate under `tools/`)**
- [ ] `every t() call in the feature resolves to a key that exists` — the reverse direction, so a new call site cannot render raw · **flow (same script)**
- [ ] `the screen spends exactly two hues` — success only on a fired promotion, attention only on a `W` line; the elements trace's flags neutral · **flow (Playwright, extends `tools/sim-density-drive.mjs`)**

The hue check must be a **drive assertion on computed styles**, not a lint: `npm run lint`'s colour-literal
and contrast gates already guard *which values* may be used, but *which token is spent where* is only
visible in a rendered tree.

## Boundaries

No API change. No new i18n keys — this ticket only removes and asserts. The new script is a **manual-run
tool beside the existing ones**, consistent with how the drives are treated; promoting it into
`npm run lint` is a separate decision and not required to close this. The flag cell's hue change touches
the elements trace built in [116](116-sim-line-expansion.md) and nothing else.

## Done when

The key script reports zero retired keys remaining and zero unresolved call sites; the elements trace's
flags render with no hue; the dead `met` branch is gone; and the extended density drive confirms the only
coloured things on a run are a fired promotion and a `W` line. `npm test`, `npm run typecheck`,
`npm run build` and all three `npm run lint` gates green.

## Blocked by

- [116](116-sim-line-expansion.md) — the flag cell's hue only matters once it lives in the elements trace,
  and the last of the file-deletion retirements happens there.
- [121](121-sim-rtl-mirroring.md) — the last slice to touch the feature's markup; asserting the ledger
  before it would only have to be re-run.
