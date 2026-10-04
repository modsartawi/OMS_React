# HITL-385 — unattended decisions, ticket 385 (navigation lives in an expanding navy rail)

## Q: "White ink" on the active row, when the colour-literal gate forbids `text-white`?
**Decision taken:** Added one token, `--rail-accent-foreground: #ffffff`, the same in both themes, with its bridge line. The contrast gate measures it on `--rail-accent` and on `--rail` at 4.5. It is used for the active row, hover ink, the group header that holds the active screen, and the brand name.
**Why:** The ticket asks for white ink. `text-white` is a literal the palette gate refuses. `--primary-foreground` turns dark in dark mode. An ALLOWED exemption would be weaker than a token. The name follows shadcn's `--sidebar-accent-foreground` convention.
**Revisit if:** the owner wants F5's five-token list kept exact. The alternative is a palette-gate exemption for `text-white` in `Rail.tsx`.

## Q: Where does the marker sit in the expanded tree and the flyout?
**Decision taken:** On a collapsed group icon, the gold `::before` sits flush on the rail's own inline-start edge. The drive checks this with a screen pixel in LTR and RTL. On a leaf (tree or flyout), it sits on the leaf's inline-start edge, as in the approved D captures.
**Why:** 363 says "on the group icon (collapsed) or the leaf (tree, flyout)". The D captures show the tree marker at the leaf's edge in both directions.
**Revisit if:** the owner reads "flush on the rail edge" as applying to the tree leaves too.

## Q: Today's mobile overlay (<992px) — keep it until 387?
**Decision taken:** Removed it together with the old sidebar. The rail renders at every width: collapsed 56px with working flyouts. If the stored preference is expanded, the 240px tree pushes the page even on a narrow screen until 387 lands. The unused `body.blocked-scroll` rule went too. 387 brings back the lock with its drawer.
**Why:** The old overlay was part of the sidebar this ticket replaces. The Boundaries say "No narrow-width behaviour; that is 387". A collapsed rail is a working, if unpolished, narrow state.
**Revisit if:** S1 merges without 387. Phones would then have no drawer.

## Q: The flyout's close label
**Decision taken:** The flyout header carries an X button labelled `common:rail.close` ("Close"). Esc, an outside click and navigation close it as well.
**Why:** The ticket asks for "the flyout's close label", which implies a control to carry it. The prototype had the same X.
**Revisit if:** the owner wants the flyout to have no close button. In that case drop the button and the key.

## Q: Keys under `topbar.*` or `rail.*`?
**Decision taken:** These keys went under a new `common:rail.*` sub-tree:
- `expand`
- `collapse`
- `close`
- `toggleSection` (moved from `topbar.*`, since only the rail uses it)

`topbar.toggleMenu` was removed, because the hamburger it labelled is gone. 387 adds its own label.
**Why:** The ticket allows either sub-tree. The rail no longer lives in the top bar.
**Revisit if:** 386 or 387 wanted `topbar.toggleMenu` back. Re-adding it is a one-line change.

## Q: Other tickets' drives read today's tree, which is now collapsed by default
**Decision taken:** These drives now boot with `oms.railExpanded = 'true'` (the toggle's own key), so their tree checks keep their meaning:
- collection
- oms-access
- central-invoice
- central-invoice-list
- settlement

`loy-member` drives the collapsed rail (group icon → flyout → leaf) through `#layout-rail`. The old `#layout-sidebar` id and the `bg-sidebar-accent` selectors moved to their rail names.
**Why:** Their checks are about gating and lit leaves, not about the default width. The foundation drive owns the collapsed behaviour.
**Revisit if:** a later slice wants those drives to exercise the flyout instead.

## Comments
- "Maximum update depth exceeded": not seen in any 385 drive run. Every mode asserts "no page errors".
- `tools/palette-drive.mjs` (its `--rail` expectation was renamed) could not run: it signs in through a live `Auth/Login`, and no SIS.Api is up. The rename is otherwise proven by `npm run lint`'s bridge-completeness and contrast gates.
