---
status: open
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

- [ ] `nearMissesSortIntoThreeClasses` — pure: ready-first order preserved as the server sent it,
      each class carries its own words and its own action-or-absence, every `skipReason` maps to an
      agent-facing phrase and an unknown category still reads as words rather than a code · pure
- [ ] `noFigureInTheRegionIsFormattedAsMoney` — pure: over a fixture whose offer description
      deliberately contains `"2 PC for 29.95 SR"`, the view model exposes no money-formatted figure
      and no savings total, while leaving the server's text untouched · pure
- [ ] `theStripScansAtAGlance` — drive: three classes visibly distinct in rank, treatment **and**
      words; the top-ranked actionable card open by construction; an open card spanning both columns;
      the outcome banner outside the clamp; the count mirrored in the top bar · flow (Playwright, new
      `tools/callcenter-guidance-drive.mjs` over 138's nine states)

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

## Blocked by

[161](161-percent-not-printed-as-money.md) — the definition wording is the card's headline.
[170](170-basket-corrects-itself.md) — the strip's density budget was measured inside a real console
with a real basket and receipt; judged in a vacuum it always passes.
