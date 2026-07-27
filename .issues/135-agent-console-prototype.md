---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: done
blocked-by: —
---

# 135 — What the agent console looks like

## Question

**HITL — build something cheap and concrete to react to** (`/prototype`). An agent lives in this one
screen for a twelve-hour shift; it is the opposite of a back-office CRUD grid, and Note 13 already
rules it renders its own full-viewport layout inside the shell's session/auth/theme.

The design input already exists and is unusually good:
[CC2's RESEARCH.md](C:\Work\DMSCO\BackOffice\Sartawi.POS\CallCenter2\RESEARCH.md) surveyed
Salesforce/Zendesk/Genesys agent desktops, Shopify/Stripe/Toast order entry, and dense-form design
systems. Its ten highest-leverage findings are the brief the WPF build could never fully execute —
caret-on-phone-field at open, a sticky customer card capped at six fields, pre-selected default
address as a chip, order-kind-first (moot here — CLCN only), **derived store as a read-only chip
with "Change…"** (which is now a plant rebind, 129), ASAP-first slot tiles, a **sticky live receipt**
that never goes below the fold, `Ctrl+K`, tooltip-with-shortcut plus a `?` cheat sheet, and
optimistic hand-off. Read it before drawing anything.

What the prototype must resolve:

- The **spatial contract** — where the customer rail, header chips, item search, basket, promotion
  rail, and live receipt live, and which of them are allowed to move.
- **Progressive collapse**: a completed header section becomes a one-line chip so the agent's eye is
  always on the next input. This is CC2's own recommendation and it was never built.
- How the **promotion near-miss rail** (Note 10) sits beside the basket without stealing it — this
  is the screen's differentiator and the easiest thing to bury.
- Where **ATP** appears: per search row, per basket line, and the soft-gate warning (Note 8), plus
  how frozen-at-add differs visibly from live availability. 🚩 [131](131-item-search-endpoint.md)
  adds a third ATP state to draw: **unknown**. When the stock service is down every search row
  returns `atp: null` with `atpAvailable: false` — and *unknown* must not read as *zero*, which is
  the opposite decision for the agent.
- 🚩 **How the search row's price is labelled**, from [131](131-item-search-endpoint.md). It is an
  **ex-VAT estimate** off the material master, while the basket line beside it is VAT-inclusive, so
  the row reads **~13% below** what the customer will pay. An agent who quotes it raw under-quotes,
  mid-call, out loud. The wire field is named `estimatePriceExVat` so it cannot be plumbed in
  silently — but the visual treatment that stops the mis-quote is this prototype's problem, and it
  is a harder one than a footnote: the two numbers sit on the same screen, in the same currency,
  meaning different things.
- **Keyboard grammar.** Agents type while talking; a mouse-first console fails at hour nine.
- What **states** the layout must survive: no customer yet, no store yet, empty basket, priced
  basket, plant rebind in progress, submit in flight, submit failed.

Deliverable: a linked prototype (this repo's `/prototype` convention) plus the layout decisions it
settles. Not the final build — an artifact to argue with.

### Added by [137](137-callcenter-web-door.md) — one more state, and an ordering rule

The address book is now **server-side unreachable before customer attach** (the five
`CustomerAddresses` routes are scoped to the session's attached customer, because the underlying
routes are unscoped and `DELETE` takes only an `addressNumber`). So the state list above gains
**"customer attached but no address yet"** as a distinct step, and the layout must make the
customer-first order feel intended rather than enforced — an agent who reaches for the address panel
too early gets a refusal, not an empty list.

## Answer

**The console is three fixed columns.** Three structurally different consoles were built and driven at
1440×900 — [prototype branch `prototype/135-callcenter-console`](#the-prototype) — and the owner picked
**A** after flipping all thirteen states in Chrome. Deciding context: a call-center **desktop**, one
agent, a full shift.

### The ruling and why A won

| | A · three fixed columns (**chosen**) | B · centre stage | C · input \| truth |
|---|---|---|---|
| Header | chip row over the basket | everything collapsed to one chip bar | accordion, one section open |
| Offers | strip under the basket | cards interleaved **in** the basket flow | drawer behind a count tab |
| Receipt | sticky right pane | fixed bottom money bar | merged into the truth pane |
| Confirm | modal sheet | inline card in the flow | takes over the truth pane |

A wins on the one property a twelve-hour shift actually rewards: **the furniture never moves.** The
caller's name, the total, and *Place order* are at the same pixels at hour nine as at hour one. B
re-flows the basket every time an offer appears — demo-friendly, hostile while typing and talking. C's
split is the cleanest idea on the board but spends half a desktop monitor on input chrome that is
collapsed for most of the call.

**Rejected deliberately, not overlooked:** B's inline confirmation card and C's pane takeover. A
below-ATP acceptance **is** the audit record (136 §5.2) — it must be able to stop the agent, and a card
in a scrolling flow can be scrolled past. Both `pendingConfirmation` kinds stay **modal**.

### The spatial contract

- **Fixed, never moves, never scrolls away:** the customer rail (start edge, 260 px), the live receipt
  (end edge, 320 px) with *Place order* pinned to its foot, and the top bar.
- **Moves:** the centre column only — chip row → item search → basket → offer strip, in that vertical
  order. The basket is the only region that grows.
- **Density:** designed 1440×900, degrades to 1280 (260 + 320 rails leave ~700 px of centre, which
  holds the basket row at compact density). Below 1280 is out of scope — it is a desktop console.
- The customer rail holds **six fields maximum** (Salesforce compact-layout discipline, CC2 finding 2).
  The address block lives at its foot and is the rail's only interactive region.

### Progressive collapse

Settled sections collapse to a chip in the chip row (store · slot · source · ref), each re-openable in
place. The chip carries its own state: *settled* (neutral), *needs attention* (attention ground, e.g. a
missing slot or ref), *derived* (a parenthetical, so a store the agent did not choose still reads as
explained rather than arbitrary). This is CC2 finding 9, which the WPF build never executed.

### Three amendments to A — the owner's ruling, and the design work they carry

1. 🚩 **An estimate never appears in the money column.** A's one real defect as drawn: `≈12.00 ex-VAT`
   and `27.60 SAR` sit ~200 px apart in the same horizontal band, distinguished by typography alone —
   precisely [131](131-item-search-endpoint.md)'s mis-quote risk, at speed, out loud. The fix takes C's
   *principle* without its layout: the search row's estimate moves **off the money column onto the
   item's second line**, beside the item number, where a price never otherwise appears; the row's end
   edge carries ATP and **Add** only. The panel keeps its standing header ("catalogue prices are
   estimates before VAT — the basket price is what the caller pays"), and **`SAR` is reserved for
   engine money** — an estimate never carries a currency word. A number that cannot appear in the money
   column cannot be misread as money.
2. **The offer strip wraps; it does not scroll sideways.** As drawn, cards four and beyond are
   invisible behind a horizontal scroll — the one gesture nobody performs with a mouse mid-call. The
   strip lists/wraps vertically and grows into the basket's dead space (with two lines on screen the
   basket had ~400 px of nothing while the strip was cropped). **The actionable count also appears in
   the top bar**, so an offer that arrives while the agent is reading search results still announces
   itself. This is the density budget [138](138-near-miss-guidance-design.md) inherits.
3. **The keyboard grammar is drawn but not designed.** `Ctrl+K`, `?`, and focus-gated single letters
   appear as affordances in all three variants and are specified in none. For a desktop console that is
   the difference between an upgrade and a port, so it gets its own ticket rather than arriving as an
   afterthought in the spec → [153](153-console-keyboard-grammar.md).

### The other layout rulings the states settled

- **ATP has three states and `unknown` is not `zero`** — a green count pill, a danger "none at store",
  and an attention "? stock unknown". They differ in ground, ink **and** wording, because they are
  opposite decisions for the agent. Basket lines carry the same pill labelled *at add* (frozen), so
  frozen and live availability never read alike.
- **Customer-first is shown as intent, not enforcement.** With a caller attached and no address yet,
  the rail's address block is an empty dashed slot with its own *Pick an address* button, and the
  centre shows the next step — the agent never reaches a route that refuses them
  ([137](137-callcenter-web-door.md)'s ordering constraint).
- **`SESSION_BUSY` is a non-blocking strip**, primary-toned with an indeterminate hairline, that says
  retrying *and* says typing still works. It is never a spinner over the basket — 136 §6.1 makes it
  routine, so it must not look like a fault.
- **A business refusal is a banner, not a crash surface** — `REBIND_REFUSED` names the offending line
  in the banner *and* tints that line in the basket, so "nothing was changed" is legible in one glance.
- **Submit is the one moment with no optimism.** CC2 finding 10 recommends optimistic hand-off; ruled
  **out** here — the button becomes "Placing the order…" and the receipt holds until a `documentNo`
  exists. An optimistically confirmed order that then refuses is a phone call the agent cannot take
  back.
- **The two full-screen phases carry their own way home** (134): *order already open* offers resume vs.
  abandon-and-start-fresh with the previous caller's name and line count visible, and the denial screen
  offers *Back to the portal* / *Sign out* — a chrome-less refusal has no nav to leave by. Both are
  identical across variants by design: they are not part of the spatial argument.

### The prototype

Thirteen states × three variants, driven in Chrome, no page errors; `typecheck` and all three lint
gates green. Captured on branch **`prototype/135-callcenter-console`** (route
`/prototype/callcenter-console?variant=A|B|C&state=…`, files
`src/features/callcenter/__prototype__/`). It is **off main** per the prototype convention — main keeps
the decision, not the variants. The state list doubles as the spec's acceptance surface: `empty ·
attached · searching · priced · prereq · belowAtp · rebindPreview · rebindRefused · busy · submitting ·
submitRefused · refusedExisting · denied`.
