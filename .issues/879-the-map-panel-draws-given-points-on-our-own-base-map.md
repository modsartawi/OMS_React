---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: BackOffice 3634
---

# 879 — The map panel draws given points on our own base map, in Arabic or English, loads only when shown, and names no outside address

## What to build

BackOffice spec 3630, M28, M29 and M33 to M35; BackOffice ADR 0135. The foundation every later map ticket draws
on: a map panel component that, given a list of points, draws them on a map of KSA and Bahrain.

- **The engine is MapLibre,** over the one base-map file of BackOffice 3634, read by byte range from one fixed
  path on our own site.
- **Nothing is fetched from another host.** The library, the style, the fonts for Latin and Arabic labels, the
  icons and the Arabic text-shaping add-on are all served from our own site. Versions are pinned exactly.
- **One style,** the quiet grey base of the prototype, so the points carry the colour. Light only.
- **Place names follow the screen's language:** Arabic names on an Arabic screen, shaped and joined correctly,
  English otherwise. The panel's own controls follow the screen's direction.
- **The credit line** "© OpenStreetMap" is on every map, small, and stays when the page is printed. If BackOffice
  3634 recorded a second credit its licence requires, it is shown too.
- **Given points, it draws them** as plain points of one size and one colour, and opens fitted to them. Size,
  colour, groups and the card come with 881.
- **It says when it is drawn:** a signal after the base map and the points are painted. The print page waits on it
  (883).
- **It says when it cannot draw** (no graphics support, or the base-map file cannot be read), so the caller can
  show the table.
- **Loaded only when a map is on screen.** A board, a report or a panel answer with no map loads none of the
  map's code or files.
- **A proof page,** in development builds only: the panel with 20 fixed store points. BackOffice 3635 prints it
  through the report renderer. 883 removes it.

## Proof (→ `tdd` red-green cycles)

Seams 6 and 7 of the spec. The map engine is replaced by a stand-in in the component tests; they do not assert on
the library's internals or on pixels.

- [ ] Given points, the panel hands the engine those points and a view fitted to them · oms-react tests
- [ ] On an Arabic screen the style asks for Arabic names and the add-on is loaded from our own site · oms-react tests
- [ ] The credit line is drawn, on screen and in the print layout · oms-react tests
- [ ] The panel signals "drawn" once, after the engine reports its tiles and points painted · oms-react tests
- [ ] The panel signals "cannot draw" when the engine fails to start or the file cannot be read · oms-react tests
- [ ] The built app's entry and its board, report and panel chunks do not contain the map's code · a check on the build output
- [ ] The built map chunk and the style name no address on another host that the page would fetch; the credit's link is the one allowed · a check on the build output, wired into `lint`
- [ ] The proof page draws over the development base-map file with the network off · seen by a person, screenshot under `.issues/assets/`

## Boundaries

No door is called here: the panel takes points. No switch is read here. The base-map file is not in git; the
development file comes from the script of BackOffice 3634, and the README says where to put it. The proof page is
not reachable in a production build.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green.

## Blocked by

BackOffice 3634 (it chooses the tile layout the style is written for, and makes the development file).
