---
type: wayfinder-ticket
wayfinder: prototype
map: 068
status: done
blocked-by: 070
---

# 071 — The derived dark twin

## Question

PosTheme is light-only — a till renders one theme. We keep dark mode, so every value approved in
070 needs a dark counterpart that does not exist upstream. What are they?

Decide and prove:

- **The derivation rule.** Not per-token taste — a stated rule (invert lightness within the same
  hue/chroma family? a fixed layered set of cool near-blacks, mirroring how our current dark theme
  layers warm near-blacks?). The rule is the deliverable; the values follow from it.
- **The surface ladder.** `--surface` / `--panel` / `--panel-2` are three near-whites in light. Dark
  needs three near-blacks with the same *relative* separation, or the card/rail/page structure of the
  reworked screen collapses into one flat plane.
- **The family colours on dark.** `--fam-insurance #0B7C8C`, `--fam-fulfil #2E7D5B`,
  `--fam-admin #5D5A93` and `--fam-loyalty #B4791F` are mid-tone on white; several will fail contrast
  as button fills on a dark panel. Decide per family whether it lightens, or whether dark flips
  family buttons to tinted-outline instead of solid fill.
- **Status colours on dark.** The `-050` tints (`--success-050`, `--danger-050`, `--attention-050`,
  `--accent-050`) are the pill and row-selection backgrounds. Their dark equivalents are the
  hardest values in the set — they must stay distinguishable from `--panel` while keeping their
  foreground text legible.
- **Contrast proof.** Every text-on-surface and text-on-button pair checked to WCAG AA (4.5:1 body,
  3:1 large/UI). Report the numbers, not an assurance.

Deliver `071-pos-dark-twin.PROTOTYPE.html`: the same swatch board as 070 in both themes side by side,
the same two re-tinted screens in dark, and the contrast table.

## Answer

Approved by the owner, 2026-07-24, against
[assets/071-pos-dark-twin.PROTOTYPE.html](assets/071-pos-dark-twin.PROTOTYPE.html) — both themes swatched
side by side, Deliveries and today's Document Details rendered in dark, the family-fill alternative
rendered and rejected, and every pair measured. `global.css` was not touched.

### The rule (the deliverable)

**R1 — dark keeps our proven lightness ladder and borrows only POS's temperature.** Every neutral keeps
the *lightness* of the dark theme we ship today (page L .224, card .265, muted .307, rail .191 — levels
already validated across ~40 screens) and takes its *hue and chroma* from the POS scale: H ≈ 250°, chroma
on the same C-vs-L curve PosTheme uses (≈ .005 near white → ≈ .026 near black). Warm near-blacks
(H ≈ 84°) become cool near-blacks. Nothing else moves. In hex: page `#1C1B19` → `#121C27`, card
`#262523` → `#1C2631`, muted `#302F2D` → `#27313A`, rail `#151412` → `#0B151F`.

