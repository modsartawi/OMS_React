---
type: wayfinder-ticket
wayfinder: task
map: 580
status: open
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
