# HITL log — ticket 447 (sync console controls, reason dialog, audit)

## Q: Contract drift — the envelope's error entries
**Decision taken:** Same as HITL-445/446: the drive stubs the REAL SIS.Api envelope `errors: [{ errorCode, errorMessage, internalErrorCode }]`, not the contract's abbreviated `{ code, message }`. Whole refusals (`REASON_REQUIRED`, `TOO_MANY_STORES`, `NO_STORES`) are read only through `apiErrorCode` / `apiErrorMessage`; per-row `results[].error` is read as the plain code string the contract describes.
**Why:** `src/core/api.ts` is the one reader of the envelope.
**Revisit if:** BackOffice 2540 really ships `{ code, message }`.

## Q: How long must a reason be?
**Decision taken:** Any reason that is not blank once trimmed (`reasonReady`); it is sent trimmed. The prototype's 5-character minimum is NOT applied.
**Why:** The wave rule and the contract both say "required, not blank"; a client-only minimum the door does not enforce would be an invented rule.
**Revisit if:** The owner wants the prototype's minimum (then BackOffice should enforce it too).

## Q: Is the selection kept across pages and filters?
**Decision taken:** Yes. The selection is a list of store codes (not grid rows), kept across pages, filters and the 30 s refresh, as in the prototype; the reason dialog lists every selected code, and a "Clear selection" button empties it. A page-wide select-all adds the page's stores until the cap; the 51st and on are refused with a toast (`selection.capped`) and their ticks are taken back. After a bulk control is answered, the selection is cleared (the prototype's behaviour).
**Why:** The cap of 50 only means something when a selection can span pages ("page through deliberately"); listing the codes in the dialog means nothing hidden is acted on unseen.
**Revisit if:** The owner wants a filter change to drop selected stores the new filter hides (the BBY maintenance precedent unselects hidden rows).

## Q: Where do the per-row failures live after the toast?
**Decision taken:** One toast sentence (success / warning / error by outcome) plus an inline "refused for these stores" list under the controls (store page) or the bulk bar (fleet), each row with its code, its words when the bundle knows the code, and the raw code otherwise. The list stays until dismissed or replaced by the next answer.
**Why:** A toast disappears; the failures must stay readable long enough to act on.
**Revisit if:** The owner wants the failures inside the toast itself.

## Q: Bulk buttons with an empty selection
**Decision taken:** With `canOperate`, the bulk bar always renders; its four buttons are disabled until a store is selected, beside a hint. Without `canOperate`, neither the checkboxes nor the bar render.
**Why:** "Absent, not disabled" is about the grant; an empty selection is a state, as in the prototype.
**Revisit if:** The owner wants the bar to appear only once a store is selected.

## Q: Which bulk controls are offered for a mixed selection?
**Decision taken:** All four (Move, Hand back, Pause, Resume) for any selection; the door answers row by row, and a WPF row under Pause/Resume/Hand back comes back `NOT_ON_WORKER` and is listed.
**Why:** The contract defines exactly that per-row refusal; filtering the selection client-side would derive host rules the door already owns.
**Revisit if:** The owner reads spec 444 story 13 ("never offered an action the server will refuse") as binding the bulk bar too — then Pause / Resume / Hand back should be disabled when every selected store is on WPF. OWNER SIGN-OFF wanted.

## Q: The notes in the reason dialog
**Decision taken:** Move, Hand back and Pause carry a one-line note on what happens, taken from the prototype without its timings ("about 5 s", "1 to 11 min"); Resume carries none (the prototype has none).
**Why:** The timings belong to BackOffice's worker settings and may change; the prototype governs the layout.
**Revisit if:** The owner wants the timings stated.

## Q: How is the fleet-wide Audit page reached?
**Decision taken:** A console page bar (`ConsoleNav`: Fleet, Audit) at the top of the Fleet and Audit pages — the prototype's top bar. 448/449 add Commands, New store and Sync pending there. The Admin menu keeps its one leaf. The 445 fleet drive's menu check was scoped to exclude this bar (`nav:not([data-console-nav])`).
**Why:** The wave allows one menu leaf; the prototype navigates the console's pages from its own bar.
**Revisit if:** The owner wants each console page as its own menu leaf.

## Q: When do the Audit page's filters apply?
**Decision taken:** On Search (a form submit), not as typed; Clear empties them and re-reads the whole feed. An end date before the start date shows a message and disables Search — nothing is sent. The store code and who are trimmed, and the code is never upper-cased.
**Why:** Four fields, two of them dates; asking the door on every keystroke would page through intermediate filters.
**Revisit if:** The owner prefers live filtering like the Fleet search.

## Contract gap: the Audit door's `from` / `to`
**Decision taken:** Both are sent as bare local dates (`yyyy-MM-dd`) from date pickers, and `to` is assumed to include the whole day.
**Why:** The contract lists `from=&to=` with no type and no inclusivity rule.
**Revisit if:** BackOffice 2539 reads `to` as midnight (then the client must send the next day, or the door should say "inclusive").

## Contract gap: the `code` filter on `ActionSync/Audit`
**Decision taken:** The store's Audit tab sends `code=<store>` and expects every entry whose `codes[]` contains it, including bulk entries.
**Why:** The contract names the parameter but not whether it matches one of several codes.
**Revisit if:** The door matches only single-store entries.

## Q: How is before → after drawn?
**Decision taken:** The door's `before` and `after` strings, each isolated as free text (`<bdi>`), with an arrow icon between them that turns under RTL; nothing is drawn when both are null.
**Why:** The bidi rule: two free-text values, the order carried by a direction-aware glyph rather than a glued string.
**Revisit if:** The door's strings turn out to be machine values (then `Ltr`).

## Q: Should a WPF store's page get an Audit tab, now that Move writes an audited reason?
**Decision taken:** No change: a WPF store keeps only Counters and Passes (446's ruling, from the contract: "the console shows only its counters and passes"). Its audit entries are read on the fleet-wide Audit page, filtered by its code.
**Why:** The contract rules the WPF page's content; 447 does not re-decide 446's tab set.
**Revisit if:** The owner wants a moved or handed-back WPF store's reasons on its own page (then `storeTabs` adds `audit` for WPF too).
