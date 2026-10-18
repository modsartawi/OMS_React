# HITL — ticket 522 (schema-1 campaign model, whole-draft Load/Save/Delete)

## Q: The ƒx helper stores a JSON `expr` now. Text box or array builder?
**Decision taken:** Settled default applied: the helper keeps its TEXT box. A pure two-way codec `src/core/rules/expr.ts` (`printExpr` / `parseExpr`, vitest `exprCodec_roundTrips`) turns text into the operator-first JSON and back. The grammar comes from the prototype's engine.js `compile()`, checked against the SIS.Rules 1.0.10 checker's own messages and BackOffice `Tests/Data.Tests/Rules/Fixtures/five-2702.json`. A filter is written `items('Name')` and stored `["items", "<id>"]`. `sum` keeps its explicit second argument. The `round` mode is a bare word. `band(x, 200:0.10)` is stored `["band", x, [[200, 0.1]]]`. A stored expr the codec cannot print shows as raw JSON and stays editable as JSON.
**Why:** The run's settled default. This REVERSES 507's ruling "the client never parses the expression language".
**Revisit if:** The owner prefers an array builder, or HQ's language has an operator the codec prints differently (it treats any identifier op generically as `op(a, b)`).

## Q: With no formula-check door, what does the helper validate against?
**Decision taken:** Settled default applied: the saved draft's `validation` issues whose `path` is the value's own path (`campaign.rules[i].values[j].expr`, or a formula condition's `…when[k].expr`). Syntax slips are the codec's, shown at once with their position. There is no live Validate call yet: that is 523's door.
**Why:** `Rules/Authoring/Validate` belongs to 523. Drafts/Load and Save already answer `validation`.
**Revisit if:** 523 adds a debounced Validate of the unsaved campaign. The helper then filters that reply by the same path.

## Q: Schema-1 conditions, effects and named values carry no id. How does the builder address them?
**Decision taken:** It uses a client-only key held under a JavaScript Symbol (`workspace/block-keys.ts`). `JSON.stringify` drops symbols, so the key never reaches the wire, and the history's JSON comparisons ignore it. Edits find blocks by key, and the checks pill locates an issue's `path` in the saved rules, then follows the key to the block on screen. Rules and filters keep their real ids. The drive finds blocks by `data-block-path` (`when.0`, `when.1.conditions.0`, `then.1`).
**Why:** Rewriting every edit, panel and check to index paths would also lose 508's "a moved block is still found".
**Revisit if:** HQ adds ids to blocks.

## Q: Where do the checks pill and Offline read from now?
**Decision taken:** From `draft.validation` (Drafts/Load and Save answer it). The invented Validate and OfflineVerdict doors and their queries are removed. Offline shows "no verdict while errors stand" when `validation.offline` is null.
**Why:** The model left no invented checks door to point at. 523 owns the live Validate door.
**Revisit if:** 523 decides the pill should validate the unsaved draft.

## Q: The rule-level all / any select
**Decision taken:** Removed. A rule's `when` is a list, and every condition must hold. "Any" is a group (`check: group, mode: any, conditions`).
**Why:** The schema-1 shape forces it: `rule.when[]` has no mode.
**Revisit if:** Never, unless HQ adds a mode to `when`.

## Q: Create — who picks the campaign id?
**Decision taken:** Settled default applied: the author types it. The id field follows the English name (upper-cased, other characters turned into `-`, at most 40) until the author edits it. It allows at most 40 of `A-Z a-z 0-9 . _ -` and refuses the static leaves `priority`, `simulator`, `sessions`, `coupon-finder`, `customers` (case-insensitive). Create sends a first `Drafts/Save` at `revision: 0`.
**Why:** No create door exists. 502's "HQ mints the code" is void.
**Revisit if:** HQ reserves more words, or wants a different suggestion.

## Q: Hours across midnight
**Decision taken:** Allowed, with a note on the page saying the hours run overnight. Two problems are left: one end alone (`hoursIncomplete`), and from equal to until (`hoursSame`, which the checker's message "the hours end at another time than they start" names).
**Why:** The contract settles it, overturning 509.
**Revisit if:** —

## Q: The state of a published campaign that also has a draft
**Decision taken:** A `pending` draft always reads "waiting for approval". Otherwise `campaignStatus` decides: Published is read from the window (scheduled / running / expired), Disabled is disabled, and `''` is a draft. The window read is the one the loaded campaign holds, which is the draft's when a draft exists.
**Why:** Load answers one campaign. The live window is 524's list composition (Versions/Load).
**Revisit if:** The owner wants a live campaign with an editing draft badged differently, or the live window shown instead of the draft's.

## Q: A stale save
**Decision taken:** 409 `RULES_DRAFT_STALE` shows "saved by someone else since you opened it" with Reload, which re-reads Drafts/Load. The unsaved edits go only on that press. `RULES_DRAFT_PENDING` gets its own wording, and while `state` is `pending` Save is disabled with that reason. The builder and every Settings page behave the same.
**Why:** The ticket's proof.
**Revisit if:** The owner wants a merge instead of a reload.

## Q: Delete draft on a live campaign
**Decision taken:** Offered whenever a draft exists (`source: draft`). It sends `Drafts/Delete { campaign, revision }`, and the live campaign stays live.
**Why:** The contract: "a live campaign stays live".
**Revisit if:** 511's ruling (delete only a never-published draft) should stand.

## BLOCKER: the slice did not fit its 1.5-hour session
**What was done:** model, draft doors, codec, the core/rules logic, the builder, Settings, dashboard, create and the list were re-pointed over schema 1. Typecheck, vitest (339 files, 5585 tests) and lint are clean. `tools/campaigns-fixtures.mjs` is re-cut to Drafts/Load replies. The campaigns drive was re-stubbed on the real draft doors and passes sections 1–46, including create-with-id, 506, and 507's codec checks. It stops at 47, where the award's value picker stays disabled after a rename.
**What a human (or the next session) must do:** finish the campaigns drive from section 47 to the end (507–516, plus the new stale-save sections 78b/78c and Offline). Re-cut `tools/priority-drive.mjs`, `tools/simulator-drive.mjs` and `tools/simulator-fixtures.mjs`, which still read the old campaign shape. Then run /code-review and /standards-review, and close 522. The list in ticket 522's Comments is exact.

## RESOLVED: the BLOCKER above (session 2, 2026-10-18)
Session 2 finished the slice: campaigns drive 588/588, priority 37/37, simulator 55/55, sessions 73/73, all stubbed. Both reviews were run and 522 is closed.

## Q: Create with an id a campaign already has
**Decision taken:** Create refuses an id the campaigns list holds, in any case (`idTaken`, "A campaign already has this id").
**Why:** HQ takes a first Drafts/Save at revision 0 over a live campaign that has no draft as that campaign's new draft. Create would then quietly draft over a live campaign (found by /code-review).
**Revisit if:** HQ adds a create door or a refusal for it. Until BO ask A adds a list door, a disabled campaign with no draft is not listed, so it is not guarded.

## Q: Value names that formulas would read as something else
**Decision taken:** A value may not be named and, or, not, true or false, or the root of one of HQ's formula fields (`session` of `session.total`). The problem is shown as `reserved`. A rename is applied, along with every `$name` that reads it, only while the typed name has no problem. Leaving the box goes back to the name the value has.
**Why:** Before this, renaming one keystroke at a time could pass the value's readers through an empty name, another value's name or a built-in field's name, and lose or misdirect them.
**Revisit if:** The owner prefers that a rename is applied only on blur.

## Q: A save of a draft that has its own evaluation tree
**Decision taken:** Every Drafts/Save (Settings and the builder) sends `tree: draft.tree` when the loaded draft has one, and leaves it out otherwise.
**Why:** The brief says "the save is the draft's whole state", and BO's WriteDraftInAsync clears TreeJson when `tree` is absent (found by /standards-review).
**Revisit if:** 524's Priority flow sends the tree through another path.
