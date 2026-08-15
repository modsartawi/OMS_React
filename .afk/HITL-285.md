# HITL — ticket 285 (open settlements lane, spec 282)

Decisions taken unattended while building `/collection/settlement/open`'s two entry tabs.

## Q: Does this slice render two tabs or three (with a disabled *Cash waiting*)?

**Decision taken:** Two — **Owing** and **Owed**. No placeholder third tab.
**Why:** The ticket's own scope is *"with its two entry tabs"*, and 286 owns Cash waiting
including its own door (`Settlement/Uncollected`, server dependency §2, not built). A disabled
tab would advertise a screen that cannot answer.
**Revisit if:** 286 is dropped from the wave — then the tab bar's shape is a two-tab decision
rather than a slice of a three-tab one, and the `?tab=cash` value should stop being reserved.

## Q: Where does `?tab=` live — `addresses.ts` or the lane module?

**Decision taken:** The **key** (`TAB_PARAM`) is declared in `addresses.ts` and `openSearch`
takes an optional tab; the **vocabulary** (`owing | owed`, the default, the reader) lives in
`open-lane.ts`.
**Why:** Exactly the split `ledger.ts` already has with its six criteria keys, stated in
`addresses.ts`'s own docblock: the grammar is spelled once, the meaning belongs to the view.
Default is the **absence** of the parameter (`scopeSearch`'s rule), so `/open` and
`/open?tab=owing` are one address rather than two spellings of it.
**Revisit if:** a fourth view needs the same key, which would make the vocabulary shared.

## Q: The *mine only* chip — URL parameter or component state?

**Decision taken:** Component state.
**Why:** Story 39 asks for **scope and tab** to survive a walk through a branch account, and
names nothing else; the prototype draws both chips as a toolbar toggle. `addresses.ts`'s `KEPT`
list is a keep-list precisely so a view's own parameter does not ride to the next screen — adding
the chip to the URL would mean adding it to `KEPT` or watching it vanish anyway.
**Revisit if:** an accountant wants to send a colleague *"my own list"* as a link.

## Q: The prototype's money cell is two `<td>`s, the second with a blank header.

**Decision taken:** **One** *Still open* column whose cell draws the figure and, only when the
branch has part-paid, a muted `of 4,000.000` after it.
**Why:** Same arrangement on screen (figure, then the original beside it, muted) with no
header-less column — a blank column header is unreadable to a screen reader and unsortable to a
grid. The prototype's ruling being protected is *"`of X` only when part-paid"*, and that is kept
exactly.
**Revisit if:** the two figures need independent sorting.

## Q: How tall is a section's grid, and does it page?

**Decision taken:** No pagination. Each section is a fixed-height virtualised grid sized to at
most ten rows, so both sections are on one page and each scrolls the lot.
**Why:** The prototype's own footer says *"the real grid scrolls the lot"*, and the point of the
arrangement is that **Everyone else's** is visible under **Yours** rather than a page away —
which a per-section paginator would undo. `autoHeight` was refused: 1,000 rows in the DOM.
**Revisit if:** a section routinely holds so few rows that the fixed height reads as empty space.

## Q: What does the screen draw when the server sends no `servedBy`/`isMine`/`ageDays` (§6 unbuilt)?

**Decision taken:** One **unsectioned** list under its own header, in the order it arrived, no
*mine only* chip, no *Served by* column, no age fact — the posted date alone in the Age column —
and (after `/code-review`) **no claim of *oldest first*** in the subtitle or the cap banner.
**Why:** The ticket's Boundaries say the fields are optional on the wire and the screen
*"derives nothing"*. A single section headed *Everyone else's* would assert the estate holds
nothing of yours; a client-side age would invent the clock the whole spec moved to the server;
*Served by* could only draw *nobody assigned* on 1,394 rows. And `sort=age` is **half of the same
dependency** as `ageDays` — a door sending no ages answered its own `EntryNumber DESC`, so
*"anything missing is newer than what is here"* would describe an arrangement the rows do not
have. Hence `aged` on the projection, beside `ranked` and `named`.
**Revisit if:** §6 ships, at which point this path is dead code worth deleting rather than keeping.

## Q: The drive's estate-scale fixture has to date its rows from *some* today.

**Decision taken:** A frozen `LANE_TODAY = '2026-08-15'` inside `open-lane-fixture.ts`, with
`postedAt` derived from `ageDays` rather than the other way round.
**Why:** The fixture plays the **server**, which is where the subtraction belongs — deriving the
date from the age is the same direction the door computes in, so the two can never disagree on a
row (story 5). A fixture reading a real clock would make the drive's assertions unreproducible.
**Revisit if:** the drive is ever pointed at a live SIS.Api, which spec 267 §Testing Decisions
forbids for this file.

## Q: The lane and the Ledger view share `Settlement/Ledger`. How does the drive's stub tell them apart?

**Decision taken:** By `sort=age`, which only the lane sends. With it the stub answers the
estate-scale open-lane fixture; without it, the six hostile branches' entries as before.
**Why:** It is the door's own discriminator (D5 — `sort=age` is the lane's addition and default
order is unchanged for every shipped caller), so the stub is split on the same field the server
is. Splitting on `limit` would have coupled the stub to a cap constant.
**Revisit if:** the ledger view ever offers an age sort of its own.

## Q (from `/code-review`): the branch account has no way back to the lane, keeping the tab.

**Decision taken:** Left as it is. Back restores it; no *back to the lane* link is added, and
`tab` does **not** join `addresses.ts`'s `KEPT` list.
**Why:** Story 39's mechanism is that the tab and the scope are both **addresses** — which is
exactly why 283 moved the views to paths — so the browser's own Back reproduces the view. The two
alternatives both cost more than they fix: putting `tab` in `KEPT` leaks the lane's own parameter
onto every address on the screen, which that list exists to prevent; and a *back to the lane* link
means teaching `SettlementPage`'s shared `BackToDoor` chrome where the reader came from, which is
a change to all four screens made at 3am for one of them.
**Revisit if:** an accountant reports losing their place walking down the Owed list — at which
point the right fix is a *where you came from* affordance on the account, designed once for the
ledger and the lane together.
