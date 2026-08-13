---
status: open
spec: 267
blocked-by: 269
---

# 271 — One entry posts, and the screen reads it back in words

## What to build

The posting form — the screen's first real write, and the one place a slip becomes money a branch
manager is asked to hand over.

**One form with a kind toggle**, never two forms. Two would make the kind a **navigation choice taken
before the accountant has the figures in front of them** — the moment it is easiest to get wrong, and
the one mistake the model cannot absorb (the server makes kind a hard constraint: a shortage is only
ever settled by a receipt, a surplus only ever by a close).

The toggle states the **consequence**, not the word:

> *the branch must hand this money over* · *the branch may keep this money back*

### The branch is typed, not picked

Code, name in either script, or city, **resolved to exactly one match** before anything can be
posted. A 1394-option `<select>` is not a control.

### Two guards, against two different mistakes — both required

1. 🔑 **The amount is read back grouped and in words** before commit — *50,000.000 · fifty thousand
   riyals* is a different sentence from *five hundred riyals*, while the two digit strings are one
   keystroke apart. **This is a review step, not a cap.** A numeric threshold was rejected twice:
   approval limits are deliberately unsettled so any number is invented, and a cap refuses the
   legitimate large entry while doing nothing about a plausible wrong one.
2. 🔑 **The resolved branch's standing open position of the same kind** is shown before the review
   step, naming each existing entry and its remaining. A monthly audit reposting the same shortage
   onto a branch that already carries one is permitted by design — **so only this screen can catch
   it**. Warn; never refuse.

### The rest of the form

- **Reason** — free text, ≤200, and the form renders **what the branch will see**, in the branch's
  own words, beside it. This is not a filing act: it is a message a manager reads at a till at 23:00.
- **The commit names the immutability** — once posted the amount cannot be changed, only cancelled
  while untouched or written off once partly consumed.
- ⚠ **Amounts are posted in what the branch can physically count** — whole units for a 2-decimal
  branch, three decimals for a 3-decimal one. The **server rounds**; the screen shows the **rounded**
  figure in the in-words read-back and in the confirmation, so the words and the ledger can never
  disagree. Do not round client-side as well — read what the server returns.
- On success the new entry's **number** is shown (it is the handle finance and the branch settle by
  on the phone), and the account refreshes.

## Spine reach

An accountant can put a real figure into a branch's ledger — the first half of the feature that was
previously a table nobody could write to.

## Proof

- [ ] Posting a shortage and a surplus each land on the branch's account with the right kind and a
      minted entry number.
- [ ] Unit test: **amount-in-words**, including grouping, the rounded figure, and both currencies.
- [ ] The standing-position warning fires on a branch that already carries an open entry of the same
      kind, and **commits anyway** when the accountant proceeds.
- [ ] A branch that resolves to more than one match, or to none, cannot be posted against.
- [ ] The in-words read-back shows the **rounded** amount for a 2-decimal branch (type a fractional
      amount and watch it), and full fils for a BHD branch.
- [ ] The reason renders verbatim in the "what the branch will see" preview, including Arabic.
- [ ] `typecheck` + `lint` green; the drive walks post → account.

## Boundaries

- **One entry at a time.** The bulk upload is [273](273-a-months-audit-uploads-and-commits.md) and
  must not be smuggled in here.
- **No numeric cap, no approval step, no second permission.** Whoever can open the screen can post.
- **No client-side rounding** and no client-computed total — the server owns both.
- **No amend.** Changing a posted amount is not offered, and its absence is stated out loud on the
  correction surface (272), not here.

## Done when

An accountant posts one entry through a single form, is shown the amount in words and the branch's
standing position before committing, and the entry appears on the account with its number.

## Blocked by

[269](269-a-branchs-account-is-the-destination.md).

## Open questions

None.
