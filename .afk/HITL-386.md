# HITL-386 — unattended decisions, ticket 386 (the top bar carries the crumb, the store chip and the bell)

## Q: Where does the crumb's record number come from?
**Decision taken:** From the route's params (the deepest match's `useMatches()` params, splat ignored), never from the path's last segment. `/nphies/authorizations/new` shows no record; `/oms/document/1000000393` ends on `1000000393`.
**Why:** The prototype guessed with "the last segment has a digit", which would mislabel a create screen or a code-shaped segment. Every `:param` route inside the shell today is a real record (`documentNo`, `deliveryNo`, `id`, `loyId`).
**Revisit if:** a shell route gains a non-record param (a `:tab`, say). It would then show as the record, and `deriveCrumb` would need a named record param per route.

## Q: What does the crumb show on an address no menu item claims (the home page)?
**Decision taken:** The brand name (`common:brandName`), as the prototype did.
**Why:** A blank crumb reads as broken. The brand is the honest answer for `/`, and it needs no new key.
**Revisit if:** the owner wants the home page to read its own title (a `common:topbar.home` key).

## Q: The build stamp's wording
**Decision taken:** "Build `v26.08.17+sha`". The label is `common:topbar.userMenu.build` and the tag is mono through `Ltr`. It no longer carries the brand, which the old footer and the C capture had ("al-dawaa BackOffice · v…").
**Why:** The ticket asks for "the build-stamp label". Gluing the brand to the tag with ` · ` would be a two-value pair in JSX, and the brand already heads the rail.
**Revisit if:** the owner wants the brand back in the stamp. That would be one key, `"{{brand}} build"`, or a `formatPair`.

## Q: Sign-out wording, and whether the theme toggle is a checkbox item
**Decision taken:** "Sign out" (new key `common:topbar.userMenu.signOut`; the ticket says "sign out"). The orphaned `common:actions.logout` key is left in place. The theme item is a `menuitemcheckbox` labelled "Dark mode", with `aria-checked` set to the theme. It keeps the menu open when toggled, so the change shows at once.
**Why:** The ticket's own words, plus the ARIA menu pattern. Removing an unused key is out of this slice.
**Revisit if:** the owner prefers "Logout" (the prototype's copy), or wants the menu to close after a toggle.

## Q: What the user menu and store chip look like before 388
**Decision taken:** The user menu is navy (`bg-rail`, `border-rail-accent`, rail-muted secondary ink, rail-accent hover, gold ring through the rail's `--ring`). It opens against the rail's inline-end edge at its foot. The store panel is a card (`bg-card`, `border-border-strong`, `rounded-lg`, `shadow-lg`). 388 swaps in `--shadow-pop` and its final recipe.
**Why:** 377 §1 rules by origin: from the rail is navy, everything else is card. 386 gives structure, focus and dismissal; 388 owns the finished look.
**Revisit if:** 388 restructures either overlay.

## Q: The store chip on a narrow top bar
**Decision taken:** Below `lg` (1024px) the words "Acting store" become screen-reader-only. The code and the attention tone stay. The unset chip always shows "No acting store".
**Why:** This is the prototype's `hidden lg:inline`, kept in the accessible name. Narrow widths are otherwise 387's.
**Revisit if:** 387's phone layout wants the chip to collapse further.

## Note: `settlement-drive.mjs` flaked once
The first run after this change failed 4 checks: three nav-leaf clicks showed the old screen, and one ledger chip click recorded no call. The next two runs were 291/291 with nothing changed in between, so I treated it as a timing flake (lazy route plus a 150ms settle). Its two `locator('nav').innerText()` reads were fixed for real: the crumb is now a second `<nav>`, so they read every nav.
