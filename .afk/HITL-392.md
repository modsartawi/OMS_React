# HITL log — ticket 392 (Ctrl+K opens one palette with Go to and Jump to number)

## Q: What are the route flags called?
**Decision taken:** `handle: { print: true }` on the two print routes (`/collection/receipt/:id`, `/collection/acr/:id`) and `handle: { ownPalette: true }` on `/callcenter`. Both are typed as `PaletteRouteHandle` in `@/core/commands/palette-model`, read by the pure `paletteOptedOut(matches.map(m => m.handle))` in `ProtectedLayout`.
**Why:** 375 R4 names `handle.print`. The console is not a print route, so it gets a second flag through the same mechanism and is not mislabelled as print. 395 deletes `ownPalette`.
**Revisit if:** the owner wants a single flag (for example `palette: false`) for both.

## Q: K2 lists "a group" and "an optional hidden flag". Does 392's `Command` carry them?
**Decision taken:** Neither yet. `Command` is `{ id, label, run?, reason?, icon? }`. Every registered command lands in This screen.
**Why:** K1 says `useCommands` "is the whole This screen group", so a `group` with one legal value is noise. `hidden` exists only for J/K, which are 393's keys. The ticket's "K2 (without `keys`)" was read as "the fields 392 has a use for".
**Revisit if:** 393's help sheet or L17's lens and view rows need a sub-group. Add `group` then, defaulting to `screen`.

## Q: Is Ctrl+K inert only under a native `dialog[open]`?
**Decision taken:** It is also inert under a hand-drawn `[role="dialog"][aria-modal="true"]` modal. That covers the saved-view dialog, the phone drawer and the collection assignment modal. The drive checks it on Save view in all three modes.
**Why:** /code-review found that the palette over the Save view dialog navigates away from a half-filled name. An `aria-modal` overlay is a dialog in every sense K4 means.
**Revisit if:** 393's single-key tier must test only `dialog[open]`. It should use the same selector.

## Q: Bubble or capture phase for the Ctrl+K listener?
**Decision taken:** Bubble, on `document`, like the console's.
**Why:** It is driven green from a text box, an AG Grid cell, the top-bar field and an Arabic layout. K4/368 say "a key a control has already handled stays that control's", and that only works in bubble.
**Revisit if:** a control is found that stops propagation of Ctrl+K.

## Q: Copy for the top-bar field and the palette box
**Decision taken:** The field reads "Go to a screen, or open a delivery or document number". The box placeholder reads "Type a screen, a command or a number". The prototype's "Search deliveries, documents, customers…" was not used.
**Why:** Live search is not in S2 (376/411). Copy that promised a customer search would be false until 411 lands.
**Revisit if:** 411 ships live search. Reword both then.

## Q: Jump to number with Arabic-Indic digits
**Decision taken:** `jumpNumberOf` folds Arabic-Indic (U+0660–0669) and Persian (U+06F0–06F9) digits to ASCII before matching `^\d+$`.
**Why:** It is cheap and pure-tested. An Arabic layout's digit row can type them, and the route takes ASCII.
**Revisit if:** anyone wants the palette to refuse non-ASCII digits.

## Q: The Ctrl+K key cap colour in the top-bar field
**Decision taken:** The K cap is gold with navy ink (`bg-gold text-gold-foreground`), and Ctrl is a plain cap.
**Why:** The token table's `--gold` comment names "the Ctrl+K key cap, S2" as a sanctioned gold fill, and the Far prototype draws it so. The pair `--gold-foreground` on `--gold` is already gated.
**Revisit if:** the owner reads gold-on-light-card as off-limits even as a fill.

## Q: No page registers a command yet. Is This screen proven?
**Decision taken:** The mechanism (`useCommands`, registry, disabled row with its reason) is proven by pure tests only. The drive shows This screen absent and Go to leading. No page was given a command in this ticket.
**Why:** The ticket builds the mechanism. The first registrations are 393 (list keys), 400 (views) and 406 (Process). Inventing one here would be scope creep.
**Revisit if:** the owner wants an on-screen disabled-row check before S3. Add it to 393's drive.
