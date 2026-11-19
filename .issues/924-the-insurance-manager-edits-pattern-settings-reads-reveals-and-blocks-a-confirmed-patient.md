---
status: done
spec: BackOffice 4050
blocked-by: BO 4055, BO 4056, 922
---

# 924 — The insurance manager edits pattern settings, reads reveals, and blocks a confirmed patient

## What to build

- **`/insurance/patterns/settings`** (manager):
  - the seven thresholds with their ranges, validated client-side as the server does;
  - "applies from the next run" copy;
  - the change log below.
- **`/insurance/patterns/reveals`** (manager): who revealed which case, when, and why, with filters. It links to the
  case. It shows no identity.
- **"Add to blocked-patient list"** on a confirmed case:
  - visible only with both the investigator grant and `INSURANCE_PATIENT_BLOCK` Change;
  - asks for `ReasonKind` (abuse or fraud), an optional payer, start and end;
  - calls `POST …/{id}/Block`.

## Spine reach

UI (two pages + one case-screen action).

## Proof (→ `tdd` red-green cycles)

- [x] An out-of-range setting is refused before the call
- [x] The reveal log renders with no identity column
- [x] The block action is hidden unless the case is confirmed and both grants are held, and `ReasonKind` is required
- [x] Lint + build clean (`check-boundaries` fails only on the 4 pre-existing hits in
  `insurance-rules/aliases/door-shapes.test.ts`, also on `main`; see the comment)

## Done when

Proof is green, and there is a live walk on BO 4055 and 4056.

## Blocked by

- BackOffice 4055
- BackOffice 4056
- 922

## Comments

