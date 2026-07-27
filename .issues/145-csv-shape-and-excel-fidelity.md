---
type: wayfinder-ticket
wayfinder: grilling
map: 139
status: done
blocked-by: 144
---

# 145 — What is in the file, and whether Excel opens it right

## Question

Ayed said "excel or csv". CSV was chosen — so the file has to survive being double-clicked into
Excel, which is a stricter bar than being valid CSV.

- **Columns.** The seven the grid shows, or the fuller row (`email`, `phoneClass`,
  `credentialState`, `isSeeded`, `isActive`) that `UaEmployeeGridRow` already carries? The grid
  compresses `phoneClass`/`email`/`deliveryChannel` into one `ChannelPill` and derives a status —
  a spreadsheet probably wants those unpacked into their own columns.
- **Codes or labels?** `credentialState` is a raw code (`temporary-must-change`); the screen maps it
  to a label. Does the file carry the code, the label, or both? Labels come from `t()` — meaning the
  export is localised, and every header is a translation key too.
- **Employee IDs and phone numbers are the classic Excel trap** — leading zeros stripped, long
  digits turned into scientific notation. Decide the treatment now (text qualifier, a leading
  apostrophe, a `sep=` hint) rather than after someone reports mangled IDs.
- **Dates.** `lastLoginAt` is an ISO stamp the screen renders through `formatStamp`. Which form goes
  in the file, and is `null` an empty cell or a "Never" word?
- **Encoding and delimiter.** UTF-8 with a BOM is what makes Excel read non-ASCII names correctly —
  confirm that is the choice, and confirm the delimiter (Arabic/RTL locales are a planned target,
  and a comma is not universally safe in Excel).
- **The filename.** It should say what the file is — which query, which day.

## Answer

Resolved AFK on the user's instruction ("go with recommendations"). Every ruling below is a
recommendation taken as decided; the two flagged **⚖︎** are the ones with a real trade-off and are
the ones to overturn first if the spec review disagrees.

### 1. The file is the row unpacked, not the grid screenshotted — 13 columns

The grid compresses three wire fields into one `ChannelPill` and derives a status. A spreadsheet
does the opposite of a pill: it wants one fact per column so it can filter and pivot. So the file
carries **every field of `UaEmployeeGridRow`, each in its own column, plus the one derived column
the screen shows** (Status), in this order:

| # | Header key | Source | Rendered as |
|---|---|---|---|
| 1 | `export.h.employee` | `employeeId` | digit-safe text (§3) |
| 2 | `export.h.name` | `displayName` | text (injection-guarded, §3) |
| 3 | `export.h.mobile` | `phone` | digit-safe text; `''` ⇒ empty cell |
| 4 | `export.h.mobileQuality` | `phoneClass` | label — new `export.phoneClass.*` keys |
| 5 | `export.h.email` | `email` | text; `''` ⇒ empty cell |
| 6 | `export.h.channel` | `deliveryChannel` (through `normalizeChannel`) | `delivery.sms` / `delivery.email` |
| 7 | `export.h.reachable` | `hasDestination(row)` | Yes / No |
| 8 | `export.h.status` | `deriveStatus(row).key` | existing `status.*` label |
| 9 | `export.h.credential` | `credentialKey(credentialState)` | existing `credential.*` label |
| 10 | `export.h.seeded` | `isSeeded` | Yes / No |
| 11 | `export.h.enabled` | `isActive` | Yes / No |
| 12 | `export.h.totp` | `isTotpEnrolled` | Yes / No |
| 13 | `export.h.lastLogin` | `lastLoginAt` | `formatStamp` or empty (§4) |

Two notes on the shape:

- **Columns 6 and 7 are the pill taken apart.** `ChannelPill` fuses "which channel" with "can it
  reach them" into one badge (`Email — no address`), because a badge has one slot. In a sheet those
  are orthogonal — you filter *SMS* on one and *No* on the other — so they split. Column 7 is the
  only computed column beyond Status, and it is three characters of `hasDestination`.
- **Columns 10/11/12 are redundant with Status and stay anyway.** Status is a *precedence chain*
  (`notSeeded → disabled → …`), so a disabled person's credential state is invisible in it. The
  whole point of a spreadsheet is asking questions the screen's precedence didn't anticipate. Raw
  facts are cheap; a missing one is a re-export.

`rowCap` / `isCapped` / `totalMatches` are wrapper metadata, not row data, and by
[144](144-export-scope-and-cost.md) the file is always the complete match set — so nothing about
capping, paging, or partiality appears in the file at all.

### 2. Labels, not codes — one truth, and it is the screen's ⚖︎

Every classification goes in as **the label the screen shows, through the same `t()` key**, and the
raw code appears nowhere. `temporary-must-change` never reaches the file; `credential.mustChange` →
*"Temporary — must change at next login"* does.

The reason is reconciliation. This file exists to be read next to the screen — someone opens
*Awaiting activation*, exports, and works the list. If the file said `temporary-must-change` where
the screen says *Must change password*, the first thing the reader has to do is build a mental
mapping, and the second is doubt whether they're the same thing. Codes are for machines, and no
machine reads this file — [144](144-export-scope-and-cost.md) established the consumer is a person
in Excel spotting who is missing.

