---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: open
blocked-by: —
---

# 379 — Does the Call center customer rail collapse into a caller header?

## Question

[The Call center order header as a sentence](373-the-call-center-order-header-as-a-sentence.md)
puts the caller's name and the delivery address into the sentence. The console's 260px
`CustomerRail` now repeats both. The Far prototype collapses the rail into a **caller header**
above the sentence, and its adoption note flags the risk: "Dropping the fixed 260px customer rail
changes muscle memory for the current console users."

[The rail shell](363-the-rail-shell.md) also brings the console into the app shell with the navy
rail collapsed to 56px. The width budget is now 56 + 260 + centre + 320 inside 135's 1440 → 1280
target.

**Does the customer rail stay, shrink, or collapse into a caller header?** If it moves, where does
each of the rail's jobs go?

- **The phone lookup.** It autofocuses on open (153, CC2 finding 1), and the two-step "find, then
  attach" flow is 165.
- **Attach and remove the caller.**
- **Loyalty sign-up** for a caller who isn't a member (159/190).
- **The caller's open requests** and converting one (194).
- **The address book**, plus the retained-address trace and the "Collecting from" block (166/176).
- **The opening-steps card,** which points at "the panel on the left".

**Constraints:**

- 153 and 365 hold: no single letters, no slash commands, and `terminal` commands can't carry a
  key.
- The sentence's address word already opens the rail's address book.

Prototype it in the live `ConsoleShell` on the navy tokens. 373's branch
`prototype/373-cc-sentence` is a ready host, with D's sentence and ledger in place.
