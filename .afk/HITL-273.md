# HITL — ticket 273 (a month's audit uploads, previews, and commits)

Decisions taken unattended, with what would make each one wrong. Every wire shape below is an
extension of spec 267 D8, which gives the two bulk doors a body and a result *name* and no field
list — **274's to settle against a live SIS.Api**, exactly as 269/270 logged theirs.

## Q: `api-envelope` forbids a `fetch` beside `core/api.ts`. What does the multipart door look like?

**Decision taken:** `api.upload<T>(path, form)` in `@/core/api` — a `POST` whose body is a
`FormData`, reaching the same `send()` (base, `credentials`, `X-Web-Client`, 401) and the same
`request<T>()` envelope/error tail as `api.post`. One line changed inside `send`: the default
`Content-Type: application/json` is now applied only to a body that is **not** a `FormData`.

**Why:** 262 added `api.blob` the same way — a new verb on the shared door rather than a second
door. The `Content-Type` guard is not a nicety: a hand-set `application/json` on a `FormData` body
strips the browser's generated `multipart/form-data; boundary=…`, and the server then parses no
parts at all. Pinned by two tests in `src/core/api.test.ts`.

**Revisit if:** SIS.Api wants the file on a `PUT`, or wants the kind on the query string rather
than as a part — both are one-line changes at the two call sites in the feature's `api.ts`.

## Q: D8 shapes `rows[]`, `errors[]`, `warnings[]` as names only. What is on each?

**Decision taken:** transcribed into `src/core/models/settlement.ts` as:

- `SettlementBulkRow` — `rowNumber, storeId, **storeName**, currencyKey, amount, reason`
- `SettlementBulkError` — `rowNumber (0 = the file itself), column, message`
- `SettlementBulkWarning` — `rowNumber, message`
- plus **`replay`** — `{ postedByName, postedAt, minutesAgo, rowCount } | null`, the content-hash fact

**Why:** each field is load-bearing for something the ticket names by hand. `storeName` **is** the
row-level guard (*the right amount on the wrong branch*). `rowNumber` is how *"finance fixes the
sheet"* is actionable at all — an error that cannot name a row sends someone back to a 47-row
spreadsheet with no cursor. `column` carries the open question's *"a missing required header must
refuse naming what it expected"*, with `rowNumber: 0` for a fault that is the file's rather than a
row's. `minutesAgo` is the **server's** subtraction, not this screen's — the same rule
`SettlementOrphanRow.ageDays` follows (270), and for the same reason: a pure module that read
`Date.now()` would change its answer overnight.

**Revisit if:** the server names its errors with machine codes rather than sentences — then the row
would carry a code and the namespace would own the words, as the envelope's refusals do.

## Q: `{ posted, replayed, entryNumbers[] }` — is `replayed` a count or a flag?

**Decision taken:** a **boolean**. *This exact `batchId` was already committed; nothing was
doubled and these are the same entry numbers.*

**Why:** it is the answer to user story 32 (*"a second tab does not double a month's audit"*), and
a count of replayed **rows** would have no meaning under an all-or-nothing commit — a batch is
committed whole or not at all, so a partial replay cannot exist.

**Revisit if:** 274 finds a number on the wire — the screen's sentence would then name it.

## Q: One `total` on the wire, but a file can hold branches of two currencies.

**Decision taken:** the in-words read-back is computed **from the previewed rows, per currency**
(`bulkTotals` in `bulk.ts`), and D8's scalar `total` is used only as a **cross-check** on a
single-currency file. A disagreement is stated on screen (`bulk.review.disagree`); it does not
block.

**Why:** the ticket's own Proof is *"the total in words … matches the sum of the previewed rows"* —
so the rows are the source, and a screen reading back a scalar it could not derive would be
unprovable by that bullet. A riyal added to a dinar is a figure wrong in both (the rule
`figures.ts` already enforces estate-wide), so a scalar cannot be the read-back on a mixed file.
The cross-check is kept because a silent disagreement between the guard and the server's own sum
is exactly the class of thing the guard exists to make visible.

**Revisit if:** the server refuses mixed-currency files outright — then the scalar is always
checkable and the multi-currency arm becomes dead code worth deleting.

## Q: A hard error is all-or-nothing. Is the client allowed to add one?

**Decision taken:** yes, exactly one: a row whose **`storeName` came back empty** is a blocker even
if the server listed no error for it.

