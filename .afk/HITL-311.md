# HITL-311 — decisions taken AFK

Contract read: BackOffice 1980 (`status: done`, `## Web contract` present), cross-checked against the committed
source on `C:\Work\DMSCO\BackOffice` main:
- `SettlementAccountantService.PostAsync` trims the reason and refuses a blank one with `SettlementReasonRequired`
  (a DomainException, which becomes a 400 envelope with the code in `errors[0].errorCode`). It then measures the
  200 limit on the trimmed text (`SettlementReasonTooLong`).
- `SettlementBulkPostingService` adds `REASON_REQUIRED` per row, and the commit answers `ROW_ERRORS`
  (`SettlementBulkIssueCodes`).

**No disagreement between contract and code.** The contract gives no wording for the single-post message, so the
drive stubs `ReasonRequiredMessage` word for word from the service.

Note: this session resumed the work of an interrupted earlier 311 run. That run's diff was saved as
`.afk/wip-311.patch` and its drive as `.afk/wip-311-settlement-description-drive.mjs`. This session re-applied both,
reviewed them again and re-ran the drive.

## Q: How is "required" marked on the single post?
**Decision taken:** The label carries the word "required" (muted), and the box has `aria-required`. There is no
browser `required`, because the browser would count a box of spaces as filled. The rule itself is the pure
`checkDescription` in `posting.ts`:
- It trims the text.
- A blank result is refused.
- More than 200 characters after the trim is refused.
- The trimmed text is what gets posted.

The error shows when the box holds only spaces, or when Review is pressed on an empty box. It never shows on a form
that has just opened.
**Why:** It follows the server's own order (trim, then blank, then length). So the form never refuses what the
server takes, and never sends what it refuses.
**Revisit if:** copy review wants an asterisk convention instead of the word.

## Q: Where does a server refusal of the single post's description show?
**Decision taken:** On the description box itself:
- It is the server's sentence, English then Arabic on its own line (`whitespace-pre-line`).
- It stays while the refused text is unchanged, and clears when that text changes.
- The review step closes back to the form with the text kept.
- These two codes get no toast, because a toast collapses the line break. Every other error still toasts as before.

**Why:** The ticket says a refusal is shown against what it refuses. /standards-review found that the first version
showed it only in a toast. The web is English-only, but the server's message is data and is passed through.
**Revisit if:** the owner wants only the English line shown. That would mean splitting the server's text, which was
not done.

## Q: Which template columns are marked required?
**Decision taken:** All three (`StoreCode`, `Amount`, `Reason`), each with a "required" pill. The `Reason` hint says
the description prints on the branch's papers and that a row without one is refused. The header stays `Reason`: it
is one of the door's aliases, and it is the spelling proven live in 274.
**Why:** Marking only the description would suggest the branch code and amount are optional, and the server
requires all three.
**Revisit if:** the owner wants only the description marked (the ticket names only that column).

## Q: A blank description on a preview row — what does the grid show?
**Decision taken:** The row is highlighted and its cell says "No description". The server's `REASON_REQUIRED`
message, in both languages as sent, sits on that row (`reviewBulk(...).errorsByRow`) and in the blocker list too.
**Why:** The ticket says "A server refusal for a blank row is shown against that row." 1980 §3's "render blank as
absent" is about OLD entries on the read screens, and those are unchanged.
**Revisit if:** the "No description" label reads as repeating the server's sentence.

## Q: A commit answered `ROW_ERRORS` — what happens?
**Decision taken:** The refusal is folded back onto the preview (`withCommitRowErrors`):
- The answer's errors replace the preview's.
- Commit is blocked.
- The refused rows are marked on the grid.
- A toast gives the number of refused ROWS: distinct rows, excluding row 0 (this was the /code-review finding). If
  only the file itself was refused, the toast says that instead.
- A `ROW_ERRORS` answer with no errors keeps the old generic refusal banner.

**Why:** 1980 §2 names this shape. Before this change, the screen showed a banner with the bare machine code.
**Revisit if:** needed. A blank row cannot reach this path in practice, because preview and commit share one
evaluation. Rows that changed between preview and commit can reach it.

## Q: Vocabulary — "reason" or "description"?
**Decision taken:** Copy the user sees says *description*: the post form's label, the template hint, and the
`reason` column header on both grids ("Description the branch reads"). Code identifiers and the wire field stay
`reason`.
**Why:** BackOffice's CONTEXT.md gained *Description (settlement entry)* in 1980, and the papers print it under that
name. The wire field is `reason`, so the code keeps it. The account grid's header was renamed as well, so the same
entry does not go by two names on two screens.
**Revisit if:** copy review wants "reason" kept on the account grid. oms-react's CONTEXT.md has no settlement terms
yet; that gap predates this ticket and is `/domain-modeling`'s job.

## Review outcome
**/code-review:** one finding, applied: the `ROW_ERRORS` toast counted errors instead of rows.

**/standards-review, applied:**
- The refusal now shows on the field (see above).
- The duplicated row-count helper is removed; the dialog counts the keys of `errorsByRow` instead.
- The drive's message comment now cites the server source.
- The pre-existing English example-row literal in `bulk-template.ts` is back to its original text instead of being
  lengthened.

**Left, as judgement calls:**
- The example rows in the downloadable CSV stay English literals. That was 272/273's choice, and they are file
  content, not screen copy.
- There are two identical "required" keys (`reasonField.required` and `bulk.template.required`), in two components
  that style them differently.
- `SettlementReasonRequired` and `SettlementReasonTooLong` are matched as inline literals. They are machine codes,
  which the i18n rule allows.
- The post box keeps its 200-character `maxLength` (271's behaviour). So the browser cuts a 200-character paste
  with surrounding spaces before any trim, and a description can use the server's full "200 after the trim" only if
  the padding fits within the box's 200.
- The hint counts characters as typed, not after the trim.
