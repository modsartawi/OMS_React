---
type: wayfinder-ticket
wayfinder: research
map: 097
status: done
blocked-by: 101, 104
---

# 106 — Mirroring and bidi for the reworked arrangement

## Question

**Does the new arrangement mirror correctly, and which of its values need bidi isolation?**

[080](080-rtl-mirroring-of-the-reworked-layout.md) did this for Document Details and 095 shipped it;
the method and most of the findings transfer, so this is a verification pass against the new device
rather than a fresh investigation. Its transferable rulings, to be applied not re-derived:

- **The culprit is the space, not the punctuation.** A value breaks only when it contains a space
  **and** begins or ends with a digit. `ERX-77120934` and `240.70` are safe. **Wrap a whole value,
  never a fragment** — fragment-wrapping *created* a fault.
- `box-shadow` offsets are **physical with no logical form** — an inset accent bar must be a
  pseudo-element with `inset-inline-start`.
- **An icon that must mirror ships as an SVG and is flipped explicitly.** `‹` (U+2039) is
  `Bidi_Mirrored`, flips itself, and double-mirrors the naive fix.
- `core/ui/Ltr` already exists (095) — this ticket names its call sites, it does not design a wrapper.
- **Scope is fixes + bidi now, no `dir` switch.** The switch remains a separate effort.

Against the approved device, answer:

1. **The bidi list** — every value on the new screen that mixes digits and spaces. Candidates from
   today's screen: the calc-time string (`summary.calc`), the count banner (`banner.counts`), a
   money+currency pair, a quantity+unit pair, the promo blocks' plain-language buy→get sentences
   (the most likely new offender — they are *composed* text carrying numbers), and any totals footer
   [104](104-sim-results-line-anatomy.md) adds.
2. **The regions that mirror**, and the ones where mirroring would be wrong. The chip bar, the
   headline band, the results table, the block↔line cross-highlight geometry.
3. **The physical-utility sweep** across `src/features/pricing/simulation/` — the
   [logical-tailwind](../.claude/rules/logical-tailwind.md) grep. Fixes that are byte-identical under
   LTR land with the rework; anything that is not, is named for the `dir`-switch effort.
4. **The hand-built results table.** It is ours, not AG Grid, so nothing mirrors itself for free —
   the exemption 080 granted AG Grid's internals does not apply here. State what that costs.
5. **`SimBonusBuyPanel`'s AG Grid** is the one place the AG Grid story does apply; 080's `enableRtl`
   finding (a grid option, not a theme param, whose lone call site reads a `dir` nothing sets) is the
   answer, and it stays out of scope with the switch.

## Answer

**The mirroring half is empty and the bidi half is 13 wrappers.** Full audit:
[106-sim-rtl-audit.md](assets/106-sim-rtl-audit.md). Instrument:
[`tools/sim-rtl-drive.mjs`](../tools/sim-rtl-drive.mjs) — headless Chromium over the three approved
prototypes, **180 state combinations** in both directions, five passes, `18/18 checks pass`. Nothing
below is reasoned about on paper; 080's two overturned first-draft claims are why.

**Every region mirrors, and not one physical-utility fix is owed** — the opposite of 080's eight faults.
Measured in both directions: the run strip (chips lead from the reading edge, controls trail), the money
readout on the strip's far edge, the 66/34 split (results lead, rail trails), the cross-highlight accent
edge swapping physical sides, `text-align: end` never resolving to `right`, and **no** RTL overflow.
**The sweep (3) is empty**: `src/features/pricing/simulation/` has zero physical utilities, zero
`box-shadow` offsets, zero inline directional styles, and the prototypes' CSS is already fully logical —
095 shipped the vocabulary and 101/102/104 were authored after it. **Nothing is named for the
`dir`-switch effort because nothing was left unfixed.** Two spellings the build must not fumble: the
line's `border-inline-start` accent (080's **F4** shape — never a `box-shadow`) and the coupon caret's
`inset-inline-end`; plus the strip's `grow` flex spacer, which sidesteps **F1**'s latent auto-margin by
construction. **No region on this device wants to resist mirroring** — it raises the question nowhere,
where 080 needed four owner rulings.

