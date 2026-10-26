---
type: wayfinder-ticket
wayfinder: task
map: 580
status: done
blocked-by: —
---

# 581 — Capture the remaining Figma frames

## Question

Nothing to decide — this unblocks the look-and-feel decisions. **What do the DMSCO design's
shell, data screens and forms actually specify?** The login frame told us the palette, the pill
controls and the glass card; it says nothing about navigation, tables, filters, cards or dense
forms.

Spend **three** `get_design_context` calls (with screenshots), one per frame, on file
`HENEtVzt5KO6b0Mq9MuvhT`:

1. **Homepage_Regular employee** (`430:5164`) — the shell: header/nav, cards, page grid.
2. **Reports** (`224:31368`) — the nearest thing to our grid screens: tables, filters, toolbar.
3. **My Profile** (`430:7247`) — forms: field groups, read-only values, section headings.

Before the calls, run `whoami` and confirm the seat still has budget; if a call is refused for
rate limit, stop and tell the owner rather than retrying. Load `figma-design-to-code` first.

File under `assets/581-figma-frames/`: each frame's screenshot, its returned code, and a short
`notes.md` per frame listing the colours (with Figma variable names), type sizes and weights,
radii, spacing, shadows/blur and component names it uses. Download any reusable assets (icons,
the nav logo) from the returned URLs, which expire after 7 days. Do not implement anything.

Resolved when the three frames are filed and their notes list every distinct colour, type style
and radius they use.

## Answer

Resolved 2026-10-26 (AFK, 3 Figma calls). Notes, screenshots and assets:
[`assets/581-figma-frames/notes.md`](assets/581-figma-frames/notes.md).

- **Reports and My Profile came back in full**; **Homepage came back as structure only** (too
  large). No fourth call was spent: Homepage's top bar is the same component as the other two
  frames' and is fully captured there. The returned code was transcribed into the notes, not filed.
- **The design has no data table anywhere.** Reports is a card index and Profile is label/value
  pairs, so the grid's look must be derived from the palette and shapes (585).
- **The shell is a horizontal top bar** (88px dark radial navy, white DMSCO lockup, pill nav with a
  filled `#182F4A` active pill, white search pill, bell, avatar), not a rail. Keep-our-UX means the
  rail stays and takes this look (587).
- **The white-on-dark DMSCO lockup exists** in the frame; it is filed as
  `assets/581-figma-frames/assets/dmsco-logo-on-dark.svg`, composed from the frame's own vectors.
- **New colours beyond the login's:** `primary-blue-60` #747983, `primary-blue-20` #D1D2D6,
  `neutrals-50` #8F8F8F, page ground #E5E5E6 under a 20% photo, avatar green #0C9D61, alert red
  #DE2C3B. Full table in the notes.
- **Shapes:** 32px panels, full-pill controls, 44px control heights, soft shadows only.
- **Type:** ChaletBook throughout, **Avenir Arabic** for Arabic; 13/15/17/24/32/40 scale.
- **Icons:** the line icons are Feather/Lucide shapes (already covered by `lucide-react`); the
  service icons are illustrated PNG sprites.
