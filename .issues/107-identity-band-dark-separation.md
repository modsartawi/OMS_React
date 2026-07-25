---
status: done
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

- [x] `bandSeparatesInBothThemes` — the band's edge is distinguishable from the page ground in dark by
      the same measure the other slabs pass (border, or a luminance step) · flow (Playwright,
      `tools/document-band-drive.mjs` — it already reads the band in both themes)
- [x] the light theme is byte-identical, or its change is deliberate and stated · flow (same drive)
- [x] `npm run lint`'s contrast gate stays green · gate

**Resolved: option 2**, the hairline, scoped to the band. `IdentityBand.tsx` gains
`border border-border` — one class, no token minted, the login Editorial Split untouched.

**How it was verified.** `tools/document-band-drive.mjs` **34/34** (was 32; the two new assertions
measure the edge in both themes). In dark the hairline is ΔL **.026** from the page against the band's
own **.011** — the edge is more than twice the separation the band had alone — and .015 from the band's
ground, so it paints from both sides. In light the band's ΔL **.904** against the page still carries
the separation and the pale edge sits .118 off the page ground: the band reads as inset by a pixel,
not ringed (screenshots in both themes confirm it). Ink is unchanged at 14.56:1 in both.

The other six document drives re-ran green untouched (detail 39, rail 25, cards 45, items 23,
actions 38, rtl 33); `npm test` 68/68; typecheck, lint (three gates — including the contrast gate) and
build green.

**The choice is recorded** in [082](082-pos-design-system-spec.md) D-9 (the tokens stand; a
`--brand-panel` consumer that is a whole surface rather than half a composition draws the hairline)
and [083](083-document-details-rework-spec.md) D-2 (the band's amendment, with both measurements).

## Notes from the build

- **The band takes `--border` at full strength, while every peer slab on the page draws
  `border-border/60`** — raised in review as two hairline recipes on one page. Kept, with the reason
  on the component: the peers sit on `--card`, a near-page ground whose edge is a *refinement*; this
  band's edge is its *separation*. A `/60` alpha over the deep-steel ground would spend on consistency
  exactly the strength the ticket exists to buy.
- The drive does **not** compare the band's edge against a peer's, though an earlier draft's wording
  claimed to. It cannot honestly: the peers' border is an alpha and `getComputedStyle` returns it as
  `oklab(… / .6)`, which the drive has no way to composite. The assertion now says what it measures —
  a 1px hairline distinguishable from both grounds.

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
