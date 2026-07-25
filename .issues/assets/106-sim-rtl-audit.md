# 106 — Mirroring and bidi for the reworked Simulation arrangement

Measured audit for ticket [106](../106-sim-rtl-mirroring.md), map [097](../097-simulation-screen-rework.md).
Method inherited from the [080](../080-rtl-mirroring-of-the-reworked-layout.md) audit: **nothing here is
reasoned about on paper.** Every claim is read off character client rects or off rendered pixels, because
080's two overturned first-draft claims are what established that bidi cannot be reasoned about.

**Instrument:** [`tools/sim-rtl-drive.mjs`](../../tools/sim-rtl-drive.mjs) — headless Chromium, loads the
three approved prototypes over `file://`, drives **180 state combinations** (30 for 101, 90 for 102, 60
for 104) in both directions, and runs five passes. `18/18 checks pass` at the time of writing.

The subject is the **approved device** — [101](../101-sim-screen-device-prototype.md),
[102](../102-sim-input-chip-bar.md), [104](../104-sim-results-line-anatomy.md) — not the app, because the
reworked screen is a spec in progress and does not exist in code. That is the correct subject anyway: the
build will be authored from these prototypes.

---

## 1. The headline: there is no mirroring work to do

**Every region mirrors correctly, and not one physical-utility fix is owed.** This is the opposite of 080,
which found eight faults, five of them one-line CSS fixes. The reason is that 080 already happened: 095
shipped the vocabulary, and 101/102/104 were authored after it.

Measured, in both directions, across every state:

| Region | Measured |
|---|---|
| The run strip | chips lead from the reading edge, controls trail — `ltr chips@124 btns@1024` · `rtl chips@814 btns@124` |
| The money readout | stays on the strip's far edge — `ltr@734` · `rtl@384` |
| The 66/34 split | results lead, promotions rail trails — `ltr results@113 rail@891` · `rtl results@519 rail@113` |
| The line's accent edge (cross-highlight) | swaps physical sides — `ltr {left:3,right:0}` · `rtl {left:0,right:3}` |
| The money columns | `text-align: end` in both directions — never resolves to `right` |
| Horizontal overflow | `0` in both directions; RTL adds no scrollbar |

