---
status: open
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
