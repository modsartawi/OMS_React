---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3630-the-map-chart-stores-as-points-on-a-map-spec.md
blocked-by: 908, 909
---

# 910 — The print page waits for Google's map and falls back to the table when Google cannot be reached; the report-print and copilot map drives run on Google

## What to build

BackOffice spec 3630 M37 and M38 as amended on 2026-11-17 (BackOffice ADR 0139). 883 made the print page wait for its
maps and print the table after 20 seconds. The rule does not change; the engine under it does, and the way the PDF
can fail grows.

- **Ready waits for Google's map.** `print-maps.ts` is engine-free and stays: a map block ends `drawn` once 908's
  engine reports tiles loaded and idle with the points on, or `fell-back` on "cannot draw" or 20 seconds. Check it
  holds with Google's events, including a Google map that loads its script but never its tiles.
- **Every way Google cannot be reached falls back:** no key, the key or referrer refused (`gm_authFailure`), the
  loader blocked or slow, the quota spent. Each prints the table of the same rows under "The map could not be drawn",
  and the page becomes ready.
- **The print layout keeps Google's logo and terms** on the printed map, and the map at its fixed paper size (3635's
  warning: a canvas or tile layer resized between drawing and printing prints cut).
- **The drives run on Google.** `tools/report-map-print-drive.mjs` and `tools/copilot-map-drive.mjs` let through
  Google's hosts only (one named list, the same as the build gate's and BackOffice 3987's), abort and count every
  other outside request, read the key from an environment variable never printed, and no longer start or need the
  base-map dev server. The print drive also prints once with Google's hosts blocked, for the fallback.
- **Recorded:** the Google hosts a print reached, the time to ready, cold and warm, against the report worker's 60
  seconds.

## Proof (→ `tdd` red-green cycles)

- [x] A map that reports auth failure, and one whose loader never answers, each end `fell-back`, and the page becomes ready · oms-react tests (the print page, fake clock)
- [x] A Google map that loaded its script but no tiles in 20 seconds falls back · oms-react tests
- [x] A report with no map becomes ready exactly as today · oms-react tests (883's test, unchanged)
- [x] The print drive: English and Arabic drawn on Google, 0 requests outside Google's list, Google's logo on the PDF; with Google blocked, the table under the line · drive output under Comments
- [x] The copilot drive: a view-grant-only reader sees the Google map above its table, in English and Arabic · screenshots under `.issues/assets/`
- [ ] The PDFs and screenshots are looked at by a person · `.issues/assets/`

## Boundaries

The print page's rule (883) and the 20 seconds stay. A real key is needed for the drives, with its referrers
allowing the dev origin; it is never written to a file in git or to the drive's output. Each drive run makes billed
map loads: keep the runs few.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

908, 909.

## Comments

**2026-11-17 — built** (branch `spec/3630-910`, off `spec/3630-google-build` at 909's `20442d87`). Status stays **open**:
the last proof box is a person's look.

What readiness waits for, on Google: the print page's rule is 883's, unchanged (`print-maps.ts` engine-free, 20 s). A
map block ends **drawn** once 908's panel has had both Google's `tilesloaded` and `idle` (the points are on the overlay
before Google can report either), or **fell-back** on any cannot-draw: `no-key` (Google never asked), `refused`
(`gm_authFailure`: the key, the referrer, the API, billing), `unreachable` (the script failed, or no callback in the
loader's 15 s), `no-graphics`; or on the page's 20 s (a script that loaded but never brought its tiles). Then the page
waits its 1.2 s and says `data-print-ready`.

Found and fixed (red first): **a map Google refuses after its tiles came printed as a drawn map.** The panel already
re-ends a drawn map as `cannot-draw: refused` (908, review W9: Google greys a refused map out), but `createPrintMaps`
ignored every ending after the first, so the print page kept `drawn` and would print Google's grey "This page can't load
Google Maps correctly" box. Now one move back is allowed: `drawn` → `fell-back` on a cannot-draw (never the other way;
a late `drawn` after a fall-back still changes nothing). Quota spent: Google reports it through `gm_authFailure` or not
at all — either path is covered (refused, or the 20 s).

Tests (vitest): `print-maps-google.test.ts` (new, 8) puts the print page's chain together as `MapBody` does — the real
`createGoogleLoader` (page a stand-in), the real `googleEngine` (Google's `google.maps` a stand-in that fires
`tilesloaded`/`idle`), `openMapPanel`, `createPrintMaps` + `printReady` — on a fake clock: drawn only after tiles AND
idle; refused → fell-back at once; loader never answers → fell-back at 15 000 ms, not 14 999; script blocked → at once;
script loaded, idle, no tiles → fell-back at 20 000 ms and late tiles change nothing; refused after drawn → fell-back
(the red one: 2 reds before the fix); no key → at once, no script tag; two maps share one script and one refusal falls
both back. 883's `print-maps.test.ts` is unchanged and green (a report with no map is ready exactly as before).
`npm test` 805 files / 11,075 tests green; `typecheck` green; `build` green; `check-grid-base`, `check-contrast`,
`check-palette`, `check-controls`, `check-map-build` green; `check-boundaries` only its 4 known insurance-rules findings.

The drives (`tools/report-map-print-drive.mjs`, `tools/copilot-map-drive.mjs`) now run on Google: the one named list of
Google's hosts is `tools/google-map-hosts.mjs` (`GOOGLE_MAP_HOSTS`: `maps.googleapis.com`, `maps.gstatic.com`,
`fonts.googleapis.com`, `fonts.gstatic.com`) — 911's gate and BackOffice 3987 take the same list. Only those are let
through; every other outside request is aborted and counted. The key comes from `GOOGLE_MAPS_KEY` into the stubbed
model's `maps` part, and every output line passes `withoutKey` (the key's first characters: 0 hits in both outputs).
Neither drive serves or needs the base-map file any more (vite serves only the app). The copilot drive's card scenario
hovers 909's HTML markers instead of searching a canvas; by default it runs `en,ar` only (billed loads).

