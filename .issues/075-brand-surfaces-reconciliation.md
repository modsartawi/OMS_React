---
type: wayfinder-ticket
wayfinder: grilling
map: 068
status: done
blocked-by: 069
---

# 075 — What survives of al-dawaa gold & navy

## Question

The owner ruled the POS palette wins outright, with al-dawaa gold/navy surviving "at most as
logo/brand mark, not as UI colour". That ruling has to be made concrete on the surfaces that
currently *are* the brand.

The affected surfaces (exact usages come from 069): `src/core/ui/BrandMark.tsx`,
`src/features/auth/LoginPage.tsx` (the Editorial Split login, built around gold/navy),
`src/app/HomePage.tsx`, `src/locales/en/common.json`, `src/assets/Al-Dawaa-Pharmacies-01.svg`.

Settle, surface by surface:

- **The login page.** Its whole composition is a brand statement — a gold/navy split. Does it become
  a POS-blue split, keep its brand colours as a deliberate exception (the one screen that is
  *marketing* rather than *tool*), or get rebuilt? Note it is the first thing every operator sees;
  "exception" is a defensible answer, but it has to be a stated one, not a leftover.
- **The home page.** Same question, lower stakes.
- **The brand mark.** The SVG's own colours are the company's and don't change. Decide what sits
  *around* it — the sidebar header background, any gold underline or navy plate.
- **Is gold reachable at all?** PosTheme's `--attention #B4791F` is a warm gold-brown already used
  for warnings, and `--fam-loyalty` is the same hue. If al-dawaa gold `#FDC801` also appears as
  chrome, the two golds will read as a mistake at a glance. Either the brand gold is confined to the
  logo, or `--attention` moves off gold. Pick one.
- **Naming.** `common.json` carries the "al-dawaa BackOffice" product name — unaffected by colour,
  but confirm nothing in the copy references the retired look.

Record the per-surface ruling in this ticket. Where the answer is "exception", state the rule that
makes it an exception so it doesn't erode.

## Comments

**From [071 — The derived dark twin](071-pos-token-dark-twin.md) (done):** the navy collision is worse
in dark than in light. al-dawaa navy `#002554` is **darker than the dark theme's own page**
(`#121C27`), so a navy brand panel doesn't clash there — it *disappears*, taking the composition's
figure/ground with it. Whatever this ticket rules for the login and home surfaces has to answer for both
themes, not just the light one where navy-vs-steel is the visible problem.

## Answer

**The rule, stated once so it doesn't erode:**

> **al-dawaa gold and navy are the mark's colours, not the app's.** `#FDC801` and `#002554` appear in
> exactly one place — inside `Al-Dawaa-Pharmacies-01.svg`, rendered through `BrandMark`. Neither hex
> may appear as a ground, ink, border, or Tailwind arbitrary value anywhere in `src/`. Brand identity
> on a surface is carried by **the mark plus the wordmark**, never by a brand-coloured field.

That is the whole ruling. Every per-surface answer below is a consequence of it, so there is no
"exception" left standing that a later change could quietly widen.

### 1. The login Editorial Split — re-grounded, composition intact

The panel keeps its composition exactly: bled watermark, lockup, kicker, tagline, desktop-only half.
Only the **ground and its ink** change. Navy `#002554` → a **theme-invariant deep steel**.

Two new tokens, and they are the *only* pair in `global.css` declared **outside** the `.dark` block
with no dark counterpart — that structural oddity is the enforcement mechanism, and their names say
why they are allowed to be odd:

| Token | Value (both themes) | Note |
|---|---|---|
| `--brand-panel` | `#202A34` | Deep steel. Same darkness the navy occupied (navy L ≈ .245, this L .280), near-neutral instead of saturated — so the composition's weight survives the hue swap. |
| `--brand-panel-foreground` | `#FFFFFF` | Fixed. **Cannot** be `--primary-foreground`, which flips to `#121C27` in dark (071 R2) and would invert the panel's ink. |

**Why invariant rather than a light/dark pair.** The panel is a brand surface, not a themed one; the
mark's gold is fixed, so its ground should be too. It also makes one value answer both themes:

- **Light** — `--brand-panel` L .280 against the sign-in half's `--background` L .975. A dramatic dark
  slab, which is what the navy did.
- **Dark** — L .280 against `--background` L .222 ⇒ **ΔL +.058**. The panel reads as a *raised slab*
  rather than dissolving. That separation sits between two 071 already shipped: `--card` vs
  `--background` (+.042) and `--sidebar-accent` vs `--sidebar` (+.089). This is the direct answer to
  071's comment.

**On the value colliding with dark `--sidebar-accent` (`#202A34`).** Same hex, unrelated role — and
deliberately **not** aliased. `--brand-panel` is declared as its own literal; a future move of the
sidebar hover ground must not drag the login panel with it. (071's `-050`/`-800` role-swap is the
precedent for one value wearing two meanings.)

