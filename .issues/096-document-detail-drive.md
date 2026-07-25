---
status: done
spec: 083
blocked-by: 095
---

# 096 — theRebuiltScreenDrivesEndToEndInBothThemes

## What to build

The acceptance pass for the rework: the part no unit test reaches — that the arrangement *reads*
right, in both themes, and that the action bar's disabled-with-reason states behave.

**`tools/document-detail-drive.mjs`**, modelled directly on `tools/screen1-smoke.mjs` and
`tools/bby-inquiry-drive.mjs`, opens a real document and asserts:

- the identity band's big line is the document number;
- the pill rail's pill count matches the document (090's corpus table is the expectation);
- all four tabs — Items · Header Conditions · Log · Jobs — switch, and the operator's column widths
  and sort survive the switch;
- the summary rail unstacks **above** the work area below 900px;
- the terminal pair renders at the end of the bar, at cluster-button height, and goes disabled while a
  command is busy.

**Manual verification, in both themes**, covers what the drive cannot judge: the identity band's dark
ground against 082's dark page, the five cards on each of the five captured documents (which exercises
every collapse), the pill rail's colours, the items grid's selected row and pinned footer, and the
action bar at a width that forces the cluster group to wrap.

## Spine reach

tooling (Playwright drive) · manual verification across every region

## Proof (→ `tdd` red-green cycles)

- [x] `documentDetailDrive` — `node tools/document-detail-drive.mjs` completes with every assertion
      above green against a live document · flow (Playwright) — **39/39**
- [x] Manual both-theme pass on all five captured documents, findings recorded in this ticket's
      Comments · manual — see **Findings from the manual pass** below

**How it was verified.** `node tools/document-detail-drive.mjs` — **39/39**, replaying the five
captured payloads verbatim onto `SdDocument/Document|Delivery/{no}` (SIS.Api is up on :5111 but wants
an operator login this tool has no credentials for; the data is the live capture either way). It
asserts the ticket's five items: the document number as the largest text on the page on all five
captures, the rail against D-3's table with the pill counts 2·0·2·2·0 as literals, all four tabs
switching with the other three panels mounted-but-hidden and an operator's column width and sort
surviving a round trip through every one of them, the rail 340px beside the work area at 1600px and
unstacked above it at 880px, and the terminal pair last-in-bar at cluster height — disabled with no
reason while a command is in flight, takeable again after. The review added the second half of the
ticket's framing sentence: `Request Cancellation` on `8000000174` is `aria-disabled` (never
`disabled`), keeps focus, and states its reason on hover **and** on keyboard focus.

The whole screen was re-driven region by region as well — `document-rail-drive` 25/25,
`band` 32/32, `cards` 45/45, `items` 23/23, `actions` 38/38, `rtl` 33/33, all untouched. `npm test`
68/68, `npm run typecheck`, `npm run lint` (three gates) and `npm run build` green. **No source
change was needed:** the acceptance pass found no defect in the six regions it drives.

## Findings from the manual pass

`DRIVE_SHOTS=<dir> node tools/document-detail-drive.mjs` writes the pass's evidence: every capture in
both themes at 1600px, plus a 720px capture (the width that wraps the cluster group) and a
selected-row capture, per theme. Read by eye, with the colour relationships measured rather than
judged where a number was available.

- **The identity band's dark ground is the one real finding.** `--brand-panel` is fixed in both
  themes (082 D-9): `rgb(32,42,52)`. Against the light page it separates at **13.54:1** — the "one
  dark band on the page" the spec describes. Against 082's dark page it separates at **1.18:1**, and
  the band is the page's only surface with no border, so in dark it reads as a faintly lighter slab
  rather than as a band. It is still legible and still the page's opening statement — its white ink
  sits at 14.56:1 and the cards around it are themselves only 1.12:1 off the page (they carry a
  hairline border). Recorded, **not fixed here**: the correction is either a border on the band or a
  dark-twin value for `--brand-panel`, which is an 082 token decision, not the one-line correction
  Boundaries admits.
- **The pill rail's colours hold in dark** — anchor 6.16:1, `Ready` 8.08:1, `Cancellation` 8.50:1
  against their own grounds, and the two severities stay distinguishable from each other.
- **The five cards, on all five documents, exercise every collapse:** e-Rx renders on `2000000551`
  alone; Driver & tracking renders on 5/5 (as 092 recorded — `courierCode` is set everywhere, so it
  does not collapse on pick-in-store); the address rows vary from five down to two.
- **The items grid** shows its pinned totals footer at the foot of all five, and a clicked row paints
  both the selected ground and the leading accent bar in both themes.
- **At 720px** the cluster group wraps to three rows and the terminal pair stays at the end of the
  last row, at cluster-button height — nothing hidden, no `More ▾`.
- **The Jobs tab count** flips to the danger pill when the fixture carries a failed job, which is
  what 093 built it to do.

No outstanding arrangement defect.

## Notes from the build

- **On 090's fold-in note** ("096 should fold it into `tools/document-detail-drive.mjs` rather than
  ship both"): what folded in is the **corpus table** — the acceptance drive asserts each document's
  rail and pill count itself, so it never depends on another tool having run. `document-rail-drive.mjs`
  **stays**, because the note predates the precedent 091–095 then set: every region ships its own
  drive, 095 re-ran all four, and the rail drive's other assertions (the anchor's neutral outline, the
  two severities on the same `R`, `TRDY` in monospace, the thirteen-row disclosure, Refresh
  last-in-rail with no success toast) are region evidence with no home in an acceptance pass. Six
  region drives plus one acceptance drive is the shape this build ends in.
- The two deferred collections are **fixtures** — no capture carries Log or Jobs rows — and they say
  so at their declaration. `outboxStatus` takes the model's own taxonomy (`P`/`F`/`C`).
- The drive's "at the END of the bar" is a `right` comparison, i.e. an LTR reading. That is
  deliberate: the drive never mirrors, and the logical spelling of this bar is measured in
  `document-rtl-drive.mjs`.

## Boundaries

**Manual-run tool, not a CI gate** — it needs SIS.Api on `:5111`, exactly like its prior art
(`screen1-smoke.mjs`, `bby-inquiry-drive.mjs`). No source change is expected; any defect the pass
surfaces is fixed here if it is a one-line correction to a region already built, and filed as its own
ticket if it is not.

## Done when

`node tools/document-detail-drive.mjs` passes against a live document, and the both-theme manual pass
across all five captured documents is recorded with no outstanding arrangement defect.

## Blocked by

[095](095-rtl-mirroring-and-bidi.md) — and transitively every region ticket; there is nothing to drive
until the screen is whole.
