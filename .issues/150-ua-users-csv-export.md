---
status: done
spec: 147
blocked-by: 148
---

# 150 — exportingANarrowedCardDownloadsACsvExcelOpensCleanly

## What to build

An **Export CSV** button on `admin/ua-users` that downloads the **current query's full match set** —
the whole card or search, walked from the first page, ignoring whichever page is on screen. This
slice delivers the routine path: a narrowed card (a few hundred rows at most), no dialog, the file
just arrives.

**The file is the wire row unpacked, not the grid screenshotted** — 13 columns, one per grid-row
field plus the derived Status. The on-screen channel pill splits back into two columns (*Codes via*
and *Reachable*), and the seeded / enabled / TOTP facts each get a column even though the Status
precedence chain hides them on screen. An analyst filtering on "not seeded" should not have to
reverse-engineer it out of a status word.

**Every classification is the label, resolved through the same `t()` key the screen uses** — never
the raw code. The file then reconciles against the screen by construction. The accepted price is
that the export is localised, headers included; that is a decision, not an oversight.

Three guards make Excel open it honestly, and all three are load-bearing:

1. **`="…"` formula-text wrapping on employee id and phone.** Plain quoting does *not* preserve a
   leading zero, and a long numeric id otherwise arrives as `1.23457E+11`.
2. **A `'` prefix on any free text starting `=`, `+`, `-`, or `@`** — a display name must not
   execute as a formula.
3. **BOM + a leading `sep=,` line + CRLF.** The BOM is what makes Arabic names render; the `sep=`
   line is because Excel's double-click path uses the OS list separator, which is `;` in Arabic
   locales. Accepted cost: one junk first row in non-Excel tools.

`lastLoginAt` renders through the existing stamp formatter (`YYYY-MM-DD HH:mm`, **no `new Date()`
anywhere near it**), and a never-signed-in person gets an **empty cell, not the word "Never"** — a
word makes the column text and kills date sorting.

Filename `ua-users-{scope}-{YYYY-MM-DD}.csv`, where scope is the card **code** (labels don't survive
sanitising), date only, no time.

The writer is a **pure module** — rows in, string out, no DOM and no network — and it **shares** the
screen's existing status / reachability / credential / stamp helpers rather than re-deriving any of
them. Two derivations of "what status is this person" is exactly how the file and the screen start
disagreeing.

## Spine reach

api (the walk reuses [148](148-ua-users-pager.md)'s paged call) · logic (pure CSV writer + filename
builder) · component (the toolbar button + triggering the download) · i18n (`ua-admin`: the button,
one key per column header) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `csvColumnsAndLabels` — 13 columns in order; channel split into codes-via + reachable; every
      classification the screen's label, not the code; empty cell for a null last-login; a stamp
      passes through unshifted · pure — `src/features/admin/ua-admin/csv.test.ts` (12 cases)
- [x] `csvSurvivesExcel` — leading-zero employee id and phone wrapped as formula text; a display
      name starting `=` prefixed; BOM, `sep=,` and CRLF present; a name containing a comma, a quote
      and a newline round-trips · pure — same file
- [x] `exportingAWorklistDownloadsIt` — drive: open a narrowed card, click Export, a file named
      `ua-users-<card>-<date>.csv` lands with one row per match (not one per visible page) · flow
      (Playwright, extends `tools/ua-users-scale-drive.mjs` — now 50/50)

## Boundaries

No new endpoint — the walk is the pager's own call in a loop. **No permission check of its own**:
the button renders whenever the screen renders, behind the existing access probe (ticket
[146](146-export-gate-and-audit.md)) — do not add a `canExport` field or a new probe. New i18n keys
include one per CSV column header; no new namespace.

## Done when

Clicking Export on a card holding more rows than one page produces a file containing **every**
match, which opens in Excel in columns with employee IDs and mobile numbers intact and Arabic names
legible, and the two pure suites are green.

## Blocked by

[148](148-ua-users-pager.md) — the export walks with the paged call that slice introduces.

## Comments

**Built 2026-07-27.** Two new modules beside the pager: pure `csv.ts` (writer + filename builder,
no DOM, no `t` instance — it takes a **label resolver**, which is what let the suite drive it with
the *real* `ua-admin` locale file rather than a stub map, so a missing key fails as a raw key in a
cell) and `export.ts` (the walk + the download, the two halves that can't be pure). The page gained
one button, one `exporting` flag, and an `exportCsv` that captures the query it started with.

Column 4 is the one header the ticket didn't name: `phoneClass` has **no on-screen word** (the grid
shows the number or a dash, and the class only reaches the eye through the channel pill), so
*Mobile status* + `csv.phoneClass.*` is new vocabulary — the only new vocabulary in the file. Every
other classification resolves through the pills' own keys (`status.*`, `delivery.*`, `credential.*`),
and the drive asserts the row reads `…,Usable,,SMS,Yes,Active,Yes,Yes,Active,No,2026-07-01 09:00`
— labels end to end, not a wire code in sight. Yes/No got `csv.yes`/`csv.no` rather than reaching
across to the `common` namespace, so the resolver stays single-namespace.

Two review fixes on the way out, both about the no-partial-file rule:

- the runaway-page bound **throws** instead of returning what it has. Returning a short list would
  be exactly the silent early stop spec 147 story 29 forbids, and it would have written a file.
- the download anchor is parked in the document and its object URL revoked a tick after the click —
  a synchronous revoke is fine in Chrome and can abort the download elsewhere.

Left to 151, deliberately: the >500 confirm, the cancellable progress toast, dedupe by `employeeId`,
and turning the runaway bound into a reported failure. The walk already takes its page fetcher as a
parameter, which is the seam 151's in-memory suite needs.

The drive's `phoneGap` stub pool became **400 rows** (it had been the whole 6,000-row estate), which
is both the number its card already claims and the eight-page walk that makes "the whole match set,
not the visible page" observable — 402 lines out, not 52.
