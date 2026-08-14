# HITL — ticket 271 (one entry posts, and the screen reads it back in words)

Decisions taken unattended, in the order they came up. Each one is also written at the
line of code it affects; this file is the index, and the list 274 settles against a
live SIS.Api.

---

## Q: where does the posting form live — the door, the branch account, or both?

**Decision taken:** **both**, one `PostEntryDialog` with an optional `seedStoreId`. The door's button seeds nothing (the branch is typed); the account's seeds the branch already on screen.
**Why:** the ticket requires two things that pull in opposite directions — *"the branch is typed, not picked"* (which wants the door) and *"on success … the account refreshes"* (which wants the account). One component satisfies both: the seed goes into the typed box and resolves through the same one-match rule as anything typed, so it is a saved keystroke rather than a bypass of the guard.
**Revisit if:** an accountant posting from an account finds the resolved-branch line redundant; it would become a read-only chip there, still through `resolveBranch`.

## Q: `Settlement/Post` answers the rounded amount. What is a "review step" supposed to show *before* the server has rounded anything?

**Decision taken:** the read-back and the review step draw the amount at **the branch's own currency precision** (`currencyDecimals` — 2 for SAR, 3 for BHD); the **confirmation** draws the figure the server returned.
**Why:** this is D10's existing rendering rule (the one `formatMoneyIn` already applies to every figure on this screen), not a second rounding rule — the ticket's boundary forbids the client *computing* a figure, and nothing here does: what goes on the wire is the amount as typed, byte for byte (`50000.567`, asserted in the drive). Showing the typed third decimal at a SAR branch would have been a read-back of a figure that is never posted, which is the exact disagreement between the words and the ledger the guard exists to prevent.
**Revisit if:** 274 finds the server's rounding is not round-half-up at the currency's own scale — then the read-back's rule follows the server's, in `amount-words.ts`, in one place.

## Q: the amount in words needs the currency's nouns (*riyals*, *halalas*). Pure module or namespace?

**Decision taken:** **split** — the number words are the pure module's (`numberToWords`, tested), the nouns are the `settlement` namespace's, composed in `inWordsSentence` with i18next `_one`/`_other` plurals.
**Why:** `i18n-zero-literal` admits no exception for a user-visible word that happens to be domain vocabulary, and *"one riyal"* vs *"1 riyals"* is a grammar slip on the one screen where a **sentence** is the guard.
**Revisit if:** never; a third currency is one JSON block plus one line in `WORDED_CURRENCIES`.

## Q: what does the read-back say for a currency the app has no nouns for?

**Decision taken:** the **ISO code as the noun** — *"fifty thousand KWD"*, `post.words.other.*`.
**Why:** the footprint is KSA + Bahrain (`CURRENCY_DECIMALS` says so in one line) and a third currency is a visible, deliberate addition. Borrowing a riyal's noun for a dinar-shaped currency would be wrong in the sentence that is the guard; the code is merely terse.
**Revisit if:** a third currency goes live — it gets its own nouns, here.

## Q: does the standing-position warning need its own door?

**Decision taken:** **no** — it reads `Settlement/Account` for the resolved branch, on the same query key as `BranchAccount`'s.
**Why:** the account door already answers every entry the branch holds, so the standing position is a `filter` over an answer this screen fetches anyway — and posting from an account (the common case) then costs no request at all. Inventing a `Settlement/StandingPosition` door would have been a second contract for 274 to settle, answering a subset of one that exists.
**Revisit if:** the account answer proves heavy for branches with hundreds of entries; the door's `TOP` cap already bounds it.

## Q: what does the form do when the branch's account cannot be read?

**Decision taken:** it says **the standing position is unknown** and stays postable.
**Why:** silence would be a claim — *"nothing standing"* is a statement about a ledger the screen just failed to read, and the same rule 270 settled for the worklist banner (*a screen may say it does not know; it may not say there is nothing wrong because it could not ask*). Blocking the post instead would turn a warning-only guard into a refusal, which D4 forbids.
**Revisit if:** never.

## Q: the amount box — a `type="number"` stepper, or free text?

**Decision taken:** **free text** with `inputMode="decimal"` and `parseAmount`, which accepts a grouping comma and refuses everything else (zero, negatives, letters).
**Why:** an accountant transcribing `50,000` off finance's spreadsheet types what they read, and `type="number"` silently drops a value the browser dislikes — leaving an empty box where a figure was typed, which on this form is money. A refusal an accountant can see beats a value that vanished.
**Revisit if:** the box grows a currency-aware mask; the rule stays in `parseAmount`.

## Q: is the kind toggle allowed to change after a branch is resolved?

**Decision taken:** **yes**, and the standing position re-reads with it (drive-asserted: 0142's shortage side shows 575.50, its surplus side 120.00).
**Why:** the whole argument for one form is that the kind is chosen *with the figures in front of you*. A toggle that froze after resolution would have reintroduced the navigation choice two forms make.
**Revisit if:** never.

## Q: `0.004` at a SAR branch parses as a number. Is refusing it the "numeric cap" the ticket forbids?

**Decision taken:** **refused**, with a sentence saying why — and it is not a cap. Raised by `/standards-review`'s spec axis, kept deliberately.
**Why:** the boundary forbids a *threshold above which a legitimate entry is refused* (*"no numeric cap, no approval step, no second permission"*), and the drive proves nine million posts unimpeded. This is the opposite end: a figure below the branch's smallest countable unit posts as **zero**, reads back as *zero riyals*, and creates an entry no till can consume and nobody can hand over. `parseAmount` already refuses a literal `0` on the same ground; refusing a figure that *is* zero to this branch is that same rule at the branch's own precision.
**Revisit if:** a server-side minimum appears — then it is the server's number, and this becomes a message rather than a rule.

## Q: the review step shows a figure the client derived. What if the server's rounding is not ours?

**Decision taken:** the confirmation **names both figures** when they differ (`post.done.adjusted`), rather than quietly showing a number nobody approved.
**Why:** `/standards-review`'s sharpest finding. The client rounds nothing on the way out (the typed `50000.567` goes up verbatim, drive-asserted) and the read-back is drawn at the branch's own precision, which is the server's rule as this wave understands it — but *understands* is doing work there until 274. A disagreement is then a sentence an accountant reads, not a silent substitution. ⚠️ **The drive cannot exercise this path**: its stub rounds the same way the screen does, so the branch is unproven until a live door disagrees — which is the point of writing it now.
**Revisit if:** 274 confirms the rounding; the line stays anyway, as it costs nothing and covers a contract that can still change.

---

## Still open for 274 (the joining ticket)

- The route string and body casing of **`Settlement/Post`** (`{ storeId, entryKind, amount, reason }` → `{ entryNumber, settlementEntryId, amount }`), and in particular that the answered `amount` is **the rounded, stored figure** — the confirmation reads it back verbatim, so a server echoing the request would make the confirmation a lie rather than a check.
- Whether the server's rounding is round-half-up at the branch's currency scale (see the second entry above).
- Whether an entry number is minted per estate or per branch. The screen only quotes it; the ledger's lookup (270) assumes estate-wide uniqueness and would need a branch beside it if it is not.
- 269's and 270's own lists, unchanged.
