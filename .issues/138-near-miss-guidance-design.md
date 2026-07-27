---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: done
blocked-by: 135
---

# 138 — What actionable promotion guidance looks like, and what it promises

## Question

Graduated from the map's fog by [130](130-potential-bby-prerequisites.md), which established what the
server can and cannot say. The data question is answered; what remains is a **design** question, and
130's findings make it sharper than "show the near-miss".

Design the near-miss → one-click-add surface for the agent console (a slice inside
[135](135-agent-console-prototype.md)'s layout, not its own screen), settling:

- **Three near-miss classes, one list.** 130 established that a near-miss is now one of: *actionable*
  (add N of these items and it fires), *ready* (`IsReady` — fully qualified but out-ranked by a better
  promotion, so there is nothing to do), and *non-actionable* (an origin/accumulation refusal that no
  basket change can fix — and per 128 the origin class becomes permanent and common). They cannot
  read alike. How does the agent tell them apart at a glance, mid-call?
- **A grouping prerequisite is a set, not an item.** The honest statement is "any 2 from these ~1,000".
  130 rules the agent gets a **ranked, ATP-filtered handful** plus a route to the full list. What does
  the handful look like, how many, what does it rank on, and how does "…and 994 more" behave without
  becoming a second screen?
- **What the card is allowed to promise.** 130 killed `wouldSave`: the wire carries the discount
  *definition*, never a savings total (spec 574 US26 — a real one requires firing the promotion). So
  the card says "20% off" and "add 1 more", not "save 12.40". Prove that still reads as worth acting
  on — this is the feature's whole value, and the honest version is quieter than the dishonest one.
- **One-click add, and what happens next.** The add is a normal `addItem` under map note 3 (intent
  only). The re-price may fire the promotion, may fire a *different* one, or may fire nothing (the
  prerequisite was one of several). Under resume-per-request every add is a server round trip. What
  does the agent see during it, and what does an add that did not fire look like?
- **Get-side absence.** Until BackOffice
  [787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md)-C lands, "buy X get
  Y" near-misses are invisible — not empty, *absent*. Does the surface acknowledge partial coverage,
  or silently show what it has?

Blocked by 135: this is a region inside the console, and its density budget is set there.

Deliverable: a linked prototype (`/prototype`) plus the ruling on what the card promises, feeding the
spec and constraining 136's promotion payload.

## Answer — part 1: what the card promises (settled, no ruling needed)

130 and contract §2.1 already closed this; the prototype only had to prove the honest version still
reads as worth acting on. It does, on one condition: **the definition has to be the largest thing on
the card.** Drawn first as a caption under the offer name it disappears; drawn at headline size
(`20% off`, `3rd free`, `both for 29.95`) with the server's description demoted to the sub-line, it
carries the card on its own. The three things a card may say are therefore:

1. **What it gives** — the discount *definition*, headline-sized. Never a savings total; `wouldSave`
   does not exist and is not computable client-side (spec 574 US26).
2. **What it needs** — `add N more`, plus a meter, plus the honest set statement
   (`any 1 from Oral care selection · 42 qualify`).
3. **What qualifies** — the ranked, ATP-filtered handful, and a route to the rest.

Two constraints fell out of drawing it, both new:

- 🚩 **`SAR` cannot be reserved for engine money by a rule the console controls.** Real BBY
  descriptions carry currency words of their own — `"2 PC for 29.95 SR"` is in this repo's own 098
  captures. So 135 amendment 1's rule has to be restated as what it actually forbids: **no figure
  *formatted as money* (`12.00 SAR`) may appear in the guidance region.** The estimate keeps `≈` and
  the muted register, and stays off the money column. The drive asserts the narrow form; the broad
  one (`no SAR anywhere`) fails on server text nobody may edit.
- **An estimate never sits in a column that also holds engine money.** Inside guidance this is free —
  the region holds no engine money at all. Every figure in it is an estimate or a definition, which
  is a stronger guarantee than the search panel can make and worth stating in the spec as a property
  of the region, not of each row.

## Answer — part 2: the other four questions, as drawn

- **Three classes, one list.** They may not differ by hue alone — they are three different decisions.
  All three variants separate them on **rank + treatment + words**: *actionable* is the only class
  with an action, *ready* says `already counted — a better offer applied`, *blocked* says why in the
  agent's words (`not offered on call-center orders`), never the wire code. 117's rule carries
  forward: the hue correction is the **meter**, not the tile.
- **A grouping is a set.** The handful is **three**, held constant across the variants. Five was
  drawn first and is the finding below. The honest cardinality is always printed (`42 qualify`,
  `997 qualify`), and the route to the rest is a **hand-off to the item search, filtered to the
  offer** — `Search the other 994` — not a second list. The console already has a search panel; a
  modal here would be the second screen the ticket warned about.
- **One-click add, and what happens next.** The add is in-flight on the row that launched it
  (`Adding…`), and the row does not move while it runs. Three outcomes are drawn, because the
  re-price is the engine's and not the card's: **fired**, **fired a different offer**
  (`A better offer fired instead: …`), and **did not fire** — where the offer *stays* and only its
  meter moves (`1/2 → 2/3`), under a banner naming what was added and what is still needed. Silence
  on that path reads as a broken button; removing the card reads as a bug.
- **Get-side absence.** Acknowledged once, quietly, at the region's edge: *buy-one-get-one offers
  aren't checked yet — this list covers discounts only.* It is a property of the surface, not of a
  card, and it disappears on its own when 787-C lands (scenario 9 proves that: no other change).

## The prototype

Branch **`prototype/138-near-miss-guidance`** (off `prototype/135-callcenter-console`), route
`/prototype/near-miss-guidance?variant=1|2|3&state=…`, files
`src/features/callcenter/__prototype__/guidance/`. The region is mounted **inside 135's chosen
console** — real rails, real basket, real receipt — because 135 amendment 2 set this ticket's
density budget and a guidance surface judged in a vacuum always passes.

Nine states: `three · bigSet · adding · didNotFire · firedOther · many · readyOnly · none ·
getSideLanded`. Driven at 1440×900 by `tools/guidance-138-drive.mjs` — **91/91, no page errors**;
typecheck and all three lint gates green.

| | 1 · Wrapping strip of cards | 2 · One next best action | 3 · The ledger |
|---|---|---|---|
| Shape | cards wrapping 2-up | one offer, full width, items pre-resolved | one row per offer, fixed columns |
| Non-actionable | pills + a collapsed line | one line of text | rows in the same list |
| Region height (working state) | 318 px | **246 px** | 302 px |
| At seven offers | see finding 1 | 1 shown, 6 behind a stepper | 2 shown, rest scroll |

### What the drive found that drawing did not

1. 🚩 **Expansion, not offer count, is what breaks every shape.** At a handful of **five**, opening
   one offer pushed every other offer below the fold in *both* list variants — the "three classes in
   one list" property survives right up until the agent uses the feature. Cutting the handful to
   three restores it (the ledger then shows the open offer *and* the next one). **Three is the
   number**, and it should be the server's `topN` for the inline path, not a client slice.
2. **The card strip is the only shape that overran the density budget** (46% of the centre column
   once an outcome banner is pinned above it), and the only one that needed a correction to stay
   inside it. Measured, not judged.
3. **A single open card in a 2-up grid wastes half the strip** — the item rows squeeze beside ~500 px
   of nothing. Fixed by letting an open card span both columns, which is variant 2's layout arrived
   at by accident: the evidence keeps pointing the same way.
4. The default-open card must be **the top-ranked actionable offer, by construction**. Drawn with a
   hardcoded id first, and the big-set scenario rendered collapsed — a card whose items are one click
   away is a card whose items nobody reads mid-call.

### Recommendation, pending the owner's ruling

**Variant 2, taking the ledger's blocked-row treatment.** It is the shortest surface (246 px — the
basket keeps ~70 px more than under the strip), it is the only one where the agent never chooses
between offers while a caller is talking, and finding 1 says the other two are only readable when
they show one expanded offer anyway — which is variant 2's premise, stated up front. What it gives
up is scanning: seven offers behind a stepper is genuinely worse than seven rows, so the one thing
worth stealing from 3 is putting *ready* and *blocked* in the same list rather than compressing them
to a text line.

