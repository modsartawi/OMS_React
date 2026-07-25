---
type: spec
status: ready
map: 068
---

# 082 — The POS design system

Synthesized from wayfinder map
[068 — POS palette as the app standard + Document Details rework](068-pos-palette-and-document-detail-rework.md),
tickets [069](069-token-surface-inventory.md) · [070](070-pos-token-remap-light.md) ·
[071](071-pos-token-dark-twin.md) · [072](072-command-family-taxonomy.md) ·
[074](074-ag-grid-theme-mapping.md) · [075](075-brand-surfaces-reconciliation.md) ·
[077](077-severity-colour-layer.md).

This is the **first** of the map's two specs. The second — the Document Details rework — consumes
this one and must not start until it has landed (the map's rollout ruling: *palette first, then the
screen*; the screen work must not build against a moving palette).

## Problem Statement

The back office looks like two applications wearing one skin.

Its declared colour system is a warm-neutral palette (issue 464) — twenty-one semantic tokens in
`global.css`, an accent in terracotta, near-blacks at hue 84°. But that system only reaches the
surfaces someone remembered to route through it. Everywhere else, colour was written by hand:

- **The status layer was never tokenised at all.** Success, warning, danger and informational states
  are spelled out as raw Tailwind palette classes at ~230 sites across 41 files — `emerald` 55,
  `amber`/`orange` 75, `red`/`rose` 87, `blue`/`sky` 15. The one tokenised member, `--destructive`,
  is out-voted six to one by raw `red-*`. An operator reading a "needs attention" chip on one screen
  and a different-but-also-amber chip on the next is looking at two independent authorings that
  happen to have converged.
- **Two badge idioms drifted apart.** `bg-<fam>-500/15 text-<fam>-700 dark:text-<fam>-300` at 38
  sites; `bg-<fam>-100 text-<fam>-800 dark:bg-<fam>-500/15 dark:text-<fam>-300` in coupons and
  import. Same meaning, different weight, no way to tell which is correct.
- **Every grid keeps its own copy of the palette.** `core/theme/ag-grid-theme.ts` hand-mirrors twenty
  hex values across light and dark, with a comment instructing the reader to keep them in sync with
  `global.css` by hand. Nothing enforces it; the grid and the app can silently diverge and have no
  way to notice.
- **Brand colour leaked into UI colour.** al-dawaa navy `#002554` grounds the login panel and the
  home hero; gold `#FDC801` inks two kickers as arbitrary-value Tailwind classes.

Layered on top of that, the owner has ruled the warm-neutral system retired outright in favour of
the `Sartawi.POS` `PosTheme.xaml` palette — a cool steel-blue scale from a sibling product. Swapping
the twenty-one token *values* re-tints only what already reads them. Everything above stays warm. The
app would ship with steel-blue neutrals and old-palette status badges on the same screen — visibly
worse than either palette applied consistently.

Three further problems only become visible once the swap is real:

- **PosTheme is light-only.** A till renders one theme; we ship dark mode across ~40 screens. Every
  value needs a dark counterpart that does not exist upstream, derived by a rule rather than by taste.
- **al-dawaa navy is darker than the new dark theme's own page.** The navy panel doesn't merely
  clash in dark — it dissolves, taking the login composition's figure/ground with it.
- **The POS reference colours buttons by function family**, a concept our action bars don't have.
  Adopting the look without the taxonomy produces decorative colour, which is the thing this spec
  exists to remove.

## Solution

One colour system, declared once, that every surface reads — including the ones that don't speak
Tailwind.

**The token layer becomes the only place a colour is written.** Forty-five tokens in `global.css`
(twenty-one existing names keeping their roles and changing their values, plus twenty-four additions),
in **hex**, with a full light table and a dark twin derived by a stated rule. Because every existing
token is consumed as a Tailwind utility and the whole repo contains exactly one `var()` read, this
half of the work requires **zero `.tsx` edits** — 126 `--primary` call sites, 358
`--muted-foreground` call sites and 218 `--border` call sites re-tint by changing one line each in a
stylesheet.

**The severity layer gets tokens and one idiom.** Four families — `success`, `attention`, `danger`,
and `primary` serving as the informational fourth — each with four tiers: base fill, `-050` ground,
`-border`, `-800` ink. Because the dark twin's rule makes `-050`/`-800` *roles* rather than lightness
levels, one class string is correct in both themes and **every `dark:` variant in the sweep is
deleted rather than translated**. The two drifted idioms collapse into `bg-<fam>-050
text-<fam>-800`, and the badge itself graduates into a shared `core/ui` component so the idiom exists
in one place.

**Colour means something or it isn't spent.** Hue is reserved for severity and for the two command
families. Sites that were using hue as an identity distinguisher — which session channel, which promo
kind, which condition origin — go neutral, because a POS session is not "success" and a fixed-amount
promo does not "need a human". Brand gold and navy retreat into the logo SVG and are not reachable
from `src/` at all.

**The grid stops keeping its own copy.** AG Grid v36's serializer passes string params through
verbatim and derives every colour in CSS `color-mix`, so the theme reads `var(--card)` directly. The
two hand-mirrored hex blocks collapse into one params block that re-tints automatically — for this
palette move and every future one.

**Three static gates keep it that way.** After this spec lands, `src/` contains no colour literal of
any kind outside `global.css` and the logo SVG, and `npm run lint` proves it on every run.

The user-visible result: one consistent steel-blue system, light and dark, with status colour that
means the same thing on every screen — and a codebase where the next palette decision is one file.

## User Stories

1. As a back-office operator, I want every screen to use the same colour system, so that a status
   chip means the same thing on Deliveries as it does on Coupons.
2. As an operator, I want the "needs attention" amber on one screen to be byte-identical to the
   "needs attention" amber on the next, so that I learn the colour language once.
3. As an operator, I want the app's neutrals to be a single consistent temperature, so that no screen
   reads as belonging to an older version of the product.
4. As an operator working in dark mode, I want every surface, badge, grid and button to be as
   readable as its light counterpart, so that dark mode is a genuine choice rather than a degraded one.
5. As an operator with low vision, I want every text-on-surface and text-on-fill pair to clear WCAG
   AA, so that I can read the app without increasing contrast at the OS level.
6. As an operator, I want status colour to never be the *only* channel carrying a meaning, so that I
   can still work if I can't distinguish two hues.
