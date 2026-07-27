---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: open
blocked-by: —
---

# 153 — The console's keyboard grammar

## Question

Surfaced by [135](135-agent-console-prototype.md), amendment 3. The chosen layout **draws** `Ctrl+K`,
`?` and focus-gated single letters as affordances and **specifies none of them**. Agents type while
talking; CC2's research calls a mouse-first console the thing that fails at hour nine (finding 10), and
the WPF build shipped no palette at all. Left to `/to-spec` this gets invented one shortcut at a time.

What this ticket settles:

- **The `Ctrl+K` verb list.** Every verb on 136's contract is a candidate (`addItem`, `changeQty`,
  `voidLine`, `changeUom`, `attachCustomer`, `removeCustomer`, `applyCoupon`, `setAddress`, `setStore`,
  `setSlot`, `setDocumentSource`, `submit`, `abandon`) plus navigation ones (focus search, open the
  address book, open the offer strip). Which are in the palette, how they are worded so two or three
  letters find them, and what a verb does when `capabilities` says the server would refuse it — hidden,
  or shown disabled with the reason?
- **Single-letter accelerators, and their gate.** The Gmail/Linear convention is single letters gated
  on focus not being in a text field — but this console's *resting* focus is the search box (CC2
  finding 1 puts the caret on the phone field at open, and the agent lives in search after that). A
  grammar whose gate is "not typing" may almost never be armed. Does that kill single letters, or does
  it mean a modifier (`Alt+…`, the Webex `Ctrl+Alt+…` convention) is the real answer?
- **What `?` shows**, and whether the cheat sheet is the discovery mechanism or just its backstop —
  Linear's tooltip-with-shortcut-pill trains the shortcut at the point of use, which is a different
  (and cheaper to miss) design.
- **The dangerous keys.** `submit` and `abandon` mint and destroy real orders. Does either get a
  shortcut at all, and if so what stands between the key and the act — the existing modal, a hold, or
  nothing because the confirmation already exists?
- **Where the keys live in the layout.** 135 fixed the spatial contract; this decides what the key hints
  in the top bar actually advertise and whether the offer strip's one-click add is keyboard-reachable
  without a mouse round trip (it is the map's headline feature — a mouse-only Add undercuts it).

Deliverable: the grammar as a table (key · verb · gate · where it is advertised), thin enough to drop
into the spec. A `/prototype` pass on the palette is optional — the layout it lives in already exists on
`prototype/135-callcenter-console`.
