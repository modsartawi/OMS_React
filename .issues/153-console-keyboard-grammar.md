---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: done
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

## Answer

**The grammar is four keys and a palette, and the single letter is dead on this console.**

Owner rulings, 2026-07-29, taken against the **built** console rather than the drawing — which is
what settled the central question. The ticket asked whether the Gmail/Linear focus gate ("armed when
you are not typing") could work here. It cannot, and the evidence is stronger than 135's sketch
implied: the resting focus is a text box **twice over**. `CustomerRail.tsx:152` `autoFocus`es the
phone field at open (CC2 finding 1, US9), and after attach the agent lives in `#cc-item-search`,
which **re-focuses itself after every landed add** (`ItemSearchPanel.tsx:162-167`) precisely so the
next item can be typed without a click. A grammar gated on *not typing* would be armed only in the
gap between a sheet closing and the agent's next keystroke. So every key below either works **from
inside a text box** or belongs to a box the agent is already in.

🚩 **The finding that reframed the ticket: adding an item had no keyboard path at all.** Every search
row's *Add* is a mouse target (`ItemSearchPanel.tsx:396-414`) and so is every guidance card's
(`GuidanceStrip.tsx:418`). The map's headline feature — one-click add from a near-miss — was
**mouse-only in the shipped build**, which is the thing CC2 finding 10 calls the failure at hour
nine. The palette is the smaller half of this answer; the in-box grammar is the half that pays.

### The table

| Key | Where it is armed | What it does | Gate | Advertised |
|---|---|---|---|---|
| `Ctrl+K` / `Cmd+K` | anywhere in the console, **including inside any text box** | opens the palette | **inert while any `<dialog>` is open** — a palette over a confirmation sheet is two truths on one screen | search-box placeholder; the palette's own foot |
| `↓` / `↑` | the search box, results on screen | moves the highlight. **Nothing is highlighted until the first press** | inert while `add.onAdd` is `null` (the gate is shut) or an add is in flight; the highlight **resets on every new term** | palette foot (`↑↓ move`) |
| `Enter` | the search box, a row highlighted | adds that row — the same act as the row's *Add* | `capabilities.canAddItem`, read from the same prop the button reads. Never a second predicate | palette foot (`↵ run`) |
| `Enter` | the palette, a row highlighted | runs the row | the row's own enablement (below) | palette foot |
| `Enter` | the phone field | resolves the caller | already built (`CustomerRail` form submit) | — |
| `Enter` | a basket qty field | commits the correction | already built (`BasketPanel.tsx:309`) | — |
| `Esc` | the search box **with text** | clears the box and keeps the caret | already built, including the `stopPropagation` that stops a sheet above from also acting on it | palette foot (`esc close`) |
| `Esc` | the palette, or any sheet | closes it; **focus is restored natively** | `core/ui/Modal` is the native `<dialog>` — trap and restore are free | — |
| — | — | **submit and abandon have no key** | palette rows only: `Ctrl+K`, type, `Enter` | — |

Everything else is typed. There are **no single letters, no `Alt` chords, no `?`, and no `F1`.**

### The eight rulings

1. **Palette + in-box only.** One key to memorise. The alternative that survived longest was
   always-armed `Alt+letter` (Webex's `Ctrl+Alt+…`, RESEARCH §10) — rejected because the mnemonic
   letters are the ones Chrome has taken (`Alt+D` address bar, `Alt+E`/`Alt+F` menu, `Alt+←/→`
   history), so the set would be chosen by what is left rather than by what is memorable. `Ctrl+K`
   *is* Chrome's omnibox-search key and **is** interceptable — Linear, Slack and GitHub all take it —
   so the handler must `preventDefault()`.
2. **`Enter` is armed only after an arrow.** Results land with **no** row highlighted; `↓` then
   `Enter` is two keys to add the top match. 🚩 The reason is 131's own unsolved problem: the match
   clause is a **non-sargable `LIKE '%…%'` over two description columns**, so the top row is a
   relevance *guess*, and a one-key add of a guess puts a line on a live order. Two keys is the price
   of every add being aimed. The rejected middle — arm `Enter` only when exactly one row returned —
   was a rule the agent would have to model before pressing.
3. **Nothing on the keyboard can end a call.** `submit` and `abandon` are palette rows and nothing
   else. *Abandon* still opens its existing modal, whose default action is *Keep*; *Place order*
   presses the button the receipt already gates on `canSubmit`. 🚩 Two extra guards fall out of this:
   the terminal acts **sort last** in the palette and are **never the auto-highlighted row**, so an
   `Enter` on a mistyped query cannot land on one. If the query matches *only* `Abandon call`, the
   palette highlights nothing and the agent must press `↓`.
4. **A refused verb is a palette row, disabled, carrying its reason** — the console's **one
   deliberate exception** to the standing law that a control the door would refuse is worse than no
   control (165/167/175). The law is about a control the agent's hand *lands on*; the palette is a
   question the agent *asked*, and an empty answer to a deliberate question teaches nothing. Disabled
   rows stay highlightable and `Enter` on one does nothing — skipping them would hide the very reason
   this exception exists.
5. **The live offers are palette rows, not chords.** `Alt+1..3` was rejected: the cards re-order as
   the basket moves, so the number is a *position* and not an offer. The rows are the strip's own
   actionable cards (138 ruled three is the number, and it is the server's `topN`, never a client
   slice), naming the item to add, at the top of an empty palette.
6. **The palette is the whole cheat sheet.** No `?` (it types a question mark into the box the agent
   is in), no `F1` sheet. Four keys do not justify a second surface that can drift out of date; the
   palette's foot carries them and every row shows what typing gets you.
7. **Line verbs stay out.** `changeQty`, `changeUom` and `voidLine` take a line, and a palette row for
   them needs a second step. Phase 1's palette is **one level deep and order-scoped**: the object of
   every row is the order. The basket keeps its own controls and stays `Tab`-reachable — which also
   keeps the highest-risk of the three, *void*, aimed at a line the agent is looking at.
8. **`Ctrl+K` is advertised in the search box's placeholder** — where the caret already is on every
   call. The owner accepted the known cost: it disappears the moment the agent types. A permanent
   top-bar pill was declined; 135's top bar already carries the doctype, the guidance count, the store,
   the operator, refresh and abandon.

### What the palette holds

Rows are drawn from `SessionState`, in this order:

1. **Actionable offers** (`nearMisses`, the strip's own view model — read once, as `ConsoleShell`
   already does for the top-bar count, so the two can never disagree).
2. **Order verbs**, one row each: *Search items* (focuses the box — this is also the way home for an
   agent whose focus is stranded on a chip they clicked), *Address book*, *Change store*, *Delivery
   slot*, *Source & reference*, *Order note*, *Attach caller* / *Remove caller*, *Refresh*. Plus, as
   they land: *Fulfilment mode* ([176](176-fulfilment-mode-drawn.md)), *Payment type*
   ([155](155-payment-type-cod-or-online.md)), *Apply coupon*
   ([159](159-coupon-and-loyalty-signup-drawn.md)).
3. **The terminal acts**, last and set apart: *Place order*, *Abandon call*.

The palette is a native `<dialog>` like every other sheet — `core/ui/Modal`'s trap-and-restore is
what makes closing it land the caret back where the agent was, and re-implementing that is how the
"return home" story breaks.

### 🚩 The reason a disabled row carries — and why it needs no contract change

Ruling 4 asks for a sentence the contract does not carry. `capabilities` is a set of **booleans**;
only `submitBlockers` ships typed codes with words behind them (`submit-blockers.ts`, whose whole
point is that a code this client has never heard of still reaches the agent as words). So:

- **Enablement is the capability boolean, always.** Never re-derived, never client-computed — 160's
  law, unbent.
- **The reason is a separate lookup** keyed on which capability is false, worded on this side. Where
  the contract itself names the precondition it is quoted rather than invented — §2.3's
  `canAddItem = open && customer != null && plantSource != "seededAtOpen"` and §6.3's attach-before-
  address ordering are the contract's own sentences. *Place order* reuses `submitBlockers` verbatim
  and needs nothing new.
- **A generic fallback** covers any capability with no known precondition, so a new `canX` cannot
  ship a blank row.

The failure mode of a wrong reason is therefore a **vague sentence, never a wrong refusal** — because
the reason never touches enablement. An additive `capabilityReasons` on the wire would be the tidier
answer and is a §9 **minor**; it is deliberately **not** minted, because the client can be honest
without it and the contract has already spent its one budgeted revision
([177](177-v1.2-captures-land-on-the-client.md)).

### Notes for the build

- **Arrows are vertical only.** `←`/`→` are deliberately unused: they mirror under RTL, and the
  console is a planned-Arabic surface. `↑`/`↓` are direction-neutral and mean the same thing in both.
- **The `Ctrl+K` listener is document-level, mounted with the console, and guarded on
  `dialog[open]`.** A native modal makes background *content* inert but a document `keydown` still
  fires, so the guard is explicit.
- **The highlight is `aria-activedescendant` over the existing rows** (WAI-ARIA combobox), not a
  focus move — the caret must stay in the box so the agent can keep typing, and WCAG 2.2 SC 2.4.11/
  2.4.13 apply to the highlight ring (RESEARCH §10's last bullet).
- **Testing follows 083's ruling** (RTL still uninstalled): which rows the palette shows for a given
  `SessionState`, and the arming/reset logic for the highlight, are **pure modules** with vitest
  (`palette-rows.ts`, `search-cursor.ts`); the key handling itself is proved by a Playwright drive
  under `tools/`, over the real v1.2 captures.
- **Zero-literal**: every palette row label, reason sentence and the palette foot are `callcenter`
  namespace keys. The placeholder change is `search.placeholder`.

This lands as an **additive revision to spec [160](160-callcenter-console-spec.md)** — its
Out-of-Scope entry for 153 becomes stories. It needs **no contract change**, no server work, and no
BackOffice issue: every gate in the table is a `capabilities` field the client already holds.
