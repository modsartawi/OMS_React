---
type: spec
status: ready
map: 275
---

# 282 — Open settlements: the accountant's follow-up surface

> Synthesized from wayfinder map [275](275-settlement-follow-up-lanes-map.md) and its six resolved
> tickets ([276](276-what-an-entrys-age-is-measured-from.md) ·
> [277](277-the-cash-waiting-doors-shape.md) · [278](278-the-chase-notes-contract.md) ·
> [279](279-the-nav-grows-a-third-level.md) · [280](280-the-ageing-read-door.md) ·
> [281](281-the-open-settlements-view.md)). Prototype:
> `.afk/PROTO-281-open-settlements.html`. Server asks: `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md`
> §2, §6, §7 (destined for BackOffice 1199).

## Problem Statement

An accountant can post a settlement entry, correct one, withdraw a batch and look a branch up by
number — but there is nowhere to answer the question the job actually starts from: **who has not
sent the money, how long has it been, and who do I ring?**

The settlement front page is a search box plus one triaged lane (wrong money). That triage is
deliberate and correct: an entry that is merely open is not, by itself, work. But it means the
estate's open position is invisible unless the accountant already knows which branch to look at. The
two lanes that would answer it were both built once and then **deleted** by ticket 274 rather than
faked — the ageing lane because it counted against a staleness rule the domain refuses to make, and
cash waiting because the fleet row carries a flag with no door behind it. Today:

- A branch that posted a shortage in March and has paid nothing appears on no screen at all until
  somebody types its code.
- A branch that is **owed** a surplus and has never claimed it is worse off still — nobody is
  motivated to chase money the estate owes outward.
- A prepared receipt nobody has collected shows as a flag on a fleet row that says *"0331 has one
  somewhere"*, sending the accountant hunting through an account for it.
- 1,255 of the estate's 1,394 branches are assigned to nobody, so any screen that silently scopes
  to *mine* drops most of the estate's late money out of the door.
- And when an accountant does ring a branch, nothing records that they did — so a second accountant
  rings the same manager the next morning, and *"we already spoke, they promised Sunday"* lives in
  one person's memory.

## Solution

**One screen, `/collection/settlement/open`, with three tabs — Owing · Owed · Cash waiting.** It is a
*work session*, not a glance: the accountant opens it holding a phone and works down it.

Each row is one sentence you can say out loud: **entry 1611 · Riyadh 0611 · open 159 days, posted
9 March · 3,061.232 still open · served by Ayed · never chased.** Rows are ordered **oldest first**
and nothing else, because the domain has not ruled when an entry is late — so the screen states the
age as a **fact** and never as a judgement. No red, no *overdue*, no badge.

The estate is never narrowed away. Rows carry the pairing's `servedBy` and a session-resolved
`isMine`, and the tab renders **two sections** — *Yours* above *Everyone else's* — each oldest first,
with the second section's header saying what is inside it (*"oldest is 39 days — older than anything
of yours"*). Ranking without hiding.

**Owing (SHORTAGE) and Owed (SURPLUS) are separate tabs**, not a kind column: the same age fact
pointing in opposite directions. **Cash waiting** is the third — a prepared special receipt nobody
has collected, where the call goes to the collector rather than the branch manager.

A **minimal chase note** — who rang, when, free text, append-only, internal — is recorded from the
row without leaving the list, and the newest one shows in a *Last chased* column whose *never
chased* state is a named case rather than a blank cell. Its server door is a separate dependency,
and the screen **degrades to two read-only lanes** without it, drawing no column at all rather than
claiming 1,394 branches were never chased.

Getting there, the nav grows a level: **Settlement Account** becomes an expandable node with four
leaves — Overview · Open settlements · Ledger · Bulk upload — and the screen's views become **path
segments** instead of `?view=`, because the active-highlight machinery matches pathname only and a
query parameter can never light up a submenu entry.

## User Stories

1. As an accountant, I want one screen listing every settlement entry the estate still has open, so
   that I can start the day from the work rather than from a search box.
2. As an accountant, I want the list ordered oldest first, so that the money that has been
   outstanding longest is the money I ring about first.
3. As an accountant, I want each row to state how long the entry has been open as a plain fact
   ("159 days"), so that I can judge it myself against whatever finance has told me this month.