*Rejected: reflecting the light ladder about L = 0.5.* It puts `--card` (L 1.000 → 0.000) **below** the
page — a card cut into the page rather than raised off it, inverting the elevation language on every
screen — and compresses seven surfaces into L 0.00–0.08, where our own shipped theme is the evidence that
steps that small disappear (today's dark uses ~.04 between tiers where light uses ~.015).

**R2 — chromatics lift to the L .66–.76 band, hold hue, and flip their ink.** R1 cannot apply to
`--primary`, the four severities or the two families: they are mid-tone fills (L .50–.62) built to carry
white text on white panels, and at that lightness they vanish on a near-black card. Each keeps its POS
hue exactly (255.9 / 152.8 / 72.0 / 22.4 / 161.9 / 285.0) and its chroma within ±.02, and rises into the
band. **Consequence, stated once: in dark, every filled chromatic control is a light tonal fill with dark
ink** (`--primary-foreground` = `--background` `#121C27`). White on the lifted fills measures 2.23–2.34:1;
there is no version of this where dark mode keeps white-on-colour.

**R3 — interaction moves toward contrast with the page, not toward black.** `--accent` (hover) and
`--secondary-press` sit *below* their base in light and *above* it in dark. The one place the ladder's
rank deliberately inverts; the same state-layer convention every dark UI uses.

**R4 — `-050` and `-800` are roles, not lightness levels.** `-050` = "the quiet ground of this family",
`-800` = "ink on that ground". Absolute lightness swaps in dark: `-050` becomes a tinted near-black
(L ≈ .32, C ≈ .05 — roughly **4×** the light tint's chroma, because a near-black needs far more chroma to
read as tinted at all), `-800` becomes a light tint (L ≈ .82–.87). `bg-danger-050 text-danger-800` keeps
meaning exactly what it meant — **zero call-site churn, same as 070**.

### The surface ladder

Three near-whites → three near-blacks, ΔL measured against `--card`:

| Tier | light | L | Δ | dark | L | Δ |
|---|---|---|---|---|---|---|
| `--card` | `#FFFFFF` | 1.000 | — | `#1C2631` | .264 | — |
| `--card-2` | `#FAFBFC` | .988 | −.012 | `#17212C` | .244 | −.020 |
| `--background` | `#F4F7FA` | .975 | −.025 | `#121C27` | .222 | −.042 |
| `--sidebar` | `#E9EEF4` | .947 | −.053 | `#0B151F` | .191 | −.073 |
| `--muted` | `#EEF2F6` | .959 | −.041 | `#27313A` | .308 | **+.044** |
| `--accent` | `#E4EAF1` | .935 | −.065 | `#323C46` | .351 | **+.087** |
| `--sidebar-accent` | `#DCE5EF` | .918 | −.029 *(vs rail)* | `#202A34` | .280 | **+.089** *(vs rail)* |

Dark steps run ~1.7× the light steps, deliberately: oklch L is perceptually uniform in theory, but a
near-black step is eaten by panel gamma, ambient reflection and OLED crush in a way a near-white step is
not. Our shipped dark theme already encodes that correction and R1 inherits it rather than re-deriving it.

### The table — dark mode, final (43 tokens, hex, per 070's notation ruling)

| Token | Light (070) | **Dark (071)** | Rule |
|---|---|---|---|
| `--background` | `#F4F7FA` | `#121C27` | R1 |
| `--foreground` | `#19232E` | `#ECF0F3` | R1 (off-white — pure white haloes on a dark panel) |
| `--card` | `#FFFFFF` | `#1C2631` | R1 |
| `--card-foreground` | `#19232E` | `#ECF0F3` | R1 |
| `--card-2` | `#FAFBFC` | `#17212C` | R1 |
| `--muted` | `#EEF2F6` | `#27313A` | R1 |
| `--muted-foreground` | `#586674` | `#98A6B4` | R1 · **358 uses**; 5.89 light / 6.16 dark |
| `--ink-3` | `#8593A1` | `#76828E` | R1 · tertiary, sub-AA by design in both |
| `--accent` | `#E4EAF1` | `#323C46` | **R3** |
| `--accent-foreground` | `#19232E` | `#ECF0F3` | R1 |
| `--border` | `#E3E9F0` | `#2E3742` | R1 · ΔL .069 from card in **both** themes. Retires today's `oklch(1 0 0 / 10%)` alpha |
| `--border-strong` | `#CBD6E2` | `#3B4755` | R1 · ΔL .129 in both |
| `--divider` | `#EDF1F5` | `#28313B` | R1 · ΔL .044 in both |
| `--input` | `#CBD6E2` | `#3B4755` | R1 · = `--border-strong`, as 070 set it. Also retires an alpha |
| `--ring` | `#2F63A6` | `#6BA0E8` | R2 · = `--primary` in both |
| `--primary` | `#2F63A6` | `#6BA0E8` | R2 · **126 uses**; L .498 → .700, H 256 held |
| `--primary-050` | `#E9EFF7` | `#22344B` | R4 |
| `--primary-border` | `#C6D6EC` | `#364C68` | R4 |
| `--primary-800` | `#27538C` | `#B5D0F5` | R4 |
| `--primary-foreground` | `#FFFFFF` | `#121C27` | **R2 consequence** |
| `--secondary` | `#586674` | `#7D8B99` | R2 · L .630 is the exact level where `--background` ink clears AA (4.93) |
| `--secondary-press` | `#495562` | `#8F9DAB` | **R3** · −.063 L in light, +.060 L in dark |
| `--secondary-foreground` | `#FFFFFF` | `#121C27` | R2 |
| `--success` / `-050` / `-border` / `-800` | `#1E874B` · `#E7F3EC` · `#BFE0CD` · `#155F36` | `#55B577` · `#1E3A27` · `#2E543A` · `#ABDCB8` | R2+R4 · H 152.8 held |
| `--attention` / `-050` / `-border` / `-800` | `#B4791F` · `#F8F0DE` · `#E7D3A3` · `#7C5410` | `#E4A249` · `#422F15` · `#5F4522` · `#F6CC9A` | R2+R4 · H 72.0 held, lifted to L .760 — amber loses chroma fast below it |
| `--danger` / `-050` / `-border` / `-800` | `#C23B41` · `#FBECEC` · `#E7BFC1` · `#8E2A2F` | `#DF6768` · `#4C2625` · `#6F3837` · `#EEB3B0` | R2+R4 · H 22.4 held, lifted **least** (L .660) so terminal red stays the heaviest thing on screen |
| `--destructive` | `var(--danger)` | `var(--danger)` | alias unchanged |
| `--destructive-foreground` | `#FFFFFF` | `#121C27` | R2 |
| `--sidebar` | `#E9EEF4` | `#0B151F` | R1 · darkest surface in the app |
| `--sidebar-foreground` | `#19232E` | `#ECF0F3` | R1 |
| `--sidebar-accent` | `#DCE5EF` | `#202A34` | **R3** |
| `--sidebar-active` | `#2F63A6` | `#6BA0E8` | R2 · = `--primary` |
| `--fam-fulfilment` | `#2E7D5B` | `#5FB28B` | R2 · H 161.9 held |
| `--fam-cancel-request` | `#5D5A93` | `#9896DA` | R2 · H 285.0 held |
| *(reserved)* prescription accent | `#0B7C8C` | `#40B1B7` | R2 · **value only** — 073 still names it (070 §4) |
| `--radius` · `--font-sans` | unchanged | unchanged | — |

### The family-fill question, decided

**Tonal fill, not tinted outline.** 072 spends the button's *fill* as its weight axis: ghost (add-note,
return-document) < family fill < danger fill, with danger-**outlined** as the deliberate override step
below danger-filled. Flipping families to outline on dark collapses four weight tiers into two and makes
Force Cancel indistinguishable from Reschedule at a glance. The tonal fill costs one thing — the label ink
stops being white — and R2 pays that price once, uniformly, for every chromatic fill. Both versions are
rendered in the prototype.

