---
status: done
spec: BackOffice 3888 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3888-oms-react-bupa-outcomes-brief.md)
blocked-by: BO 3889
---

# 899 — Bupa line outcomes: filter a date range, read the summary, open its lines, and export to Excel

## What to build

A new leaf under the **OMS** nav group, beside Delivery Documents: **Bupa line outcomes** / **نتائج أسطر بوبا**
(doors BackOffice 3889–3891, [brief](C:\Work\DMSCO\BackOffice\.issues\assets\3888-oms-react-bupa-outcomes-brief.md)).
It lists every Bupa Care Connect line whose dispensed item or quantity differs from what Bupa sent, so the
insurance team stops opening orders one by one.

- **Filters:** from / to (required; placed dates; inclusive; at most 3 months), store, and kind (Resolved,
  Auto-resolved, Swapped, Quantity only, Voided, Unresolved). They live in the URL, so a view can be shared.
- **Summary table** (`GET BupaLineOutcomes/report`): kind · sent (material / SFDA / text, EN + AR name) · dispensed
  (material, SFDA, EN + AR name; "—" on voided / unresolved) · orders · lines · qty differs · sent / dispensed base
  units. Sorted by lines, with a totals row. Show the door's coded refusal (reversed or over-long range) inline.
- **Drill-down:** opening a summary row lists its detail lines: Bupa reference, document number (linking to
  `/oms/document/{documentNo}`), approval number, placed, store, line, sent vs dispensed with quantities. Each line
  expands to its act history (act · item before → after · quantity before → after · reason · who · when). **Show
  `PICK` as "Resolve" / "حلّ"**, never "Pick".
- **Export:** the button downloads the server's `…/report/export` `.xlsx` for the same query through `core/api`
  (`api.blob`). Do not build the file in the browser.
- **Grant:** the leaf and its menu entry are shown only with `BupaLineOutcomes.View`. Probe it the way other gated
  OMS leaves do.

## Spine reach

model/api (report + download) · logic (filter ↔ query, drill-down matching) · components · i18n (EN+AR) · route/menu
· test + drive

## Proof (→ `tdd` red-green cycles)

- [x] `the filter builds the report and export query alike` · pure
- [x] `a summary row's lines are the details with its kind, sent and dispensed item` · pure
- [x] `PICK reads as Resolve in both languages` · pure
- [x] drive (new, stubbed): filter → summary → drill-down → act history → export requests the same query and saves
  a file; refusal shown; LTR + RTL; leaf hidden without the grant · flow

## Boundaries

New endpoints, stubbed until BO 3889–3891 are on staging. Then a staging walk reconciles against the brief's
"Changes". Feature folder under `features/oms/` (area rule), new i18n namespace. No patient identity is shown,
because the doors carry none.

## Done when

The stubbed screen filters, drills down and exports, with the proofs green. The staging walk against BO 3889–3891 is
owed once they land.

## Blocked by

BackOffice [3889](C:\Work\DMSCO\BackOffice\.issues\3889-a-bupa-order-with-a-pharmacist-resolved-text-line-comes-back-from-the-report-door-as-a-resolved-row.md)
for the live contract. The screen can be built against stubs from the brief before that.

## Comments

**2026-11-14 — built, stubbed (`/implement`).** Commits df23a0e3 + the review-fix commit after it.

- **Where:** `src/features/oms/bupa-line-outcomes/` (Page, `access`, `api`, `filters`, `outcomes`, `columns`), wire shapes in
  `src/core/models/bupa-line-outcome.ts`, namespace `bupa-line-outcomes` (EN + AR, mirrored), route `/oms/bupa-line-outcomes`,
  leaf right after Delivery documents on `GET BupaLineOutcomes/Access` → `{ canView }` (fails closed).
- **Proof:** `filters.test.ts` (one query for report + export; range; URL) and `outcomes.test.ts` (drill-down match; PICK →
  Resolve / حلّ; unknown act/kind; en/ar mirror) — 17 green. `tools/bupa-line-outcomes-drive.mjs` **52/52**, LTR + RTL,
  twice. The RTL pass checks direction only: `lng` is still `en`, so the Arabic copy is pinned by the unit test, not the drive.
- **Reviews:** /code-review + /standards-review, applied: highlight redraw, kind column on detail lines, refusal titled as a
  refusal (business) not a failure, the header through `<Trans>`, no plural "1 lines", unknown-kind fallback, `||` file name,
  Reset label, the drill keyed by row.
- **Staging walk owes (against the brief's Changes):**
  1. the 3890 refusal **code** — today the screen shows the door's message as sent; give the code its own sentence if wanted;
  2. the client's **3-month** check (`to ≤ from + 3 calendar months`, month-end clamped) against 3890's rule;
  3. the drill-down **text fold** (`trim` + lower-case) against the door's CI grouping — two summary rows with one key would
     mix their lines;
  4. the export's fallback name (3891's `bupa-line-outcomes_<from>_<to>.xlsx`) and its two sheets.
- **Ruled here, not asked:** blank dates mean the last 30 days (the serial-refusals shape), so a bare link is "the last 30
  days" rather than fixed dates; the browser blocks a bad range before calling.
- **Glossary owed:** *Line outcome*, its six kinds and *act* are not in oms-react `CONTEXT.md` yet (BackOffice's glossary has
  them); left for `/domain-modeling` since `CONTEXT.md` holds another session's uncommitted edits.