**Nothing on this screen wants to resist mirroring.** 080 had to ask the owner four times whether a mirror
was desired (the identity band, the action bar's clusters, the pill rail, `↗`). This device raises the
question nowhere: it has no chart axis, no timeline, no commit-vs-escape geometry. The one arguable case —
the three money columns ending with net total leftmost under RTL — is correct: they mirror as a group and
still read `was → saved → net total` in reading order.

**The sweep (question 3) is empty.** `src/features/pricing/simulation/` contains **zero** physical
Tailwind utilities (`ml/mr/pl/pr/left/right/text-left/text-right/rounded-l/rounded-r/border-l/border-r`),
zero `box-shadow` offsets, and zero inline directional styles. The prototypes' hand-written CSS is
already fully logical: `border-inline-start`, `margin-inline-start`, `margin-inline`, `inset-inline-end`,
`padding-inline`, `padding-inline-start`, `text-align: start|end`. **Nothing is named for the `dir`-switch
effort, because nothing was left unfixed.**

Two spots where the *build* will be tempted into the physical spelling, named so review catches them:

- `.line { border-inline-start: 3px solid transparent; margin-inline-start: -3px }` — the cross-highlight
  accent. This is 080's **F4 shape**: it must become `border-s-[3px]` + `-ms-[3px]`, and **must never
  become a `box-shadow`**, whose offsets are physical and have no logical form.
- `.cell.ctl::after { inset-inline-end: 5px }` — the coupon-control caret.

And one accident worth keeping: the strip pins its money with a `<span class="grow">` flex spacer, not an
auto margin. That sidesteps 080's **F1** (a latent `margin-left:auto` that is inert until the row wraps)
by construction. If the build simplifies it, `ms-auto` is the only acceptable spelling.

---

## 2. The bidi list (question 1) — 13 call sites

36 runs on the device carry a digit and a space. **28 reorder under RTL; 8 are measured safe.** Every
break was repaired in-place by isolating the value, measured by applying
`direction:ltr; unicode-bidi:isolate` (which is exactly what `core/ui/Ltr`'s `<bdi dir="ltr">` is) and
re-reading the rects. All 13 sites are `core/ui/Ltr` — **no new component, and nothing to design.**

| # | Call site | Measured value | ltr → rtl |
|---|---|---|---|
| 1 | run strip · the pricing-date chip | `25 Jul 2026` | 62 → **−11** |
| 2 | run strip · the calc-time readout | `268 ms` | 30 → **−8** |
| 3 | run strip · money + currency | `172.38` `SAR` | safe by spelling — see below |
| 4 | Results frame heading · count badge | `2 lines`, `2 lines · 1 warning` | 80 → **−9** |
| 5 | Promotions frame heading · count badge | `1 fired · 1 near-miss` | 87 → **−8** |
| 6 | result line · the whole `qty ×unit` value | `2 EA × 91.26` (inner `× 91.26`) | 33 → **−10** |
| 7 | result line · the promotion slot's server title | `70% 2nd PCS`, `2 PC for 29.95 SR` | 100 → **−12** |
| 8 | result line · the `[070]` message | `[070] Mandatory condition 'VKP0' … at step 5` | 411 → **−38** |
| 9 | promo card · the identity line | `000100000131 · ZB03 · applied ×2` | 180 → **−16** |
| 10 | promo card · the amount | `105.18 SAR`, `36.48 SAR` | 77 → **−14** |
| 11 | promo card · the near-miss note | `, would have saved 26.04.` | 126 → **−78** |
| 12 | line expansion · condition rate / base | `91.26 SAR`, `−35.000 %` | 46 → **−48** |
| 13 | the 400 banner · the server message | `UoM 'EA' is not valid for material '32423333'.` | 244 → **−6** |

### Three results that overturn the ticket's own expectations

**The buy→get sentences are safe — the ticket's prime suspect is innocent.** 106 named "the promo blocks'
plain-language buy→get sentences (the most likely new offender)". Measured: `Buy 2, the second at 70% off`
reads **identically in both directions** (172 → 172). The reason is bidi rule W7 — a European number
preceded by a strong left-to-right character in the same run *becomes* left-to-right — so a sentence that
opens with a Latin word immunises every number inside it. The same mechanism makes
`Gross 182.52 · net 118.64 · tax 17.79`, `line 10` and `to 31 Jul 2026` safe.

**What breaks instead is the raw server title.** `70% 2nd PCS` and `2 PC for 29.95 SR` — the promotion
descriptions as the wire sends them (098's captures) — open with a digit and reorder. So the offender is
not the composed English we write, it is the **server text we pass through**. That inverts the ticket's
guess and is the more durable finding, since server text cannot be re-worded.

**Money + currency breaks only when a literal space separates them.** The strip spells
`172.38<span class="cur">SAR</span>` — no space character, the gap is `margin-inline-start: 3px` — and is
measured safe. The promo rail spells `105.18 SAR` with a real space and breaks. Wrap both anyway (over-
application is free), but the spelling is a second, independent line of defence worth preserving.

### The predicate stays dumb — deliberately

080's transferred rule is *a value breaks when it contains a space and begins or ends with a digit*. On
this screen it is **measurably not exact, in both directions**, and the drive asserts that it must stay
dumb rather than get sharpened:

- **It under-fires** where W7 applies (`Gross 182.52 …` is predicted to break and does not).
- **It over-fires** where a leading or trailing *neutral* is involved, because neutrals resolve from the
  surrounding line, not from the run (N1/N2): `— 70% 2nd PCS` is safe sitting next to Latin text and
  would break standing alone.

**No run-local predicate can be exact for that reason.** The rule is a *superset* of measured breakage
(asserted), and over-application costs nothing, so the reviewable rule remains **a server value mixing
digits and spaces gets wrapped** — with the standing caveat that it is wrapped **whole, never in
fragments** (080 created a fault by isolating a fragment of an all-Latin run).

Two of the "breaks" above are the mild class 080 already ruled **not a bug**: #11 and #13 reorder only
because a leading comma or a trailing `'.` relocates to the paragraph edge. They are wrapped because it
is free, not because the value scrambles.

---

## 3. Icons (question 2, continued) — one new fault, and 080's trap reproduced

Self-mirroring was **measured off rendered pixels**, screenshotting each glyph under `direction:ltr` and
`direction:rtl` and diffing — not looked up in a table. 24 glyphs on the device; exactly two self-mirror:

| Glyph | Self-mirrors | Role on the device | Ruling |
|---|---|---|---|
| `›` U+203A | **YES** | the disclosure twisty on every result line and on Manual conditions | correct as a character; **must not** also be flipped |
| `‹` U+2039 | **YES** | `‹ Pricing elements`, the sibling trace link | correct as a character; **must not** also be flipped |
| `▸` U+25B8 | no | **`Bonus buy details ▸`** | **FAULT — must mirror** |
| `→` U+2192 | no | the `buy → get` chip | **FAULT — must mirror** |
| `▶` U+25B6 | no | `▶ Process` | does not mirror — the one low-confidence call |
| `↻` U+21BB | no | `↻ Inputs changed` (102's status slot) | does not mirror — confirms 080 |
| `⌄ ⌃ ▾ ▴` | no | expanded twisty, `Edit ▾` / `Done ▴` | vertical, direction-neutral |
| `↑` U+2191 | no | `Fix it in Items ↑` | vertical, direction-neutral |
| `⛁ ✕ ⚠ ✓ ✔ × − · — … ⏎` | no | wipe cache, remove row, marks, signs, separators | direction-neutral |

**080's trap is live on this device, and it is now load-bearing rather than decorative.** The twisty `›`
appears on *every* result line and on Manual conditions — 103 made it the screen's primary affordance. As
a character it flips itself and is correct for free; the moment the build renders it as lucide's
`ChevronRight` (an SVG, which does **not** auto-mirror) it needs an explicit flip, and if anyone adds that
flip *while keeping the character*, it double-mirrors back to wrong. Both halves measured in 080. The
ruling stands and is now the most consequential line in it: **if an icon must mirror, ship it as an SVG
and flip it explicitly; never let a punctuation character be an icon.**

**The two faults** are both affordances that point *forward* and would point backwards under RTL:

- `Bonus buy details ▸` — 099's approved modal affordance. `▸` does not self-mirror. Ship a lucide
  `ChevronRight` with an explicit `rtl:-scale-x-100`.
- `buy → get` — the promo-kind chip. Ship lucide's `ArrowRight` explicitly flipped. **Precedent already
  exists in the shipping code**: `SimPromoBlocks.tsx:146` renders `<ArrowRight className="rtl:rotate-180" />`
  and `SimMissedPromotions.tsx:88` flips its chevron the same way — the two lucide icons in the feature
  today are *already* correct, which is why the sweep is empty.

`▶ Process` is recorded as the low-confidence call, the way 080 recorded `↗`. Media players do mirror play
triangles in RTL locales; a Process button is not a media player, and `▶` here is a run glyph in the same
family as `⛁` and `⚡`. **Ruled: does not mirror.** Flagged rather than buried.

---

## 4. The hand-built results table (question 4) — the cost is already paid

The premise needs one correction: **the results table is hand-built today.** `SimResultsGrid.tsx` contains
no `AgGridReact` — it is a CSS-grid table. So the rework does not *take on* this cost, it **inherits**
it, and question 4's "state what that costs" resolves to a measurement rather than an estimate.

**Measured cost: zero RTL-specific code.** The three things AG Grid would have done for us — per-direction
column alignment, the selected-row accent side, and header/cell alignment pairing — are all expressible
logically, and all three measured correct across 180 state combinations with no `dir` branch anywhere:
`text-align: end` resolves per direction, and the accent edge swapped physical sides on its own.

What we owe in exchange is **spelling discipline, not code**: `text-end` never `text-right`,
`border-s`/`::after` + `inset-inline-start` never `box-shadow`, and the two named temptations in §1. That
is cheaper than the alternative, because the AG Grid path is what produced 080's **F6** — `enableRtl` set
on 1 of 7 grids, reading a `dir` nothing in the app ever sets, as an unsubscribed DOM read. **A
hand-built table has no third-party exemption to carve out of
[logical-tailwind](../../.claude/rules/logical-tailwind.md), and no drift to police.**

---

## 5. `SimBonusBuyPanel`'s AG Grid (question 5) — the premise expires

Question 5 assumes the panel survives. It does not: **[103](../103-sim-deep-layers-placement.md) dissolves
`SimBonusBuyPanel`** and turns its `h-72` AG Grid into a plain table.

`SimBonusBuyPanel.tsx` is the **only** `AgGridReact` in `src/features/pricing/simulation/`. So after the
rework the Simulation screen contains **zero AG Grid instances**, and `enableRtl` has **no call site on
this screen at all** — there is nothing here for the `dir`-switch effort to wire. 080's F6 finding is
unchanged and still out of scope, but its call-site count drops by one and this map owes it nothing.

---

## Scope

**Fixes + bidi now, no `dir` switch** — 106's inherited boundary, unchanged. Concretely, what this audit
sends into the spec is: 13 `core/ui/Ltr` call sites, two icons that must ship as flipped SVGs, and two
CSS spellings to hold the line on. All are invisible under LTR, so none of it can regress the screen.

**Out of scope and unchanged:** the `dir` switch itself and F8's wiring; F6's derived `enableRtl` value
(now with one fewer call site); and **Arabic copy and font metrics**, which 083 ruled out and 097 restates
— Arabic is taller and often wider at the same point size and will pressure the 250px promotions rail, the
uppercase chip keys (uppercase does not apply in Arabic) and the 34px row. That belongs to whatever effort
ships Arabic.
