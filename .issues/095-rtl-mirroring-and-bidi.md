---
status: done
spec: 083
blocked-by: 091, 092, 093, 094
---

# 095 — theLayoutMirrorsCorrectlyBeforeAnyDirSwitchExists

## What to build

The mirroring audit verified eleven mechanisms on the reworked layout and found eight faults, five of
which are one-line respellings **byte-identical under LTR**. They are simply the correct spelling of
rules already written, so they land now — with no `dir` switch in existence and **no visual change to
the shipping screen**.

- **`margin-inline-start: auto`** for the identity band's customer block, and its media-query reset.
  Latent today — inert while the sub-ids column grows — and bites the moment the band wraps.
- **The selected-row bar as a pseudo-element** with `inset-inline-start`, **never `box-shadow`**,
  whose offsets are physical and have no logical form. 082's theme already specifies it correctly —
  confirm it, and confirm 093 did not reintroduce a shadow.
- **`border-start-start-radius: 0`** on the work-area frame, so the square notch that meets the active
  tab follows the tab strip when it mirrors.
- **Bidi isolation on six fields** via a small **`core/ui/Ltr`** wrapper: the three phone numbers, the
  two band date/time values, and the items grid's totals footer text. The rule for reviewers is
  deliberately dumb — **a server value that mixes digits and spaces gets wrapped** — because a value
  breaks only when it contains a **space** and begins or ends with a digit. Measured safe and
  deliberately untouched: `ERX-77120934`, `1180-4471`, `240.70`, `1000000393`. Over-application is
  free. **Wrap a whole value, never a fragment**: isolating an id inside `↗ Track SMSA-91180442`
  *created* a fault by splitting an all-Latin run.
- **Icons:** the back chevron **mirrors** and the external-link `↗` **mirrors to `↖`**, both as
  explicit flips on SVG. Refresh `↻`, the disclosure `▾` and `⚡` do not mirror. The transferable
  rule: **if an icon must mirror, ship it as an SVG and flip it explicitly — never let a punctuation
  character be an icon.** `‹` (U+2039) is `Bidi_Mirrored`, so it flips itself, hides the fault, and
  double-mirrors the obvious fix.

## Spine reach

`core/ui` (the `Ltr` wrapper) · component/CSS across all four reworked regions · app-drive

## Proof (→ `tdd` red-green cycles)

No runtime test — the whole point is that these are byte-identical under LTR. Verify by driving
`npm run dev` and confirming **nothing changed visually**, plus `npm run typecheck` and
`npm run lint`. A temporary `dir="rtl"` on `<html>` in devtools is the manual check that the band's
customer block, the tab notch, the phone numbers and the two mirrored icons all behave — the `dir`
switch itself does not ship.

**What was run:** `npm test` 68/68 (unchanged — no pure module moved) · `npm run typecheck` ·
`npm run lint` (all three gates) · `npm run build` — all green.

- [x] **The manual devtools check, automated.** `tools/document-rtl-drive.mjs` (**33/33**) sets
      `dir="rtl"` on `<html>` itself and asserts every mechanism in BOTH directions: the six isolates
      carry the value their own field produces and read left-to-right (measured off **character
      client rects**, not class names — reasoning about bidi on paper is what 080 overturned twice);
      the customer block pins to the band's end at 1600px **and wrapped at 700px**; the back chevron
      and `↗` flip while `↻` and `⚡` do not; the selected-row bar is a 3px `::before` on the grid's
      own start side with `box-shadow: none` on both row and cell.
- [x] **The red half.** Stripping one isolate from the DOM under RTL and re-measuring proves the
      wrapper is load-bearing rather than decoration: `966501076360 · Dammam - ad dabab` reads +217px
      wrapped and **−17px bare**. The same probe is why `Placed` is documented as over-application
      rather than a fault: `March 6, 2025 · 02:46` opens with a strong Latin letter and holds its
      order unwrapped.
