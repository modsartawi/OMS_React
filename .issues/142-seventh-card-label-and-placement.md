---
type: wayfinder-ticket
wayfinder: grilling
map: 139
status: done
blocked-by: 141
---

# 142 — Naming and placing the seventh card

## Question

The card row already ends in **Disabled**, which is driven by `isActive`. Dropping a card labelled
"Active users" next to it reads as its complement — and it isn't: one is about the account being
enabled, the other about the person having finished activation. Two different senses of "active"
sitting side by side is a misreading waiting to happen.

- What is the card's **label**? "Activated", "Completed activation", "Signed up" — or does the
  existing "Disabled" card need renaming instead so the pair stops colliding? Whatever is chosen
  becomes a `t()` key in `src/locales/en/ua-admin.json`.
- Where does it sit in `CARDS` (`UaAdminUsersPage.tsx:18`)? Next to **Awaiting activation**, so the
  before/after pair reads together, or at the end?
- What **tone** class? The existing cards spend colour meaningfully — danger for `notSeeded`,
  attention for `phoneGap`, the sidebar accent for the two activation-ish cards. An "everything is
  fine" count may want no tone at all rather than a seventh colour.
- **Layout.** The row is `grid-cols-3 md:grid-cols-6` — seven cards break the even split. Does it
  become `md:grid-cols-7`, wrap to two rows, or does something else move?

The screen's palette rules come from the POS steel-blue standard (map 068) — don't mint a new hue.

## Answer

**Label — `cards.completedActivation` → "Activation done". "Disabled" does not move.**

The collision is the *word*, not the position, so the fix is to not spend the word. "Activated" is
out for exactly that reason: a past participle about account state sitting one card from "Disabled"
reads as its complement. Keeping the noun **activation** is the safeguard — "Awaiting activation" /
"Activation done" are visibly two ends of one journey and cannot be misread onto the
enabled/disabled axis.

"Activation done" rather than the domain term "Completed activation" only because the labels on this
row are terse (`Not seeded`, `Must change pwd`). The domain term stays **Completed activation** in
`CONTEXT.md`, in the spec, and as the code key / wire field 141 named — the ubiquitous language is
intact; only the on-screen string is shortened.

Renaming **Disabled** is **declined**: it is the same word as the `status.disabled` pill, the Status
column, and the Disable / Re-enable actions in `UserDetailPane`. Renaming it to fix a neighbour
desynchronises four places to repair one.

**Placement — position 5 in `CARDS`, immediately after `awaitingActivation`:**

```
all · notSeeded · phoneGap · awaitingActivation · completedActivation · mustChange · disabled
```

The row keeps its narrative: population → the two things blocking people → **the activation pair,
adjacent** → the admin-reset detour → account state. At the end, the before/after pair would be
separated by two cards and the reader would be comparing numbers across the row.

**Tone — none (`tone: ''`). No seventh hue, and not the sidebar accent its neighbour carries.**

On this row colour means *there is work here*: danger for `notSeeded`, attention for `phoneGap`,
sidebar accent for the two queues someone has to drain. This card is the only one whose rows need
nothing done — an odometer, not a worklist. It joins `all` and `disabled` as untoned. The asymmetry
with `awaitingActivation` is deliberate and must be stated in the spec, or it reads as an oversight.

**Layout — the row stops being a fixed six-slot grid:**

`grid grid-cols-3 md:grid-cols-6` → **`grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]`**

Nothing else moves. `md:grid-cols-7` squeezes seven cards into 768 px, and — the deciding argument —
141 rules the card is **hidden entirely while the server field is absent**, so the row must look
right at *both* six and seven cards; a hardcoded 7-column grid leaves a visible hole on the right
for the whole period before the addendum lands. Auto-fit is correct at 6 and at 7, at every width,
with no breakpoint ladder: ~7 across at full desktop, 6 as it narrows, 3 on a tablet, 2 on a phone.
Labels wrap to two lines at the tightest widths, as they already do today; grid items stretch, so
cards stay equal height.

```
┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ 6,012  │   184  │   397  │  1,240 │  3,908 │    62  │   211  │
│ People │  Not   │ Phone  │Awaiting│Activa- │  Must  │Disabled│
│        │ seeded │ gap —  │activa- │tion    │ change │        │
│        │        │blocked │tion    │done    │  pwd   │        │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┘
   —      danger  attention  accent   (none)   accent    —
```

**Nothing for the addendum** beyond the `completedActivation` field 141 already specified.

Approved by the human 2026-07-27 as recommended, unchanged.
