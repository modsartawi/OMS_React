---
type: wayfinder-map
status: open
---

# 580 — The DMSCO theme, app-wide

## Destination

One `status: ready` spec, consumable by `/to-tickets`: **the whole oms-react app restyled in the
DMSCO visual language** from the Figma file *HR-Portal_Website* (`HENEtVzt5KO6b0Mq9MuvhT`, page
"Website - Phase 1"). It covers the token table, the shell, the shared `core/ui` pieces, the AG Grid
theme, and how the 95 screens' hand-styled controls move onto them.

Reached when that spec is `ready` and no decision blocks the build.

## Notes

**Domain:** oms-react back-office (see `CONTEXT.md`). This is a look-and-feel effort; it adds no
domain terms.

**Prior art.** The login page is already done and is the reference implementation: commit
`d689a2f7`, `src/features/auth/LoginPage.tsx`, the fixed `--login-*` block in `src/app/global.css`,
assets in `src/assets/login/`. Earlier re-themes to read, not repeat: [068 — POS palette + Document
Details rework](068-pos-palette-and-document-detail-rework.md) (spec 082, the token structure and
the four dark rules R1–R4 that still stand) and map 358 / spec 380 (palette B, IBM Plex, ADR 0003).

**Measured scope (2026-10-26).** The token table in `global.css` is the only place a colour is
written (gated by `npm run lint`), so token values restyle every screen at once. The cost is
elsewhere: 95 pages, 80 AG Grid mounts, **422 hand-written `<button>`s and 550
`<input>`/`<select>`/`<textarea>`s in features**, 121 uses of `border-input`, 1,022 uses of
`rounded-md/lg/xl`, and 37 drive scripts that assert colours or tokens.

**Owner rulings already taken (charting session, 2026-10-26)** — premises, not open. The owner
asked to settle these as recommendations; any can be overruled:

- **Destination is a ready spec** (owner's pick), not the rethemed app. Build happens after, from
  the spec's tickets.
- **Visual language only, keep our UX** (owner). Colours, shapes, type, the logo and the frosted
  surfaces carry over; flows, steps, copy semantics and screen arrangements do not change.
- **HR-portal content does not come over**: news, e-services, team dashboard, the "Noura" chatbot,
  the language pill. See Out of scope.
- **Figma budget.** The account is a Starter plan with a View seat (about 6 MCP calls a month, about
  2 spent on the login). One `get_design_context` per frame; ask the owner before spending a call
  beyond [581](581-capture-the-remaining-figma-frames.md)'s three. The saved page metadata dump is
  free to reuse.
- **No numeric density target** is set by the owner. Density was judged by eye on
  [584](584-how-much-of-the-hr-sites-scale-reaches-the-working-screens.md)'s prototype: today's
  compact sizes stay. No ticket invents a pass/fail number, and none enlarges a working screen.
- **Every rule in `.claude/rules/` and every lint gate stands.** The theme changes values, not the
  rules: tokens only in `global.css`, AA contrast, logical Tailwind, bidi, zero-literal i18n.

**Skills:** `/prototype` for look-and-feel tickets (HTML or a throwaway route, linked as an asset
beside the issue); `/grilling` for rulings; `/research` for facts outside the repo; the `figma:*`
skills (`figma-design-to-code`) for any Figma read.

## Decisions so far

<!-- one line per resolved ticket -->

- [Can we licence Chalet for the web?](582-can-we-licence-chalet-for-the-web.md): yes, House
  Industries' Chalet Book has a cheap one-time self-hosted web licence, but **no Arabic**, unproven at
  12px, and its "public domain" wording may not cover internal IIS hosts (needs House's written
  word); Jost is the open look-alike.
- [How much of the HR site's scale reaches the working screens?](584-how-much-of-the-hr-sites-scale-reaches-the-working-screens.md):
  **none** — working screens keep today's compact sizes (19 rows vs 10 on staging) and take only
  the DMSCO colours, shapes, logo and type style; the design's scale and the glass stay on the login.
- [Capture the remaining Figma frames](581-capture-the-remaining-figma-frames.md): Reports and
  Profile in full, Homepage structure only; **no data table exists in the design** (the grid's look
  is derived), the shell is a **top bar** (our rail stays and takes its look), a white-on-dark DMSCO
  lockup is filed, and the full palette, shapes and type scale are in its notes.
- [How the DMSCO palette maps onto our tokens](585-how-the-dmsco-palette-maps-onto-our-tokens.md):
  `--primary` is the navy `#172031` everywhere and **links are underlined** (owner); hueless
  neutrals, one gold `#FEC33B`, status families unchanged, login block stays separate; all 184
  contrast pairs pass.
- [The shell, and which mark it carries](587-the-shell-and-which-mark-it-carries.md): the
  **DMSCO lockup** (dotted-D symbol when collapsed) and the **Figma top bar's look** on our rail:
  radial deep navy, a filled `#182F4A` pill with a gold icon for the active item, pill rows and a
  white pill search field; sizes and page titles unchanged (owner).
- [How dark mode is derived without a dark design](586-how-dark-mode-is-derived-without-a-dark-design.md):
  **navy night** (owner): dark keeps palette B's navy-tinted ladder while light stays hueless; the
  navy lifted to `#9db2d8` for the interactive family, gold `#fec33b` ring and cursor; gate 184/184.
- [Inventory the hand-styled controls](583-inventory-the-hand-styled-controls.md): 435 buttons
  (88 carry a Button variant's colours, none its shape; 72 chips/tabs, 59 icon, 41 outlined
  look-alikes, 42 one-offs) and 543 fields on 224 class strings; 302 fields but only 80 buttons
  already use a named constant; five features hold 37%.
- [How the screens move onto the shared controls](588-how-the-screens-move-onto-the-shared-controls.md):
  **mixed** (owner): new `core/ui` Input/Select/Textarea/Field, IconButton and Chip take the big
  buckets, the look-alikes fold into Button, the long tail is restyled in place; **colours first,
  shapes follow** (owner): one release turns the app DMSCO, then the sweep lands area by area.
  Drives, slicing, proof and empty states are settled there as recommendations.
- [Which type family the app sets type in](589-which-type-family-the-app-sets-type-in.md): **keep
  IBM Plex** (owner); ADR 0003 stands, Chalet is not bought (no Arabic, unproven at 12px).

## Not yet specified

<!-- Everything that was here graduated into 588's answer (drives, rollout, empty/loading/error
     states) or out of scope (illustrations). All tickets are closed: the way is clear, and the
     next step is `/to-spec`. -->

## Out of scope

- **The HR portal's screens and content** (homepage, e-services, teams, reports, news, profile as
  features; the chatbot; the language pill). This map adopts the look, not the product.
- **The printed facsimiles** (`print-sheet.css`, `collection-voucher.css`, `collection-acr.css`).
  They reproduce paper forms and keep the forms' own ink (the palette gate's documented
  exception); only the chrome around them follows the theme.
- **A language switch** on the login or in the shell. Not part of this theme; would be its own
  effort.
- **The illustrated service icons** (the design's PNG tile sprites). Compact working screens
  have no tiles, and empty states keep their line icons (588). A home-page illustration would be its
  own small effort.
- **The login page** — already built (`d689a2f7`). It may be touched again only if 585 folds its
  `--login-*` tokens into the main table.
