---
status: done
spec: 267
blocked-by: 271
---

# 273 — A month's audit uploads, previews, and commits

## What to build

The second posting door, beside 271's single form — which is **untouched** and stays the door for one
entry.

Finance's monthly audit **already ends in a spreadsheet**. That is the whole argument for this door:
the input shape is found, not invented, and the alternative (a multi-row grid typed on the screen)
would be a shape invented here for finance to re-key *into*.

### Two calls over the same upload

1. **Preview** — the file plus the chosen kind goes up; the server parses, resolves and returns rows,
   errors, warnings, a `batchId` and a content hash.
2. **Commit** — **the same file is re-sent** with that `batchId`. There is no staging table and no
   client-held row state: what commits is the *file*, not a JSON array the browser assembled and
   could have diverged from. A **hash mismatch** means the sheet changed between review and commit
   and the server refuses.

⚠ The upload needs a **multipart door in `@/core/api`** if one does not exist — the same way
[262](262-the-api-client-learns-to-fetch-a-file.md) added the blob path. `api-envelope` forbids a
hand-rolled `fetch` beside it.

### The guard, at two levels — both required

1. 🔑 **The preview grid is the row-level guard**: every parsed row with its store code **resolved to
   a branch name**, plus kind, amount and reason. The resolved *name* is what catches the error a
   number-only review cannot — **the right amount posted onto the wrong branch**.
2. 🔑 **The file's total, in words, at the commit button** — *"47 entries, one hundred twenty-eight
   thousand four hundred riyals"*. This is 271's guard lifted to the aggregate, and it is what still
   catches `50,000` typed for `500`: one fat-fingered row moves the total by two orders of magnitude
   and the words say so.

271's in-words guard **does not survive multiplication** — forty in-words lines is a page nobody reads
by row forty, which is exactly when it stops guarding. Do not render one per row.

### The rules the preview enforces

- **Hard errors are all-or-nothing.** Nothing commits while any row is unresolvable or malformed; the
  preview enumerates the bad rows, finance fixes the sheet, and re-uploads. ⚠ Deliberately stricter
  than the assignment seed's insert-all-blind precedent, because *a seed row is inert and a posted
  entry is money someone will be asked for*.
- **Duplicate warnings commit anyway.** A branch already carrying an open entry of the same kind is
  flagged on its row — the batch must **never be stricter than the single form**, or a real second
  shortage months apart becomes unpostable by file.
- **One kind per file**, chosen with 271's toggle at the **file** level; the file carries no kind
  column. A mixed file makes the in-words total a **net** figure a typo can hide inside.
- **A content hash warns** — *"a file with these 47 rows was posted 4 minutes ago by ضحى"* — and
  **never refuses**. Refusing would make a genuinely identical repeat unpostable.
- **XLSX and CSV.** The client uploads bytes; parsing is entirely the server's — do not add a
  spreadsheet library here.

### Cancel as a unit

A posted batch can be withdrawn as one act: the same per-entry correction applied across the
`BatchId`, **reporting which rows a till already consumed and therefore could not be cancelled**. It
is a loop over 272's mechanism, not a new one — a batch is a handle and a provenance fact, never a
second lifecycle.

## Spine reach

A month's audit is posted in one act, and withdrawn in one act if finance sent the wrong file.

## Proof

- [x] An `.xlsx` and a `.csv` of the same rows preview identically. — `settlement-drive`, *"an .xlsx
      and a .csv of the same rows preview IDENTICALLY"*: same row count, same commit label.
- [x] Every preview row shows the **branch name**, not just the code; an unresolvable code is a hard
      error and **blocks the whole file**. — the drive's three checks on `august-bad.csv`, plus
      `bulk.test.ts` *"blocks the whole file on one unresolvable code"* and *"blocks an unnamed row
      the server did not complain about"* (the client's own backstop).
- [x] The commit button carries the **total in words**, and it matches the sum of the previewed rows.
      — the label *is* the sentence (`bulk.review.commitWithTotal`), folded from the rows by
      `bulkTotals`; drive-checked, and pinned by `bulkTotals`' own tests.
- [x] Unit test: the preview partition — hard errors block, duplicate warnings do not. —
      `bulk.test.ts`, 22 tests.
- [x] A duplicate-kind row warns on its row and commits. — drive, on `august-dup.csv`.
- [x] Re-uploading the same file surfaces the *posted N minutes ago* banner and still allows the post.
      — drive, two checks.
- [x] Editing the sheet between preview and commit is **refused** on the hash. — drive, on the
      server's `HASH_MISMATCH`; the refusal is a business `ApiError`, and the commit button stands
      down while the notice is up (272's press-refuse-press ruling).
- [x] Cancel-as-a-unit withdraws a batch and **names the rows a till had already consumed** — both
      of them: the row a till reached *before* the withdrawal was drawn (named, never attempted) and
      the one that lost its race *mid-loop* (named, with the remaining it came back with).
- [x] `typecheck` + `lint` green; the drive walks upload → preview → commit. — **177/177**, 1760
      vitest tests, `npm run build` green.

## Boundaries

- **271's single form is untouched.**
- **No client-side parsing** of XLSX or CSV, and no new dependency for it.
- **No staging table, no client row state** — the file is re-sent.
- **No per-row in-words read-back.**
- **No bulk-only permission.** Bulk changes how fast an accountant posts, not who is trusted to post.

## Done when

A real-shaped sheet previews with resolved branch names, refuses as a whole on a bad row, commits
behind a total read back in words, and the resulting batch can be withdrawn as one act.

## Blocked by

[271](271-one-entry-posts-and-reads-itself-back.md).

## Built

**Two calls over one multipart upload, and `@/core/api` grew the door for it.** `api.upload` is
`post` with a `FormData` body — same base, credentials, CSRF header, 401 and error taxonomy — and
the one thing it does differently is **say nothing about Content-Type**, so the browser's own
`multipart/form-data; boundary=…` survives. Pinned by three tests in `src/core/api.test.ts`, because
a hand-set JSON content type there is a failure that looks like an empty file.

🔑 **The guard is at both levels the ticket demands.** The preview grid resolves every code to a
branch name (an unnamed row is a hard error even if the server reported none — `bulk.ts`'s own
backstop), and the file's total rides **in words on the commit button**, folded per currency from
the previewed rows rather than read off D8's scalar, which is cross-checked and cannot describe a
mixed file. 271's guard was lifted, not multiplied: there is no per-row read-back.

**Cancel-as-a-unit is a loop over 272's `Settlement/Cancel`, not a new door** — and the batch is an
**address** (`?view=batch&batch=`), reachable an hour and a reload after the commit, because the
`batchId` became a criterion of 270's ledger (one input, one column) rather than a *list my batches*
door nobody asked for. The withdrawal reports three groups and rolls nothing back: withdrawn, the
rows a till got to first (named, with the server's words and the new remaining), and the calls that
never completed — whose entries are *unknown*, not decided.

⚠️ **Wire extensions**, all logged in `.afk/HITL-273.md` for 274: the two bulk bodies and results,
and a `batchId` criterion on `Settlement/Ledger`. Route strings stay 274's to confirm.

## Open questions

⚠ **The real sheet's header names and the reason column's true width are an ops input still owed** by
the server spec — headers are read **by name, never by position**, so a re-ordered sheet must still
post and a missing required header must refuse naming what it expected. Build against that contract;
confirm the literal names when the sample lands.