⚠ **HITL — this is a ruling, not a conclusion.** Flip the three in Chrome before it goes to spec.

## The ruling — 2026-07-27

**Variant 1, the wrapping strip, ships.** The owner ruled against the recommendation above, which
stands as recorded rather than being rewritten: variant 2 is still the shortest surface and still the
only one where the agent never chooses between offers mid-call. What variant 1 buys for its extra
72 px is **scanning** — every actionable offer is a card the agent's eye lands on without a stepper,
which is the property finding 1 said the other shapes only fake.

Variant 1 was the one shape the drive measured as over budget, so the ruling is only safe because
both of its corrections were already in the prototype when it was measured: an **open card spans both
columns** (finding 3) and the strip body is clamped to **18rem** with the outcome banner pinned above
it (finding 2). The 318 px in the table is the *corrected* number, not the drawn one.

**The qualifying-item rows carry Arabic** — 131 put Arabic in the item search, and the reason applies
harder here: this is the row whose name the agent reads to the caller. Ruled in on all three variants
by fixing the shared `ItemRow`, whose own doc comment had promised "description, Arabic, ATP" while
rendering no Arabic at all — only variant 3's bespoke row ever had it.

### What landing the Arabic found

1. 🚩 **`<bdi>` implies `dir="auto"`.** Drawn first as its own line under the English name, the Arabic
   flipped the whole block RTL and the name jumped to the far end of the row, detaching from the line
   it belongs to and pushing the item number onto a line of its own. The isolation is wanted; the
   direction flip is not — `<bdi dir="ltr">` keeps `unicode-bidi: isolate` while the block stays
   start-aligned, and the run still renders RTL inside it. **This generalises past the prototype**:
   121 reached for `core/ui/Ltr` for LTR runs in RTL text, and this is the mirror case with the
   opposite failure mode. Whatever the build uses for it must not be a bare `<bdi>`.