4. As an accountant, I want the age counted from when the entry was **posted**, so that a branch
   paying one riyal a week cannot keep an old debt looking young.
5. As an accountant, I want the age to agree with the posted date printed on the same row, so that
   the number and the date never tell me two different stories on the phone.
6. As an accountant, I want an entry posted today to read *today* rather than "0 days", so that the
   newest rows read like speech.
7. As an accountant, I want the age to come from the server, so that a browser left open all night
   never shows me a number the sort no longer agrees with.
8. As an accountant, I want **no colour, badge or "overdue" wording** on the age, so that the screen
   never asserts a staleness rule the business has not made.
9. As an accountant, I want SHORTAGE entries on their own **Owing** tab, so that *"the branch owes
   head office"* is one list I can work top to bottom.
10. As an accountant, I want SURPLUS entries on their own **Owed** tab, so that money the estate owes
    a branch is chased too, rather than sinking into a list sorted by age alone.
11. As an accountant, I want the two tabs to carry counts, so that I can see the size of each job
    before opening it.
12. As an accountant, I want a third tab for **cash waiting** — prepared receipts nobody has
    collected — so that a receipt ageing on a shelf is visible without opening a branch's account.
13. As an accountant, I want a cash-waiting row to name the **collector** rather than the branch
    manager, so that I ring the person whose visit did not happen.
14. As an accountant, I want a cash-waiting row to quote its **entry number**, so that I identify it
    on the phone with the same handle every other tab uses.
15. As an accountant, I want a cash-waiting row's age counted from when the receipt was **prepared**,
    so that "how long has this been waiting" means what it says.
16. As an accountant, I want my own branches ranked first, so that the list opens on the work that
    is mine.
17. As an accountant, I want the rest of the estate to still be **on the same screen** below mine, so
    that the 1,255 branches nobody is assigned to are never invisible.
18. As an accountant, I want the second section's header to tell me its oldest entry, so that I know
    something older than my own worst row is down there without scrolling to find out.
19. As an accountant, I want a row to name **who serves the branch**, so that the row tells me who to
    ring without a second lookup.
20. As an accountant, I want a branch nobody is assigned to to say so in words, so that an empty
    column is never mistaken for a missing name.
21. As an accountant, I want to filter to **my branches only**, so that I can work my own list when
    the estate's is not my job today.
22. As an accountant, I want to filter to **never chased**, so that I can find the branches nobody
    has spoken to yet.
23. As an accountant, I want the money column to show what is **still open**, so that the figure is
    what I am ringing about rather than what was posted.
24. As an accountant, I want the original amount shown beside it **only when the branch has
    part-paid**, so that a row where nothing has happened does not print the same number twice.
25. As an accountant, I want partial payment visible at a glance, so that I can tell a branch that is
    engaging from one that is ignoring me — without that fact being smuggled into the age.
26. As an accountant, I want to record that I chased a branch, from the row, without leaving the
    list, so that a session of twenty calls does not become twenty navigations.
27. As an accountant, I want a chase note to belong to the **branch**, so that one phone call about
    four open entries is one note rather than the same sentence typed four times.
28. As an accountant, I want a chase note to be able to **name the entry** it was about, so that
    *"they promised to pay entry 143 on Sunday"* has somewhere precise to live.
29. As an accountant, I want to see the **newest** note on the row, so that I know what was last said
    before I dial.
30. As an accountant, I want a branch nobody has chased to say **never chased**, so that a real and
    useful state is not rendered as an empty cell.
31. As an accountant, I want notes to be append-only, so that the history of what was said cannot be
    quietly rewritten.
32. As an accountant, I want to correct a mistake by adding another note, so that append-only is
    workable rather than a trap.
33. As an accountant, I want the note field to tell me it is **internal**, so that I write it for my
    colleagues and not for the branch.
34. As an accountant, I want a chase note's timestamp on the same clock as everything beside it, so
    that a note never appears to have been written before the call it describes.
35. As an accountant, I want the lanes to work fully **before** the chase note exists server-side, so
    that the read-only half of this screen is not blocked by a table nobody has built yet.
36. As an accountant, I want the *Last chased* column to be **absent** rather than empty when its door
    is not built, so that the screen never tells me nobody has chased anyone.
