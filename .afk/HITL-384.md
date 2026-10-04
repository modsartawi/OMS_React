# HITL-384 — unattended decisions, ticket 384 (ranges, pairs and server text read right in RTL)

## Q: What does `formatRange` put between the ends — a closed en dash or a spaced one?
**Decision taken:** It uses a closed `–` (`18:00–21:00`, `1–20`). It uses a spaced ` – ` when either end already carries a space or a hyphen (`2026-09-05 – 2026-09-12`). As a result:
- collection's day span reads exactly as before;
- the Delivery details window changes from `20:00 - 22:00` to `20:00–22:00`;
- the call center chip is unchanged.

**Why:** The ticket writes the range as `from–to`, and the call center drive must read `18:00–21:00`. A closed dash between two ISO dates would blur into the dates' own hyphens.
**Revisit if:** the owner wants one fixed form for every range.

## Q: Reshape the `{{a}} / {{b}}` and `{{from}} – {{to}}` templates, or delete them?
**Decision taken:** Deleted. The keys are `collection:grid.daySpan`, `broadcast:counter` and `bonus-buy-download:progress.counter`. The separator glyphs now live in `@/core/util/bidi` (`formatRange`, `formatCount`), and `i18n-zero-literal.md` lists them as allowed punctuation. `bonus-buy-inquiry:members.range` was reshaped to `Showing {{range}} of {{total}}`, because it carries words.
**Why:** A template whose whole content is `{{a}} / {{b}}` would become `{{count}}`, which carries nothing. The ticket asks for pure helpers that return one string. 095's old reason for routing the dash through `t()` ("the separator is copy") is what F24 overturns: a translated separator between two separately interpolated ends is exactly the shape that reverses.
**Revisit if:** an Arabic translator wants a different range or count separator. That would need a locale-aware separator in the helper, not a template.

## Q: Which isolate does a mixed pair take (`code · name` with an Arabic name, `1001 · الرياض`)?
**Decision taken:** `Ltr`, once, around the whole pair, so the code reads first. This covers the store chip, the refused-line `itemNumber · description`, and the Details band's date · time and phone · city. It is written into `bidi.md`'s table.
**Why:** 378 §2 lists `1001 · Riyadh` → `Riyadh · 1001` as a breakage, which means the expected order is the LTR one.
**Revisit if:** the owner reads an Arabic-led pair as needing to start from the right.

## Q: Interpolated values in a `t()` sentence: `<Trans>` slots or `fsi()`?
**Decision taken:** `fsi()` is used at every non-grid `formatDateTime` site in settlement:
- ApprovalDialog, ChaseDialog, EntryApproval, EntryChangeRequest, EntryJournal, RepairDialog, SettlementDoor;
- in each touched sentence, the names and ids beside the date are wrapped too.

JSX sinks with no sentence around them use `Ltr`:
- EntryAudit's time and EntryJournal's consumed-at;
- active sessions' started and last-seen;
- the existing-order facts;
- iDoc's exported-at;
- the two counters.

**Why:** `<Trans>` needs a tag in each template, and the Boundaries say locale JSON changes only where two ends become one value. F26 names the FSI helper for interpolations.
**Revisit if:** a reviewer prefers `<Bdi>`-slot templates. Note that FSI picks its direction from the first strong letter, so it is not a strict LTR isolate for machine values. That is harmless for digit-led dates and amounts.

## Q: Should the xlsx export strip isolates from cell values too, or only from header names?
**Decision taken:** Only from header names. A header name is an F26 string sink, so it may legitimately carry `fsi`. Cell values are left untouched, so a misuse of `fsi` in a grid value stays visible rather than silently cleaned up.
**Why:** F26: "never used in grid values or exports". Standards review pointed out that stripping cells would hide the violation.
**Revisit if:** the owner wants belt-and-braces stripping of cell text too.

## Q: The grid-cell interpolations HITL-383 deferred to 384
The keys are `open.age.posted`, `open.row.ofAmount`, `open.chase.line` (in its cell), `open.row.theftDay`, `ageWords` and central-invoice `list.serials.open`.
**Decision taken:** Left as they are.
**Why:** 384's Boundaries say "Grid cells are 383's". Using `fsi` inside a cell renderer would put invisible characters into the cell text that Ctrl+C copies, which F26 forbids. The clean fix is a `<Trans>` slot, which changes the template, and that is outside this ticket's locale boundary.
**Revisit if:** the owner wants them done. That is a small follow-up ticket using `<Trans>` slots, and it is unowned now.

## Q: Values outside the §3 sweep that are still unisolated (noticed, not changed)
- Settlement money rendered bare next to swept hunks: `SettlementDoor` row amount, `RepairDialog` `repair.summary` amount/store, and `EntryAudit` amount.
- Active sessions' user id, store code and IP.
- bonus-buy `DetailModal` min / max (`a / b` plus currency, in mono).
- Coupons `maxRedemptionsPerCode / maxRedemptionsTotal`.
- `IdentityBand`'s comment that still calls the other sub-ids "measured safe" (095 logic).

**Decision taken:** Not swept.
**Why:** The ticket's sweep is 378 §3's list (ranges, counters and `formatDateTime`). A whole-app "isolate by kind" sweep is each screen's own step (S3–S6 re-drive their own values).
**Revisit if:** the owner wants an S1-wide sweep before S2.

## Q: Pre-existing drive failures seen while proving
**Decision taken:** Recorded, not fixed.
- `four-filters-drive` fails 3 and `collection-drive` fails 2. These are landing-date query checks, and they fail identically on HEAD with this diff set aside.
- `settlement-drive` is flaky: 286/291 on HEAD; 291, 286 and 290 with this diff. The failing set changes from run to run and never touches a swept file.
**Why:** None of them are this slice's.
**Revisit if:** any of them reproduces on a check that touches a swept site.