7. As an operator, I want a data grid to look like part of the application rather than an embedded
   third-party widget, so that the header, borders and hover states match the page around them.
8. As an operator, I want a grid row I've selected to be unmistakable at a glance, so that I don't
   act on the wrong document.
9. As an operator, I want hovering a grid row to feel like the row lifting toward me rather than a
   hole opening in the page, so that scanning a 41-column table is comfortable.
10. As an operator, I want figures in a numeric column to align digit-for-digit, so that I can compare
    magnitudes by eye without reading each number.
11. As an operator, I want the totals footer of a grid to read as a summary rather than as another
    data row, so that I don't mistake it for a record.
12. As an operator, I want the sidebar to stay a quiet rail rather than becoming a second dark band,
    so that nothing competes with the screen I'm actually working in.
13. As an operator, I want a hover state to move toward me in both themes, so that interaction
    feedback doesn't invert when I switch theme.
14. As an operator, I want the focus ring to remain visible when I tab onto a filled primary button,
    so that keyboard navigation never loses its position.
15. As an operator, I want disabled controls to keep reading as disabled after the palette change, so
    that I don't try to click something inert.
16. As an operator arriving at the login screen, I want it to still feel like a deliberate brand
    moment, so that the product's first impression survives the restyle.
17. As an operator, I want the login panel to remain a distinct slab in dark mode, so that the
    composition doesn't dissolve into the page at night.
18. As an operator, I want the al-dawaa mark itself to keep its own colours, so that the company's
    identity is unchanged even though the app's chrome is not.
19. As an operator, I want the post-login home page to read as a tool rather than as a marketing
    surface, so that I start working instead of reading a banner.
20. As an operator, I want never to see two different golds on one screen, so that nothing reads as a
    rendering mistake.
21. As an operator, I want a QR code to render on a white ground in both themes, so that my phone can
    always scan it.
22. As an operator, I want a modal scrim to stay a neutral dim in both themes, so that the dialog
    above it is what my eye goes to.
23. As an operator scanning a list of sessions, I want the channel of each session to be readable from
    its label, so that I'm not asked to memorise which hue means "mobile".
24. As an operator, I want colour in this app to be reserved for things that are good, bad, or need
    me, so that when something *is* coloured I look at it.
25. As an operator, I want a failed outbox row in a grid to be unmistakably failed in both themes, so
    that triage doesn't depend on which theme I happen to be in.
26. As an operator, I want the terminal actions on a document to read as heavier than the reversible
    ones, so that I can tell "this ends the order" from "this moves the order" without reading.
27. As an operator, I want commands that change *when* or *where* an order is served to share a
    colour, so that I can find them as a group.
28. As an operator, I want asking to cancel and withdrawing that ask to look like a pair, so that I
    understand one undoes the other.
29. As an operator, I want low-stakes commands like adding a note to be visually quiet, so that
    attention is spent on the commands that matter.
30. As an operator, I want the same command to be the same colour every time I visit a document, so
    that colour is something I can learn rather than something I have to re-read.
31. As an Arabic-reading operator (future), I want the grid's selected-row marker to appear on the
    correct edge, so that the mirrored layout doesn't leave a stray bar on the wrong side.
32. As a developer, I want a single place where every colour in the application is declared, so that
    the next palette decision is one file rather than forty-one.
33. As a developer, I want the grid theme to read the same tokens as the rest of the app, so that
    the grid and the page cannot silently diverge again.
34. As a developer, I want to write a status badge without choosing between two idioms, so that a new
    screen is consistent by construction rather than by review.
35. As a developer, I want a status badge to take a severity rather than a class string, so that a
    feature's lookup table expresses meaning instead of styling.
36. As a developer, I want the severity vocabulary in code to be the same five words the design
    decisions use, so that a ticket and a type declaration can't drift apart.
37. As a developer, I want `npm run lint` to fail if I reintroduce a raw palette class, so that the
    sweep can't quietly unravel one commit at a time.
38. As a developer, I want `npm run lint` to fail if I nudge a token value below AA, so that the
    contrast table is enforced rather than merely documented.
39. As a developer, I want the dark theme to be derived from a stated rule, so that adding a token
    later is a derivation rather than a guess.
40. As a developer, I want token values to be byte-comparable with the upstream `PosTheme.xaml`, so
    that I can verify a value rather than trust a conversion.
41. As a developer, I want `-050` and `-800` to mean the same thing in both themes, so that I never
    write a `dark:` variant for a status badge again.
42. As a developer, I want to know that a filled chromatic control carries dark ink in dark mode, so
    that I don't ship `text-white` on a tonal fill.
43. As a developer, I want the two `cellStyle` hex overrides to become tokens, so that the last places
    the grid bypasses the theme are closed.
44. As a developer adding a new screen, I want a stated rule for when a new family colour may be
    minted, so that the token set doesn't grow by precedent.
45. As a developer, I want a comment that misdescribes where AG Grid reads its theme mode to be
    corrected, so that a future reader doesn't "fix" a working line.
46. As a developer, I want the grid's RTL flag to have one declared home, so that six of seven grids
    don't stay silently un-mirrored.
47. As a reviewer, I want the palette sweep to arrive as one reviewable pass, so that I never have to
    judge whether a half-swept screen is intentional.
48. As a reviewer, I want dead tokens revived into real roles rather than left declared-and-unused, so
    that the token list describes the app.

## Implementation Decisions

### D-1 · The token layer is the single source of colour; hex, not oklch

All colour is declared in `global.css` under `:root` and `.dark`, and consumed as Tailwind utilities
through `@theme inline`. Values are **hex**, replacing today's `oklch()`, for three reasons: they stay
byte-verifiable against `PosTheme.xaml`; the AG Grid theme is already a hex file so one notation
covers both; and Tailwind 4 resolves alpha utilities (`bg-primary/10`) through `color-mix` identically
for either notation, so no existing utility changes behaviour. The dark twin is *derived* in oklch
space but *emitted* as hex.

### D-2 · The light table (070, approved)

Twenty-one tokens become forty-three; 075 adds two more for forty-five total (D-9). Nineteen originals
keep name and role and change only value. `--secondary` / `--secondary-foreground`, both dead at zero
uses, flip role to carry the POS neutral button.