2. 🚩 **A clamped region hides the cost of new content — the height table does not move.** A third
   line per item row left all nine of variant 1's heights *identical*, because the 18rem clamp turned
   the growth into scroll. What went below the fold was the third item and **`Search the other 37`**
   — the route to the rest of the set, one of the three things part 1 says a card must carry. The
   budget (`share ≤ 0.45` of the centre, `didNotFire` at 356 px) left no room to raise the clamp.
   **Corrected by putting Arabic on the meta line** beside the item number and estimate — all three
   are secondary, `<bdi>` already isolates the run, and every height returned byte-identical to the
   pre-ruling table. **The Arabic ruling costs zero pixels.** The lesson is the measurement's, not the
   row's: a `max-h` region needs the drive to assert *what is visible*, not only how tall it is.
3. Variant 3 keeps its own two-line item layout (its fixed columns have the width for it). The two
   losing variants were not re-drawn to match — noted so nobody reads the divergence as a finding.

Re-verified after the ruling: `tools/guidance-138-drive.mjs` **91/91, no page errors**, heights
unchanged; `npm run typecheck` and all three `npm run lint` gates green.

**Constraints this hands the spec** (on top of part 1's two): the inline path's `topN` is **three**,
server-side; an open card spans the strip; the strip body is clamped and the outcome banner sits
outside it; the eligible-item row carries `description2`; and the bidi wrapper for an Arabic run in
LTR chrome is `dir`-pinned, never `dir="auto"`.
