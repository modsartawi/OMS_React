## Q: Should the line projection exclude `deleted` lines?
**Decision taken:** No — `returnableLines` projects every line the document carries; only a zero remainder omits a row.
**Why:** Ticket/spec 289 D3 name exactly one rule (`remaining = quantity − returnedQuantity`); a deleted-line rule is an unstated eligibility rule, and `items.ts` already sets the house precedent of showing deleted lines rather than hiding them. It can only affect the tooltip split, never `disabled`.
**Revisit if:** the return dialog ticket (291+) finds the server accepts a deleted line, or 1283 says deleted lines are not returnable.

## Q: `BZ02` still appears in `tools/document-band-drive.mjs` and `tools/document-cards-drive.mjs`; the ticket says it should appear nowhere in the repo.
**Decision taken:** Left both alone. Only `src/` was swept, per the ticket's own **Done when** (`grep -r "BZ02\|'BB'" src/`).
**Why:** Those two hits are assertions on the store code rendered from a captured live payload — data, not the store rule this ticket deletes. Removing them would delete a true assertion.
**Revisit if:** a later ticket restates the no-`BZ02`-anywhere rule as covering drive assertions on captured data.

## Q: Names for the three new `command.disabled.*` keys.
**Decision taken:** `returnNeedsDelivery`, `returnStarlinksOnly`, `returnNothingLeft`.
**Why:** Matches the existing `requestOpen` style (cause-named, camelCase) and prefixes with the command they belong to now that the command owns three of them.
**Revisit if:** a later slice adds disabled reasons for other commands and a per-command nesting reads better.

## Q: The reason table checks `documentCategory` first — but that would let a category refuse a return the server allows (capture `9000000003` is opened as a delivery with `documentCategory: 'T'`).
**Decision taken:** `canReturn === true` is asked FIRST and alone; the category and the projection only choose which of the three REASON strings a disabled command shows, in spec 289 D2's order.
**Why:** D2's own ruling is that `disabled` follows `canReturn` and nothing else; the table's order is the order the reasons are checked, not a second gate. Still fails closed — absent `canReturn` disables everything.
**Revisit if:** the live door (ticket 295) shows the server sends `canReturn: true` on documents the create call then refuses on category.

## Q: A delivery with `canReturn: false` and no lines at all — which reason?
**Decision taken:** The store-rail reason. Exhaustion must be PROVEN by lines that were returned (`hiddenCount > 0`), not merely by an empty projection.
**Why:** "Everything has already been returned" is a false statement about a document with nothing on it. Tooltip-only either way.
**Revisit if:** a live bonded delivery legitimately arrives with an empty `lines` array.

## Q: `/standards-review` flags that `CommandContext` now carries the whole `lines` array purely so a tooltip can be split (Refused Bequest / Feature Envy), and that the header→context mapping is spelled in four places.
**Decision taken:** Both left as they are. `lines` stays on `CommandContext`; no `commandContext(document, busy)` mapper was extracted.
**Why:** Spec 289 D3 puts *every* decision the screen makes in the pure layer — handing the panel a pre-computed `nothingLeft` boolean would move the store-vs-exhausted split into the composition root, which is exactly what D3 rules against. The mapper is a real duplication but three of its four sites are tests, and ticket 291 reworks this surface anyway.
**Revisit if:** 291 or 292 adds a sixth field to `CommandContext`, or the panel's memo is measured churning on `lines`.

## Q: `bonded return`, `Starlinks rail`, `remaining` and `exhausted` are load-bearing new domain terms that `CONTEXT.md` does not define.
**Decision taken:** Not added — noted for a `/domain-modeling` pass before ticket 291.
**Why:** 290's Spine reach names model, logic, component, i18n and test; the glossary is not in it, and inventing entries for a screen that does not exist yet would pin vocabulary the return dialog has not settled.
**Revisit if:** 291 lands the dialog — that is the point at which the terms are worth pinning.

## Q: Spec 289's Testing Decisions describe `delivery-with-remaining` as also carrying **two header delivery-fee conditions**; the fixture built here carries the capture's own single per-line condition.
**Decision taken:** Line shapes only. The fee-condition half is left to the fee-projection ticket.
**Why:** 290's Boundaries scope the fixture to "one line untouched, one partly returned, one fully returned"; and the fee filter is unresolved — live capture `8000000121` carries its header `DFEE` row with `condCategory: ""`, so inventing two fee rows now would bake a guessed category code into a fixture whose shape is contractual.
**Revisit if:** the fee-projection ticket lands — it extends this fixture rather than writing a second one.

## Q: Both the ticket's and spec D2's tables say the three causes are listed "in the order they are checked", but `canReturn` is now asked before the category.
**Decision taken:** Left the tables alone; the code comment records the divergence.
**Why:** The tables' rows are still the order the three REASONS are checked; only the enable/disable answer moved ahead of them, which is D2's own "disabled comes from `canReturn` and nothing else". A spec edit is spec 289's to make, not a ticket's.
**Revisit if:** ticket 295 (the live door) reopens D2 for any other reason — fix the sentence in the same pass.
