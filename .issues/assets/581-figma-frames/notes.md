# 581 — What the DMSCO frames specify

Figma file `HENEtVzt5KO6b0Mq9MuvhT` ("HR-Portal_Website", page "Website - Phase 1"), read
2026-10-26 with `get_design_context` (3 calls). Screenshots beside this file:
`reports-224-31368.png`, `my-profile-430-7247.png`. The login frame (84:4419) was read in the login
session and is built in `d689a2f7`.

**Coverage.** Reports (`224:31368`) and My Profile (`430:7247`) returned full code + screenshot.
Homepage_Regular employee (`430:5164`) was too large and returned **structure only** (no styles, no
screenshot); its top bar is the same component as the other two frames', which are complete, so no
further call was spent. The returned code itself was not persisted (too large to file); everything
below is transcribed from it.

## The finding that matters most

**The design has no data table anywhere.** Reports is a card index of report types, not a grid;
My Profile is label/value pairs. Nothing in the file says how a dense AG Grid should look, so the
grid's DMSCO styling must be *derived* from the palette and shapes (585), not copied.

**The shell is a top bar, not a rail.** The design navigates with a horizontal pill bar. Our UX is
the left rail (keep our UX), so 587 restyles the rail in this language rather than adopting the bar.

## Colours (Figma variable names where the code gave them)

| Variable / role | Value | Seen on |
|---|---|---|
| `primary-blue` | `#172031` | primary button, active profile tab, header gradient end |
| `primary-blue-light` | `#182F4A` | headings (24/32px), links, active nav pill, field-pair accents |
| `primary-blue-60` | `#747983` | breadcrumb text |
| `primary-blue-20` | `#D1D2D6` | inactive nav-pill text on the dark header |
| `primary-yellow` | `#FEC33B` | favourite star, icon accents, nav icon stroke |
| `neutrals-80` | `#4C4C4C` | body copy, labels, descriptions |
| `neutrals-70` | `#626262` | footer text, field labels (login) |
| `neutrals-60` | `#797979` | hint text (login) |
| `neutrals-50` | `#8F8F8F` | search placeholder |
| `neutrals-30` | `#BCBCBC` | field / search border |
| `neutrals-10` | `#E9E9E9` | chip ground (reveal-password chip) |
| `black` | `#1F1F1F` (login) / `#000` (titles here) | values, card titles |
| page ground | `#E5E5E6` + the photo at 20% opacity | every inner page |
| glass panel | `#F1F1F1` at 70% | panels (32px radius) |
| card | white at 75% over blend layers | tiles inside panels |
| header bar | radial `#111A1E` → `#172031`, 90% opacity | top bar, 88px, bottom corners 30px |
| avatar | `#0C9D61` (green) | initials circle |
| notification dot | `#DE2C3B` | bell badge |

No dark mode exists in the file.

## Type

ChaletBook (Bold / Regular) everywhere; Arabic names in **Avenir Arabic** (Heavy / Regular).
Named styles: Heading/Desktop X-Large 40, Large 32, Medium 24; Copy/Desktop Large 17, Medium 15;
Copy Small 13; Paragraph 15/20. Line height is 100% except paragraphs (20px).

## Shapes and spacing

- **Radii:** panels 32px; photo panel 26px; image avatar 36px; buttons, nav items, search, chips
  and count pills are full pills (38–1000px); profile tabs 47px (active) / 32px.
- **Heights:** nav items, search, fields, chips and tabs 44px; primary button 52px (login).
- **Gutters:** 68px page margin at 1512px; 24px panel padding; 16px card padding; 12–16px gaps.
- **Elevation:** soft only — `0 8px 20px rgba(0,0,0,.12)` on nav pills, `0 4px 14px rgba(0,0,0,.05)`
  on inactive tabs, `0 2px 10px rgba(0,0,0,.02)` on search.

## Components seen

- **Top bar:** white DMSCO lockup 112×60 (`assets/dmsco-logo-on-dark.svg`, composed from the
  frame's own vectors — the white-text twin of the login lockup); pill nav (inactive: text only on
  glass; active: filled `#182F4A`, white text, gold home icon); white global-search pill 295×44;
  bell in a circle with a red dot; avatar circle + name + chevron; language pill.
- **Breadcrumb** under the bar: home icon + ` / Reports`, 17px `#747983`.
- **Page header:** 32px bold title, 17px subtitle, a page-level search pill at the end.
- **Panel:** glass, 24px bold `#182F4A` title + 15px subtitle, a white count pill ("10 Services").
- **Tile / card:** 48×42 illustrated icon (yellow accent), 17px bold title, 15px description,
  underlined "How it works?" link (15px bold `#182F4A`), gold favourite star.
- **Profile tabs:** pill segmented control — active filled `#172031` white bold; inactive white 40%
  with a soft shadow.
- **Label / value pairs:** 15px `#4C4C4C` label over 17px value; section titles 17px bold;
  full-width hairline dividers between sections.
- **Lists:** rows with a trailing check / x icon and hairline separators; radio pair.
- **Icon button:** 39px circle with an edit icon.
- **Footer:** hairline, © line and links at 15px `#626262`.
- **Homepage (structure only):** KPI tiles 262×130 (big number + label), announcement rows with tag
  chips (20px), category filter chips (44px), news cards 326×340, the "Noura" chatbot.

## Icons

Line icons are Feather/Lucide shapes (home, search, bell, mail, briefcase, map-pin, user, edit-3,
check, x, calendar, download) — `lucide-react` already covers them. The service icons are
**illustrated PNG sprites**, not line icons (`assets/service-icons-*.webp`, re-encoded).

## Assets filed (`assets/`)

`dmsco-logo-on-dark.svg` (+ the two scripts that compose it), header bar `ec5b4.svg`, active-nav
home icon `7aaad.svg`, avatar `f7f50.svg`, bell `088eb.svg`, search `65007.svg`, check `09b28.svg`,
x `e0cd6.svg`, star `5c868.svg`, edit `dcd44.svg`, `page-ground.webp` (the 20% photo, 9.9 MB PNG →
webp), `service-icons-a/b.webp`. The Figma asset URLs expire after 7 days (2026-11-02).
