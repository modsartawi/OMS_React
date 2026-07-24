---
type: wayfinder-ticket
wayfinder: prototype
map: 068
status: done
blocked-by: 073
---

# 080 — RTL mirroring of the reworked layout

## Question

The layout now exists (073), so the RTL question is finally answerable. The POS reference asserts a
`FlowDirection` flip — rail on the right, commit bottom-left — but WPF flips a whole visual tree in one
property. Our equivalent is [logical-tailwind](../.claude/rules/logical-tailwind.md), which mirrors
*most* of it for free and silently fails to mirror the rest.

073 already banked two: the items grid's selected-row bar uses `inset-inline-start`, and every rail /
card / tab rule was written with logical utilities. What is **not** settled:

- **The identity band's split.** Big line + sub-ids start-side, customer block end-side. Under RTL that
  puts the customer on the left. Correct — or does the customer block want to stay optically anchored
  to the reading edge?
- **The action bar under RTL.** 072's grammar is *escape-start · clusters · terminal-end*. Mirrored,
  the terminal red pair lands bottom-**left**. Confirm that is what we want, and confirm the cluster
  order within the bar reverses too (Fulfilment first in both directions, or first-by-reading-order?).
- **The pill rail.** Six pills plus the `All statuses` / `Refresh` pair pinned with
  `margin-inline-start:auto`. Verify the pinning survives the flip and that the pills wrap from the
  correct edge.
- **Tabular numerals and ids.** `documentNo`, phone numbers, money — LTR runs inside an RTL paragraph.
  Do they need explicit `dir="ltr"` / bidi isolation, or does `font-variant-numeric: tabular-nums` plus
  the browser's bidi algorithm handle it? A phone number that renders `7712 018 55 966+` is the failure
  mode to look for.
- **The dark band's gradient and the card accent bars.** Direction-neutral (vertical gradient, 3px
  vertical bar) — confirm, and note any genuinely direction-*dependent* visual that earns a physical
  utility plus the comment the rule requires.
- **AG Grid.** The rule explicitly puts third-party widget internals out of scope for physical-class
  overrides — so establish whether AG Grid's own RTL mode (`enableRtl`) is the answer, and whether it
  is a per-grid prop or a theme-level setting (adjacent to 074).

Deliver a prototype rendering the 073 device twice, `dir="ltr"` and `dir="rtl"`, side by side, with
every mirroring failure marked. **Copy is out of scope** — the map rules Arabic translation content
out; Latin text in an RTL frame is enough to expose layout faults.

## Answer

**logical-tailwind paid out.** The headline result is that 073 mirrors almost entirely for free — the
rail and its divider, the pill rail's `margin-inline-start:auto` pinning (verified: pins left, pills
wrap from the right edge), the action bar's terminal pin, the tab underline, card accent bars, table
alignment, and the whole flex reading order. §1 of the prototype lists eleven mechanisms now **verified
rather than assumed**. The vertical band gradient and the 3px accent bars are confirmed
direction-neutral, as suspected.

**Eight faults, five of them one-line CSS fixes that are byte-identical under LTR** — they are simply
the correct spelling of rules already written, so they can land in the 073 build with no RTL switch in
existence and no visual change to the shipping screen.

