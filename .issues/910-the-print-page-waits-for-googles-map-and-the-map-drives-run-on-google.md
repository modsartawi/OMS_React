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

- [ ] A map that reports auth failure, and one whose loader never answers, each end `fell-back`, and the page becomes ready · oms-react tests (the print page, fake clock)
- [ ] A Google map that loaded its script but no tiles in 20 seconds falls back · oms-react tests
- [ ] A report with no map becomes ready exactly as today · oms-react tests (883's test, unchanged)
- [ ] The print drive: English and Arabic drawn on Google, 0 requests outside Google's list, Google's logo on the PDF; with Google blocked, the table under the line · drive output under Comments
- [ ] The copilot drive: a view-grant-only reader sees the Google map above its table, in English and Arabic · screenshots under `.issues/assets/`
- [ ] The PDFs and screenshots are looked at by a person · `.issues/assets/`

## Boundaries

The print page's rule (883) and the 20 seconds stay. A real key is needed for the drives, with its referrers
allowing the dev origin; it is never written to a file in git or to the drive's output. Each drive run makes billed
map loads: keep the runs few.

## Done when

Proof boxes ticked; `test`, `lint` and `build` are green (the known pre-existing `check-boundaries` findings aside).

## Blocked by

908, 909.
