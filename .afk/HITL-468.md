# HITL — 468 (View JSON on the Transactions tab, BackOffice spec 2586 door 2589)

## Q: "a 500 uses the shared `failureLabelKey`"
**Decision taken:** a codeless 500 (the failed audit write) reads "The receipt's JSON could not be loaded." over core's
server sentence (`apiErrorMessage`). `NO_STORE` gets the shared `failures.NO_STORE` words, with the code beside them.
**Why:** `failureLabelKey(code)` maps a code to its words. A 500 with no `errorCode` has no code to look up, so the
literal reading cannot be built. If the door sends a code on its 500, it goes through `failureLabelKey` like any other.
**Revisit if:** the owner wants a dedicated "the view could not be audited" sentence. That would need the door to send a
code, e.g. `AUDIT_FAILED`.

## Q: is the store's `code` shown beside the shared words?
**Decision taken:** yes, for any code other than `NOT_FOUND`. A code with no words (`BAD_REQUEST`, or a new one) shows
raw, with the server's message. This matches how the console words a failed row elsewhere.

## Q: `TransactionsList` keyed by the store code (a 467 behaviour change)
**Decision taken:** going to another store's page starts it fresh: today, default filters, page 1, drawer closed.
**Why:** otherwise an open drawer, or a day picked on one store, would carry over to the next store's page.

## Q: does the audit feed refresh after a view?
**Decision taken:** yes. A served view invalidates the audit feeds (`AUDIT_KEY`), so "Viewed receipt JSON" appears
without a manual refresh.

## Q: the drawer frame is copied from `collection/inquiry`'s `SlipDrawer`
**Decision taken:** the frame is copied (native `<dialog>`, `SHEET`, cancel/close/backdrop handling), because a
feature never imports another feature.
**Revisit:** now that two features use it, it is due to graduate to `@/core/ui` as a `SideSheet`. That is a separate
refactor touching both features; it is not done in 468.

## Known minor
- `canOperate` is checked twice: an effect closes the drawer, and a render guard stops a one-frame flash before the
  effect runs. Both are deliberate.
- Fixed after code review: the audit feed is now refreshed from the read itself (`onServed`), so it still refreshes
  when the drawer is closed before the answer comes. The drawer's Escape also stops propagation, as core's Modal does.
- Code review called one-read-per-opening redundant (`opening` in the key, the drawer keyed by it, and `gcTime: 0`).
  All three are kept on purpose: two quick openings in a row must never share a cached answer.
- Code review raised a column jump when the access probe resolves late. It cannot happen here: the store page gates on
  `syncConsoleAccessQuery`, so the probe has answered before the tab mounts.
- The `NOT_FOUND` sentence keeps the ticket's exact wording, which has no closing period.
