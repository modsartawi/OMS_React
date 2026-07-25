---
status: open
spec: 110
blocked-by: 115, 116, 117, 119
---

# 121 — The reworked screen mirrors, spends two hues, and carries no retired key

> **Absorbs [122](122-sim-hue-and-key-audit.md)**, closed `wontfix`. Both were trailing audits over the
> same finished markup, and 121 already blocked on everything 122 did — so merging them removes a whole
> wave from the build order at no cost to either.

## What to build

Make the rebuilt screen read correctly right-to-left. The audit already ran — 180 state combinations ×
both directions — so this slice implements a **known, counted** result rather than discovering one.

**The mirroring half is empty.** The sweep found **zero physical utilities** to fix: the logical-utility
vocabulary shipped before these regions were authored, so **nothing is named for the direction-switch
effort**. No region wants to resist mirroring, and no owner ruling is owed. Keep it that way — every
utility this rework writes is logical (`ms`/`pe`/`text-start`/`start-`/`border-s-`), per the standing
rule.

**The work is bidi isolation: 13 wrappers**, all using the existing shared `Ltr` primitive — **no new
component**. 28 of 36 digit-and-space runs reorder under the browser's own bidi algorithm, and each is
repaired by isolating the **whole value**, not a fragment of it.

**Three findings that fix where the wrappers go** — each overturned a guess, so build to these rather
than to intuition:

- **The buy→get sentences are innocent.** A Latin word opening the run immunises its numbers; wrapping
  them would be work for nothing.
- **The raw server promotion title is the offender instead** — and it **cannot be re-worded**, because it
  is server data passed through as data. It must be isolated.
- **Money and currency break only with a literal space** between the figure and the unit.

**Icons.** `›`/`‹` self-mirror (measured off pixels), and `›` is now the **load-bearing twisty** for the
line expansion — so the SVG double-mirror trap is live and must be avoided rather than rediscovered. Two
real faults need flipped icon SVGs: the `Bonus buy details ▸` control and the `buy → get` arrow.
**`▶ Process` is ruled not to mirror** — it is a transport-style glyph, not a direction indicator; comment
the exception where it sits, per the logical-utility rule's exception clause.

**Two things that cost nothing, recorded so they are not re-litigated:** the results table is hand-built
today, so the rework **inherits zero RTL-specific table code** — no third-party exemption and no drift.
And because [116](116-sim-line-expansion.md) removes the feature's last AG Grid, the screen ends with
**zero grids** and the grid's RTL flag has no call site here at all.

**One assertion to keep honest:** the shared bidi predicate is measurably **not exact and must stay
dumb** — no run-local predicate can be — so the drive asserts it remains a **superset**, catching more
than strictly necessary rather than fewer.

## The close-out, absorbed from 122

The last slice to touch this feature's markup is also the right place to prove the two rules the whole
rework has been asserting. Each earlier slice retires its own keys as it goes; this proves the ledger is
**complete** rather than mostly done.

### The hue budget — a contradiction that is live today

The screen's whole hue budget is **two**: `success` on a fired promotion, `attention` on a `W` line. A
near-miss is neutral, staleness is neutral, a discount is neutral, and a healthy line carries no mark.

The boolean flag cell paints its true-flag check `success`, and it survives into the elements trace built
by [116](116-sim-line-expansion.md). Left as is, the expansion spends `success` on *"this row is
statistical"* and the two-hue statement is **not true of the built screen**. Make it neutral. **Free
alongside:** that component's `met` mode — the red X branch — has **no call site**, so a third hue leaves
with dead code rather than needing a ruling. Delete it.

### The key ledger — the contract half of the expand–contract

[123](123-sim-i18n-key-expand.md) expanded the locale file; this contracts it. Assert:

- **The five retired money keys appear in neither the locale JSON nor any call site** —
  `results.subtotal`, `results.promo`, `results.gross`, `results.tax`, `results.net`. This is the
  anti-collision assertion and the reason those keys were minted fresh rather than renamed in place: the
  natural rename target was **occupied by a different number**, and a key that resolves to plausible
  English about the wrong figure is strictly worse than a raw key, which is at least visibly broken.
  **No partially-swept state can satisfy this assertion.**
