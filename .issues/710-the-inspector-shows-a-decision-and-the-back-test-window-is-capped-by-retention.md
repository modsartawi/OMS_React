---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 710 — The inspector shows a decision, and the back-test window is capped by retention

## What to build

Story 68; R1, R4–R6, R10; door 3298. An inspector opens any decision of any age and sees its rule and version, each
fact's key, path and typed value (or unknown / unparsed), and the replay result. **Show message** tries the kept copy,
then a re-fetch from the Nphies service, and says which: matches the hash, differs from it, or not found. In the last
case the typed values still stand and the page says so.

The back-test never offers a window longer than the door's limit (the shortest retention setting it reads, minus 30
days). The brief has no row for this cap, so it rides here.

## Spine reach

model/api (decision view, message reply, window limit) · store/logic (hash outcome reading, window cap) ·
component (inspector, back-test window) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] each hash outcome and fact state reads in words — pure
- [x] the window offered is capped by the door's limit — pure
- [x] an old decision with no kept copy still explains itself; each of match, differs and not found shows — flow

## Boundaries

A re-fetched message is shown and never stored: no browser storage, no query cache kept past the view. Behind the
decision-log read grant; the door logs it. Synthetic bundles only in stubs and screenshots. Doors stubbed; 711 reconciles.

## Done when

Every decision can be explained without its kept copy, and the back-test cannot ask for data already purged.

## Blocked by

None (can start immediately).

## Open questions

- Where the inspector is entered from. Default: from the Review list's decision rows and the rule's metrics. Settle it
  against what 3298 builds.

## Comments

**2026-10-30, built on stubs.** Pure tests in `inspector/decision.test.ts` and `core/insurance-rules/backtest.test.ts`;
`tools/insurance-fhir-710-drive.mjs` 92/92 stubbed, LTR and RTL. Nothing has met a live door. RTL was driven with the
app's `lng` still `en`, so the Arabic bundle is proved by key parity only and no one has read it on screen.

**Door shapes guessed (3298 spells none; 711 reconciles):**

- `GET InsuranceRules/Decisions/{id}` → `{ id, at, store, pharmacist, channel, sourceRef, patient, ruleId, ruleVersion,
  outcome, facts: [{ key, path, type, state: value|unknown|unparsed, value }], replay: { outcome, matches } | null,
  message: { ref, hash, kept } }`. `outcome` uses the guard line outcomes (pass, refuse, override, warn, exception); any
  other word is shown as it came. Free-text fact types are `text` and `string`.
- `GET InsuranceRules/Decisions/{id}/Message` → `{ source: kept|refetched|null, check: match|differs|notFound, hash,
  foundHash, message }`.
- `GET InsuranceRules/Backtests/WindowLimit` → `{ maxDays }`, with the door doing the "shortest setting minus 30".
- A bare 403 without the decision-log read grant, on both decision doors.

**Decisions, overrulable:**

- **Entry.** From a Review row (its id is taken to be the decision's id: guessed) and by typing an id on a new menu leaf,
  `/insurance-rules/decisions`, because the Review list holds only its newest 500 rows and "any age" needs a way in. Not
  from the rule's metrics: 3298 builds a read by id and metrics rows are aggregates with no decision id.
- **The limit fails closed.** Until the limit is read, or if it cannot be read, no window is offered and Start is disabled.
  ⚠ So this web change must not ship before the 3298 door: until then the existing guard back-test cannot start.
- **Windows stay 30 / 90 / 180.** A limit of 120 offers 30 and 90, not 120. Under 30 offers none and says why. A `?days=`
  past the limit starts at the longest offered.
- **A message the screen cannot vouch for is "not found" and is not shown**: an unknown check, an unknown or missing
  source, or a match with no body. A differing message IS shown, under its warning, with both hashes.
- **Facts show the logged value untouched**, not number- or date-formatted, because this is evidence.
- **The message is held in a mutation with `gcTime: 0`**, and each Show is a new read for the door to log.
- **The patient key goes through `maskedKey`** whatever the door sends.
- `tools/insurance-simulator-drive.mjs` gained one stub line for the limit (126/126); review drive 108/108.
