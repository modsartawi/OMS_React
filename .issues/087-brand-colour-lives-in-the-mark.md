---
status: done
spec: 082
blocked-by: 084
---

# 087 — brandColourLivesOnlyInTheMark

## What to build

al-dawaa gold `#FDC801` and navy `#002554` appear in exactly one place — inside the al-dawaa SVG,
rendered through `BrandMark`. Neither hex may appear as a ground, ink, border or Tailwind arbitrary
value anywhere in `src/`.

That is the whole ruling (spec 082 D-9); every per-surface change below is a consequence of it, which
is what stops a standing "exception" being left behind for a later change to widen. **Brand identity
on a surface is carried by the mark plus the wordmark, never by a brand-coloured field.**

- **The login Editorial Split keeps its composition and swaps only its ground.** The bled watermark,
  the lockup, the kicker, the tagline and the desktop-only half all survive. The panel's ground
  becomes `--brand-panel` and its ink `--brand-panel-foreground` (with `/70` for the muted line);
  the gold kicker loses its gold. **The watermark and lockup marks stay gold** — that is where brand
  colour lives now.

  `--brand-panel` `#202A34` is theme-invariant by design: it sits at the navy's own darkness (navy
  L ≈ .245, this L .280) but near-neutral instead of saturated, so the composition's weight survives
  the hue swap, and against the dark page it reads as a **raised slab** (ΔL +.058) rather than
  dissolving as the navy did. `--brand-panel-foreground` **cannot** be `--primary-foreground`, which
  flips to `#121C27` in dark and would invert the panel's ink.

  It shares its hex with dark `--sidebar-accent` and is **deliberately not aliased** — a future move
  of the sidebar hover ground must not drag the login panel with it.

- **The home hero becomes a tool, not a marketing surface.** Post-auth, the brand ground is dropped
  entirely: `--card` ground, `--border` edge, hierarchy from type scale and padding. The 360px
  watermark is dropped (at 10% opacity on a light card it is a pale gold wash — brand colour as
  decoration); the 44px lockup stays. The gold kicker is retired.

  *Considered and rejected:* a `--primary-050` tinted band (blunts a token doing semantic work) and
  `--card-2` (at L .988 vs `--background` .975 it would be invisible in light).

- **Both `text-[#FDC801]` kickers are deleted** — `app/HomePage.tsx:35` and
  `features/auth/LoginPage.tsx:453`. They are the only two arbitrary-value colour classes in the
  entire app, so after this ticket `src/` contains **zero hardcoded colour hexes in `.tsx`**, which is
  what makes ticket 089's gate unambiguous.

- **One stale i18n key deleted:** `auth.json`'s `subtitle: "OMS Portal"` — the retired product name,
  no longer rendered by any component.

- **Untouched, deliberately:** `BrandMark` (colour-agnostic by construction), the al-dawaa SVG (the
  company's colours are the company's), and the sidebar / topbar (no gold underline, no navy plate,
  no brand-tinted rail header — the mark carries the brand unaided).

**Gold is not reachable from the token layer.** `--attention` `#B4791F` stays exactly as 084 sets it
and the dark twin is untouched; both tables stay closed. If this ticket finds itself wanting a gold,
that is the signal it has gone wrong.

**Verified before slicing:** the login panel's `text-white` / `text-white/70` (lines 442, 461) and the
home hero's (lines 25, 44) are four of the app's nine `text-white` occurrences. This ticket converts
the login pair to `--brand-panel-foreground` and **deletes** the home hero pair with its brand ground,
which is what lets ticket 089's second gate reach zero.

## Spine reach

`features/auth/LoginPage.tsx` · `app/HomePage.tsx` · `locales/en/auth.json` (key deletion) · drive.
Tokens come from 084; this ticket declares none.

## Proof (→ `tdd` red-green cycles)

- [x] Drive the login screen in **both themes** and confirm the panel reads as a deliberate dark slab
      in each — in dark it must separate from the page rather than dissolve into it, which is the
      exact failure the navy had and the reason `--brand-panel` exists · flow (`npm run dev`)
- [x] Drive the home page in **both themes** and confirm the hero reads as a card in the app's own
      language, with the lockup present and no gold wash · flow
- [x] `grep -rn -- "-\[#" src/` returns **nothing**, and `grep -rn "FDC801\|002554" src/` matches only
      the al-dawaa SVG · pure (folded into ticket 089's gate, asserted by hand here)

## Boundaries

Deletes one i18n key (`auth.json` `subtitle`) — confirm no component renders it before removing. No
API, no nav change, no new token (084 declares `--brand-panel` and its foreground). This is the only
ticket in spec 082 that changes what a screen looks like **compositionally** rather than only in
colour, so it is the one where a screenshot before/after is worth keeping.

## Done when

Login and Home render with no brand hex outside the SVG, in both themes; `-[#` returns zero hits
across `src/`; and the dead `auth.json` key is gone.

## Blocked by

[084](084-pos-tokens-both-themes.md) — `--brand-panel` and `--brand-panel-foreground` are declared
there.

## Comments

**Done 2026-07-24.** Login and Home reworked (LoginPage.tsx / HomePage.tsx), the `BRAND_NAVY`
constants and both `text-[#FDC801]` kickers removed, and the dead `auth.json` `subtitle` deleted.
`grep -rn -- "-\[#" src/` returns nothing; typecheck + build green; both screens driven in light and
dark (login panel reads as a raised slab in dark, ΔL +.058 above the page; home hero reads as a card).

One nuance on the second gate: `grep -rn "FDC801\|002554" src/` matches the al-dawaa SVG **and** a
prose comment in `src/app/global.css:144` (084's, explaining why `--brand-panel` exists). That is the
sanctioned token file — spec 082 D-12 excludes `global.css` and the SVG, and ticket 089's gates
(`text-white` + `-\[#`, `global.css` excluded) never look at it — so it is not a leak. The Proof
line's "only the al-dawaa SVG" wording is stricter than its parent spec; the actual invariant (no
brand hex on a surface, none reachable from the token utilities) holds.