| Token | Light | Source | Note |
|---|---|---|---|
| `--background` | `#F4F7FA` | POS `--surface` | 46 uses |
| `--foreground` | `#19232E` | POS `--ink` | 26 uses |
| `--card` | `#FFFFFF` | POS `--panel` | 59 uses; value unchanged, contrast changes |
| `--card-foreground` | `#19232E` | POS `--ink` | tracks `--foreground` |
| `--card-2` | `#FAFBFC` | POS `--panel-2` | **new** — second panel tier, grid hover |
| `--muted` | `#EEF2F6` | POS | 75 uses |
| `--muted-foreground` | `#586674` | POS `--ink-2` | **358 uses — the most-felt swap** |
| `--ink-3` | `#8593A1` | POS `--ink-3` | **new** — replaces the `text-muted-foreground/60` idiom |
| `--accent` | `#E4EAF1` | derived | 34 uses, a *hover ground*. POS's `--accent` name is **not** carried across — theirs is the primary action |
| `--accent-foreground` | `#19232E` | = `--foreground` | declared partner of `bg-accent` |
| `--border` | `#E3E9F0` | POS `--border` | **218 uses** |
| `--border-strong` | `#CBD6E2` | POS `--border-strong` | **new** — table-head rule, action-bar rule |
| `--divider` | `#EDF1F5` | POS `--divider` | **new** — row rules inside a table |
| `--input` | `#CBD6E2` | POS `--border-strong` | 45 uses; fields read stronger than card edges |
| `--ring` | `#2F63A6` | = `--primary` | 15 uses + the repo's one `var()` read; terracotta retired |
| `--primary` | `#2F63A6` | POS `--accent` | **126 uses** |
| `--primary-050` | `#E9EFF7` | POS `--accent-050` | **new** — selection ground, tint badges, info |
| `--primary-border` | `#C6D6EC` | POS `.pill.go` | **new** — completes the fourth severity family |
| `--primary-800` | `#27538C` | POS `--accent-700` | **new** — press state *and* ink on `-050` |
| `--primary-foreground` | `#FFFFFF` | POS `--on` | 15 uses |
| `--secondary` | `#586674` | POS `--key` | revived — the neutral filled button |
| `--secondary-press` | `#495562` | POS `--key-press` | **new** |
| `--secondary-foreground` | `#FFFFFF` | POS `--on` | flips meaning with `--secondary` |
| `--success` `-050` `-border` `-800` | `#1E874B` · `#E7F3EC` · `#BFE0CD` · `#155F36` | POS + `.pill.ok` | **new family** |
| `--attention` `-050` `-border` `-800` | `#B4791F` · `#F8F0DE` · `#E7D3A3` · `#7C5410` | POS + `.pill.warn` | **new family** |
| `--danger` `-050` `-border` `-800` | `#C23B41` · `#FBECEC` · `#E7BFC1` · `#8E2A2F` | POS | **new family**; `-800` is the Force-Cancel ink |
| `--destructive` | `var(--danger)` | alias | **compatibility alias** — 14 call sites untouched |
| `--destructive-foreground` | `#FFFFFF` | POS `--on` | |
| `--sidebar` | `#E9EEF4` | derived | light rail |
| `--sidebar-foreground` | `#19232E` | derived | |
| `--sidebar-accent` | `#DCE5EF` | derived | active/hover ground |
| `--sidebar-active` | `#2F63A6` | = `--primary` | was terracotta |
| `--fam-fulfilment` | `#2E7D5B` | POS `--fam-fulfil` | reschedule · change-store |
| `--fam-cancel-request` | `#5D5A93` | POS `--fam-admin` | request-close · withdraw |
| `--prescription` `-050` `-800` | `#0B7C8C` · `#E3F0F2` · `#085C68` | POS `--fam-insurance` | named by 073; a **marker**, never a control — declared here, consumed by the Details spec |
| `--radius` | `0.625rem` | unchanged | 185 `rounded-*` keep their geometry |
| `--font-sans` | Inter / Readex Pro | unchanged | POS is WPF; no web font contract |

**`--primary` maps to POS `--accent`, not POS `--key`.** POS `--key` `#586674` is the *same value* as
`--ink-2`, which becomes our 358-use `--muted-foreground`; mapping `--primary` there would paint every
default button the exact colour of dim body text. All 126 `--primary` call sites are actions or
accents — filled buttons, active-tab text, selected-row borders, tint grounds — and not one is body
ink. POS `--key` still gets a home: the revived `--secondary`.

**Three POS tokens deliberately not adopted:** `--disabled` / `-ink` / `-border` (we express disabled
as `disabled:opacity-45`; adopting them means rewriting every disabled control for no gain) and
`--on-sub` (= `text-primary-foreground/80`, two sites).

**The sidebar is a light rail.** A dark steel band was rendered and rejected: it competes with the
document identity header the Details spec introduces, and two dark bands meeting at a corner stops
either being special.

### D-3 · The dark derivation rule (071, approved)

The rule is the deliverable; the values follow from it.

