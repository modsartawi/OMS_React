---
status: done
spec: 766
blocked-by: 771
---

# 773 — Every panel offers fullscreen, refresh, table, CSV, xlsx, PNG and a permalink, and shows its freshness and its failures

## What to build

- **Panel actions:**
  - fullscreen;
  - refresh, with "fetched N ago";
  - view as table;
  - download CSV or xlsx from the panel's rows through the core xlsx writer, with isolates
    stripped;
  - download PNG, serialised from the SVG;
  - permalink.
- **Freshness:** "data as of HH:MM", and a "data is behind" chip in the attention status, with an
  icon and a label, when `dataAsOf` is more than 45 minutes old.
- **States:**
  - **empty:** "no data for these filters";
  - **truncated:** "cut at the row cap";
  - **failed:** `ANALYTICS-408` and `409` show a retry, and the other panels keep going;
  - **unavailable:** `ANALYTICS-410` shows the area's reason.

## Spine reach

store/logic (freshness, states) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `freshness: 44 min is fine, 46 min is behind; fetched-ago wording` · pure (vitest)
- [x] `a failed panel shows retry while its neighbours render; downloads produce files; the table view matches the chart` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Exports use the existing core xlsx writer and strip isolates; never `fsi()` in a value. Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves each action and each state.

## Blocked by

[771](771-a-boards-filters-re-ask-every-panel-and-stream-each-answer-with-the-strip-showing-n-of-n.md)
