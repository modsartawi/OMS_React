# The Ops Console sets type in IBM Plex, not Inter

The app's type moves from **Inter + Readex Pro** to the IBM Plex family: **Plex Sans** for UI text
and grids, **Plex Mono** for identifiers and codes, and **Plex Sans Arabic** for Arabic. This
overturns BackOffice 464's "Inter everywhere" ruling. Decided in
[359](../../.issues/359-which-type-family-the-ops-console-uses.md) (map 358, owner, 2026-10-02).

## Why 464 no longer holds

464 chose Inter as the open stand-in for claude.ai's Styrene, serving a warm claude.ai identity.
Map 068 retired that identity, and its spec (082) kept Inter only as "unchanged", not because anyone
argued for it again. The Ops Console is a different identity: al-dawaa navy and gold, dense,
keyboard-first. It was prototyped and approved in Plex.

## What Plex gives that Inter didn't

- **Figures align by default.** Plex Sans figures are tabular out of the box (465's binary check).
  Inter is proportional and needed `tabular-nums` scoped onto grids and `[data-numeric]`. That rule
  becomes a no-op. Keep `[data-numeric]` as a semantic marker.
- **A mono face that someone actually chose.** `font-mono` already appears at 111 call sites, and
  with no token behind it the OS provided Consolas. `--font-mono` now points at Plex Mono, so those
  sites change without edits.
- **An Arabic face drawn alongside the Latin.** Plex Sans Arabic comes from the same design program,
  so stroke, weight and x-height match in mixed lines, with real 500/600/700 weights.
- **A narrower sans.** It fits more columns in a dense grid, and its Latin file is lighter (~44 KB
  against ~73 KB).

## The rules that come with it

- **Mono means "a key".** Delivery and document numbers, SAP and material codes, store codes and
  device ids are mono. **Money and quantities stay in Plex Sans.** Its figures already align, they
  are narrower than mono figures, and keeping them out of mono keeps the meaning of mono clear.
  (The prototype set amounts in mono. That was rejected.)
- **Files** are self-hosted woff2 under `src/assets/fonts/`, with no Google Fonts at runtime:
  - Plex Sans: one Latin variable file.
  - Plex Mono: 400 and 600. A 500 request falls back to 400, and 700 to 600, so no bold is
    synthesized.
  - Plex Sans Arabic: 400, 500, 600 and 700 as static files, ~170 KB in total. It is gated by
    `unicode-range`, so it costs nothing until Arabic glyphs render.
  - Inter and Readex Pro are removed.

## Consequences

- **Arabic now costs more.** About 170 KB, against Readex Pro's 23 KB, paid only by sessions that
  render Arabic. This was accepted in exchange for Latin and Arabic that match.
- **Readex Pro had no tabular figures (465), but that mostly didn't matter.** Western digits in an
  Arabic screen render in Plex Sans and Plex Mono, because the Arabic file only covers Arabic. It
  would matter only if Arabic-Indic digits were ever shown.
- **12px legibility in 28px rows was not compared side by side.** It is checked in the
  colours/density prototype ([362](../../.issues/362-ops-console-colours-density-and-grid-look.md)).
