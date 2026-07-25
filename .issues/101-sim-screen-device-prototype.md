---
type: wayfinder-ticket
wayfinder: prototype
map: 097
status: done
blocked-by: 098, 099, 100
---

# 101 — The reworked screen as one device

## Question

**What is the screen's arrangement?** This is the map's centre — an HTML prototype beside the issue
(as 041/042/073 did), filled with real values from [098](098-simulate-payload-capture.md), built
from 082's shipped tokens and [100](100-sim-chip-vocabulary.md)'s chip vocabulary, and reacted to by
the owner until it is the approved device.

It must answer at least:

1. **The headline** — deliberately left open at charting. Does the screen get a sticky result band
   (Net Total as the big line, discount/tax/calc-time beside it, the run chips alongside) that the
   results scroll under? Or is the results grid itself the headline, with Net Total a figure among
   the lines? Draw both if the argument is close; the owner rules on the picture.
2. **The regions and their order**, with [099](099-sim-region-question-inventory.md)'s permanent /
   conditional / disclosed classification realised as layout. Today's 7fr–5fr split and eleven
   frames are the thing being replaced; the replacement needs a stated shape (rail + work area?
   single column with a sticky head? two panes with one scroll?) and a reason.
3. **Where the input goes.** The map ruled it collapses to a chip bar after Process. Draw the
   collapsed state and its place — is the chip bar part of the headline band, or its own strip?
4. **What the frame budget is.** Name how many bordered surfaces the new screen has and what each
   one buys. The rework's premise is that eleven is too many; the prototype should be able to say
   its own number out loud.
5. **The pre-run state.** The screen before any Process is the first thing every analyst sees;
   draw it, even if the answer is "the same arrangement with empty regions".
6. **`SimMissedPromotions`.** Built, passing (048), and deliberately commented out of the page. The
   map deferred the ruling to here: draw the arrangement **with** it and **without** it, and let the
   owner rule now that the space question can be seen. Record which way, and why.

Constraints that are not up for prototyping: arrangement only (no behaviour, no request change);
logical Tailwind; zero-literal i18n in whatever code the spec later produces; both themes must be
drawn, since 082 ships a dark twin and a light-only prototype hides half the palette.

Deep layers (detail region, elements trace, missed-promo body), per-line anatomy, responsive
behaviour and mirroring are **not** settled here — they are 103, 104, 105 and 106, all of which read
this ticket's device as their premise.

## Answer

**The device is approved.** Owner ruling, 2026-07-25, against
[`assets/101-screen-device.PROTOTYPE.html`](assets/101-screen-device.PROTOTYPE.html) — Arrangement D
built properly on 098's real captures, corrected to [100](100-sim-chip-vocabulary.md)'s vocabulary,
in both themes, across five states and three headline candidates. All six sub-questions ruled.

The prototype's own corrections to the 099 sketch, applied before it was shown: the tinted
`Promotion on` pill and the dashed ghost chip are gone (100 §2); chips are borderless `bg-muted`
with an uppercase key; **the status dot column is gone** — an `ok` line carries no mark at all, so
the results grid has no severity column and the only coloured thing on a healthy screen is the
fired-promotion card.

### 1 — The headline: **A, the quiet strip. Nothing is sticky.**

The run strip carries the chips, the money readout and the run controls in **one unframed row that
scrolls away with everything else**. The deciding evidence is 098's density picture: the screen is
1–3 lines and 0–2 promo cards, so **nothing scrolls**, and a pinned band would spend permanent
vertical space on a case the data has never produced. Both rejected candidates are recorded because
they are the ones that come back:

- **B, the sticky band** — reconsider only if baskets far larger than anything captured appear.
  Making the strip sticky is one CSS declaration on an already-correct arrangement, so this is a
  reversible non-decision, and it belongs to [105](105-sim-responsive-arrangement.md) if it returns.
- **C, money in a totals row** under the last result line — the most honest expression of "Net Total
  is a confirming readout", rejected because it costs the analyst the total while the run strip is
  in view, on a loop whose whole point is comparing this run's total with the last one.

**Net Total keeps its emphasis by weight, not by border or by size** — 19px semibold in the strip,
beside `disc`, `tax` and the calc time as smaller keyed pairs. It is no longer the largest thing on
the screen, and the promotion verdict is at eye level beside the lines it explains.

### 2 — The regions and their order

One column, then the 66/34 split, exactly as 099 approved and now drawn at real density:

```
run strip   PLANT P001 · ORG 1000 · CHAN 20 · 25 Jul 2026 · PROMO on · Edit ▾
            172.38 SAR · disc −63.88 · tax 22.48 · 268 ms  │ [▶ Process] Clear ⛁ Wipe cache
Items       material · qty · uom · CONTROL ▾ · ✕            › Manual conditions
──────────────────────────────────────────┬──────────────────────────
RESULTS (66%)                             │ PROMOTIONS (34%)
```

