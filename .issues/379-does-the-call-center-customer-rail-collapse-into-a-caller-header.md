---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
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

## Prototype (2026-10-02, awaiting the owner's pick)

- **Branch:** `prototype/379-cc-rail` (`36d6be9`) in worktree `C:\Playground\oms-react-379`. It is
  rebuilt from 373's `bdc24e7`, because the 373 branch ref and worktree had been pruned and only the
  commit survived. It never merges.
- **Run:** `npx vite --port 5379`, then open
  `/prototype/callcenter-rail?stub=1&palette=navy&variant=A|B|C|D&state=…`. ←/→ change the variant
  and ↑/↓ change the scenario. There are seven scenarios: opening, just attached with 2 requests,
  converting a request, resting order, collection with a kept address, collection with no store,
  and Arabic RTL.
- **Setup:** 373 D's sentence and ledger sit in the real `ConsoleShell`, beside a 56px stand-in
  for 363's collapsed navy rail. `stub=1` answers the member lookup (a number ending `0000` is a
  miss) and the two sign-up calls, so find, attach, sign-up and remove all work offline.
- **Variants:**
  - **A — Rail as today:** 260px and unchanged. This is the control.
  - **B — Slim caller rail:** 220px. The rail keeps lookup, attach, sign-up and requests, and drops
    the address and "Collecting from" block.
  - **C — Caller header (Far):** no rail. One bar at the top of the centre column runs lookup →
    found → Attach → name · tier · points · mobile · member · requests · ✕. Sign-up opens in the
    flow under the bar.
  - **D — Rail to open, header after:** A's rail while nobody is attached, collapsing into C's bar
    on attach.
- **Measured** (`node tools/proto-379-shots.mjs`, with 52 captures in [379-shots/](assets/379-shots/)):

  | Variant | Centre column at 1280 | at 1440 |
  |---|---|---|
  | A | 644px | 804px |
  | B | 684px | 844px |
  | C | 904px | 1064px |
  | D | 904px after attach | 1064px after attach |

  - All four keep the caret in the phone box on open and on remove, keep tier and points across
    the attach, draw the requests offer once the caller lands, and keep sign-up on screen.
  - **D fails 135:** the centre jumps from 644px to 904px on attach.
  - **Only A still has an address-book door outside the sentence.**
- **Seen:**
  - **C's bar needs the short form.** Tier, points and the full "This caller has 2 open
    requests." wrapped the bar at 1280. "2 open requests · View" and an icon-only ✕ (the rail's
    own) fit on one line.
  - **C's linked-request chip has no room for the reason, raised-at and the pharmacist's note**
    that the rail card shows. They are a tooltip in the prototype.
  - **The caller's name is said twice in C:** once in the bar and once in the sentence.
  - **The trace moves:** in B, C and D the kept-address line sits under the sentence, and the store
    word says "Collecting from".

## Answer

**C: the customer rail collapses into a caller bar at the top of the centre column.** The owner
decided on 2026-10-02 after the live prototype above, and took the recommendation on all three
questions.

### 1. The layout

- **The console has two columns plus a bar:** 363's 56px navy rail, then the centre column
  (`minmax(0,1fr)`), then the receipt (320px). 135's 260px start column goes.
- **The centre column grows:** 644 → 904px at 1280, and 804 → 1064px at 1440.
- **135's "the furniture doesn't move" still holds.** The bar takes the same pixels before and
  after the attach, and the centre width does not change across it.
  - **D was rejected:** its centre jumps 644 → 904px mid-call.
  - **B's +40px** did not pay for keeping a column that repeats the sentence.
- **The operator lead must accept it.** The phone box moves from the start column to the top of
  the centre. That is a behaviour change, so under 361 it needs the operator lead's acceptance at
  the Call center step.

### 2. Where each of the rail's jobs goes

- **Phone lookup:** the bar's phone box, keeping the `cc-phone` id.
  - 165/153 hold: the caret lands there on open, keyed on the order, and returns there on remove.
    Measured in all four variants.
  - The found member appears inline in the bar with **Attach**, so the two steps stand.
  - The palette's *attach caller* row still focuses the box.
- **Attach and remove:** Attach is in the bar. Remove is the rail's icon-only ✕ at the bar's
  inline end, with its aria label. The palette's *remove caller* row is unchanged.
- **Loyalty sign-up:** a miss offers *Sign this caller up* in the bar. `SignupPanel` opens **in the
  flow under the bar**, never as a modal. That keeps 159's inline ruling, with the bar now standing
  where the rail did.
- **Open requests:**
  - **The count** becomes a chip in the bar, on attention ground, that opens 194's picker
    unchanged. It needs a short form, "N open requests · View" (a new plural key), because the
    rail's full sentence wrapped the bar at 1280.
  - **A linked request** shows a *Converting request ‹no› ↗* chip. Clicking it opens an **in-flow
    detail section under the bar** (175 §9's idiom, like sign-up). The section carries:
    - the reason;
    - *Raised at store ‹code›*;
    - the pharmacist's note;
    - the ↗ link;
    - **Unlink**, which opens 195's confirmation unchanged.

    The owner chose this over a tooltip, which keyboard and touch never see, and over a second bar
    line. The section was not prototyped and is drawn at build.
- **The address book:** the **sentence's address word is the only door** (373). The rail's *Pick an
  address* and *Change* go.
- **"Collecting from" and the trace:**
  - The sentence's store word replaces "Collecting from".
  - `STORE_NOT_CHOSEN` is said once, by the store word.
  - **The retained-address trace** (176) becomes a note under the sentence beside `HeaderNotes`:
    "Their Home address is kept…".
- **The opening-steps card:** the caller step's hint changes from "the panel on the left" to point
  at the caller bar. 373 already found the store hint stale, so both are reworded at build.

### 3. What the bar shows

- **When a caller is attached:** name · tier · points · mobile · member id · the requests chip · ✕,
  on one line at 1280.
- **The fields stay `railFields`'s.** 135's six-field cap and fixed order hold in the bar, and tier,
  points and email still come only from this session's lookup member.
- **The name is said twice, on purpose.** The bar says who is on the line, and the sentence's
  readout is what is read back (owner).
- **Bidi:** the name is in `<bdi>`, and the mobile and member id are in `Ltr` and mono (359). The
  Arabic RTL capture mirrors correctly, with ✕ at the inline end.

### Amends

- **135:** two columns plus a bar.
- **165:** the rail becomes the bar. Its caret and two-step rules stand.
- **159:** sign-up sits under the bar.
- **194:** the count block becomes a chip, and the card becomes a chip plus an in-flow detail.
- **166 and 176:** the rail's address and collection blocks are retired. The sentence owns them.
- **363:** the hand-on *CustomerRail → `card-2`* is moot, because `CustomerRail` and its
  `bg-sidebar` use leave the console.
