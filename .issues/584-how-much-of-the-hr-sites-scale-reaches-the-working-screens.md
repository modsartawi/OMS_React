---
type: wayfinder-ticket
wayfinder: prototype
map: 580
status: done
blocked-by: 581 (waived — the owner judged scale on the login frame's prototype; 581's frames may move colours, not sizes)
---

# 584 — How much of the HR site's scale reaches the working screens?

## Question

The design is an HR website: 40px headings, 44px pill fields, 52px buttons, generous gaps, photos.
BackOffice is mostly dense grids and forms used all day. **Which parts of the DMSCO look carry over
at full scale, and which are scaled down for the working screens?**

Prototype one real grid screen (Deliveries list or Materials search) and one real form (a side
sheet or dialog) in two or three densities, using 581's frames as the source:

- **A — full design scale** (the login's sizes everywhere).
- **B — DMSCO shapes and colours at our current density** (pill/rounded shapes, new palette,
  current 12px grid text and row heights).
- **C — a middle step**, if A and B are too far apart.

The owner picks by eye (no numeric target — map Notes). The answer should name, per element
(page heading, section heading, field, button, grid row, toolbar, card, dialog), which scale it
takes. It should also decide whether the **frosted glass surface** stays a login/landing-only
treatment or appears in the shell, and fix the short-window case seen on staging (the login card's
776px minimum height scrolls a 744px window).

## Answer

Resolved 2026-10-26 by the owner ("yes"), on the prototype in the comment below (variant B won).

**The working screens keep today's compact sizes; only the DMSCO look carries over.** Colours,
shapes (pill controls, rounder cards), the logo and the type style come from the design; sizes do
not. The design's large scale stays on the **login page only**.

| Element | Scale |
|---|---|
| Grid rows, cells, headers | today's: 12px text, 26px rows, 28px header (`OMS_GRID_ROW_HEIGHT` / `_HEADER_HEIGHT` unchanged) |
| Buttons, fields, toolbars | today's heights (`core/ui/Button` h-7, text-xs), DMSCO shape and colour |
| Page and section headings | today's sizes; [587](587-the-shell-and-which-mark-it-carries.md) may restyle them, not enlarge them |
| Cards, dialogs, side sheets | today's padding; DMSCO radius and colour |
| Login | the design's scale, as built (`d689a2f7`) |

Why: on staging at 1568×698 the Deliveries list shows 19 rows at today's density and 10 (with
truncated cells) at the design's; at the design's scale the Delivery details page pushes its items
grid below the fold. The owner's standing concern is that BackOffice must stay compact.

Settled alongside, as recommendations (overrulable):
- **The frosted glass surface is login-only.** It needs a photographic ground behind it, which the
  working screens don't have.
- **The login's short-window case is a build fix, not a design question:** the card's 776px minimum
  height should yield on short windows (no page scroll at 744px). The spec carries it.


**2026-10-26 — early prototype, ahead of 581** (owner asked to see compactness first). Branch
`prototype/dmsco-density` (commit `808be58e`, worktree `C:\Playground\oms-react-proto-dmsco`, never
merge). Three skins over the REAL Deliveries list and Delivery details, live staging data, switched
from the floating bar: `current`, `dmsco` (DMSCO colours + shapes at today's density), `dmsco-scale`
(the Figma's 15px copy, ~40px rows). Colours are from the login frame only; 581's frames may still
move them. Measured at 1568×698: the list shows **19 rows in `dmsco` vs 10 in `dmsco-scale`** (with
truncated cells); at scale the details page pushes the items grid below the fold. Owner's verdict
pending — this comment does not resolve the ticket.