- **Every retirement in the ledger is gone** — the 9 that left with dissolving files and the 13 that
  needed a sweep, including **`summary.elapsed`, which was already dead before this rework began**.
- **No `t()` call site in the feature resolves to a missing key**, and no `simulation` key is
  unreferenced (allowing for the dynamic key families, reached by prefix).
- **The uppercase keys are authored in their JSON values, not produced by a CSS `uppercase` transform**
  — the seven `strip.key.*`, the three `detail.badge.*`, `detail.stat` and `promo.free`. A transform is
  a **no-op on Arabic script**, so it would leave these looking un-keyed rather than visibly needing a
  translator's decision.

Keep the key check as a small script beside the existing `tools/` gates so it can be re-run — the whole
argument for it is that the ledger is *checkable*.

## Spine reach

component (13 `Ltr` wrappers, two flipped icon SVGs, the flag cell's hue) · i18n (the contract half —
retirements only) · test (drive + script)

## Proof (→ `tdd` red-green cycles)

- [ ] `every region of the reworked screen mirrors with no physical-utility fix owed` — the existing 180-combination sweep, re-run against the rebuilt markup · **flow (Playwright, `tools/sim-rtl-drive.mjs`)**
- [ ] `every digit-and-space run keeps its internal order in RTL` — including the raw server promotion title and money-with-currency · **flow (same drive)**
- [ ] `the twisty, the bonus-buy control and the buy→get arrow point the way the text runs` — and Process does not mirror · **flow (same drive)**
- [ ] `no retired simulation key remains in the locale file or any call site` — the five money keys named explicitly, plus the full retirement list and the already-dead orphan; and every `t()` call resolves · **flow (script gate under `tools/`)**
- [ ] `the screen spends exactly two hues` — success only on a fired promotion, attention only on a `W` line, the elements trace's flags neutral · **flow (same drive)**

`tools/sim-rtl-drive.mjs` **already exists and is green against today's screen.** Its job here is to go
green again against the rebuilt one; extend its state matrix to cover the strip's collapsed and expanded
forms, the line expansion, and the stacked arrangement — and to carry the hue assertion, which must be a
check on **computed styles**, not a lint: `npm run lint`'s colour-literal and contrast gates already
guard *which values* may be used, but *which token is spent where* is only visible in a rendered tree.

## Boundaries

No API change and **no new i18n keys** — this ticket only removes and asserts. **Arabic copy and font
metrics stay out of scope** (a standing ruling): the recorded pressure points for that later effort are
the 250 px rail, the uppercase chip keys, and the 34 px row. The in-flight hairline's animation is the
one physical-direction exception on the strip. The new key script is a **manual-run tool beside the
existing ones**; promoting it into `npm run lint` is a separate decision and not required to close this.

**Concurrency:** the last ticket in the build order — nothing else is in flight. Uses the existing
`tools/sim-rtl-drive.mjs` on **drive port 5205**.

## Done when

`node tools/sim-rtl-drive.mjs` is green against the rebuilt screen across its extended state matrix, in
both directions, with no physical Tailwind utility introduced anywhere in the feature and the two icon
faults flipped; the key script reports zero retired keys remaining and zero unresolved call sites; the
elements trace's flags render with no hue and the dead `met` branch is gone; and `npm test`,
`npm run typecheck`, `npm run build` and all three `npm run lint` gates are green.

## Blocked by

All four render slices — the wrappers go on real markup, the ledger cannot be closed while call sites are
still moving, and a partial pass would need re-doing: [115](115-sim-result-line.md),
[116](116-sim-line-expansion.md), [117](117-sim-promotions-rail.md),
[119](119-sim-responsive-arrangement.md).

[118](118-sim-bby-details-affordance.md) is **not** a blocker: its control ships dark, so it adds one
`Ltr`-free label and nothing the sweep or the ledger depends on. If it happens to land first, no rework.