- **R1 — dark keeps our proven lightness ladder and borrows only POS's temperature.** Every neutral
  holds the *lightness* of the dark theme shipping today (page L .224, card .265, muted .307, rail
  .191 — levels validated across ~40 screens) and takes hue and chroma from the POS scale (H ≈ 250°,
  chroma on PosTheme's own C-vs-L curve). Warm near-blacks become cool near-blacks; nothing else moves.
  *Rejected: reflecting the light ladder about L = 0.5* — it puts `--card` below the page, inverting
  the elevation language on every screen, and compresses seven surfaces into L 0.00–0.08 where our own
  shipped theme is the evidence that steps that small disappear.
- **R2 — chromatics lift to the L .66–.76 band, hold hue, and flip their ink.** Mid-tone fills built
  to carry white text on white panels vanish on a near-black card. Each holds its POS hue exactly and
  its chroma within ±.02, and rises into the band. **Consequence, stated once: in dark, every filled
  chromatic control is a light tonal fill with dark ink.** White on the lifted fills measures
  2.23–2.34:1; there is no version of this where dark keeps white-on-colour.
- **R3 — interaction moves toward contrast with the page, not toward black.** `--accent` (hover) and
  `--secondary-press` sit *below* their base in light and *above* it in dark.
- **R4 — `-050` and `-800` are roles, not lightness levels.** `-050` = "the quiet ground of this
  family"; `-800` = "ink on that ground". Absolute lightness swaps in dark: `-050` becomes a tinted
  near-black (L ≈ .32, C ≈ .05 — roughly 4× the light tint's chroma, because a near-black needs far
  more chroma to read as tinted at all), `-800` becomes a light tint (L ≈ .82–.87). **This is the rule
  that makes one class string correct in both themes** and is the mechanism behind D-6's `dark:`
  collapse.

Dark surface steps run ~1.7× the light steps deliberately: a near-black step is eaten by panel gamma,
ambient reflection and OLED crush in a way a near-white step is not. The shipped dark theme already
encodes that correction and R1 inherits it rather than re-deriving it.

### D-4 · The dark table (071, approved)

| Token | Light | **Dark** | Rule |
|---|---|---|---|
| `--background` | `#F4F7FA` | `#121C27` | R1 |
| `--foreground` | `#19232E` | `#ECF0F3` | R1 — off-white; pure white haloes on a dark panel |
| `--card` | `#FFFFFF` | `#1C2631` | R1 |
| `--card-foreground` | `#19232E` | `#ECF0F3` | R1 |
| `--card-2` | `#FAFBFC` | `#17212C` | R1 |
| `--muted` | `#EEF2F6` | `#27313A` | R1 |
| `--muted-foreground` | `#586674` | `#98A6B4` | R1 |
| `--ink-3` | `#8593A1` | `#76828E` | R1 — tertiary, sub-AA by design in both |
| `--accent` | `#E4EAF1` | `#323C46` | **R3** |
| `--accent-foreground` | `#19232E` | `#ECF0F3` | R1 |
| `--border` | `#E3E9F0` | `#2E3742` | R1 — ΔL .069 from card in **both** themes; retires an alpha value |
| `--border-strong` | `#CBD6E2` | `#3B4755` | R1 — ΔL .129 in both |
| `--divider` | `#EDF1F5` | `#28313B` | R1 — ΔL .044 in both |
| `--input` | `#CBD6E2` | `#3B4755` | R1 — retires an alpha value |
| `--ring` | `#2F63A6` | `#6BA0E8` | R2 |
| `--primary` | `#2F63A6` | `#6BA0E8` | R2 — L .498 → .700, H 256 held |
| `--primary-050` | `#E9EFF7` | `#22344B` | R4 |
| `--primary-border` | `#C6D6EC` | `#364C68` | R4 |
| `--primary-800` | `#27538C` | `#B5D0F5` | R4 |
| `--primary-foreground` | `#FFFFFF` | `#121C27` | **R2 consequence** |
| `--secondary` | `#586674` | `#7D8B99` | R2 — L .630 is exactly where `--background` ink clears AA |
| `--secondary-press` | `#495562` | `#8F9DAB` | **R3** |
| `--secondary-foreground` | `#FFFFFF` | `#121C27` | R2 |
| `--success` `-050` `-border` `-800` | `#1E874B` · `#E7F3EC` · `#BFE0CD` · `#155F36` | `#55B577` · `#1E3A27` · `#2E543A` · `#ABDCB8` | R2+R4, H 152.8 held |
| `--attention` `-050` `-border` `-800` | `#B4791F` · `#F8F0DE` · `#E7D3A3` · `#7C5410` | `#E4A249` · `#422F15` · `#5F4522` · `#F6CC9A` | R2+R4, H 72.0 held, lifted to L .760 |
| `--danger` `-050` `-border` `-800` | `#C23B41` · `#FBECEC` · `#E7BFC1` · `#8E2A2F` | `#DF6768` · `#4C2625` · `#6F3837` · `#EEB3B0` | R2+R4, H 22.4 held, lifted **least** (L .660) so terminal red stays heaviest |
| `--destructive` | `var(--danger)` | `var(--danger)` | alias unchanged |
| `--destructive-foreground` | `#FFFFFF` | `#121C27` | R2 |
| `--sidebar` | `#E9EEF4` | `#0B151F` | R1 — darkest surface in the app |
| `--sidebar-foreground` | `#19232E` | `#ECF0F3` | R1 |
| `--sidebar-accent` | `#DCE5EF` | `#202A34` | **R3** |
| `--sidebar-active` | `#2F63A6` | `#6BA0E8` | R2 |
| `--fam-fulfilment` | `#2E7D5B` | `#5FB28B` | R2, H 161.9 held |
| `--fam-cancel-request` | `#5D5A93` | `#9896DA` | R2, H 285.0 held |
| `--prescription` `-050` `-800` | `#0B7C8C` · `#E3F0F2` · `#085C68` | `#40B1B7` · *(R4)* · *(R4)* | R2+R4 |

**One constraint carried back into the light table: `--attention` `#B4791F` must never be a
filled-button ground in light.** White measures 3.69:1 on it, `--foreground` 4.31,
`--attention-800` 1.82 — the hue sits at the luminance where no ink clears AA. It is a pill / border /
icon / dot colour only; the pill form measures 5.91:1 and a dot carries no ink at all. Dark is
unaffected (the lifted `#E4A249` carries dark ink at 7.83). A future attention-filled button needs a
darker fill token of its own (`#8E6318`, white at 5.32:1); it does not get to re-use `--attention`.

**Family buttons keep their fill in dark; they do not flip to tinted outline.** D-8 spends the
button's fill as its weight axis, and flipping families to outline collapses four weight tiers into
two. The tonal fill costs one thing — the label ink stops being white — and R2 pays that price once,
uniformly, for every chromatic fill.

### D-5 · Severity is four families; there is no `--info` token

POS declares no info hue, and now that `--primary` *is* steel blue, an info token would be a second
blue three shades from the first — two tokens the eye can't tell apart and the reader can't choose
between. The 15 raw `blue`/`sky` sites sweep into `--primary` / `--primary-050` / `--primary-border` /
`--primary-800`, which carries the same four tiers precisely so it can serve as the fourth family.

The severity vocabulary is five words, fixed by the Details spec's status work and used identically
here: **`ok`** = complete and went well · **`go`** = actively in motion · **`warn`** = needs a human ·
**`bad`** = ended badly, terminally · **`mute`** = not recognised / neutral.

| Severity | Family | Badge classes |
|---|---|---|
| `ok` | `--success` | `bg-success-050 text-success-800` |
| `go` | `--primary` | `bg-primary-050 text-primary-800` |
| `warn` | `--attention` | `bg-attention-050 text-attention-800` |
| `bad` | `--danger` | `bg-danger-050 text-danger-800` |
| `mute` | neutral | `bg-muted text-muted-foreground` |

### D-6 · One idiom, and the `dark:` collapse

The two drifted badge idioms both reduce to a single class string with **no `dark:` variant at all**.
This is derived from R4, not chosen: `-050` and `-800` swap absolute lightness between themes while
keeping their roles, so `bg-danger-050 text-danger-800` means the same thing in both. The **82 `dark:`
twins** in the inventory are deleted rather than translated, and the ~249 raw occurrences and the ~165
distinct decisions converge.

Four shapes exist beyond the badge. The complete substitution table for the sweep:

| Shape | Sites | Today | Becomes |
|---|---:|---|---|
| Tint badge | ~44 | `bg-<f>-500/15 text-<f>-700 dark:text-<f>-300` · `bg-<f>-100 text-<f>-800 dark:…` | `bg-<f>-050 text-<f>-800` |
| Bare ink | ~35 | `text-<f>-600 dark:text-<f>-400` | `text-<f>-800` |
| Callout / banner | ~10 | `border-<f>-500/30 bg-<f>-500/5 text-<f>-800 dark:…` | `border-<f>-border bg-<f>-050 text-<f>-800` |
| Filled chip / button | 2 | `bg-<f>-700 text-white` | `bg-<f> text-primary-foreground` |
| Bare fill — dot, bar, meter | 6 | `bg-<f>-500` | `bg-<f>` |

Every one is a single string valid in both themes. Contrast verified against D-2/D-4: bare ink `-800`
on `--card` / `--background` / `--muted`, all four families, both themes, worst case **5.96:1**
(`--attention-800` on light `--muted`), best 11.48. Bare fill as a non-text graphic (needs 3:1): worst
case **3.43:1** (light `--attention` on `--background`). Tint badge: 5.91–8.50.

**`@theme inline` gains sixteen bridge lines** — `--color-<fam>`, `--color-<fam>-050`,
`--color-<fam>-border`, `--color-<fam>-800` for `success` · `attention` · `danger`, plus the three new
tiers for `primary` (`--color-primary` already exists). Without them `bg-success-050` does not
compile; declaring the tokens in `:root` is not sufficient. The same applies to every other new token
in D-2 that is consumed as a utility (`--card-2`, `--ink-3`, `--border-strong`, `--divider`, the two
`--fam-*`, `--prescription*`, `--secondary-press`, and D-9's brand pair).

### D-7 · Hue is reserved for severity; categorical colour goes neutral

Eleven sites spend hue as an **identity distinguisher** with no severity meaning, and three of them
sit inside lookup maps the inventory nominated as the sweep's efficient core:

| Map | Keys | What hue meant |
|---|---|---|
| `admin/active-sessions` — channel tone | web · mobile · backoffice · pos | which channel |
| `pricing/simulation` — promo-kind class | free · percent · fixed · setprice | which promo kind |
| `pricing/simulation` — condition-card badge tone | promotion · manual · header | where the condition came from |

**All eleven become `bg-muted text-muted-foreground`.** Safe at every one: all three maps already
render a text label beside the chip, so colour was never the only channel. Consequence for the build:
because every key resolves to the same string, **all three maps become dead code and are deleted**,
their call sites taking a constant. This also removes one half-tokenised outlier without a separate
decision.

Of the inventory's "four small status-lookup maps holding ~49 hits", **only two are severity** — the
ua-admin password-state tone map and the BBY-inquiry status tone map — and both convert to
value → severity under D-10.

### D-8 · The command-family colour taxonomy

Colour on a command bar carries **function, not stakes**. Stakes are carried by the tiers the grammar
already provides (escape at the start, quiet in the clusters, terminal at the end). A stakes-coloured
bar is three reds shouting at once and — worse — a button's colour would change between visits as
document state moves; a token that shifts meaning per row is not a design system.

| Family | Token | Value | Members | Rationale |
|---|---|---|---|---|
| **Fulfilment** | `--fam-fulfilment` | `#2E7D5B` | reschedule · change-store | Changes **when** or **where** the order is served without touching whether it lives. Fully reversible; the only family whose members keep the order alive. |
| **Cancellation request** | `--fam-cancel-request` | `#5D5A93` | request-close · withdraw-request | The round-trip *about* cancelling. Neither cancels anything itself and each undoes the other. Indigo, not red: **asking is not doing.** |
| **Quiet** | *none* — ghost | outlined, `--muted-foreground` on `--border-strong` | add-note · return-document | Frequent and low-consequence. Colour here would spend attention on the two commands that need none. |
| **Terminal end** | `--danger` filled + `--danger` outlined | `#C23B41`, override ink `--danger-800` | cancel-order · force-cancel | **Not a family — a tier.** Both destructive, so both red; the override separates by *weight*, not by a second louder red. |

**`--success` earns no button anywhere in the app.** "Close" on a delivery document means *cancel*, so
none of the eight document commands is a positive outcome — orders complete in the field, never from
this screen. There is no green commit slot. `--success` appears in status displays only.

**Three POS families deliberately not ported:** `--fam-sales`, `--fam-loyalty`, `--fam-admin` — a back
office sells nothing, runs no loyalty tier, and "admin" names a nav area rather than a command family.

**Extension rule (this is what stops the token set growing by precedent):** other screens inherit the
*grammar* — escape at the start, quiet tier, terminal end — but **no family colour**. A new family
colour is minted only when a screen has **two or more commands sharing a purpose**.

### D-9 · Brand surfaces: gold and navy are the mark's colours, not the app's

> `#FDC801` and `#002554` appear in exactly one place — inside the al-dawaa SVG, rendered through
> `BrandMark`. Neither hex may appear as a ground, ink, border, or Tailwind arbitrary value anywhere
> in `src/`. Brand identity on a surface is carried by **the mark plus the wordmark**, never by a
> brand-coloured field.

That is the whole ruling; every per-surface answer is a consequence, so no "exception" is left
standing that a later change could widen.

**Two new tokens, and they are the only pair declared *outside* the `.dark` block with no dark
counterpart** — that structural oddity is the enforcement mechanism:

| Token | Value (both themes) | Note |
|---|---|---|
| `--brand-panel` | `#202A34` | Deep steel. Sits at the navy's own darkness (navy L ≈ .245, this L .280) but near-neutral instead of saturated, so the login composition's weight survives the hue swap. |
| `--brand-panel-foreground` | `#FFFFFF` | Fixed. **Cannot** be `--primary-foreground`, which flips to `#121C27` in dark under R2 and would invert the panel's ink. |

In light, L .280 against the sign-in half's L .975 — a dramatic dark slab, which is what the navy did.
In dark, against `--background` L .222 ⇒ **ΔL +.058**, a *raised slab* rather than a dissolve; that
separation sits between two the dark table already ships (`--card` vs `--background` +.042 and
`--sidebar-accent` vs `--sidebar` +.089).

`--brand-panel` shares its hex with dark `--sidebar-accent` and is **deliberately not aliased** — a
future move of the sidebar hover ground must not drag the login panel with it.

**Amended by [107](107-identity-band-dark-separation.md) — the tokens stand, the consumers carry a
hairline.** The ΔL +.058 above was sized for the login Editorial Split, where the panel is one half of
a two-half composition and the light sign-in ground beside it defines the slab. Ticket 091 made
`--brand-panel` the ground of a **full-width page header** (083 D-2) with nothing beside it, where the
same step reads as a faint raise: 13.54:1 against the light page, 1.18:1 against the dark one, and the
band was the page's only slab with no `--border` hairline. The resolution is a border on **that
consumer**, not a dark twin: the pair stays the only one declared outside the `.dark` block with no
counterpart, which is the enforcement mechanism this section names. A future `--brand-panel` consumer
that is a whole surface rather than half a composition should draw the hairline too.

| Surface | Ruling |
|---|---|
| Login (Editorial Split) | Composition intact — bled watermark, lockup, kicker, tagline, desktop-only half. Ground → `--brand-panel`; ink → `--brand-panel-foreground` (and `/70` for the muted line); the gold kicker loses its gold. The watermark and lockup marks stay gold — that is where brand colour lives now. |
| Home hero | Post-auth is **tool**. Brand ground dropped entirely: `--card` ground, `--border` edge, hierarchy from type scale and padding. The 360px watermark is dropped (at 10% opacity on a light card it is a pale gold wash — brand colour as decoration); the 44px lockup stays. Gold kicker retired. |
| `BrandMark` component | Unchanged — colour-agnostic by construction. |
| al-dawaa SVG | Unchanged. The company's colours are the company's. |
| Sidebar / topbar | No gold underline, no navy plate, no brand-tinted rail header. The mark carries the brand unaided. |

*Considered and rejected for the home hero:* a `--primary-050` tinted band (blunts a token doing
semantic work) and `--card-2` (at L .988 vs `--background` .975 it would be invisible in light).

**Gold is not reachable.** `--attention` `#B4791F` stays exactly as D-2 sets it and the dark twin is
untouched — both tables stay closed. Deleting the two gold kickers has a bonus: they are the only two
arbitrary-value colour classes in the entire app, so afterwards the codebase has zero hardcoded colour
hexes in `.tsx`, which is what makes D-12's gate unambiguous.

**One stale key found and deleted:** `auth.json`'s `subtitle: "OMS Portal"` — the retired product
name, no longer rendered by any component.

### D-10 · `core/ui/StatusBadge` and `core/ui/severity`

The ua-admin helpers module already exports a tone map keyed `ok | warn | bad | muted` — the severity
vocabulary, arrived at independently, minus a letter. Two features already share the shape, so under
[feature-structure](../.claude/rules/feature-structure.md) it **graduates up to `core/`** rather than
being copied a third time.

- **`core/ui/severity.ts`** — `type Severity = 'ok' | 'go' | 'warn' | 'bad' | 'mute'` (D-5's spelling;
  ua-admin's `muted` is renamed to `mute`, and `go` joins even though the pill rail leaves it unowned)
  plus the severity → class-string map per shape.
- **`core/ui/StatusBadge.tsx`** — takes a `Severity` and renders the badge idiom, retiring ~44
  hand-written class strings. **The label is a child, never a key**: the component adds no `t()` call
  and needs no i18n namespace, keeping [zero-literal](../.claude/rules/i18n-zero-literal.md) a caller
  concern.

Feature-side maps become **value → `Severity`**, never value → class string.

**One collision the build must resolve rather than rename around:** the BBY-inquiry columns module
already declares a local `StatusBadge` taking a code and a label. It becomes a thin wrapper —
code → `Severity`, then the core component.

`mute` maps to `bg-muted text-muted-foreground`, which is also where D-7's eleven categorical sites
land, so neutral has exactly one spelling in the app.

### D-11 · The AG Grid theme reads tokens directly

**`var()` works on the installed `ag-grid-community@36.0.1`.** The v36 serializer returns a string
param value verbatim — there is no JS colour parsing to break — and every colour the grid derives is
computed in CSS via `color-mix(in srgb, var(--ag-…), …)`. So `backgroundColor: 'var(--card)'`
composites correctly on every path. The existing comment claiming otherwise is stale.

Because `.dark` already reswitches every token, **one params block serves both themes** and the two
hand-mirrored hex blocks collapse into one. This deletes the twenty mirrored values the inventory
counted as a real cost of the swap, makes the grid re-tint automatically for this palette move **and
any future one**, and removes the grid-vs-app divergence bug rather than re-creating it in new colours.
`data-ag-theme-mode` keeps a single passenger: `browserColorScheme`, which is a literal (native
scrollbars), not a colour, and has no token.

Seventeen params — ten remapped, seven added. Every one verified present in the 36.0.1 bundle by name.

| AG param | Paints | Token |
|---|---|---|
| `backgroundColor` | grid body ground | `--card` |
| `foregroundColor` | cell text | `--foreground` |
| `headerBackgroundColor` | header row ground | `--muted` |
| `headerTextColor` | header labels | `--muted-foreground` |
| `borderColor` | default for every border | `--border` |
| `rowHoverColor` | hover overlay | `--card-2` ¹ |
| `selectedRowBackgroundColor` | selection overlay | `--primary-050` |
| `accentColor` | focus ring, checkboxes | `--primary` |
| `oddRowBackgroundColor` | zebra — off | `--card` |
| `browserColorScheme` | native scrollbars | *literal* `light`/`dark` |
| **`rowBorder`** | rules between rows | `--divider` |
| **`headerRowBorder`** | rule under the header | `--border-strong` |
| **`pinnedRowBackgroundColor`** | totals footer ground | `--muted` |
| **`pinnedRowTextColor`** | totals footer ink | `--foreground` |
| **`pinnedRowBorder`** | rule above the footer | `--border-strong` |
| **`inputBorder`** / `inputBackgroundColor` | filter inputs in the grid | `--input` / `--card` |
| **`invalidColor`** | validation | `--danger` |
| `wrapperBorderRadius` · `spacing` · `fontSize` · `fontFamily` · `headerFontSize` · `headerFontWeight` | density | **unchanged** |

¹ **`rowHoverColor` reads `--card-2`, not `--background`.** On a `--card` white grid inside a
`--background` page, hovering to the page colour reads as a hole rather than a highlight — and in dark
it inverts, because page is *darker* than card, so the hover would move down. `--card-2` moves the
correct direction in both themes by construction.

**Deliberately not set**, named so they aren't discovered as fallout: `columnBorder` /
`headerColumnBorder` (Quartz's default of no vertical rules already matches both the POS reference and
today's grids); the chrome family (`chromeBackgroundColor`, `menuBackgroundColor`,
`tabBackgroundColor`, `sideBarBackgroundColor`, `button*`), which derives acceptably; and
`rangeSelection*`, which is Enterprise.

**Three treatments settled, two of which need no work:**

1. **`tabular-nums` is already done by the grid.** The bundle ships
   `.ag-right-aligned-cell{font-variant-numeric:tabular-nums}`, and the shared column kit's money and
   number builders already set `type:'numericColumn'`, which applies that class. Every numeric column
   in the app already has tabular figures. No param, no CSS.
2. **Zebra stays off** — and for a better reason than restyle inertia. `rowBorder` on `--divider`
   draws a hairline under every row, which is the job banding does, done once and more quietly; both
   is belt and braces on a 41-column screen. The mechanical catch if this is ever revisited:
   **`--card-2` is already spent on `rowHoverColor`**, so zebra-on makes hover invisible on odd rows
   and costs a second token D-2 has not minted.
3. **The selected-row accent bar is the one genuine CSS escape.** The `--primary-050` ground is
   `selectedRowBackgroundColor`; the 3px inline-start bar has **no param** — AG Grid exposes no per-row
   edge marker. It ships as `.ag-row-selected::after` with `inset-inline-start: 0`, which is verified
   to mirror correctly under `dir="rtl"`. **`::before` is unavailable** — AG paints its own
   selection/hover overlay there. This is exactly the case
   [logical-tailwind](../.claude/rules/logical-tailwind.md)'s exception clause anticipates: the token
   API has no answer. (Note: a `box-shadow` inset would *not* mirror — `box-shadow` offsets are
   physical and have no logical form.)

**The two `cellStyle` hex overrides** (`#c62828` in the deliveries and document column modules) become
`var(--danger)`, and **the ink flips from `#ffffff` to `var(--primary-foreground)`** — under R2, white
measures 2.2:1 on the dark fill. These are inline styles, so `var()` resolves against `:root`/`.dark`
regardless of how the theme itself is written. The comment documenting a light-mode-only contrast check
must be **rewritten with the pair, not deleted**.

**The dark path needs no second theme object.** `withParams(params, mode)` emits a mode-scoped block
on the same theme. The flip is already correct and stays correct: the theme store toggles `.dark` and
rewrites `agThemeMode` in the same synchronous block, and `index.html` does both pre-paint, so there is
no frame where the app is dark and the grid is light.

**One comment defect to fix:** the theme module's header says AG Grid reads `data-ag-theme-mode` from
`<body>`. Both writers set it on `<html>`. The extracted selector is
`:where(:root[data-ag-theme-mode=…], body[…], .ag-theme-mode[…])` — `:root` **is** `<html>`, so the
**code is right and the comment is wrong**. Worth fixing because the docs describe only the
`.ag-theme-mode` class form, and a reader following them would "fix" a working line.

**`enableRtl` gets a declared home.** It is a **grid option, not a theme param**, so the theme cannot
carry it. It becomes one derived value exported beside the theme object, ready to be spread into every
grid. Today it is set on exactly one of seven call sites and reads a `dir` attribute nothing in the app
ever sets. **This spec only declares its home; wiring the `dir` switch is out of scope.**

### D-12 · Three static gates, wired to `npm run lint`

Following the pattern already established by the import-boundary checker: plain node scripts, no new
runner, failing the existing lint script.

1. **Palette gate.** `\b(bg|text|border|from|to|via)-(red|rose|amber|orange|emerald|green|blue|sky|violet|slate)-`
   over `src/` — zero hits.
2. **Literal gate.** `text-white` — only the login panel's sites survive, and only until D-9 lands,
   after which it is zero. `-\[#` — zero. Combined with D-9, **`src/` then contains no colour literal
   of any kind outside `global.css` and the logo SVG.**
3. **Contrast gate.** Parses the `:root` and `.dark` blocks of `global.css` and asserts D-4's measured
   pairs still clear their threshold (4.5:1 body, 3:1 large/UI/non-text). This is what turns a
   hand-measured table into something that stays true.

**Deliberately outside all three gates** — palette-adjacent values that are not severity and must not
be tokenised: the three `bg-black/50` modal scrims (a scrim is black in both themes by intent), and
the login QR code's `bg-white` quiet zone (a QR needs a white module ground to scan).

### D-13 · Rollout: one mechanical pass, not per-area

The whole substitution lands as a single build ticket across all 41 files. Per-area follow-ups were
considered and rejected: the app would carry steel-blue neutrals against warm badges until the last
area landed, and the substitution table would be re-read four times. D-6's `dark:` collapse makes most
of the diff deletion, which is what makes a single pass reviewable. The three gates in D-12 are the
completion criterion.

## Testing Decisions

**What makes a good test here.** This spec is ~95% declarative CSS and mechanical substitution. There
is almost no logic to exercise, and asserting that a tone map equals a class string tests a constant —
it restates the implementation and fails only when someone deliberately changes it. The two things
that can genuinely go wrong are *a raw palette class survived the sweep* and *a token value was nudged
below AA*, and neither is caught by a component test. So verification is static analysis over the
source plus driving the real app, and the tests assert **externally observable properties of the
codebase and the rendered screen**, not internals.

**Seams, highest first:**

| Seam | Tier | What it proves |
|---|---|---|
| `tools/check-palette.mjs` | pure, static over `src/` | The sweep is complete and stays complete: no raw palette class, no `text-white` outside the brand panel, no `-[#…]` arbitrary colour. |
| `tools/check-contrast.mjs` | pure, in-memory | D-4's twenty measured pairs still clear AA. Parses `global.css`'s `:root`/`.dark` blocks and recomputes WCAG relative luminance — the token values are the input, so it fails on a value edit, not on a code edit. |
| `npm run typecheck` | compiler | `Severity` is exhaustive: every feature-side value → severity map covers its union, and no call site passes a retired class string. |
| Driving the app | manual, both themes | The part no static check reaches — that the result *looks* right. |

**Both new scripts join `npm run lint`**, which today runs only `tools/check-boundaries.mjs`. That is
the prior art in every respect: a plain node script walking `src/`, reporting `file:line` hits, exiting
non-zero. The palette gate is the same shape with a different regex; the contrast gate is the same
harness with a colour-maths body.

**The contrast gate's assertion list is D-4's table**, transcribed once: foreground on card /
background / sidebar, muted-foreground on card / muted, ink-3 on card (3:1), primary as text and as
fill, ink on secondary / secondary-press / success / danger / both family fills, each `-800` on its own
`-050`, plus D-6's derived pairs (`-800` on card/background/muted, and each base fill against card at
3:1). It must also assert the **negative**: white ink on any dark chromatic fill is *below* AA, which is
what stops someone "fixing" R2 by reverting `--primary-foreground`.

**Driving the app** covers, in both themes: the six grid call sites (Deliveries, Sim results, BBY
Inquiry, and the Document Details detail grids) for header, borders, hover, selection and the pinned
footer; the login Editorial Split for the brand panel's slab separation in dark; the home hero without
its brand ground; the sidebar rail; and at least one screen from each of the three neutralised
categorical maps, to confirm the labels still carry the meaning the colour used to.

**This spec does not bootstrap vitest/RTL.** The runner should be earned by a spec with real logic to
exercise; here it would land on thin material — small lookup functions and a component that renders a
span. `StatusBadge` and `severity.ts` become the natural first subjects **when** the runner arrives on
its own ticket, and the hardening ticket remains the place that happens.

**Prior art:** `tools/check-boundaries.mjs` (static gate wired to `npm run lint`),
`tools/screen1-smoke.mjs` and `tools/bby-inquiry-drive.mjs` (Playwright drives of a real screen — the
model for the manual verification pass, and the place a screenshot-diff check would eventually go).

## Out of Scope

- **The Document Details rework.** Layout, the status pill rail, the rail cards, the action-bar
  arrangement and the live-payload field rules are the map's *second* spec. This one declares the
  tokens that spec consumes (including `--prescription`) and stops there.
- **The POS/WPF side of the rework** (BackOffice map 665 / ticket 668). Different repo, different
  effort; this spec only consumes its palette.
- **Any change to document command behaviour** — endpoints, the actionType matrix, the Change Store
  or Reschedule flows. D-8 is arrangement and colour only. The command *label* renames it depends on
  belong to the Details spec.
- **Sourcing the true command-legality matrix** from the WPF controller or the server. Offered and
  rejected while charting: the client deliberately does not gate on status, and reproducing the
  server's rules here is command behaviour.
- **The RTL `dir` switch.** D-11 gives `enableRtl` a declared home and the selected-row bar is built
  to mirror, but nothing in the app sets `dir` and this spec does not add it. The mirroring fixes and
  bidi isolation belong to the Details spec; Arabic translation content belongs to neither.
- **Arabic font metrics and copy.** The font faces are already declared and unicode-range gated.
- **Bootstrapping vitest / RTL.** See Testing Decisions.
- **A screenshot-diff or visual-regression harness.** Worth having; not what this spec buys.
- **Minting a categorical colour ramp.** D-7 rules identity colour out rather than re-homing it. If a
  screen later has a genuine need for identity hues, that is a new design surface with its own light
  and dark derivation — a fresh effort, not a widening of this one.
- **An attention-filled button.** D-4 forbids re-using `--attention` as a light fill and names the
  value a future one would need (`#8E6318`). Minting it is not this spec's work.
- **Adopting the three unported POS tokens** (`--disabled`/`-ink`/`-border`) or `--on-sub`, and the
  three unported family colours. D-2 and D-8 state why.
- **Density.** Row and header heights are per-grid props and a settled product decision; D-11 changes
  colour params only.

## Further Notes

**Why zero call-site churn is real and not optimistic.** The inventory established that all
twenty-one existing tokens are consumed purely as Tailwind utilities, with exactly one `var()` read in
the entire repo (a `:focus-visible` rule that needs no change). That is what makes D-2 and D-4 a
one-file edit. The 249 raw palette occurrences are a *separate* cost and are D-6/D-13's whole subject
— it is worth keeping the two clearly apart when sizing the work, because the token swap is nearly
free and the sweep is nearly all of it.

**The trap that generalises.** The filled-chromatic-with-white-ink problem R2 creates is small in the
raw palette — the inventory's two badge idioms are both *tint* idioms, structurally safe — but it
hides in **already-tokenised** code. The notification bell's unread count is `bg-ring text-white`,
which never spelled a palette class and so never appeared in the inventory, yet inherits the failure
the moment `--ring` becomes `--primary`. That is why D-12's second gate greps `text-white` and not
`bg-red-`.

**Nine tokens were dead or near-dead** before this work. D-2 rehomes the two that had real roles
available (`--secondary`, `--secondary-foreground`) rather than deleting them, which is why the count
goes 21 → 43 → 45 without the list reading as padded.

**On the AG Grid finding.** D-11's `var()` result is worth more than the copy-paste this was set up
to be. The conservative path — a literal hex table in both modes — is fully derived and available if
the `var()` approach hits something the bundle inspection missed, and reverting to it is mechanical.
The recommendation is to take the `var()` path precisely because it makes the *next* palette decision
a one-file edit too.

**Sequencing within the build.** The tokens (D-2, D-4, D-9) and the `@theme inline` bridge (D-6) must
land before the sweep, or the substituted classes don't compile. The grid theme (D-11) can land with
the tokens. `StatusBadge` (D-10) must exist before the ~44 badge sites can be converted. The gates
(D-12) land last and are the proof the pass is complete — they will fail until it is, which is the
point.

**On the severity vocabulary.** `go` is defined here with no owner on the document pill rail. That is
deliberate rather than speculative: the raw-palette sweep's own informational sites are its
constituency, and dropping it would leave the fourth token family (`--primary`'s four tiers) without a
name in the type. If it turns out to have no consumer after the sweep, removing it is a one-line
change; minting it later is not.
