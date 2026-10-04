# HITL-387 — unattended decisions, ticket 387 (below 1280px the rail overlays; below 640px a drawer)

## Q: The `--backdrop` token belongs to 388's list — add it here or use a stopgap scrim?
**Decision taken:** Added `--backdrop` now, with 377 §1's exact values (`rgb(13 16 21 / 0.32)` light, `rgb(0 0 0 / 0.5)` dark) and its `--color-backdrop` bridge line. Both of 387's scrims use `bg-backdrop`. 388 still adds `--shadow-pop` and moves the other scrims onto this token.
**Why:** 387's text names "a `--backdrop` scrim". A `bg-black/30` stopgap would be a colour literal the palette gate refuses, and 388 would only have to replace it.
**Revisit if:** 388 wants different values or names. Only the two token lines would change.

## Q: Where does the user menu go on a phone, with no rail?
**Decision taken:** At the drawer's foot. It opens ABOVE the avatar, inside the drawer, through a new `placement="above"` on `UserMenu` (the rail keeps `beside`). An Esc inside the open user menu closes only the menu; a second Esc closes the drawer.
**Why:** Without it, a phone has no sign out, no theme toggle and no build stamp. The prototype's drawer dropped them, and `phone-390-drawer.png` is cut off at 800px, so it neither shows nor rules out a foot.
**Revisit if:** the owner wants the phone drawer to be the tree only. Remove the foot `div` and the `placement` prop.

## Q: The drawer's and the hamburger's labels
**Decision taken:** New keys `common:topbar.drawer.open` = "Open menu" (the hamburger) and `common:topbar.drawer.label` = "Menu" (the dialog's name). The drawer's X reuses the existing `common:rail.close` ("Close"), the same key the flyout uses.
**Why:** The ticket asks for the hamburger's and the drawer's accessible labels under `topbar.*`. A second "Close" key would duplicate an existing one.
**Revisit if:** the owner wants wording such as "Open navigation".

## Q: Is the drawer modal? Is the 640–1279 overlay?
**Decision taken:** The drawer is a modal dialog (`aria-modal`, Tab wraps inside it, focus on the first leaf when it opens, focus back on the hamburger after every close). The 640–1279px overlay is a non-modal disclosure: the toggle keeps focus and carries `aria-expanded`, and Esc returns focus to the toggle.
**Why:** The drawer locks the body and covers the page, so it behaves as a dialog. The overlay is the rail's own tree laid over the page for a moment, opened by its toggle.
**Revisit if:** an accessibility review wants the overlay trapped too.

## Q: The overlay toggle's wording while it is open
**Decision taken:** It keeps the rail's "Expand menu" / "Collapse menu" (`common:rail.*`), as the prototype did.
**Why:** It is the same control, and its effect is the same: the tree shows, then goes. No new key is needed.
**Revisit if:** the owner reads "Collapse menu" as a setting. `rail.close` would fit the overlay instead.

## Q: Crossing a band while something is open
**Decision taken:** A width change that crosses a band closes the overlay and any flyout. Shrinking below 640px unmounts the rail. Widening from a phone unmounts the drawer, and its cleanup puts back the body's overflow.
**Why:** A transient overlay must never turn into a pinned tree, and a scroll lock must never outlive its drawer.
**Revisit if:** never, most likely.

## Comments
- "Maximum update depth exceeded": not seen. Every drive mode asserts no page errors.
- Not proven: the scroll lock is `overflow: hidden` on `body`, which Chromium honours. Older iOS Safari can still touch-scroll the page behind. That needs a real-device check (owner).
- Noticed, not this slice's: in the RTL expanded user foot (rail or drawer), the Latin name aligns left while the user id aligns right. That comes from 386's `<bdi className="block">`. Left for 391's sweep.