- [x] **LTR is unchanged, measured twice.** Every `<bdi>` is an inert inline box inside its parent's
      rect (no display/margin/padding of its own), and the four region drives from 091–094 re-run
      green untouched: band **32/32**, rail **25/25**, cards **45/45**, items **23/23**, actions
      **38/38**.

## Boundaries

Adds **`core/ui/Ltr`** — with `isBlankDate`'s export (092) the only additions this spec makes to
`core/`. **Out of scope, recorded so the next effort knows where they live:** the `dir` switch itself,
and `enableRtl` as a single derived value exported beside the grid theme (today's lone call site reads
a `dir` nothing in the app ever sets). Everything *inside* AG Grid mirrors itself via its own
`.ag-ltr`/`.ag-rtl` guards. Arabic **copy and font metrics** stay out with the translation effort —
Arabic is taller and often wider and will pressure the 340px rail and the uppercase card headings when
it arrives.

## Done when

The six bidi-hazard values render through `Ltr`, the band's customer block and the work-area frame use
their logical spellings, the back chevron and `↗` flip explicitly as SVGs, no `box-shadow` carries the
selected-row bar — and the LTR screen is visually unchanged.

## Blocked by

[091](091-identity-band.md), [092](092-summary-rail-cards.md),
[093](093-items-grid-and-jobs-count.md), [094](094-action-bar-grammar.md) — every wrap site and every
logical respelling lives in a region those four build.

## Comments

**Three of the five respellings were already correct when this ticket opened**, which is what
building them in the region tickets rather than sweeping them afterwards was for. F1 landed with 091
(`ms-auto` on the customer block, and the prototype's media-query repeat has no counterpart here —
the band wraps on flex, not on a breakpoint); F4 landed with 085/093 as
`.ag-row-selected:not(.ag-full-width-row)::before { inset-inline-start: 0 }`, and 093 introduced no
`box-shadow`; F2's back-chevron flip landed with 091. This ticket **confirmed** all three by
measurement and added only the `↗` flip and the six isolates.

**F5 does not exist in this build, and that is a finding rather than an omission.** The prototype's
notched work-area frame (`.gridwrap{border-radius:0 9px 9px 9px}`) became an **underline tablist over
an unframed panel** when 073's layout was implemented — the tab strip is `border-b` with a
`border-b-2` active underline, and the grid below is a separate box whose `wrapperBorderRadius` is
symmetric on all four corners. There is no square notch meeting the active tab, so there is nothing to
respell. Recorded in the drive tool's header so the next reader can tell it was considered.

**The ticket's "two band date/time values" is one band value plus one rail value here.** 080 measured
`Placed` and `Scheduled` on the prototype's band; in the shipped layout `Scheduled` is the Fulfilment
card's **Delivery window** row (`deliveryWindow`), so that is where its isolate went. Six fields
total, as specified. `Placed` itself turns out **not** to break in our format
(`March 6, 2025 · 02:46` opens with a strong Latin letter) — it stays wrapped because
over-application is free and the dumb rule is the reviewable one.

**Two directional icons on the action bar were never ruled on, and are left unflipped.** 094's
Return Document carries lucide's `Undo2` and Withdraw Request carries `Reply` — both curved arrows
pointing start-ward, the same class of glyph as the back chevron F2 mirrors. 080 ruled the chevron,
`↻`, `▾`, `⚡` and `↗` and did not reach these two. Flipping an icon nobody has looked at under RTL is
how `↗` became "the one low-confidence call", so they are recorded here for the effort that ships the
`dir` switch — which is also the first time anyone can see them mirrored.

**Still out, unchanged:** the `dir` switch itself (F8) and F6's `enableRtl`. `omsGridDirection` exists
beside the theme (085) but is spread into no grid, so AG Grid keeps its own LTR direction under a
`dir="rtl"` page — which is why the drive proves the selected-row bar is logical by forcing
`direction: rtl` on the row rather than by flipping the page. Arabic **copy and font metrics** stay
with the translation effort.