**⚖︎ The trade-off, accepted:** the export is therefore **localised**, and every header is a
translation key too (`.claude/rules/i18n-zero-literal.md` demands the headers regardless — this
just extends it to the cells). An Arabic-locale export will be an Arabic file. That is correct for a
human-read file and would be wrong for a re-import format; we are not building a re-import format.
If a machine consumer ever appears it gets its own endpoint, not a second column set here.

Booleans render **Yes / No** (`export.yes` / `export.no`), not `TRUE`/`FALSE` and not `1`/`0`. Excel
coerces `TRUE` to a boolean type and then filters it differently from text; Yes/No stays text,
filters cleanly, and reads as an answer to the header's question.

### 3. The Excel traps — three guards, all in the writer

**Digit strings (columns 1 and 3).** Quoting is *not* protection: Excel parses `"0501234567"` as the
number 501234567 and the leading zero is gone. The only treatment that survives a double-click is
the formula-text wrapper — the cell is written as `="0501234567"`. Applied to **`employeeId` and
`phone` only**, and skipped for an empty value (`=""` is an ugly empty cell). Google Sheets honours
it identically; a plain text editor shows the wrapper, which is the price.

**Formula injection (columns 2 and 5).** A `displayName` beginning with `=`, `+`, `-`, `@`, tab or
CR is executed by Excel on open. Names come from SAP so this is hygiene rather than a live threat,
but the fix is one line: prefix such a field with `'`. Applied to the free-text columns.

**Delimiter (⚖︎).** The file opens with a **`sep=,` hint line** before the header. Excel's
double-click path uses the *OS list separator*, which is `;` in Arabic and most European locales —
an Arabic-locale target is stated on the map, so a bare comma file would land in that user's Excel
as a single mangled column. `sep=,` overrides that unconditionally. **The trade-off, accepted:**
non-Excel tools (Google Sheets, `pandas.read_csv` with defaults) show `sep=,` as a junk first row.
Excel-double-click is the stated bar; the junk row is one visible line and is obviously junk.

So the bytes are: `BOM` + `sep=,\r\n` + header row + data rows, **CRLF** throughout, RFC 4180
quoting (a field containing `"`, `,`, or a newline is quoted and its quotes doubled).

### 4. Dates: the screen's own string, and `null` is an empty cell

`lastLoginAt` goes in as **`formatStamp(iso)` — `YYYY-MM-DD HH:mm`**, the exact string the grid
renders. No `new Date()` anywhere near it: the repo's no-utc-time rule holds here for the same
reason it holds in the grid, and the sliced form is unambiguous in every Excel locale (unlike
`14/07/2026`, which an en-US Excel reads as a different date or as text).

**`null` is an empty cell, not the word "Never".** The grid says *never* because a blank table cell
looks broken; a blank spreadsheet cell does not — it is `(Blanks)` in the filter dropdown and
`COUNTBLANK` counts it. A text word in a date column makes the whole column text and kills sorting,
which is precisely the operation someone exporting *Awaiting activation* wants. `grid.never` stays
on the screen and does not follow into the file.

### 5. Filename: scope and day, from a key

`ua-users-{scope}-{YYYY-MM-DD}.csv` — e.g. `ua-users-phoneGap-2026-07-27.csv`,
`ua-users-search-ahmed-2026-07-27.csv`.

- **`scope`** is the card **code** for a worklist (`all`, `phoneGap`, `awaitingActivation`, …) and
  `search-<slug>` for a search, where the slug is the term lowercased with non-alphanumerics folded
  to `-` and truncated at 24 chars. **The code, not the label** — labels contain spaces, em-dashes
  and (in Arabic) characters that sanitise down to nothing; a filename that survives is worth more
  than a filename that translates, and the card code is already the URL-ish identity of the
  worklist everywhere else in the screen.
- **Date only, not a timestamp.** Two exports the same day collide into `… (1).csv`, which is the
  browser's job and is more readable than a seconds-precision name nobody scans.
- The pattern lives in `t('export.filename', { scope, date })` so it is not a bare literal and can be
  localised later without touching the writer.

### 6. Where it lives

A new **pure module** `src/features/admin/ua-admin/csv.ts` — `toCsv(rows, t)` returning the string,
plus the small guards (`digitCell`, `textCell`, `csvField`) as named exports. Pure and
framework-free, so it is exactly the kind of module `vitest` covers directly (the repo's standing
position from spec 083: pure modules are where regression is silent). The Blob/`URL.createObjectURL`
download is the impure part and stays in the page-level export hook.

### New i18n keys (ua-admin namespace)

`export.filename`, `export.yes`, `export.no`, `export.h.*` (13 headers),
`export.phoneClass.{missing,placeholder,usable}`. Everything else reuses existing `status.*`,
`credential.*`, `delivery.*` keys — which is the mechanism that makes §2's "one truth" literally
true rather than merely intended.

### Consequences

- **Nothing for the contract addendum.** No server change: the file is composed entirely from fields
  `UaEmployeeGridRow` already carries.
- **`deriveStatus`, `hasDestination`, `normalizeChannel`, `credentialKey`, `formatStamp` are now
  shared by the screen and the file** and stay in `helpers.ts` — the export imports them rather than
  re-deriving, which is what keeps the two readings identical.
- **[146](146-export-gate-and-audit.md) inherits a sharper object**: the thing it decides whether to
  gate is now known to be a 13-column file carrying every person's mobile number and email address
  in plain text — a staff contact directory, not a status report.
