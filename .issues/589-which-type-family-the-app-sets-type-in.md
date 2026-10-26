---
type: wayfinder-ticket
wayfinder: grilling
map: 580
status: done
blocked-by: 582
---

# 589 — Which type family the app sets type in

## Question

ADR 0003 sets the app in IBM Plex (Sans, Mono, Sans Arabic). The DMSCO design sets type in
ChaletBook. **Does the app move to the design's family, keep Plex, or split (e.g. Chalet for
headings and the login, Plex for UI text and grids)?**

Decide from [582](582-can-we-licence-chalet-for-the-web.md)'s facts: licence and cost, Arabic
coverage, and how it reads at 12–13px in a grid. A change overturns ADR 0003, so record it as a new
ADR. If the owner wants it but the licence is still pending, say what ships in the meantime.

## Answer

Resolved 2026-10-26 by the owner, on recommendation: **keep IBM Plex** (Sans, Mono, Sans Arabic)
for UI text, grids and Arabic. ADR 0003 stands, so no new ADR is needed.

- The DMSCO look comes from colour (585, 586), shape (588), the shell (587) and the logo, whose
  artwork already carries the brand lettering.
- Chalet Book isn't bought. From 582: it has no Arabic, it is unproven at 12px, and its licence's
  internal-host scope is unconfirmed. If the company later standardises on a brand face, that is a
  new effort and a new ADR.
- The login keeps Plex as built (`d689a2f7`).