**The bidi list (1) is 13 `core/ui/Ltr` call sites** — 36 runs carry a digit and a space, **28 reorder**,
each repaired in place by isolating the value (measured, not assumed): the pricing-date chip, the
calc-time `ms`, money+currency, both frame-heading count badges, the line's whole `qty ×unit`, the
promotion slot's server title, the `[070]` message, the promo card's identity line / amount / near-miss
note, the expansion's condition rate+base, and the 400 banner's server message.

**Three measurements overturn this ticket's own guesses.** The **buy→get sentences are innocent** — the
named prime suspect reads identically in both directions (bidi **W7**: a number preceded by a strong LTR
character in the same run becomes LTR, so any sentence opening with a Latin word immunises its numbers).
**What breaks instead is the raw server title** (`70% 2nd PCS`, `2 PC for 29.95 SR`) — so the offender is
the text we pass through, not the English we compose, and that cannot be re-worded away. And
**money+currency breaks only when a literal space separates them**: the strip's `172.38`+`SAR` (gap is a
margin) is safe where the rail's `105.18 SAR` is not.

**080's predicate is measurably not exact — and must stay dumb.** It under-fires via W7 and over-fires on
leading/trailing neutrals, which resolve from the surrounding line (**N1/N2**), not the run — so
`— 70% 2nd PCS` is safe in place and would break alone. **No run-local predicate can be exact.** The
drive asserts the rule is a *superset* of measured breakage, so a later session cannot sharpen it into
something that under-fires: **a server value mixing digits and spaces gets wrapped, whole, never in
fragments.**

**Icons: 080's trap is live and now load-bearing, plus two new faults.** Self-mirroring was measured off
rendered pixels, not looked up. Of 24 glyphs, exactly two self-mirror — `›` and `‹` (U+203A/U+2039) —
and `›` is **the disclosure twisty on every result line**, which 103 made the screen's primary
affordance. Correct for free as a character; the moment it becomes lucide's SVG `ChevronRight` it needs
an explicit flip, and a flip *plus* the character double-mirrors back to wrong. **Two real faults:**
`Bonus buy details ▸` and the `buy → get` chip both point forward and neither `▸` nor `→` self-mirrors —
ship both as explicitly flipped lucide SVGs. Precedent is already in the shipping code
(`SimPromoBlocks.tsx:146`, `SimMissedPromotions.tsx:88` both carry `rtl:rotate-180`), which is part of
why the sweep is empty. `▶ Process` is **ruled not to mirror** and recorded as the one low-confidence
call, the way 080 recorded `↗`.

**The hand-built table (4) has already paid its cost, and it is zero RTL-specific code.** Premise
corrected: `SimResultsGrid.tsx` has no `AgGridReact` — the table is hand-built *today*, so the rework
inherits the obligation rather than taking it on. All three things AG Grid would have done — per-direction
column alignment, the selected-row accent side, header/cell pairing — measured correct across 180 state
combinations with no `dir` branch. What we owe is spelling discipline, not code, and it is the cheaper
side: a hand-built table has **no third-party exemption to carve out of logical-tailwind and no drift to
police**, where the AG Grid path is exactly what produced F6.

**Question 5's premise expires.** 103 dissolves `SimBonusBuyPanel`, which is the **only** `AgGridReact`
in the feature — so the reworked screen contains **zero** AG Grid instances and `enableRtl` has no call
site here at all. F6 is unchanged and still out of scope, with one fewer call site; this map owes it
nothing.

**Scope held:** fixes + bidi, no `dir` switch. All of it is invisible under LTR, so none can regress the
screen. Arabic copy and font metrics stay ruled out (083, restated by 097) — recorded pressure points for
that effort: the 250px rail, the uppercase chip keys, the 34px row.