37. As an accountant, I want a row to link to the branch's account, so that *understanding* an entry
    is one click from *chasing* it.
38. As an accountant, I want the link to open the account **on the entry I clicked**, so that I do not
    hunt for it in the branch's history.
39. As an accountant, I want my scope and my tab preserved when I come back from an account, so that
    walking through a branch does not undo the view I chose.
40. As an accountant, I want *nothing owing* to be a real, worded answer, so that an empty list reads
    as good news rather than as a broken screen.
41. As an accountant, I want *nothing owed* and *no cash waiting* worded distinctly, so that three
    different good outcomes are not one generic sentence.
42. As an accountant, I want a list emptied by **my own filter** to say so, so that I do not read
    "nothing owing" when I am the one who narrowed it.
43. As an accountant, I want a **failed** read to say it failed, so that a server refusal is never
    drawn as "nothing needs you".
44. As an accountant, I want a failed read to show em-dashes in the tab counts rather than zeroes, so
    that no number on the screen is a fabrication.
45. As an accountant, I want to be told when the answer hit its cap, so that I know the list may be
    incomplete rather than assuming the estate is smaller than it is.
46. As an accountant, I want the two entry tabs' counts to agree with each other and with the front
    page's signpost, so that I never have to work out which number is lying.
47. As an accountant, I want a counted signpost on the settlement front page linking through, so that
    the work is discoverable from the screen I already open.
48. As an accountant, I want **Settlement Account** in the menu to expand into its four screens, so
    that I reach the ledger and this lane without knowing an address.
49. As an accountant, I want clicking the parent menu item to take me to the Overview, so that a
    label that looks clickable is clickable.
50. As an accountant, I want the menu to highlight exactly the screen I am on, so that Overview does
    not read as selected while I am on the ledger.
51. As an accountant, I want an address I pasted into a ticket last week to still open the same view,
    so that moving the views to paths does not break my own notes.
52. As an accountant, I want a batch withdrawal address to keep working an hour and a reload later,
    so that *"finance sent the wrong file"* is still one repair.
53. As an administrator, I want this screen behind the same settlement grant as the rest of the
    screen, so that granting the settlement screen does not accidentally grant something new.
54. As an administrator, I want the menu node to disappear entirely for a session without the grant,
    so that the nav never advertises a screen that will refuse.
55. As a developer, I want the age, the sort and the ranking decided by the server, so that the
    client cannot re-sort a capped page and silently change which rows the cap kept.
56. As a developer, I want the lane's projection to be a pure module, so that the sectioning, the
    tri-state and the empty-vs-failed distinction are verified in memory rather than by eye.
57. As a developer, I want the URL grammar spelled in one module, so that a later slice's parameter
    does not leak between views.
58. As a developer, I want the nav to support exactly one extra level, so that the shell renders
    nothing nobody has designed.
59. As a developer, I want every string on this screen to come from a translation key, so that the
    Arabic retrofit stays a data change.
60. As a developer, I want the money to render at the precision the app can honestly claim, so that
    a currency hole elsewhere is not papered over with a guess here.

## Implementation Decisions

### D1 — One feature, one route family; no new area

Everything lands in the existing `collection/settlement` feature and its `settlement` i18n
namespace. No new area folder: the URL prefix `/collection/*` and the nav group are unchanged; only
a level appears inside them. The lane's screen, its projection module and its columns are new files
inside the feature; `api.ts` grows two calls.

### D2 — The nav grows exactly one level, and only the renderer changes

`Settlement Account` becomes a node with `routerLink` (Overview) **and** `items`. The shell gains a
`MenuSubGroup` used only when a group's child itself has children — a **bounded** change, not a
generic recursive `MenuNode`, because there is no visual design for a fourth level.

🔑 The permission machinery needs **no change**: `collectGated` and `filterMenu` already recurse, so
a nested node whose children all hide is already dropped, at any depth. This was verified before the
decision, and it is the reason the blast radius is one component rather than the whole nav.

The menu model gains one optional field, `exact`, honoured by `isActive`. Without it the Overview
leaf (whose path is a prefix of the other three) would render as active on all four screens.