- **Permanent:** run strip, Items.
- **After a run only:** Results, Promotions.
- **Instead of a whole-run failure:** the 400 banner *replaces* the work area rather than pushing it
  down, and Items stays exactly where it was so the offending line is corrected in place.

The run controls sit as a terminal cluster at the end of the strip, separated by a rule:
`▶ Process` primary, `Clear` and `⛁ Wipe cache` quiet — the run loop's three verbs in one place,
which is what 099's "Clear cache is a run control" ruling asks for.

### 3 — Where the input goes: the strip *is* the collapsed input

Not a separate chip bar under a headline band, and not part of a card. The chips, the `Edit ▾`
control, the money and the run buttons are **one strip**, because they are all the same thing: the
parameters of the run you are looking at, and the controls that produce the next one. The chip set
is **one hover/click target** ending in `Edit ▾` (100 §3); expanding replaces the collapsed row with
the form **in place**, so nothing below it moves except by the form's own height.

**Items never collapse** and never join the strip — 099's two-lifetimes ruling, drawn: the strip is
what you set once, the Items frame is the instrument you retype every run.

### 4 — The frame budget: **three. One before the first Process.**

| Frame | What it buys |
|---|---|
| **Items** | the instrument that changes every run — it needs a working surface and an `+ Add item` affordance |
| **Results** | the lines, and the boundary the expansions open inside |
| **Promotions** | the verdict, held apart so the results never shift when it grows or shrinks |

Everything else has no frame: the run strip (a readout + a control cluster, not a region), the 400
banner (a message, already bordered by its severity), manual conditions and the per-line detail
(disclosures inside a frame that already exists). **Eleven frames and seven headings become three and
three** — and **one and one** before the first Process. The prototype states its own number in the
tally under each state.

### 5 — The pre-run state: the form open, one sentence, **no empty frames**

Before any Process the run strip is **expanded as the form** — there is no run to condense, and this
is the moment the determination fields are actually set. Below it, the Items frame with one blank
row. Where the work area will be: **one line of quiet text**, not a framed empty box, not a skeleton,
not a sample basket. Nothing has happened, so there is nothing to draw — that *is* the reclaim.

The three test levers (procedure key, loyalty group, loyalty tier) live in the open form, always
reachable, and never appear as chips unless set (100 §4).

Two alternatives were offered and declined: **recalling the last run** (real behaviour, outside the
map's arrangement-only line — it can be proposed as its own ticket outside this map) and a **worked
example** (occupies space with fiction).

### 6 — `SimMissedPromotions`: **in, in the promotions rail**

Ruled with the space cost visible — the prototype's near-miss switcher draws the rail both ways on
the same capture. Off, the rail loses half its content and the run's own answer to "what would ×2
have got me" disappears while the payload still carries it. **`SimulationPage.tsx:357` is
uncommented; a near-miss is a card in the same rail as a fire**, distinguished by the `○` glyph, the
neutral treatment and a `Would save` label — **never by hue** (100: a near-miss is not `warn`).

Per 098, a missed card carries **only** description, bonus-buy number, condition type, `wouldSave`,
validity and `isStackable` — **no prerequisite line ever**, and no line linkage, which is precisely
why it lives in a screen-level rail and not on a result line.

### The three states the prototype settles beyond the ticket's list

- **Promotion off** — the rail is *not* empty; it says the run measured nothing. 098 finding 3 makes
  a blank rail actively misleading, and the `PROMO off` chip alone is not enough at rail distance.
- **A warning line** — the `W` line is the only coloured thing on screen (`StatusBadge` attention),
  its `[070]` message sits inside its own expansion, and the fix is one row up in Items. No count
  banner, no dot column.
- **A whole-run 400** — banner in `danger` carrying the envelope `message` plus its code, work area
  absent rather than empty.

Hue budget across every state drawn: **two** (`success` on a fire, `attention` on a `W`), plus
`danger` on the whole-run failure banner — which is a *message*, not a screen region, and was already
the only evidenced failure path (099 region 6).

### What this hands on

- [102](102-sim-input-chip-bar.md) — the strip is the collapsed input **and** the money readout **and**
  the run controls; expansion replaces the row in place. It owns chip copy, the mechanics, staleness,
  and now also **the in-flight shape** (the map's fog item), since the strip owns Process.
- [103](103-sim-deep-layers-placement.md) — four disclosures, all inside a frame that already exists.
  No disclosure may introduce a fourth frame.
- [104](104-sim-results-line-anatomy.md) — the line has **no status column**; the warn badge rides in
  the promo column's place. The rail's card fields are its to finalise.
- [105](105-sim-responsive-arrangement.md) — one breakpoint (where 66/34 stacks), and the sticky-band
  question if it ever returns.
- [106](106-sim-rtl-mirroring.md) — the strip, the split and the line grid are the three things that
  mirror.