Print drive, against `vite` on `localhost:5207`, headless Edge with SwiftShader, Google `3.66.13d` —
`report-map-print-drive: ok`:

| scenario | map | ready after | Google hosts reached | outside, aborted | PDF |
| --- | --- | --- | --- | --- | --- |
| drawn-en | drawn | 11.2 s cold (first vite compile included), **6.2 s warm** | all four | 0 | `910-report-map-en.pdf` |
| drawn-ar | drawn (RTL, Arabic place names) | 7.1 s | all four | 0 | `910-report-map-ar.pdf` |
| blocked-en (Google aborted) | the table, 7 rows, "The map could not be drawn" | 3.0 s | none (1 aborted) | 0 | `910-report-map-google-blocked-en.pdf` |
| refused-en (a key Google refuses: `InvalidKeyMapError`) | the table, same line | 4.1 s | `maps.googleapis.com`, `maps.gstatic.com` | 0 | temp only |
| slow-en (script never answered) | the table, same line | 17.8 s | none | 0 | temp only |
| no-key-en | the table, same line; Google never asked | 3.0 s | none | 0 | temp only |

All inside the report worker's 60 s. The map's box is 654 × 320 on screen and the same under print media (no resize
between drawing and printing, 3635's warning). Google needs nothing more to print: the map is raster
(`renderingType: RASTER`, 908), its tiles are images, so no `preserveDrawingBuffer` or graphics card (MapLibre's 3635
lessons do not apply); the fixed paper width (`PAPER_PX`) is what keeps it uncut. On the PDF: Google's logo,
"Map data ©2026 Google" and "Report a map error" (text in the PDF); Google hides its zoom buttons, keyboard-shortcut and
"Terms" link in print itself (`gmnoprint`), so the printed attribution is Google's own print form.
Previews: `910-report-map-{en,ar,google-blocked-en}.png` (page 1 of each PDF).

Copilot drive (view grant only, `localhost:5207`) — `copilot-map-drive: ok`: English and Arabic `drawn` above the
answer's table (13 rows), legend and "1 store is not on the map" under the map, Google's logo and terms on it, 0
outside requests, 0 console errors, Google hosts the same four. Card: pointing at a store shows "Diplomatic Quarter
Riyadh Till sales SAR 76,540.00 Change in Till sales -11.3%", a tap pins it. Screenshots
`910-copilot-map-{en,ar,card-en}.png`. Not yet looked at by a person — the last box stays open.
