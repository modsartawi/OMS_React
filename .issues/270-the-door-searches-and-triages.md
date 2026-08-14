---
status: open
spec: 267
blocked-by: 269
---

# 270 — The door searches, and triages what needs a human

## What to build

The front page. **Nobody browses 1394 branches** — an accountant arrives with a *branch* in mind or
with *work* in mind — so the door is a search box and a triaged worklist, and 269's account is where
both land.

### The search

One box resolving **branch code, branch name in either script, city, or entry number**. An entry
number jumps straight to that entry's branch account; everything else ranks branches. The scope
(below) **ranks** results, it never refuses one.

### The scope control

Three states — **my branches** (default), **unassigned**, **all** — over the assignment the four
collection inquiries already read.

- "Mine" is the **union of own branches + one-level reports**, so a supervising accountant does not
  open empty.
- An accountant with **no staff row opens unfiltered**. That is a normal state, not an error, and the
  screen must not announce it as one.
- **Widening is never locked.** The scope is a convenience, never a permission.

### The worklist, triaged by what it costs

| lane | contents | scope |
|---|---|---|
| **Wrong money** | orphan consumptions (no document, past the server's grace), **enumerated in full**, each with a **Repair** action | 🔑 **always estate-wide** |
| **Cash waiting** | prepared-but-uncollected settlement receipts, showing **age** | 🔑 **always estate-wide** |
| **Ageing** | entries open a long time — **a count and a way through to the ledger**, never a card each | honours the scope |

🔑 **The estate-wide carve-out is the load-bearing part of this ticket.** 1255 of 1394 branches are
unassigned; under a naive "mine" scope their money would be on nobody's screen. Wrong money and cash
waiting are rare, enumerated, and belong to whoever is looking — only the ageing count and the search
ranking honour the scope. Anyone "tidying" the scope handling will break this first, so it gets its
own test.

🔑 **Triage is why this screen works.** The prototype proved the alternative by failing: an untriaged
"needs you" list went from 3 cards at six branches to ~140 at scale, of which 131 were merely ageing,
and the four that were actually *wrong* sank into them.

### The repair action

The wrong-money lane's rows carry **Repair** — the only write on this screen. It calls the server's
repair door, which is **predicated on the consumption still having no document**, so a late Z
arriving mid-click comes back as a **no-op, not a failure**: say so plainly and refresh the lane.

**Also in this ticket**: the **flat cross-estate ledger** as a support view — capped, paged,
filter-first — answering *"find entry #143, whichever branch it is on"*. It is explicitly **not** the
account: it can only assert a total nobody owes and nobody consumes, so render the total as a report
figure and keep the position on 269's account.

## Spine reach

An accountant opens the screen and is taken to the branch, or to the work, without scrolling an
estate.

## Proof

- [ ] Search finds a branch by code, by name **in both scripts**, and by city; an entry number lands
      on that entry's account.
- [ ] Scope defaults to mine, widens in one click, and **never refuses** a branch outside it.
- [ ] A session with no staff row opens **unfiltered**, with no error surface.
- [ ] 🔑 Unit test: wrong-money and cash-waiting rows for an **unassigned** branch appear under scope
      = *mine*; ageing rows for the same branch do **not**.
- [ ] Unit test: triage grouping — wrong money enumerated in full, ageing collapsed to a count.
- [ ] Repair posts, the lane refreshes, and a **no-op** response renders as *"a document arrived for
      this consumption — nothing to repair"* rather than an error.
- [ ] The ageing lane never renders one card per entry, at any fixture size.
- [ ] `typecheck` + `lint` green; `tools/settlement-drive.mjs` walks search → account.

## Boundaries

- **The account view is 269's** — this ticket navigates to it and does not restyle it.
- **No posting** (271) and **no correction** (272). Repair is here because it lives on this lane and
  nowhere else.
- **No ageing threshold logic invented here.** The lane shows what the server returns; escalation
  rules are deliberately unsettled.
- **No caching of the fleet aggregate.** The server's open-set aggregate is fast; a denormalised
  per-store balance is the trap this design refused twice.

## Done when

The door opens on my branches, finds a branch four ways, triages the work into three lanes with the
estate-wide carve-out proven by test, and repairs an orphan — including the no-op case.

## Blocked by

[269](269-a-branchs-account-is-the-destination.md).

## Open questions

The worklist's own refresh shape (poll, manual, on-focus) was left open by the design and is this
ticket's to settle cheaply — manual refresh unless driving it proves otherwise. Record the choice
here.