**Consequent edits to `LoginPage.tsx`:** delete `BRAND_NAVY` (:16) and the inline `style` (:443) →
`bg-brand-panel`; `text-white` (:442) → `text-brand-panel-foreground`; `text-white/70` (:461) →
`text-brand-panel-foreground/70`; **`text-[#FDC801]` (:453) → `text-brand-panel-foreground/70`** —
the kicker loses its gold, per the rule. The watermark `BrandMark` and the 40px lockup mark are
untouched and still gold: that is where the brand colour lives now.

Two things on this file that look sweepable and are **not**:

- `bg-white` (:680) is the QR quiet zone. Structural — a QR needs a white module ground in both
  themes. Leave it literal; do not tokenise it.
- `linkClass` `text-sidebar-active` (:71) sits on the sign-in half, not the panel, and 070 already
  moves it terracotta → `--primary`. No change here.

### 2. The home hero — brand ground dropped entirely

Post-auth is **tool**. The hero sits inside the shell, framed by the rail and the section cards, so a
saturated brand field there is exactly what "brand is not UI colour" forbids — and it is the one
viewport where an `--attention` warn pill could share the screen with brand gold.

The hero **keeps its copy and its lockup, loses its colour**: ground `--card`, edge `--border`, and its
hierarchy above the section cards comes from **type scale and padding**, not from a coloured field.

**Consequent edits to `HomePage.tsx`:** delete `BRAND_NAVY` (:14) and the inline `style` (:26); drop
`text-white` → default `--foreground`; `text-white/70` (:44) → `text-muted-foreground`;
`text-[#FDC801]` (:35) → `text-muted-foreground`; **drop the 360px watermark `BrandMark` (:28–31)** —
at 10% opacity on a light card it becomes a pale gold wash, i.e. brand colour used as decoration. The
44px lockup mark stays.

Considered and rejected: a `--primary-050` tinted band. It would give the hero separation without
brand colour, but 070 spends that token on selection grounds, tint badges, and info — a decorative
band would blunt a token that is doing semantic work. `--card-2` was also rejected: at L .988 vs
`--background` .975 the band would be invisible in light.

### 3. The brand mark and what sits around it

`BrandMark.tsx` is **unchanged** — 069 confirmed it is colour-agnostic by construction (it crops the
gold glyph onto a transparent ground). The SVG is **unchanged**: the company's colours are the
company's.

What sits around it is already settled by 070 and needs no new decision — restated so it is on the
record: the topbar lockup sits on `--background`, the sidebar on the **derived light rail**
`--sidebar` `#E9EEF4` (dark `#0B151F`). **No gold underline, no navy plate, no brand-tinted rail
header.** The mark carries the brand unaided on every in-tool surface.

### 4. Is gold reachable? No.

Brand gold is confined to the logo; **`--attention` `#B4791F` stays exactly as 070 set it** and 071's
dark twin is untouched. Both approved tables stay closed.

Deleting the two `text-[#FDC801]` kickers has a bonus 069 measured: they are the **only two
arbitrary-value colour classes (`-[#…]`) in the entire app**, so after this ticket the codebase has
**zero** hardcoded colour hexes in `.tsx` outside `BrandMark`'s asset import — which makes the 077
severity sweep's grep unambiguous.

### 5. Naming and copy

`common.json`'s brand copy (`brand` / `brandKicker` / `brandName`) carries no colour reference and is
**unaffected**. `home.json` and `auth.json`'s `brandPanel.tagline` / `.blurb` are likewise colour-free.

**One stale hit found:** `auth.json:3` — `"subtitle": "OMS Portal"` — the **retired product name**,
pre-dating the al-dawaa BackOffice rename. `LoginPage` no longer renders it (the password step shows
`t('title')` only), so it is a dead key carrying dead branding. **Delete the key** as part of this
work; nothing reads it.

### Summary of the build fallout

| Surface | Ruling |
|---|---|
| `LoginPage.tsx` | Ground → `--brand-panel`; ink → `--brand-panel-foreground`; gold kicker retired. Composition intact. |
| `HomePage.tsx` | Brand ground dropped → `--card`/`--border`; watermark dropped; gold kicker retired. |
| `BrandMark.tsx` | Unchanged. |
| `Al-Dawaa-Pharmacies-01.svg` | Unchanged. |
| `AppShell.tsx` / sidebar | Unchanged beyond 070's token swap. No brand plate. |
| `global.css` | **+2 tokens**, theme-invariant: `--brand-panel`, `--brand-panel-foreground`. |
| `auth.json` | Delete dead `subtitle: "OMS Portal"`. |
| `common.json` · `home.json` | Unchanged. |
