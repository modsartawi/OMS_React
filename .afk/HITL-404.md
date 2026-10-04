# HITL — ticket 404 (AFK, 2026-10-04)

## Q: Where does the order's Attachments tab land?
**Decision taken:** A `<details>` disclosure in the facts column, under Items. It reads "Attachments · n" (no count until one is known, as the tab badge did), and it sits LAST, after Pricing conditions. The Prescription block's Files · N · Show row opens it and moves focus to its summary. Opening it is the list's first selection, so the audited ByOwner read still waits for it. Its body stays mounted when folded, so a file still sending survives a fold.
**Why:** It is the runner's settled default ("a disclosure under Items with its file count"). Placing it after Pricing conditions keeps D4's own order (facts → Items → Pricing conditions) intact.
**Revisit if:** The owner wants it as a facts block, or between Items and Pricing conditions. Raise it at the S4 sign-off.

## Q: Phone numbers in Plex Mono?
**Decision taken:** Yes. The customer mobile and the driver mobile are set in mono, along with the IDs and codes (loyalty ID, approval no., patient ID, e-Rx ref, store, courier, tracking). Money, the delivery window, names and words stay in Sans. This is a key set in `FactsColumn.tsx` (`MONO`). `railCards` is unchanged, because its `numeric` flag also covers money.
**Why:** The approved 371 D captures draw both phones in mono, and spec 380 C sets the caller bar's mobile in mono. A phone is quoted digit by digit, like a key.
**Revisit if:** The owner reads 359's "IDs and codes only" strictly. Then drop `mobile` and `courierDriverPhone` from `MONO`.

## Q: How should the blocks look?
**Decision taken:** One `--card` card holding the five blocks in a grid: two columns from `md`, three from `2xl`, as in the prototype. Each block has a small uppercase heading. Only Prescription is coloured (`--prescription`, a pair newly measured in check-contrast). The Driver block loses 083's `fam-fulfilment` accent bar, and every block loses its accent bar. Values sit at the inline start after the label. The total keeps its rule.
**Why:** The 371 D captures govern layout, and they show exactly this.
**Revisit if:** The owner wants the Driver block's colour back.

## Q: Copy for the section headings
**Decision taken:** "Items · n", "Pricing conditions · n" and "Attachments · n" (`items.heading`, `conditions.heading`, `attachments.heading`, with `_one`/`_other`, identical in English). The count is a `<Trans>` slot isolated with `Ltr`. "Attachments" alone when there is no count yet. `conditions.empty` now reads "no header-level pricing conditions". The Show row's spoken name is "Show the order's files under Attachments". The bare-403 withdraw notice no longer says "this tab".
**Why:** The heading wording follows the captures. The ticket asks for a plural key, so an Arabic locale can vary it. Copy must not mention a tab that no longer exists.
**Revisit if:** —

## Q: Retired keys
**Decision taken:** The whole `document:tabs.*` block is retired (ariaLabel, row/file counts, the three labels). `grid.loading` is KEPT, because ChangeStoreDialog and PickupAddressPanel still use it (/code-review caught it being dropped). `cards.ariaLabel` now reads "Document facts".
**Why:** "Retire the tab-label keys that no longer render."
**Revisit if:** —

## Q: The items grid "sized to its rows": how?
**Decision taken:** `DetailGrid` always uses `domLayout: 'autoHeight'`. Its floor is one row (`autoHeightMinBodyHeight: OMS_GRID_ROW_HEIGHT` in the core theme), down from AG Grid's 150px. A core CSS rule in `global.css` puts AG Grid's overlay ("invisible") horizontal scrollbar in its own lane under the grid. That scrollbar used to be hidden in the 150px floor; without the floor it covered and swallowed clicks on the last line. With classic scrollbars, nothing changes. `DetailGrid` lost its unused loading and error states.
**Why:** The ticket calls the floor a capture artefact. The drive proves no floor, no covered last line and the scrollbar lane inside the frame, at 4, 2 and 1 rows.
**Revisit if:** A document with hundreds of lines shows up (auto-height draws every row; there is no virtualisation).

## Q: Pricing conditions grid lifetime
**Decision taken:** The conditions grid is built the first time the disclosure opens, then kept mounted, so a sort or filter survives a fold.
**Why:** It avoids mounting a hidden AG Grid on every page load. It also keeps D-23's "never rebuild a grid the operator configured" spirit.
**Revisit if:** —

## Q: The 900px `rail:` breakpoint
**Decision taken:** Deleted from `global.css`. Its only users were the summary rail and the page grid this ticket removes.
**Why:** It is dead, and its comment described a rail that no longer exists.
**Revisit if:** —

## Note: what the reviews raised and was left alone
- `AttachmentsTab.tsx`, `attachments-tab.ts`, `attachmentsTabGate`, `railCards`/`RailCard`/`RailFiles` keep their names. Their doc comments now say disclosure / fact cards. Renaming them churns tests and four tickets' history for no behaviour; a rename sweep can follow.
- `FactsColumn` relays five `OrderAttachments` fields into `AttachmentsTab` one by one (carried over from the page, untouched).
- `document-rtl-drive` stays at 52/53. It is the same pre-existing Plex Mono "inert inline box" check, with the same three entries as at 401–403. An inline-flex tracking link briefly added a fourth; the anchor is now inline, so it is gone.
- `foundation-drive` stays at its 1294/1302 baseline (topbar search box and bell count, not this slice).
- `grid-theme-drive` still skips Pricing conditions: its stub document has no header conditions, so the empty line renders instead of a grid.