The 268-era ruling that Settlement Account is *"a leaf rather than a group of its own, because
neither a new nav group nor a new URL prefix appears"* is overturned **in writing** in the same
comment: a URL prefix now does appear, so the same rule that made it a leaf makes it a node.

### D3 — The views become paths; parameters keep what a view is *looking at*

| leaf | path |
|---|---|
| Overview (the door: search, triage, scope) | `/collection/settlement` |
| **Open settlements** | `/collection/settlement/open` |
| Ledger | `/collection/settlement/ledger` |
| Bulk upload (and a batch's withdrawal) | `/collection/settlement/upload` |

The dividing rule: **a path segment names which screen; a parameter names what that screen is looking
at.** So `?scope=` rides every link (unchanged `KEPT` list), `?store=`/`?entry=` stay parameters on
the Overview path — a branch account is where you *land*, not a nav destination — `?batch=` stays a
parameter on the upload path, the ledger's six criteria stay parameters, and the lane's tab is
`?tab=owing|owed|cash`. `VIEW_PARAM` is deleted, and with it `readBatchView`'s both-halves-required
rule.

Consequence worth stating: **269's `?store=` addresses and 273's shareable batch addresses do not
change at all**, which covers the most-pasted addresses on this screen.

### D4 — Old `?view=` addresses redirect, permanently

At the Overview path, before anything renders: `?view=ledger` → `/collection/settlement/ledger`;
`?view=batch&batch=…` → `/collection/settlement/upload?batch=…`; all other parameters carried
through; `replace` so Back does not bounce. **No sunset** — nothing is simplified by removing it
later, and the cost of not having it is an accountant reading *page not found* while holding a
phone. It is commented as a compatibility shim with its date and reason so no later reader mistakes
it for live grammar.

### D5 — The ageing rows come from `Settlement/Ledger`, extended

Not a new door. `Status = 'OPEN'` is a column-equals-constant rather than a money predicate, so the
one-spelling discipline that justifies `Settlement/Orphans` does not apply, and the ledger already
takes the lane's exact question. The door grows, all additive:

```
GET Settlement/Ledger?status=OPEN&sort=age&limit=2000
  rows += servedBy, isMine, ageDays, lastChase?
```

- `sort=age` → `PostedAt ASC, EntryNumber ASC` — **total**, which is the property the door's existing
  `EntryNumber DESC` was chosen to protect. Default order is unchanged for every shipped caller.
- `ageDays = DATEDIFF(day, PostedAt, <server now>)` — the server subtracts; the client owns no clock.
- `servedBy`/`isMine` label and rank, and **never filter**.
- The door's existing refusal of an unfiltered call is satisfied by `status=OPEN`.

**One call feeds both entry tabs**, split by `entryKind` in the projection — so the two counts, the
front-page signpost and the cap banner all describe one answer and cannot disagree.

### D6 — Cash waiting comes from a new `Settlement/Uncollected`

```
GET Settlement/Uncollected?limit=500  →
{ settlementConsumptionId, documentId, storeId, storeName, servedBy, isMine,
  entryNumber, entryKind, amount, currencyKey, preparedAt, ageDays }[]
```

Estate-wide, no scope parameter, mirroring `Settlement/Orphans`. `preparedAt` is the special-receipt
CONSUME row's timestamp — the consume happens **at prepare**, so that stamp is when the receipt was
written, on head office's own clock. `entryNumber` arrives by joining the entry, which is why no
identified-in-words fallback is needed.

⚠️ A partly-consumed entry can legitimately appear on **both** Owing and Cash waiting. That is two
true sentences about the same money and the client must not deduplicate them.

### D7 — The chase note is one table and one write door, and the screen survives without it

```
POST Settlement/Chase { storeId, subject, subjectId, entryNumber, note } → { accepted, chase }
```

`subject` is `BRANCH | ENTRY | RECEIPT`; a note belongs to a **branch** and optionally names what it
was about. Append-only — no edit, no delete, no supersede. Under the **existing settlement grant**.
Refusals arrive as `accepted:false` (unknown branch, blank note, over-length, unrecognised subject),
this screen's established idiom.

The newest note per branch rides on the lane rows themselves, so no per-row fetch.

🔑 **The wire field is a tri-state and the client must keep the three cases apart:**

```ts
// from the 281 prototype — the distinction the whole degradation story rests on
type ChaseCell =
  | { kind: 'unavailable' }               // field absent → the column is not rendered at all
  | { kind: 'never' }                     // null → "Never chased", a named state
  | { kind: 'chased'; at: string; by: string; note: string }
```

Collapsing `unavailable` into `never` would state, confidently, that nobody has chased any of 1,394
branches. The projection returns the case; the renderer cannot produce a blank.

### D8 — The lane projection is a pure module

One new module owns everything the screen decides, taking the two doors' answers and the session's
identity and returning what the view draws — deliberately shaped like `worklist.ts` (no React, no
`t()`, no network, **no clock**):

- split the one ledger answer by `entryKind` into the two tabs;
- partition each tab into `mine` / `theirs`, **each already oldest-first from the server**;
- compute the second section's signpost (its oldest, and whether that is older than the first
  section's oldest — the sentence only claims the comparison when it is true);
- apply the *mine only* and *never chased* filters;
- return the `ChaseCell` case per row;
- distinguish **empty**, **emptied by a filter**, and **failed** as three separate results.

Sorting is **not** re-done here. The server's order is authoritative because the answer is capped,
and re-sorting a capped page changes which rows the cap kept.

### D9 — Caps

A new `OPEN_LANE_LIMIT = 2000` joins `cap.ts`, and `LEDGER_LIMIT` **stays 500**. The docblock's own
rule decides it: the lane answers a *population* (the estate's open entries — 1,394 at 274's seeded
scale), where a cap below it truncates a complete answer; the Ledger view answers a *question*, where
reaching 500 means the question is too broad to read. Cash waiting uses the orphan lane's 500 — a
waiting receipt is a rare event, not a population. `isCapReached` watches all three.

### D10 — What a row carries

`entryNumber` · branch name + code · age as a fact with its date beneath (`0` → *today*) ·
`remaining`, with `of amount` **only when part-paid** · `servedBy` or a worded *nobody assigned* ·
the `ChaseCell`. Cash waiting substitutes three things and nothing else: the age says *prepared*, the
money is the receipt's whole amount with no remaining, and the name column is the **collector**.

### D11 — Grid, with a taller row

AG Grid, matching the five surfaces this feature already has, for sort, filter and CSV. The concern
that a chase list is read one row at a time while talking is answered by row height and column order
(the row reads as a spoken sentence), not by inventing a bespoke list component in a feature that has
none. The note is written in a dialog opened from the row, so the list is never left.

### D12 — Money, unchanged and unsolved here

Figures render minimum-2 / maximum-3 decimals and **no column is totalled**, because `currencyKey` is
still missing from these reads and `figures.ts` refuses to add riyals to dinars. This spec inherits
that compromise and neither solves nor designs around it. `Settlement/Uncollected` carries
`currencyKey` because it is free there; that does not change the rendering rule until the account and
fleet reads carry it too.

### D13 — i18n

All new copy in the existing `settlement` namespace. Four menu keys (`menu.overview`, `menu.open`,
`menu.ledger`, `menu.upload`) plus the lane's own: three tab labels, the two filter chips, the age
phrasing (*today* / *n days*), *never chased*, *nobody assigned*, the section headers and the
signpost sentence (interpolated, never concatenated), four empty states, the failure sentence, the
cap banner, and the note dialog's labels and internal-only hint. The group header stays `collection`'s.
*Open settlements* is the owner's own wording and stays exactly that.

## Testing Decisions

A good test here asserts what a reader of the screen would notice, not how the module reached it: the
order of rows, which section a row landed in, which of the five states rendered, what the signpost
says. Nothing asserts an internal function's shape or a class name.

**Tier 1 — pure, in-memory (vitest).** The seam this feature already has thirteen suites at, and where
this wave's regression risk actually lives:

- **the lane projection (D8)** — the split by kind; both sections oldest-first with a total order;
  the signpost's comparison claimed only when true; both filters; each `ChaseCell` case; and the
  three empty-ish results kept distinct (**empty ≠ emptied-by-filter ≠ failed**, the assertion that
  stops a failed door rendering as good news);
- **`addresses.ts`** — the four paths, what each link keeps and drops, and a **table-driven redirect
  test** for every legacy `?view=` address including hand-edited half-addresses;
- **`cap.ts`** — `isCapReached` against the lane's 2,000 and the ledger's 500, so the two callers'
  banners are proven to be about different answers;
- **`menu-model.ts`** — `isActive` with and without `exact`, asserting Overview is *not* active on the
  three sibling paths (the trap this ticket exists to avoid), joining the existing
  `menu-collection.test.ts` / `useVisibleMenu.test.ts` suites;
- **`useVisibleMenu`** — one added case proving a nested node whose children all hide disappears
  rather than leaving an empty expander. The code already does this; the test is what keeps it true.

**Tier 2 — flow (Playwright).** `tools/settlement-drive.mjs` extended, in the manual-run style the
repo's other drives use: the menu node expands and each leaf routes; the lane renders both sections
against a stubbed envelope at estate scale; the three tabs switch; a legacy `?view=ledger` address
lands on the new path; the chase dialog writes a note and the row's cell changes case; and the two
degraded renderings — **door failed** and **chase field absent** — are each driven, because they are
the two states most likely to be broken by a later change and least likely to be noticed.

**No React Testing Library in this wave** (owner-confirmed). Spec 083's ruling holds and D8 is what
makes it hold: the sectioning, the tri-state and the empty-vs-failed distinction all live in the pure
module, leaving the screen a thin renderer. RTL remains the hardening ticket's to add.

Every ticket verifies with `npm run typecheck` and `npm run lint` (import boundaries, contrast, colour
literals) — the last of which is load-bearing here, since the design rule is that **nothing colours
the age**.

## Out of Scope

- **A full follow-up workflow** — statuses (chased / promised / escalated / resolved), assignment,
  due-back dates. A second effort's worth of work with policy decisions inside it; the minimal note is
  what will tell us which of them are real.
- **A staleness threshold or any *overdue* rendering.** The domain has not ruled when an entry is
  late. If finance ever mints one it lands as a badge over this lane, not as a new lane.
- **A per-branch settlement cadence table.** Nothing of the sort exists today, and it is only worth
  having once someone has ruled that "late" varies by branch.
- **Any notification or reminder rail.** Ruled absent *by design* upstream. This screen surfaces work
  where an accountant looks; it does not push.
- **Solving `currencyKey`.** Outstanding on the account and fleet reads, tracked as §1 of the server
  draft. Inherited here, not fixed here.
- **Exporting the chase list**, and **showing chase history on the branch account**. Both plausible
  next questions; neither is needed to make the screen work.
- **Bringing store-side receipt detail (who prepared it, its note) to head office.** A POS sync change
  with its own risk, and nothing on this screen needs it.

## Further Notes

**Server dependencies, and how the build is sequenced around them.** Three asks leave for BackOffice
as §2, §6 and §7 of `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md`. Their shapes are settled, but
none is built:

- **§6** (the ledger extension) blocks the two entry tabs' *ranking* — but not the tabs. Against
  today's door, `status=OPEN&limit=2000` already returns the rows; only `servedBy`/`isMine`/`ageDays`
  are missing. The build should therefore treat the extra fields as optional on the wire, exactly as
  it treats `lastChase`.
- **§2** blocks the Cash waiting tab entirely. It is one tab, and the other two ship without it.
- **§7** blocks only the chase column (D7).

🔑 **The nav change (D2–D4) depends on nothing and should be built first.** It touches shared shell
code, it is the prerequisite for addressing the screen at all, and building the lane before it would
mean addressing the screen twice.

**Two measurements already taken, so nobody re-derives them.** The oldest-first sort over the estate's
open entries costs 17 ms cold / 2 ms warm at 1,407 rows despite `PostedAt` being unindexed, so **no
index is requested**; and the fleet door — which already runs the cash-waiting predicate as an
aggregate — answers the whole estate in 38–76 ms, so enumerating it as its own door is cheaper than
the flag it replaces.

**One prototype finding worth protecting through the build.** Ranking your own branches first pushed
the estate's oldest entry 176 rows down the page — the carve-out kept unassigned money *in* the
answer and the arrangement was about to hide it anyway. The signpost in D8 is the fix, and it is the
kind of line that looks decorative to a later reader. It is not: it is the only thing on screen that
says the estate holds something worse than anything of yours.
