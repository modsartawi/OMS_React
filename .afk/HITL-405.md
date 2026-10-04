# HITL — ticket 405 (composer at the Now line, Delivery details keys)

## Q: Is Ctrl+Enter a registered command, or the composer form's own submit?
**Decision taken:** The form's own submit: the textarea handles Ctrl+Enter (prevented, so the key layer never sees it). It is not registered through `useCommands`, so it is not in the `?` sheet. The composer shows "Ctrl Enter to post", and its Post button carries `aria-keyshortcuts="Control+Enter"` and the tooltip "Post note (Ctrl+Enter)".
**Why:** 365 §4/§6 call it "the form's own submit", and K5 says no key writes. A registered chord fires from anywhere on the page (K4), so it would be a key that writes.
**Revisit if:** The owner wants Ctrl+Enter listed in the help sheet. Then the core needs a sheet-only, unbound line, which it does not have today.

## Q: Does Esc bind on /oms/document as well as /oms/delivery?
**Decision taken:** Esc (back to the list) is registered on both routes. R / C / N bind only on the single-key route (/oms/delivery). On /oms/document they stay palette rows with no key.
**Why:** Both routes render the same page, the header's Back chevron is on both, and Esc is its own tier, not a single key.
**Revisit if:** The owner wants Esc-back on Delivery details only.

## Q: Does a posted note raise a success toast?
**Decision taken:** No. The box clears and the note appears as the newest row of the spine, right under the composer. A failure shows inline (message and code) and keeps the text.
**Why:** The ticket names the spine re-read as the outcome, and the page already avoids success toasts for results the operator is looking at.
**Revisit if:** Operators miss the confirmation.

## Q: How does Details know "we came from the list", so Esc can use history-back?
**Decision taken:** Every one of the list's ways into Details (Enter, double-click, Open full record, the toolbar's Open delivery/order buttons, R/C/N) puts router state `{ from: 'list' }` on the history entry (`fromListState()` / `cameFromList()` in `@/core/oms/open-intent`). The mark survives the intent being replaced away. Without it, Esc goes to `/oms/deliveries`.
**Why:** It was the smallest shared shape; 401's tests had already anticipated `{ open, from: 'list' }`.
**Revisit if:** Another screen ever opens Details and wants Esc to return to it.

## Q: Labels for the help sheet's N and Esc lines
**Decision taken:** N reuses the bar's "Add Note…" (`document:actions.add-note`). Esc reuses the header chevron's "Back to Delivery Documents" (`document:back`). This gives one label per act, so no new `keys.*` keys.
**Why:** The standards review flagged two labels for one act as drift.
**Revisit if:** The owner wants verb-first sheet copy ("Write a note").

## Q: Does the header's Back chevron get Esc's behaviour (history-back, refused with unsent text)?
**Decision taken:** No. The chevron stays 402's `<Link to="/oms/deliveries">`. Only Esc is refused while the composer holds unsent text, as D10 rules.
**Why:** D10 rules Esc only, and the chevron is 402's surface. Widening the refusal to the mouse is a product call.
**Revisit if:** The owner wants a mouse Back to protect an unsent note too (spec story 97, "never lose a note I'm writing").

## Q: A palette jump to another record while a note is unsent or posting
**Decision taken:** A jump clears the unsent text, because the composer resets per record. A post still in flight completes, but its answer never touches the new record's page. If it failed, a toast names the record it was for (`composer.failedElsewhere`, number isolated with `fsi`).
**Why:** Only Esc is ruled to be refused. The in-flight case was a /code-review finding (a stale post must not clear or reload the new record).
**Revisit if:** The owner wants the palette to refuse leaving a record with an unsent note.

## Q: A Ctrl+Enter while another command is in flight
**Decision taken:** Nothing happens. The Post button is disabled, and the spinner on the command that is running says why.
**Why:** This matches the bar's busy state, which explains nothing.
**Revisit if:** Operators read it as a dead key.
