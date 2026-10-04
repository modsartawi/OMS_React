# HITL-383 — unattended decisions, ticket 383 (every grid mirrors under RTL and isolates its values)

## Q: Where does the boot direction come from, when the app has no language switch and no Arabic locale?
**Decision taken:** `index.html`'s pre-paint script reads `localStorage['oms.locale']`. It sets `<html dir>` to `rtl` for `ar`/`ar-*` and to `ltr` for any other stored value. With no stored value the page is untouched (LTR). `src/core/theme/direction.ts` reads `<html dir>` once at module load. Only `dir` is set. `lang` stays the markup's `en` because `src/core/i18n.ts` still renders English. No switch was built, and i18n was not touched.
**Why:** F22 says "set from the locale before first paint, the way the theme is". The theme uses `oms.darkMode`, and this mirrors it. The spine says "No api or i18n". Standards review flagged that setting `lang="ar"` over English strings would make the two disagree.
**Revisit if:** the language switch ticket wants a different key, or wants i18n's `lng` read from the same key. The switch must write the key and reload.

## Q: DownloadAction was pinned `'right'` (the END of the row). Does `pinStart` replace it as the ticket says?
**Decision taken:** No. A `pinEnd` twin was added to `direction.ts`: `'right'` in LTR and `'left'` under RTL. DownloadAction uses it.
**Why:** `pinStart` would move Download to the reading start in LTR, and that is a regression. The ticket's intent is "no literal side". 378 measured that pinning is physical, so DownloadAction's own comment claiming that `'right'` mirrors was wrong.
**Revisit if:** the owner wants the action column at the start.

## Q: The drive needs "the pinned Delivery no.", but Delivery no. is not pinned by default on this branch.
**Decision taken:** The drive pins it through the Deliveries toolbar's own Pin control, which now pins to `pinStart`. The default pin is not added here.
**Why:** 401 owns "Delivery no. is pinned with `pinStart`" (spec L-list). The toolbar's `'left'` literal was a third literal side, so it moved to `pinStart` as well.
**Revisit if:** 401 lands. Its drive should then assert the default pin.

## Q: Custom cell renderers bypass the base `<bdi>`. How far does 383 go?
**Decision taken:** Whole data values printed by a custom renderer are now isolated (`<bdi>`, dir auto):
- the eligibility patient name and ID;
- the slip count;
- the settlement entry number;
- the branch name and code;
- the remaining money;
- the "served by" names;
- the chaser's name;
- the BBY identity number.

Values interpolated inside a `t()` sentence in a cell are left as they are. These are `open.age.posted`, `open.row.ofAmount`, `open.chase.line`, `open.row.theftDay`, `ageWords` and central-invoice `list.serials.open`. Badge fallbacks that show a raw unknown code are left too.
**Why:** Isolating an interpolated value needs a `<Trans>` slot, which means a locale template change. 383's Boundaries say "No i18n keys". 384 owns interpolation isolation.
**Revisit if:** 384 or a screen's step does not pick these up. Under RTL with English copy they read like "days 3".

## Q: Native `<option>` text in Assignment's accountant/collector select (a staff name or ID)
**Decision taken:** Left as is.
**Why:** A native `<option>` is a string-only sink, and the FSI helper for those is 384's (F26).
**Revisit if:** 384's sweep misses it.

## Q: Saved Deliveries views store a PHYSICAL pin side
**Decision taken:** Left as is. The column chooser now counts a column pinned on either side as pinned (`getPinned() != null`), so a column pinned under the other direction can still be unpinned. Saved sides are not converted on restore.
**Why:** No language switch exists, so a view cannot cross directions today (code-review finding, latent).
**Revisit if:** a language switch ships. Restore should then map the saved start side to `pinStart`.

## Q: Gate shape — mount-site spread or definition-site spread?
**Decision taken:** The spread goes at the definition site, so every `*_DEFAULT_COL_DEF` or builder spreads `OMS_GRID_BASE_COL_DEF` first. The gate (`tools/check-grid-base.mjs`) follows each mount's `defaultColDef` expression through local and imported consts, `useMemo` and builder functions, up to 5 hops. The file holding the spread must import the base from `@/core/theme/grid-base`. Anything the scanner cannot parse is refused. It runs a fixture self-test (3 refusals, 3 passes) before the tree. Assignment had no `defaultColDef` and now passes the base itself.
**Why:** "Every grid's `defaultColDef` spreads it." A definition-site spread keeps the column modules complete for their own vitest.
**Revisit if:** a grid builds its `defaultColDef` in a shape the scanner does not follow. The gate fails loudly in that case and never passes silently.

## Q: Drives outside this ticket's surface changed
**Decision taken:**
- `grid-theme-drive.mjs`: RTL now boots through `oms.locale`. The cursor-bar and pinned-start checks are direction-aware (125/125).
- `document-rtl-drive.mjs`: the totals footer is isolated by the base `<bdi>` (auto) and no longer by `Ltr`. The "inert isolate" width check is skipped where the parent clips, because a long item name in an ellipsis cell overflows exactly as the bare text did (53/53).
- `nphies-eligibility-drive` (`Payer code` label on the check form) and `nphies-authorizations-drive` (one copy check, "not available here yet") fail on surfaces this diff does not touch. They are left for their owners.
**Why:** Those two drives assumed an LTR grid or a `dir="ltr"` isolate, and both assumptions are now false by design.
**Revisit if:** either nphies failure turns out to be grid-related.

## Comments
- "Maximum update depth exceeded" on `/oms/deliveries`: not seen in any 383 drive run. Every mode asserts "no page errors".
