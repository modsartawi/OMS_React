---
type: wayfinder-ticket
wayfinder: grilling
map: 580
status: open
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
