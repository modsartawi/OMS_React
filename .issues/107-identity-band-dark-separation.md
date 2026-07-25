---
status: open
spec: 082
blocked-by: —
---

# 107 — theIdentityBandReadsAsASlabOnTheDarkPage

## What to build

The identity band is the one surface on Screen 2 that separates from the page by **luminance alone**.
Every other slab on the page — the pill rail, the action bar, the five summary cards — carries a
`border-border/60` hairline; the band carries none, because in light it does not need one.

Measured in the running app (096's acceptance pass, `8000000174`, both themes):

| | ground | vs `--background` |
|---|---|---|
| `--brand-panel` (the band) | `rgb(32,42,52)` | **13.54:1** light · **1.18:1** dark |
| `--card` (every other slab) | `rgb(255,255,255)` / `rgb(26,36,47)` | 1.08:1 light · 1.12:1 dark — **plus a hairline border** |
| `--brand-panel-foreground` (the band's ink) | fixed `#FFFFFF` | 14.56:1 on the band, in both themes |

**The separation itself was already ruled and is not in question.** 082 D-9 sized it deliberately:
*"In dark, against `--background` L .222 ⇒ **ΔL +.058**, a raised slab rather than a dissolve; that
separation sits between two the dark table already ships (`--card` vs `--background` +.042 and
`--sidebar-accent` vs `--sidebar` +.089)."* The measurement above is that ruling, confirmed on screen.

What is **new** since D-9 is the consumer. D-9 reasoned about the **login Editorial Split**, where the
panel is one half of a two-half composition and its counterpart half is the light sign-in ground —
the slab is defined by what sits beside it. Ticket 091 then made `--brand-panel` the ground of a
**full-width page header** with nothing beside it, whose whole job (083 D-2) is to be *"the one dark
band on the page"*. In dark it is a raised slab on a dark page, which is a weaker statement than the
one the screen was designed around, and it is the only borderless slab making it.

So: decide whether a borderless `--brand-panel` header is enough separation in dark, and if not, close
the gap. The options, cheapest first:

1. **Leave it.** D-9 sized this separation on purpose and the band's ink is unambiguous at 14.56:1.
   Record the reasoning on 083 D-2 so the next reader measuring 1.18:1 does not re-open it.
2. **Give the band the hairline every other slab has** — one `border border-border` on
   `IdentityBand.tsx`, no token change. Consistent with the page; costs the band its
   edge-to-edge slab quality in light, where it currently needs no help.
3. **Mint the dark twin D-9 deliberately withheld** — a `.dark` value for `--brand-panel`. This is
   the expensive one: the pair is *"the only pair declared outside the `.dark` block with no dark
   counterpart"*, and D-9 names that structural oddity as its own enforcement mechanism. It also
   moves the login panel, which is not this screen's to move.

**Recommendation: 2, scoped to the band.** It costs nothing in light (a hairline on a dark slab
against a light page is invisible), it leaves D-9's token pair and the login composition untouched,
and it makes the band obey the same separation rule as every other slab on the page rather than being
the one exception a reader has to know about.

## Spine reach

design decision · one component (`IdentityBand.tsx`) or one spec line · both themes

## Proof (→ `tdd` red-green cycles)

- [ ] `bandSeparatesInBothThemes` — the band's edge is distinguishable from the page ground in dark by
      the same measure the other slabs pass (border, or a luminance step) · flow (Playwright,
      `tools/document-band-drive.mjs` — it already reads the band in both themes)
- [ ] the light theme is byte-identical, or its change is deliberate and stated · flow (same drive)
- [ ] `npm run lint`'s contrast gate stays green · gate

## Boundaries

**The login Editorial Split is out of scope** unless option 3 is chosen, and choosing 3 makes this a
082 amendment rather than a Screen 2 fix — file that separately rather than widening this ticket.
No new token unless 3 wins. `--brand-panel-foreground` is not in question: fixed white, 14.56:1.

## Done when

The band reads as a distinct surface on the dark page by whichever rule this ticket settles on, the
choice is recorded against 082 D-9 / 083 D-2 so it is not re-litigated from a measurement, and the
band drive proves it in both themes.

## Blocked by

None — the screen is built ([096](096-document-detail-drive.md) is done) and this is the one finding
its acceptance pass left standing.

## Comments

Filed from [096](096-document-detail-drive.md)'s both-theme manual pass, which found no other
arrangement defect. The measurements above come from that pass; the screenshots it wrote
(`DRIVE_SHOTS=<dir> node tools/document-detail-drive.mjs`) are how the two themes were compared.
