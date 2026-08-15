---
type: wayfinder-ticket
wayfinder: prototype
map: 275
status: done
blocked-by: 276, 278, 279
---

# 281 — The Open settlements view

## Question

What the screen at `/collection/settlement/open` actually looks like — three tabs (**Owing** ·
**Owed** · **Cash waiting**), and the row an accountant works down while holding a phone.

A `/prototype` ticket, worked **with** the owner: the front page's own design was owner-ruled from a
spike at estate scale, and the one finding that shaped everything (*an untriaged "needs you" list is
just another list*) was produced by looking at 140 rows, not by reasoning about them. This screen is
the same risk with the same cure — build it against a fixture at **estate scale**, not six rows.

**What a row has to carry**, and the questions inside each:

- **Age**, per [276](276-what-an-entrys-age-is-measured-from.md). Stated as a fact — *"open 14
  days"* — never as a judgement. 🚩 No red, no *overdue*, no badge: the map's central ruling is that
  the domain has not decided when an entry is late, and a colour is a decision.
- **Who to ring** — `ServedBy`, plus the branch name and code. Whether the collector's name shows on
  the Cash waiting tab instead (different failure, different call).
- **The money**, at whatever precision is available. ⚠️ Inherits the `currencyKey` hole: figures
  render min-2/max-3 decimals estate-wide until §1 of the hand-off draft lands. Do not guess a
  currency; do not total a column that mixes riyals and dinars (`figures.ts`'s standing refusal).
- **Last chased**, per [278](278-the-chase-notes-contract.md) — including the *never chased* state
  as a named case rather than a blank cell, and how a note is entered without leaving the list.

**The arrangement questions:**

1. **What is the sort, and is it one?** Oldest-first is the obvious answer and the map's own words.
   But mine-first ranking and never-chased-first both want to be the primary key too. Three
   candidate orderings, one column of rows — settle which is the default and which are offered.
2. **Do the tabs carry counts, and does the front page?** The map promises counted signposts on the
   triage page linking through. A count is cheap to draw and expensive to be wrong about — say what
   it counts (rows, branches, or money) and what it says when the door failed. 270's lesson: a
   *"nothing needs a human"* rendering over a **failed** door was one of its `/code-review` findings.
3. **Grid or list?** Every other surface here is AG Grid. A chase list is read one row at a time
   while talking, which is not what a dense grid is for — but a bespoke list is a new pattern in a
   feature that has none.
4. **Where does a chase land you?** The branch account (269) is the destination for *understanding*
   an entry. Confirm the row links there and that the scope/tab survives the trip — 270 found every
   link was throwing the scope away, which is why `addresses.ts` owns the URL grammar at all.
5. **The empty state, three times over.** *Nothing owing* is a real and good answer. *Nothing owed*
   and *no cash waiting* likewise. And the fourth case — the door failed — must not render as any of
   them.

## Output

A prototype linked from this ticket, plus the rulings above written down. Together with 276–280 this
completes the map: the next step is `/to-spec`.

## Answer

**Built and driven at estate scale** — [`.afk/PROTO-281-open-settlements.html`](../.afk/PROTO-281-open-settlements.html),
1,394 synthetic open entries (274's seeded shape: one per branch) plus 37 waiting receipts, sorted,
sectioned and toggled in a browser rather than reasoned about. Screenshots:
[`.afk/shot-281-owing.jpg`](../.afk/shot-281-owing.jpg) ·
[`.afk/shot-281-failed-door.jpg`](../.afk/shot-281-failed-door.jpg).

Resolved AFK (the session's standing instruction) and **confirmed by the owner on sight, 2026-08-15**
— the prototype was walked through with both 🚩 findings and their fixes on screen. So the
arrangement below is settled, not proposed, and `/to-spec` may write it down as a decision.

### 🚩 Finding 1 — mine-first ranking hides the estate's oldest, and the fixture is what showed it

At estate scale **176 of 1,000 Owing rows are mine**. So a mine-first list — sections or sort, it
makes no difference — puts the estate's oldest entry **176 rows below the fold**, under my newest.
The carve-out ([the map's ruling](275-settlement-follow-up-lanes-map.md), and
`Settlement/Orphans`' whole design) keeps unassigned money *in the answer*; the arrangement was
about to hide it anyway. That is 270's finding in a new costume — *an untriaged list is just another
list* — and it only appeared because 1,394 rows were on screen.

**The fix kept mine-first and made the rest visible in one line**: two sections, each oldest-first,
and the second section's header **states its own oldest against yours** —

> **Everyone else's** · 824 · *oldest is 162 days — older than anything of yours (159 days)*

A reader who never scrolls now knows what is down there. Sections rather than one sorted column,
because a single order that encodes both *whose* and *how old* is a number carrying two facts — the
thing [276](276-what-an-entrys-age-is-measured-from.md) refused for the age itself.

### 🚩 Finding 2 — `remaining of amount` was noise on two rows in three

276 ruled the engagement fact renders as *"9 of 35 still open"* beside the age. Correct — **when the
branch has part-paid.** On the fixture 65% of entries have no consumption at all, so the column read
`3,061.232  of 3,061.232` down most of the screen: the same number twice, teaching the eye to skip a
column that only says something on the rows that matter. **The `of …` half now draws only when
`remaining < amount`.** An empty cell is right here — this is not a missing value, it is *nothing has
happened*, and the "still open" figure already said it.

### 1. The sort — **age, and only age**

Oldest first, tie-broken by `entryNumber` (total, per [280](280-the-ageing-read-door.md)).
Mine-first is a **section**, never-chased is a **filter chip** — neither is an ordering:

- *Never-chased-first* would rank a 3-day untouched entry above a 150-day one chased last month,
  which is the opposite of the lane's question.
- Column sorts stay available (AG Grid), but ⚠️ **the default must be the server's order**, because
  the answer is capped: re-sorting a capped page changes which rows the cap kept, and a reader who
  re-sorted would be reading a different question's answer with no sign of it.

### 2. Counts — **rows, on both the tab and the Overview signpost**

Rows, not money (`figures.ts` refuses to total across `currencyKey`s and the hole is still open) and
not branches (a branch with four shortages is four calls). One `status=OPEN` call feeds Owing, Owed
and the signpost, so the three can never disagree (280 sub-question 2).

🚩 **A failed door renders the count as an em-dash and the error, never `0`** — driven in the
prototype ([shot](../.afk/shot-281-failed-door.jpg)). This is 270's own `/code-review` finding
(*"nothing needs a human" over a failed door*) turned into a state that exists on purpose. Same for
the body: the failure banner replaces the table; it never borrows an empty state's words.

### 3. Grid, with a taller row — not a bespoke list

AG Grid, the pattern this feature already has five of, for sort/filter/CSV and for not minting a new
list component in a feature with none. The ticket's real concern — *a chase list is read one row at a
time while talking* — is a **row-height and column-order** problem, not a grid-vs-list one, and the
fixture reads fine at ~52px rows with the sentence ordered as it is spoken: **entry · branch · age ·
money · who to ring · last chased**. The chase note is entered in a dialog opened from the row, so
the list is never left.

### 4. Where a chase lands you

The branch account, `?store=<code>&entry=<n>` on `/collection/settlement` — unchanged by
[279](279-the-nav-grows-a-third-level.md), which keeps `?store=`/`?entry=` as parameters. `?scope=`
rides along (`addresses.ts`' keep-list), and the return link comes back to
`/collection/settlement/open?tab=…` so the tab survives the trip. 270 found every link throwing the
scope away; the same test applies to `tab`.

### 5. The four states, and the fourth is not an empty state

| state | what it says |
|---|---|
| Owing empty | **Nothing owing.** No branch is holding money for head office. |
| Owed empty | **Nothing owed.** Head office owes no branch a surplus back. |
| Cash waiting empty | **No cash waiting.** Every prepared receipt has been collected. |
| a filter emptied it | *Nothing matches these filters* + how to clear — distinct from the three above, because the estate is not empty |
| 🚩 door failed | the refusal, verbatim, plus *this is not "nothing to do"* |

### What the row carries, settled

`entryNumber` · branch name + code · **age as a fact** (*"159 days · posted 9 Mar"*; `0` → *today*;
🚩 no colour, no badge, no *overdue* — the map's central ruling) · `remaining` (+ `of amount` only
when part-paid) · `servedBy` — *"Nobody assigned"* as a named case, never blank, since 1,255 branches
have no pairing · `lastChase` as [278](278-the-chase-notes-contract.md)'s tri-state (absent → **no
column**; `null` → *Never chased*; else the note + who + when).

On **Cash waiting** the same row, three substitutions: the age is *prepared*, not *posted*; the money
column is the receipt's amount with no remaining (a receipt is whole or collected); and the name is
the **collector** — a different failure and a different call, exactly as
[277](277-the-cash-waiting-doors-shape.md) rules. ⚠️ Head office cannot show *who prepared it* (277:
that column is store-side), and does not need to.

⚠️ **Money renders min-2/max-3 decimals** until §1 of the hand-off draft lands, and no column is
totalled. Inherited, not solved here — the map says so and the prototype does the same thing the
shipped screen does.
