---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692, 702
---

# 703 — Drift items are cleared with a note and badge what they affect

## What to build

Stories 58, 59, 62; D3–D6, D10; door 3293. A **drift** item on the review list shows the payer, the signal (a new profile
version, a URL never seen, a falling answer rate) and a sample's (source, id). The catalog fields and published rules it
affects carry a drift badge that links back to it, and the rules are shown as still running. A grant holder clears it
with a note and no second approver.

## Spine reach

model/api (drift item, badge data) · store/logic (signal reading) · component (row, badges on catalog and rule list) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] each signal reads in words, and rates and URLs stay machine values — pure
- [x] a drift item shows, its badges appear on a field and a rule, clearing it removes them — flow

## Boundaries

Re-alerting is the door's. A sample is a reference, never a fragment of the bundle. Doors stubbed; 711 reconciles.

## Done when

The team sees what to re-check after a payer changes, and nothing has stopped running.

## Blocked by

692, 702.

## Comments

**2026-10-30, built on stubs** (`tools/fhir-rules-stubs-703.mjs`, `tools/insurance-fhir-703-drive.mjs`, port 5213). Never
against a live SIS.Api.

**Door shapes guessed, for 711 to reconcile** (door 3293 names the content but spells no wire):
- A drift row on `GET InsuranceRules/Review`: `kind: drift`, `payer`, `sample: { source, id }`, and
  `signal: { type: newProfile, profile } | { type: newUrl, url } | { type: rateFell, measure: answer | unparsed, field, rate, baseline }`.
  Rates are fractions 0-1; `field` is a catalog key.
- `GET InsuranceRules/Drift/Badges` → `[{ itemId, payer, signal, fields, rules }]`, open items only, so a clear removes
  them. `fields` are `factKey` strings (`$line.claimResponse.copay`), `rules` are rule ids. Whether it exists, or the data
  rides on the catalog and rule rows instead, is the door's call.
- The clear is 702's guessed `POST InsuranceRules/Review/{id}/Clear { note }`. Re-alerting is the door's.

**Decisions (overrulable):**
- A badge links to `/insurance-rules/review?kind=drift&item=<id>`, which marks and scrolls to the row rather than opening
  the dialog. `item` is not a door filter, and any filter change drops it.
- In the condition picker the badge opens a new tab, so an unsaved draft survives.
- A denied or failed badge read shows no badge and no error, so the catalog and the rule list stay usable. It therefore
  cannot tell "no drift" from "could not read".
- A half-sent signal (a `newUrl` with no URL, a null rate) reads as the unknown signal with its code, never as a wrong rate.
- The rule badge sits in the Guards list's Flags column (now 230 wide, auto height). A click on it no longer also opens the
  rule. `core/insurance-rules/DriftBadges` is ready for 699's monitor list, and 698's publish warning can read
  `driftBadgesQuery`. Coverage and category rule lists carry no badge, since the ticket's rule list was taken as Guards.
- The item lists no affected fields or rules: the ticket asks only for the badges to link back.

**Fixed in passing:** merge 710 added a 12th Review column, so item rows (11) fell one short and 702's drive failed its
"every row spans the same columns" check. Open now spans the action and decision columns, and that drive expects 12.

**Not shown yet:** as on 702, `lng` stays `en`, so the drive's RTL is direction only. The Arabic drift copy is proved by key
and slot tests alone, and no one has read it in place.

**2026-10-30, review fixes (branch `t3271-review-fix`), all stubbed.** **Story 59: the drift badge now sits wherever a published rule is listed or opened:** rule page, rule editor (new tab), coverage and category lists (new tab, beside the row's button, since a link cannot sit in a button). This replaces the decision above that took "the rule list" as Guards. 🚩 Guess for 711: door 3293's `rules` holds coverage and category rule ids too.