| # | Fault | Fix |
|---|---|---|
| F1 | `.hdr .cust{margin-left:auto}` — **latent**; inert while `.ids` grows, bites when the band wraps (auto margin then pushes to the physical right = RTL's *start*). Media query repeats it. | `margin-inline-start` |
| F2 | Back chevron does not mirror — **only when it is an SVG** (see trap below) | `[dir=rtl] .back svg{transform:scaleX(-1)}` |
| F3 | Space-separated numeric runs reorder | `<bdi dir="ltr">`, six fields |
| F4 | Selected-row bar `box-shadow:inset 3px 0 0` — **`box-shadow` offsets are physical and have no logical form** | 074's `::after` + `inset-inline-start` |
| F5 | `.gridwrap{border-radius:0 9px 9px 9px}` — notch stays top-left while the active tab moves top-right | `border-start-start-radius:0` |
| F6 | `enableRtl` set on 1 grid of 7 | one derived value beside the theme |
| F7 | Decorative arrows had no ruling | ruled, §4 |
| F8 | No `dir` wiring exists anywhere | spec names where it will live |

**Two of this ticket's own first-draft claims were overturned by measuring**, which is the reason the
prototype renders headless and reads visual order back off client rects rather than reasoning about
bidi on paper:

- **F3 is far smaller than it looks, and the culprit is the space, not the punctuation.** A value
  breaks only when it contains a **space** and **begins or ends with a digit**. Measured safe,
  untouched: `ERX-77120934`, `SMSA-91180442`, `1180-4471`, `240.70`, `-9.20`, `1000000393`,
  `RQAA3948, Tower 3`, `Thu · 4–6 PM`. Measured broken: the three phones, `Placed`, `Scheduled`, and —
  **not in the first draft** — the grid's totals footer `4 lines · 7 units` → `lines · 7 units 4`.
  **Six fields, not the dozen assumed.** The header phone reproduces the ticket's predicted
  `7712 018 55 966+` verbatim. `tabular-nums` does nothing here — it sets glyph advance width, not
  character order.
- **The bidi wrapper must cover a whole value, never a fragment of a run.** Isolating just
  `SMSA-91180442` inside `↗ Track SMSA-91180442` *created* a fault: it split an all-Latin run and the
  RTL paragraph ordered the halves right-to-left, putting the id before its verb. Over-application is
  free (isolating an already-correct value never breaks it), so the reviewable rule stays dumb:
  **server value mixing digits and spaces ⇒ wrap it.**

**The F2 trap, and the most transferable finding here.** The prototype originally drew the back
chevron as the character `‹` (U+2039), which is in Unicode's **`Bidi_Mirrored`** set and **flips
itself** under RTL. With a text glyph the fault is invisible *and* the obvious `scaleX(-1)` fix
double-mirrors it back to wrong — measured, both ways. `↗`, `↻`, `←` and **every SVG path** do not
auto-mirror. lucide ships SVG, so the fault is real in the app; the device now draws lucide's actual
`ChevronLeft` path and demonstrates it honestly. **Rule for reviewers: if an icon should mirror, ship
it as an SVG and flip it explicitly — never let a punctuation character be an icon.**

**F4 is a fault in 073, not in 074.** 073 §7 states the selected-row treatment "is logical, so it
mirrors in RTL for free" — that describes `inset-inline-start` but the prototype implements
`box-shadow`, whose offsets are physical. **074's specified `.ag-row-selected::after{inset-inline-start:0}`
was already correct.** Comment filed on both.

**F6 — `enableRtl` is a grid option, not a theme param**, so "theme-level" is not available; but seven
hand-written props is what produced today's drift. Answer: **one derived value exported beside
`omsGridTheme`, spread into every grid.** Today's single occurrence
(`BonusBuyInquiryPage.tsx:206`) is wrong three ways — 1 of 7 call sites, reads
`document.documentElement.dir` which **nothing in the app ever sets** (so it is permanently `false`),
and is an unsubscribed DOM read that would not re-render on a direction change. Everything *inside*
the grid mirrors itself, as 074 established.

**Icon rulings (F7):** back chevron **mirrors** (SVG only); `↻` refresh, `▾` disclosure and `⚡`
**do not**; `↗` external link **mirrors to `↖`** — the one low-confidence call, and not free, since
U+2197 is not `Bidi_Mirrored` and needs an explicit flip.

**Owner rulings taken this session — all four as recommended:**

1. **Identity band mirrors.** Customer block lands left in RTL. Both halves read start-first in their
   own direction; `text-align:end` already ends-aligns it relative to its own text.
2. **Action bar mirrors, clusters included.** Terminal red pair goes bottom-left; clusters reverse so
   Fulfilment is still met first *by reading order*. 072's "commit-right" was always shorthand for
   "commit-end". Zero code — it is what flex already does.
3. **Scope: fixes + bidi.** F1/F4/F5 spelled correctly in the 073 build, plus `core/ui/Ltr.tsx` on the
   six measured fields. Invisible under LTR, so it cannot regress today's screen; done now because the
   wrappers belong on the exact fields 073/079/081 are defining. **The `dir` switch and F6's derived
   value are NOT built now** — F6/F8 stay recorded so the spec names where they will live.
4. **`↗` mirrors to `↖`.**

**Deliberately unsettled.** Copy is out of scope, so Arabic **text metrics** are untested — Arabic is
taller and often wider at the same point size and will pressure the 340px rail, the 10.5px uppercase
card headings (uppercase simply does not apply in Arabic), and `white-space:nowrap` on table headers.
That belongs to whatever effort ships Arabic. Also recorded and explicitly **not** a bug: Latin labels
ending in a full stop render as `.Approval no` under RTL — a neutral taking the paragraph direction.
Real labels come from `t()` and will be Arabic; it is noted only so nobody opens a ticket for it.

[prototype](assets/080-rtl-mirroring.PROTOTYPE.html) — the 073 device authored **once** in a
`<template>` and stamped three times (`dir=ltr` · `dir=rtl` as-built with faults marked in place ·
`dir=rtl` repaired), so the markup is provably identical and any A/B difference is either a deliberate
mirror or a fault. Stacked rather than literally side by side: two devices in a 1280px column trip
073's 900px breakpoint and collapse the rail, hiding the very two-column faults under test.

## Comments

**From [074 — AG Grid theme mapping](074-ag-grid-theme-mapping.md) (done):** the grid mirrors itself,
which removes the largest thing this ticket might have owed.

AG Grid v36 guards its own directional rules with `.ag-ltr` / `.ag-rtl` classes — e.g.
`:where(.ag-ltr) .ag-right-aligned-cell{text-align:right}` — so column alignment, pinned-column sides,
header sort arrows and scroll direction mirror inside its DOM without us touching a class. That is the
boundary [logical-tailwind](../.claude/rules/logical-tailwind.md) already draws, now confirmed rather
than assumed. What this ticket must still settle for the grid is only how `enableRtl` gets set — a prop
on six `AgGridReact` call sites, or a single derived value alongside the theme.

**One piece of hand-written grid CSS does land here.** 074 found exactly one treatment AG's params
cannot express — 073's selected-row accent bar — and specified it as
`.ag-row-selected::after { inset-inline-start: 0 }`. It is logical by construction, so it mirrors for
free; it is listed here so the RTL prototype exercises it rather than discovering it. (`::before` is
unavailable — AG paints its own selection overlay there.)
