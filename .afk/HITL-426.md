# HITL — ticket 426 (Settlements: Amount, Profit center, Posted by; Approved by / at)

## Q: How does settlement reach the roster without importing the inquiry feature?
**Decision taken:** Graduated the shared TYPE, not the query. `@/core/models/collection` now holds `AssignmentPerson` and `AssignmentRoster` (the three groups). The inquiry feature's `AssignmentOptions` became `AssignmentOptions extends AssignmentRoster { defaultScope? }`, and `served-by.ts` re-exports `AssignmentPerson` so none of its importers changed. `settlement/api.ts` has its own `settlementApi.roster()` → `CollectionWeb/AssignmentOptions`, typed `AssignmentRoster`, behind its own `settlementRosterQuery` (key `['settlement','assignment-options']`, `staleTime: Infinity`, `retry: false`, copied from the inquiry query's posture).
**Why:** The runner names this option. Only the shape both features read moved; `defaultScope` is a Served-by concept settlement never reads.
**Revisit if:** a third feature needs the roster query itself. Graduate the query to `@/core/collection/api` then, with one key.

## Q: A settlement-only session cannot read the roster — is that a problem?
**Decision taken:** The client degrades. `CollectionWeb/AssignmentOptions` is gated on ANY of the six collection-screen grants (BackOffice 1196's `AnyCollectionGrantEndpointFilter` → `CanOpenAnyAsync`), and the settlement grant (`SettlementAccount`) is **not** in that disjunction. A session holding only the settlement grant gets a 403. The picker then offers only "Any accountant", and every other criterion still works (driven). A `?postedBy=<id>` link still works, because the picker shows an id the roster does not name as itself.
**Why:** Server code is out of this repo's reach, and the ticket's contract does not mention the gate.
**Revisit if:** finance has accountants who hold the settlement grant and none of the six. **For the owner / BackOffice:** add `CanOpenSettlementAsync` to `CanOpenAnyAsync` (it discloses only the roster, which a settlement accountant already sees as `postedByName`s).

## Q: The Ledger page's own URL keys for the new criteria
**Decision taken:** `amountFrom`, `amountTo`, `profitCenter`, `postedBy` (the screen's address). The door is sent `amountFrom`, `amountTo`, `profitCenter`, `postedByStaffId` (the wire contract, camelCase), spelled key by key in `ledgerQuery`, which `settlementApi.ledger` now uses instead of spreading the criteria object.
**Why:** The existing keys are short screen-level words (`from`, `to`, `kind`), and `postedBy` names what the filter means. Pinning the wire names in one pure function makes the contract testable.
**Revisit if:** someone wants the screen URL to mirror the wire names exactly.

## Q: How do the amount / profit-center boxes commit, and what happens to `1,000`?
**Decision taken:** They are text boxes that commit on Enter or on leaving the box, never per keystroke, because every commit is a navigation (the entry-number form's rule). An amount must be a plain non-negative decimal with at most 12 whole digits and 3 decimals (`1000`, `1000.5`, `.5`), which is money's scale and keeps `String(n)` out of exponent notation in the address. Typed text that does not read (`1,000`, `-5`, `1e3`) **commits nothing**: the bound already asked stands, and the box shows it again. A different spelling of the same amount (`2500.50` over `2500.5`) is no change, so there is no call and no history entry. An empty box removes the bound. A pasted address with an unreadable amount is still dropped by the ledger's existing rule (`readLedgerAmount`). From > To is not checked client-side: it reaches the server, and its `InquiryAmountRange` refusal is shown through `apiErrorMessage` (driven with a stubbed 400).
**Why:** This is the module's standing posture for hand-edited values, and the ticket says nothing about client validation.
**Revisit if:** the owner wants an inline "not a number" message instead of a silent drop.

## Q: What does "Approved by" show, and where?
**Decision taken:** `approvedByCell` (in `entry-cells.ts`, shared by both grids) shows `approvedByName` trimmed, else `approvedByStaffId`, else blank. `approvedAtCell` shows the time formatted like Posted at, or blank on the unstamped `0001-01-01` default. Both grids order the columns Posted at → Approved by → Approved at. On the Account the Journal count stays last. `approvedByName` is optional on the model, so an older SIS.Api renders the staff id (driven).
**Why:** As the ticket and runner state.
**Revisit if:** the owner prefers the name and the id together.

## Q: The Account grid is now wider than a 1600px window
**Decision taken:** Left as is. With Approved by / at added, the Account grid's columns total ~1,800px, so at 1600px the Journal count (the drilldown's affordance) is reached by scrolling the grid sideways. `tools/settlement-drive.mjs` now runs at 2000px wide, because AG Grid virtualises off-screen columns and one check reads the Journal cell. The change is commented in the drive.
**Why:** The ticket fixes the column order and positions. Narrowing other columns is a design call.
**Revisit if:** finance work on narrow screens. Options: hide Approved at by default, or narrow Posted by / Approved by.

## Q: The audit pane's approver
**Decision taken:** The `approved` fact's "where" is `{ kind: 'person', name }` when a name was stamped, and otherwise the old `{ kind: 'staff', staffId }`. It reads "Approved by ماجد العتيبي / Majed Al-Otaibi" or "Approved by staff SUP2". The rejecter and the closer are still named by staff id, because the wire carries no name for them.
**Why:** "The audit pane names the approver" — only the approver.
**Revisit if:** BackOffice later stamps a rejecter name.

## Note: wire contract vs the committed server
BackOffice 2430 (2e5713ca1 on `afk/spec2423`) binds `[FromQuery] decimal? amountFrom, decimal? amountTo, string? profitCenter, string? postedByStaffId`, counts each one alone toward the criterion rule, and adds `ApprovedByName` to the Ledger and Account rows. This agrees with the oms ticket's contract. There is no disagreement to log.

## Note: drives
- New: `tools/settlement-ledger-filters-drive.mjs`, 34/34, all stubbed.
- `settlement-drive` 291/291 after two changes: its Ledger stub now counts the four new keys as criteria (it mirrors the door's refusal), and its viewport is 2000px (see above).
- Unchanged and green: `settlement-approval` 42/42, `settlement-theft` 62/62, `settlement-supervision` 41/41, `settlement-description` 41/41, `settlement-change` 374/374.
- Outstanding (owner): the manual walk against a local SIS.Api once BackOffice 2430 is merged.

## /code-review dispositions
- **Fixed:** typing an unreadable amount over an existing bound deleted that bound. It is now refused and the bound stands (driven).
- **Fixed:** an amount past money's scale could be written to the address as `1e-7` and then dropped on re-read. The reader is now bounded to 12.3 digits (vitest round trip).
- **Fixed:** an equivalent spelling (`.5` over `0.5`) navigated to the same address and added a history entry. The box now compares the canonical spelling (driven: no call, no history entry).
- **Fixed:** the audit pane re-derived the name-or-id fallback. Both the grid and the audit pane now read `approverName` in `entry-cells.ts`.
- **Fixed:** "Approved by" could name someone while "Approved at" was blank and the audit pane had no fact (staff id set, stamp unset). `approvedByCell` is now gated on `isStamped(approvedAt)`, like the other two (vitest).
- **Fixed:** a failed roster read was silent. The picker's title now says the list could not be read and the other filters still work (driven, 403).
- **Fixed:** the stale "eight / ninth column" wording in `account-columns.ts`.
- **Kept, logged above:** a second cache key for the same roster door. The runner allowed graduating either the type or the query; the type was graduated.
- **Kept, logged above:** the Account grid is now wider than 1600px.

## /standards-review dispositions
- **Fixed (bidi):** the audit pane now isolates the name and staff id whole (`fsi`) inside its "by {{name}}" sentence. The code was older, but this ticket sends approver names through it. Two shipped drives read that text: their audit readers (`settlement-drive` `auditText`, `settlement-change-drive` `facts`) now strip the isolate marks, and every assertion in them is unchanged.
- **Fixed (spec story 48):** the filter's label is "Accountant" (its hint: "The accountant who posted the entry"), as the spec names it. Its URL key is still `postedBy` and its wire key `postedByStaffId`.
- **Fixed (duplication):** the two approver column definitions are now one `approverColumns<T>()` in `entry-cells.ts`, which both grids spread. `CommitBox` and `CommitInput` share one props type.
- **Kept:** treating every roster failure, not only the 403, as "the list could not be read" on the control. It is a filter's helper list, and the ledger's own errors still use `apiErrorMessage`.
- **Kept:** the screen URL key is `postedBy`, not `postedByStaffId`. The runner's camelCase ruling names the door's params, and those are exact.
- **For the owner:** the Account grid's width, and the roster-gate ask to BackOffice (see above).

## Note: a flaky check that this change did not cause
`settlement-drive`'s "270 → a broad query is capped…" and "…matches nothing" (the door's branch search) failed once and passed on the next run with no change, and 291/291 on two other runs. Those checks are in the door's search, which this ticket does not touch.
