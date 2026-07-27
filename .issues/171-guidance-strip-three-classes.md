---
status: done
spec: 160
blocked-by: 161, 170
---

# 171 — theGuidanceStripReadsThreeClassesAtAGlance

## What to build

The screen's differentiator, and the easiest thing to bury: every offer the basket **nearly**
qualifies for, visible without opening anything, under the basket, in a strip that **wraps** — never
a horizontal scroll, the one gesture nobody performs mid-call.

**Three classes, one list** ([138](138-near-miss-guidance-design.md)). They may not differ by hue
alone — they are three different decisions:

- **Actionable** — the only class with an action.
- **Already counted** — fully qualified but out-ranked by a better offer, so there is nothing to do.
- **Not available here** — an origin or accumulation refusal no basket change can fix. It says why
  **in the agent's words** (`not offered on call-center orders`), never the wire code, for every
  `skipReason` category including one this client has never seen.

**What a card may say**, in order of size:

1. **What it gives** — the discount *definition* at **headline size** (`20% off`, `3rd free`,
   `both for 29.95`), with the server's own description demoted to the sub-line. Drawn as a caption
   it disappears; at headline size it carries the card alone. The wording rule is 161's, from
   `@/core/`.
2. **What it needs** — `add 1 more`, a meter, and the honest set statement (`any 1 from Oral care
   selection · 42 qualify`).

🚩 **No savings total, ever.** `wouldSave` does not exist on the wire and is not computable
client-side (spec 574 US26).

🚩 **No figure formatted as money anywhere in the region.** The region holds no engine money at all,
so it can guarantee this absolutely — and the rule is *formatted as money*, **not** "no `SAR`
anywhere", because real BBY descriptions carry currency words the console may not edit (`"2 PC for
29.95 SR"` is in this repo's own 098 captures).

Three layout properties are **load-bearing, not polish** — the owner's ruling for the wrapping strip
was only safe because the drive had already measured them: an **open card spans both columns**; the
**strip body is clamped (18rem) with the outcome banner pinned outside it**; and the default-open
card is the **top-ranked actionable offer by construction**, never a hardcoded id. The **actionable
count is mirrored in the top bar**, so an offer that arrives while the agent is reading search
results still announces itself.

## Spine reach

logic (pure guidance view model: classes, order, definition wording via `@/core/`, skip-reason words)
· component (strip, cards, meter, top-bar count) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `nearMissesSortIntoThreeClasses` — pure: ready-first order preserved as the server sent it,
      each class carries its own words and its own action-or-absence, every `skipReason` maps to an
      agent-facing phrase and an unknown category still reads as words rather than a code · pure
      → `src/features/callcenter/console/guidance-view.test.ts` (19 tests), over the contract's own
      `03-near-miss-buy-side` fragment, which holds one of each class by construction. The classes
      are a rendering **rank**, never a re-sort: the list comes out in the order §3.1 sent it. The
      skip is asked **first** (an offer the engine never evaluated is out of reach whatever its
      progress claims). Phrases are resolved through the REAL `@/core/i18n`, so what is asserted is
      words — `can't be checked from this basket`, and for a category this client has never seen,
      `this offer isn't available on this order` with the code nowhere in it.
- [x] `noFigureInTheRegionIsFormattedAsMoney` — pure: over a fixture whose offer description
      deliberately contains a currency word, the view model exposes no money-formatted figure
      and no savings total, while leaving the server's text untouched · pure
      → same file. The rule is spelled in the narrow form and **self-tested**: money is a figure
      wearing a currency word, or one whose decimals were FORCED to two (`35.00`, `8.40` — the
      shape a formatter makes), which is what tells it apart from `29.95`, the numeral a set-price
      definition honestly is. Plus the strong form: over the whole view model the only numbers at
      all are the meter's counts, the shortfall and the eligible population, so a later caller
      finds no field to print a total from.
- [x] `theStripScansAtAGlance` — drive: three classes visibly distinct in rank, treatment **and**
      words; the top-ranked actionable card open by construction; an open card spanning both columns;
      the outcome banner outside the clamp; the count mirrored in the top bar · flow (Playwright, new
      `tools/callcenter-guidance-drive.mjs`)
      → **59/59, no page errors**, at 1440×900, with fixture 02's real basket and receipt under the
      strip. Open-by-construction is proven by **re-ordering the server's list** so a hardcoded id
      would open the wrong card. The span is measured (826px open vs 409px closed) and handed back
      on close. 🚩 The visibility assertions are 138's lesson: the open card's description, meter,
      delta and set statement are each inside the scroller's own box at seven offers, and the head
      is proven outside the clamp by scrolling the body to its end and finding the head still
      there. The money scan excludes nodes the console marks `data-cc-server-text` (the pass-through
      descriptions) and self-tests that it still sees the console's own figures — a scan that had
      quietly stopped looking would otherwise pass forever.

## Boundaries

No new endpoint — `nearMisses` ride `SessionState`. Fixture `03-near-miss-buy-side.json` joins
`payloads.ts`. 🚩 **The drive must assert what is *visible*, not only how tall the region is** — a
clamped region turns new content into scroll, so every height check passes while the route to the
rest of a set drops below the fold (138's own finding, the hard way). The **coupon** is not a fourth
class and is not drawn here ([159](159-coupon-and-loyalty-signup-drawn.md)).

## Done when

An agent glances at the strip and can tell, without opening anything, which offers they can act on,
which are already counted, and which are not available on this order — and nothing in the region can
be mistaken for what the caller pays.

## As built — what the reviews surfaced

- 🚩 **The headline definition needs a server field that does not exist yet.** The wire's `NearMiss`
  carries `description` and nothing about the discount, so 130's *"carry the discount definition"*
  is unbuilt on the projection side. The client takes it as an **optional, additive** block
  (`NearMiss.discount` — §9 ships additive changes server-first) and **degrades while it is absent**:
  the server's description is then the headline, exactly as `AppliedBonusBuy.applications?` degrades
  elsewhere in this repo. So the ticket's first ruling is live in the code and in the drive's
  `definitions` state, but **not against any frozen fixture** — it is a BackOffice 787 dependency,
  and the first integration should land it or the card loses its headline for real.
- **`any 1 from this selection`, not `any 1 from Oral care selection`.** The wire carries a
  `groupingId` and no grouping NAME, so the named form the ticket illustrates is unreachable today.
  The cardinality — the part that makes the statement honest — is the server's and is printed.
  Recorded as a contract gap rather than papered over with an id nobody can read aloud.
- **The set statement rides EVERY card, open or closed.** Drawn behind the disclosure first, which
  left a closed card stating a delta with no cardinality — the exact implication (*buy this one
  item*) US42 exists to prevent.
- **The blocked class keeps 138's collapsed treatment**: the count and *can't be reached from this
  basket* are visible without opening anything; the per-offer reason is one click away. That is
  variant 1 as ruled, and the words — not a hue — are what carry the class.
- **Six of 138's nine states.** `adding · didNotFire · firedOther` are the one-click add's, which is
  [172](172-one-click-add-closes-the-gap.md); they land in this same drive file with it. The
  outcome banner's SLOT ships here (the pinned head, proven outside the clamp) because the layout
  property is load-bearing; its content is 172's.

## Blocked by

[161](161-percent-not-printed-as-money.md) — the definition wording is the card's headline.
[170](170-basket-corrects-itself.md) — the strip's density budget was measured inside a real console
with a real basket and receipt; judged in a vacuum it always passes.