**Why:** the preview grid *is* the row-level guard, and its guarantee is that every row shows a
resolved branch name. A row with a blank name is either an unresolvable code (a hard error by the
ticket's own words) or a server that resolved nothing — and in both cases committing it would post
money onto a branch nobody on this screen could read back. The blocker is tagged `unresolved`
rather than `server` so the sentence beside it is honest about who refused.

**Revisit if:** the server legitimately answers rows with no name (a code it accepts but cannot
name) — then this becomes a warning and the ticket's guard weakens, which is a conversation, not a
patch.

## Q: How is a batch reached an hour later, for cancel-as-a-unit?

**Decision taken:** by **address** — `?batch=<id>` is a fourth view on this screen — and the
`batchId` becomes a criterion of 270's cross-estate ledger (URL key `batch`, one input on its
filter form, one column on its grid). The commit confirmation links straight to it.

**Why:** the ticket calls a batch *"a handle and a provenance fact, never a second lifecycle"*, and
an entry already carries its `batchId` on D8's contract. So the handle needs no new door: the
ledger is the estate-wide lookup that already answers *"find this entry, whichever branch it is
on"*, and one more criterion on it makes the batch findable from any entry that belongs to one.
Inventing a *list my batches* door would be a second lifecycle in all but name.

**Revisit if:** the ledger door does not accept a `batchId` filter — then either the server gains
it (small) or the batch view fetches per-store accounts, which is worse in every way.

## Q: Cancel-as-a-unit — one new door, or a loop over 272's?

**Decision taken:** a **client-side sequential loop over `Settlement/Cancel`**, one call per open
entry of the batch. No `Settlement/Bulk/Cancel`, no new wire.