### Contrast proof (measured, WCAG 2.1 relative luminance)

Parity with light was the goal, not merely passing:

| Pair | Light | Dark | Need |
|---|---|---|---|
| `--foreground` on `--card` | 15.89 | 13.37 | 4.5 |
| `--foreground` on `--background` | 14.78 | 15.01 | 4.5 |
| `--foreground` on `--sidebar` | 13.62 | 16.06 | 4.5 |
| `--muted-foreground` on `--card` *(358 uses)* | 5.89 | 6.16 | 4.5 |
| `--muted-foreground` on `--muted` | 5.23 | 5.32 | 4.5 |
| `--ink-3` on `--card` | 3.14 | 3.91 | 3 |
| `--primary` as text on `--card` | 6.08 | 5.70 | 4.5 |
| ink on `--primary` fill | 6.08 | 6.40 | 4.5 |
| `--primary` fill / `--ring` vs `--background` | 5.65 | 6.40 | 3 |
| ink on `--secondary` fill | 5.89 | 4.93 | 4.5 |
| ink on `--secondary-press` | 7.61 | 6.21 | 4.5 |
| ink on `--success` fill | 4.54 | 6.77 | 4.5 |
| ink on `--danger` fill | 5.26 | 5.14 | 4.5 |
| ink on `--fam-fulfilment` fill | 5.00 | 6.74 | 4.5 |
| ink on `--fam-cancel-request` fill | 6.27 | 6.31 | 4.5 |
| `--success-800` on `--success-050` | 6.77 | 8.08 | 4.5 |
| `--attention-800` on `--attention-050` | 5.91 | 8.50 | 4.5 |
| `--danger-800` on `--danger-050` | 7.26 | 7.27 | 4.5 |
| `--primary-800` on `--primary-050` | 6.72 | 8.01 | 4.5 |
| *rejected:* white ink on dark `--primary` / `--fam-fulfilment` | — | **2.34 / 2.23** | 4.5 |

**Surface separations** — WCAG ratios are meaningless between two near-identical grounds, so ΔL is the
honest metric, with light as the yardstick: page↔card `.025 · 1.08` light vs `.042 · 1.12` dark;
card-2↔card `.012 · 1.04` vs `.020 · 1.06`; border/border-strong/divider ΔL **copied exactly**;
`--primary-050`↔`--card` `.050 · 1.16` vs `.057 · 1.21`; and the hardest case, a pill on 073's rail
(`--primary-050`↔`--card-2`), `.038 · 1.12` light vs `.077 · 1.29` dark. Dark separates at least as well
as light everywhere, and better in five of eight pairs.

### One finding handed back — the LIGHT `--attention` fill fails AA

White on `#B4791F` is **3.69:1**, and no ink rescues it: `--foreground` 4.31, `--attention-800` 1.82. The
hue sits at the luminance where nothing clears 4.5. **Ruling (owner, approved): `--attention` is a pill /
border / icon colour in light, never a filled-button ground.** Latent today — 072 gives attention no
button, and the pill form measures 5.91:1 — so it costs nothing now. Dark is unaffected (lifted fill
`#E4A249` carries dark ink at 7.83). If a later ticket genuinely needs an attention-filled button it needs
a *darker* fill token of its own (`#8E6318` carries white at 5.32:1); it does not get to re-use
`--attention`. Recorded rather than silently patched, because it constrains 070's approved table.

### Handed on

- **074** now has both halves of the palette; `core/theme/ag-grid-theme.ts` carries its own dark mode
  (9 params × 2 modes) and the prototype's `--grid-*` values remain a suggestion, not a decision.
- **077** is unblocked. Its 249 raw occurrences include their own `dark:` twins (≈165 distinct decisions
  after pairing) and now have four families × four tiers in **both** themes to sweep into.
- **075** gains one new fact: al-dawaa navy `#002554` is *darker* than this dark theme's own page
  (`#121C27`), so the navy brand panel disappears into dark mode — a collision in dark as well as light.
