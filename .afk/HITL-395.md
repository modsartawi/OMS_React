# HITL log — ticket 395 (the call center's palette is the core one)

## Q: "Terminal rows sort last" — last within This screen, or last in the whole palette?
**Decision taken:** Last in the WHOLE palette. `composePalette` lifts every `terminal` row out of its group into a trailing `terminal` group listed after Go to and Jump. That group has no heading: a top rule sets it apart (PALETTE_GROUP_LABEL.terminal = null).
**Why:** Ticket proof says "terminal rows render last", and 192's ruling had the terminal pair as the list's final rows. Keeping them inside This screen would put Go to rows below them. A heading-less group adds no new copy.
**Revisit if:** The owner wants the terminal pair to stay visually inside This screen (above Go to), or wants it to carry a heading.

## Q: Where does an offer row's server-supplied description go in the core palette?
**Decision taken:** Added an optional `detail` field to `Command` and `PaletteRow`. It holds free text from the server, rendered in a `<bdi>` beside the label and matched by the typed words.
**Why:** The console's offer rows were found by the server's own words (192). The existing `value` slot is a mono `Ltr` machine value, which is the wrong isolate for free text (bidi rule).
**Revisit if:** A later slice wants offers drawn differently (e.g. the description as the label).

## Q: How does a server-named refusal with no words fall back to its family's general sentence, now that the core renders `t(row.reason)`?
**Decision taken:** The registration resolves it. `paletteCommands` takes `known: (key) => boolean` (`i18n.exists` in ConsoleShell) and picks the general key when the server-named one has no words. The core `Command.reason` stays a single key.
**Why:** No change to the core's contract. The pure tests still pin the fallback against the locale file.
**Revisit if:** A second screen needs per-row fallback keys. Then it belongs in the core.

## Q: What happens to the console palette's own chrome keys (callcenter:palette.title/placeholder/empty/foot.*)?
**Decision taken:** Removed. The core palette's common:palette.* copy serves. The row labels and reasons (palette.offer, palette.verb.*, palette.terminal.*, palette.reason.*) stay in the callcenter namespace, re-pointed with the `callcenter:` prefix.
**Why:** No consumer is left. The ticket says the row labels stay in the console's namespace, and the chrome is the core's.
**Revisit if:** Something outside src/ (docs, a drive) still quotes those strings.

## Note: tools/callcenter-drive.mjs block 4 ("the granted agent sees the Call center leaf") fails, 528/529
**Not this slice's:** It reads the nav's button text on `/`. Since 385 the rail is collapsed and icon-only, so no button text says "Call center". This slice touches no layout/rail code. Every 395 check (block 44) passes in light, dark and RTL.