**Why:** the ticket says it in as many words — *"the same per-entry correction applied across the
`BatchId` … a loop over 272's mechanism, not a new one"*. It also gets the ticket's other
requirement for free: each refusal is a **200 with the true remaining** (272's contract), which is
precisely *"the rows a till already consumed and therefore could not be cancelled"*, named per row
rather than counted. Sequential rather than concurrent so a 47-row batch does not open 47
connections, and so the report reads in the file's own order.

**Revisit if:** a batch is ever big enough for the loop to be slow (it is a month's audit — forty
rows), or the server grows an atomic batch cancel — the screen's report shape would not change.

## Q: A partly-cancelled batch — is that a failure?

**Decision taken:** No. The withdrawal reports **three groups**: withdrawn, already finished
(consumed / cancelled / written off before this act), and refused (a till got there first, with the
server's own words and the new remaining). Nothing is retried and nothing is rolled back.

**Why:** the ticket asks for exactly this — *"reporting which rows a till already consumed and
therefore could not be cancelled"*. A batch cancel that reported one number would hide the four
rows the accountant actually has to chase, and rolling back the ones that succeeded would put money
back onto branches for the sake of a tidy outcome.

**Revisit if:** finance ever needs the write-off offered per refused row from here — 272's panel
already does it on the entry, and the report links to each entry's account.

## Q: A single form's kind toggle at the **file** level — reuse or copy?

**Decision taken:** the toggle's markup is copied into the upload dialog; the **in-words sentence
is extracted** to `in-words.ts` and imported by both.

**Why:** the toggle is four lines of markup around a different legend (*what every row in this file
does*), and copying it changes nothing that can silently regress. The sentence is the opposite: it
is the guard itself, and two copies of *"fifty thousand riyals"* that could drift on a plural or a
currency noun would be two different guards. 272's ladder — copy the markup, extract the rule —
applied unchanged.

## Q: `Settlement/Bulk/Commit` refusing on a changed hash — which arm of the taxonomy?

**Decision taken:** a **business `ApiError`** (the envelope with `success:false` and, ideally, a
code), surfaced through `apiErrorMessage` with the namespace's own sentence as the fallback and a
**Preview again** button beside it. Not a 200 arm.

**Why:** cancel and repair refusals are 200s because they are *outcomes of the act* — the act ran
and the world said no. A hash mismatch is a refusal to run at all, on a request that no longer
describes anything the server holds, which is what the envelope's business arm is for (D8's own
table gives commit no `accepted` field to carry a refusal on). `apiErrorCode` is read but not
required: the sentence stands on the fallback if the server sends no code.

**Revisit if:** 274 finds the door answers `200 { accepted:false }` — then the arm moves and the
sentence does not.

## Q: `/code-review` — the file's in-words guard could render **nothing** and still commit.

**Decision taken:** Fixed. `bulkTotals` now buckets a row with **no currency code** into a bucket
of its own (labelled as such on screen) instead of dropping it, and `canCommit` additionally
requires that the totals account for **every** row.

**Why:** `distinctCurrencies` skips a blank code by design — it answers *which currencies are
here* — so a file whose rows arrived without one folded to an empty total list, `TotalInWords`
rendered nothing, and the commit button stayed live. The aggregate guard failing **open**, silently,
on the one screen where a sentence is the guard. Pinned by a test.

## Q: `/standards-review` + `/spec-review` — seven findings on this slice. All fixed.

1. 🚩 **`BatchWithdraw`'s `catch` swallowed the `ApiError` whole**, so a *business* refusal (the
   envelope saying no, with the server's words) was reported as *"the request did not complete, so
   this entry's state is unknown"* — the exact flattening `api-envelope` forbids. It now branches on
   `apiErrorKind` and joins the **refusals**, named, with the server's sentence. Pure half tested.
2. 🚩 **The commit's fallback sentence asserted the hash.** *"It no longer matches the one that was
   previewed"* was the fallback for **every** commit failure — a 500, a timeout, a dropped
   connection — and this client never read the file, so it cannot know that. The claim is now made
   only behind the server's own `HASH_MISMATCH` code; everything else says the smaller honest
   thing. Same correction 269's cap banner made.
3. 🔑 **The total in words was not on the button the ticket names.** The button carried digits and
   the words sat in the panel above it. D7 puts the guard *at the commit button*, so the words are
   now the label: *"Post 5 entries · one hundred twenty-eight thousand seven hundred riyals and
   fifty halalas"*.
4. ⚠️ **`SettlementBulkError.column` was carried and never rendered** — a field that is dead is a
   field that quietly stops being sent, and it is what answers the ticket's own open question
   (*"a missing required header must refuse naming what it expected"*). Now rendered, with a drive
   check on a header-less sheet.
5. The refused row's sentence was **assembled with `+`** from a key and the server's words
   (`i18n-zero-literal`: interpolate with named params, never concatenate). One key, one
   `{{reason}}`, and a sibling for the refusal that states none.
6. The preview step labelled the file's kind from **local state** rather than the server's echoed
   `entryKind` — which is the field that exists to prove *what was reviewed is what was chosen*.
7. The disagreement panel drew its two sums with `toLocaleString('en-US')` while every other figure
   on the screen goes through `formatMoneyIn` — a second money path in the one panel whose job is
   comparing two sums.

**Also raised, deliberately not acted on:** the `KINDS` constant and the two-card kind toggle are a
second copy (the in-words *rule* was extracted, the markup was not — the ladder's own split, logged
above); the `(file, batchId, entryKind)` clump; `BulkUploadDialog`'s size. And `CONTEXT.md` listing
*branch* under **Avoid** while this screen speaks it throughout — 269 logged that as a
`/domain-modeling` job for the whole wave, and a sixth slice re-deciding it in isolation is the
drift the logging exists to prevent.

## Findings raised outside this ticket's scope, left for triage

- 🚩 **`EntryCorrection.tsx:96` (ticket 272) — a money-correctness defect, worth its own fix.** The
  cancel and close-out `onSuccess` handlers read `row!` from the **latest render** rather than the
  entry the act was performed on. Changing the grid selection while a correction is in flight makes
  the toast name the wrong entry, and makes `afterRefusedCancel` mix the *new* entry's
  `amount`/`status` with the *old* entry's returned remaining — offering a write-off sized from
  another entry's race. Raised by `/code-review` at high effort and confirmed against
  `@tanstack/query-core` (a pending mutation gets fresh option closures). **Not fixed here**: it is
  272's shipped panel and this ticket's boundary is the second door. It should not wait for 274.
- 🚩 **`CrossEstateLedger.tsx:63` (ticket 270)** — the filter `draft` is seeded from the URL once and
  never re-synced, so Back/Forward *within* the ledger view leaves the form showing criteria the grid
  is not using. Raised at 272, re-raised here, still 270's.
- ✅ **The drive's flaky `search()` helper** (raised at 272) — **fixed here**, since this ticket was
  in the file: it now waits for the address it just wrote rather than for a fixed 150 ms.

## 🚩 Wire extensions this slice made

| door | shape |
|---|---|
| `POST Settlement/Bulk/Preview` | multipart: `file` + `entryKind` → `{ batchId, contentHash, entryKind, rows[], errors[], warnings[], total, replay }` |
| `POST Settlement/Bulk/Commit` | multipart: `file` + `batchId` + `entryKind` → `{ posted, replayed, entryNumbers[] }` |
| `GET Settlement/Ledger` | **+ `batchId`** criterion (the batch's handle, per the address decision above) |

Route strings, casing and part names remain **274's to confirm**, as with every door in this wave.
