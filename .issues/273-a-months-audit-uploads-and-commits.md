---
status: open
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

- [ ] An `.xlsx` and a `.csv` of the same rows preview identically.
- [ ] Every preview row shows the **branch name**, not just the code; an unresolvable code is a hard
      error and **blocks the whole file**.
- [ ] The commit button carries the **total in words**, and it matches the sum of the previewed rows.
- [ ] Unit test: the preview partition — hard errors block, duplicate warnings do not.
- [ ] A duplicate-kind row warns on its row and commits.
- [ ] Re-uploading the same file surfaces the *posted N minutes ago* banner and still allows the post.
- [ ] Editing the sheet between preview and commit is **refused** on the hash.
- [ ] Cancel-as-a-unit withdraws a batch and **names the rows a till had already consumed**.
- [ ] `typecheck` + `lint` green; the drive walks upload → preview → commit.

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

## Open questions

⚠ **The real sheet's header names and the reason column's true width are an ops input still owed** by
the server spec — headers are read **by name, never by position**, so a re-ordered sheet must still
post and a missing required header must refuse naming what it expected. Build against that contract;
confirm the literal names when the sample lands.