**2026-11-19 — built and proven against mocks; stays `open` for the live walk on BO 4055 and 4056.** The settings
at `/insurance/patterns/settings` and the reveal log at `/insurance/patterns/reveals` (the manager's: two leaves in
922's Insurance group on `canManagePatterns`, each page behind its own `ScreenGate` with its own "no access" words),
and "Add to blocked-patient list" in a confirmed case's header. EN + AR, RTL.

- **Where:** inside 922's `src/features/insurance/patterns/`, namespace `insurance-patterns`, keys `settings.*`,
  `revealLog.*` (923 owns `reveal.*`), `block.*`, `menu.settings`, `menu.reveals`. In files of their own, so spec
  4050's parallel slices never edit one: models `src/core/models/insurance-pattern-manager.ts`; doors `manager-api.ts`
  and their reader `manager-wire.ts` (beside 922's `api.ts`/`wire.ts`, under the same `PATTERNS_KEY`); pure rules
  `settings.ts`, `reveal-log.ts`, `block.ts`; screens `PatternSettingsPage.tsx`, `RevealLogPage.tsx`,
  `CaseBlockAction.tsx`. Shared files are only appended under 922's slot comments (`app/insurance-routes.tsx`,
  `layout/menu-insurance.ts`, `PatternCasePage.tsx`, both locale files).
- **Settings:** the seven thresholds with their ranges in ONE table (`SETTING_RANGES`, BO 4055's list; the `min`/`max`
  the server sends are not read), each checked as it is typed: out of range, blank, not a number, or a fraction where
  days or pharmacies are counted. While any value has a problem the save is held and nothing is sent, and
  `managerApi.saveSettings` throws `SettingsNotSentError` before `api.put` as a second guard. A save sends only the
  thresholds that changed, and the PUT's answer replaces the cache. "A change applies from the next run … Cases it has
  already closed are never re-scored." stands above the form, and the change log (newest first) below it.
- **Reveal log:** four columns (When · Case · Revealed by · Reason) and no identity column. The model has no identity
  field and the reader keeps only those fields: a planted `patientKey`/`memberId` is dropped (api test, and the
  `manager-no-identity` source contract, mutation-checked). Filters by period (a backwards period is refused and never
  asked), user (debounced), and case (a row's "Only this case", or `?case=` in a shared link), all kept in the URL.
  Paged 25 at a time. Each case number links to the case.
- **Block:** `CaseBlockAction` renders nothing unless `canOfferBlock` holds (`status === 'confirmed' &&
  canRevealPatient && canBlockPatient`, failing closed). The dialog says what happens: the case's patient, every store
  and payer, the reference naming the case, and the identity use written to the reveal log. It asks for the kind of
  finding (required), an optional reporting payer (≤ 40, 3982's width), a start (blank = today; a backdated start is
  accepted) and an end (blank = none; not before today, not before the start), then posts `…/Cases/{caseId}/Block`.
  🔒 `managerApi.block` resolves to nothing: the answer is dropped, since a list-entry echo could carry the patient key.
  A refusal shows inside the dialog, which stays open. On success the case, the case list and the reveal log are read
  again.
- **Tests (vitest, 88):**
  - `settings`: each of the seven at each bound, both sides, against BO 4055's literal list; blank, words and
    fractions; the body carries only what changed.
  - `reveal-log`: the URL, the filters and the query.
  - `block`: the predicate across statuses, single grants, near misses and fail-closed answers; the form's rules and
    its body.
  - `manager-api` (at the `@/core/api` seam): paths and bodies; no PUT for four out-of-range values; planted identity
    dropped from the log; the block refused before the call, its answer dropped, its id escaped.
  - `manager-no-identity`, `manager-i18n-keys`, `layout/menu-insurance-manager`.
- **Drive** `tools/insurance-patterns-manager-drive.mjs` (its doors in `tools/insurance-patterns-manager-stubs.mjs`,
  chained after 922's `patternsDoors`): **82/82**.
  - The nav leaves and both gates for two near-miss grant sets.
  - Settings: the seven read with their ranges, the next-run copy and the change log. WindowDays 31, MinStores 1 and
    OverlapShare 0.91 are refused on the page and Save makes **no PUT**; 90.5 days asks for a whole number. One PUT
    carries only the two changed values; the log grows; a refused save keeps the draft; Discard works.
  - Reveal log: 31 rows over two pages; exactly four headers; the identity the stub planted in every row never on
    screen; Next; the user, period (backwards refused) and case filters; a pasted address; a case link.
  - Block: hidden in five scenarios (a missing grant, the manager instead of the investigator, an open or a cleared
    case). Confirm held without a kind; a start after the end and an end before today refused, nothing posted. The
    body is `{ reasonKind, payer, endsOn }`, trimmed, with no patient and no actor; the echoed key is never shown; the
    block's own reveal-log row is at the top; a `CASE_NOT_CONFIRMED` refusal shows in the dialog.
  - Arabic RTL on all three surfaces, with screenshots `924-pattern-settings-rtl-ar.png`, `924-reveal-log-rtl-ar.png`
    and `924-block-dialog-rtl-ar.png` in the session scratchpad.
- **Merged `spec/4050-insurance-patterns` (923) at `5fc25db3`:** only the two locale files conflicted (both sides added
  a block before `case`), and both sides were kept. After the merge: typecheck clean, **854 files / 11,498 tests**
  green, build clean, drives 922 **77/77**, 923 **53/53**, 924 **82/82**.
- **Guessed — reconcile when BO 4055/4056 land (BackOffice asks):**
  - `GET Insurance/Patterns/Settings` → `{ settings: [{ name, value, min, max }], changes: [{ name, oldValue, newValue,
    by, at }] }`. `PUT` on the same path takes `{ settings: [{ name, value }] }` with **only the changed thresholds**
    (the server keeps the rest and logs each change), answered like the GET. Values are JSON numbers. Six thresholds
    are whole numbers (the client refuses 7.5); `OverlapShare` is a fraction (0.25).
  - `GET Insurance/Patterns/Reveals?from&to&user&caseId&skip&take` → `{ items: [{ caseId, caseNumber, by, at, reason }],
    totalMatches }`, newest first. `from`/`to` are local `yyyy-MM-dd`, inclusive; `user` is the revealer (the match
    rule is the server's); the case is filtered by id. A block's row reads reason `block` (4056).
  - `POST Insurance/Patterns/Cases/{caseId}/Block` takes `{ reasonKind: abuse|fraud, payer?, startsOn?, endsOn? }`.
    The end is named `endsOn` (the list's own column is `ExpiresOn`), and the answer is ignored. The payer ≤ 40 and
    the end-not-before-today rules are the list's (3982/3133), assumed to hold through its change path.
  - Refusals are shown with `apiErrorMessage` whatever their code (`CASE_NOT_CONFIRMED`, `SETTING_OUT_OF_RANGE`).
  - The grant keys are 922's: `InsurancePattern:02` for both pages and leaves, and the block on `InsurancePattern:06`
    AND `InsurancePatientBlock:02`.
- **Judgement calls to review:**
  1. Six thresholds are whole numbers (MaxKmPerHour and MinTravelKm included). The share is typed as the server holds
     it (0.25), with "0.25 = 25%" in its help.
  2. One value with a problem holds the whole save, and only changed values are sent.
  3. The log's case filter is set from a row or a shared link, never typed: the door takes a case id, which nobody
     types. The filter names the case by its number.
  4. The block action stays offered after a block (a second one replaces the entry, as the list does).
  5. The manager's leaves do not need the analyst grant: a manager without it can read the log, but a case link leads
     to "no access" (4053 nests the roles on the server).
- **Lint:** grid, contrast, palette, controls (no hand-written control added; still 168) and map-build are clean.
  `check-boundaries` exits 1 only on the 4 pre-existing hits in `src/features/insurance-rules/aliases/door-shapes.test.ts`
  (lines 4–7, also on `main`, untouched here). Build clean.
- **Still owed:** the live walk on BO 4055 and 4056.
- **2026-11-19, spec 4050 code-review fixes (`impl/4050-review`) touching this slice:** 2 (a block in flight survives a double Escape, via `core/ui/Modal`), 3 (the block dialog is mounted outside the grant check and a bare 403 names both grants, EN and AR), 5 (the reveal log's emptied page falls back to the last page), 6 (a PUT answer naming fewer than seven thresholds blanks no field; the settings are re-read), 7 (a failed re-read keeps the settings, with "Read again"), 8 (a value typed during a save is kept), 10 (a block invalidates every case read), 11, 14 and 15 (the log's address days, grouped counts, query passed through); manager drive 95/95. Status left open.
