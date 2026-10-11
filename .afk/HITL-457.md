# HITL log — ticket 457 (store page: mirror summary, strip Mirror line, Mirror tab)

## Q: The ruling lets a slice change only the store drive's WPF tab assertion, but appending Mirror to STORE_TABS also breaks the worker store's "six tabs" assertion and the `storeTabs` vitest. What changes?
**Decision taken:** Three assertions were changed on purpose, each with a comment:
- drive check 3: six tabs became seven, with Mirror last;
- drive check 7: the WPF list became Counters, Passes, Mirror;
- in `store-helpers.test.ts`, the two `storeTabs` expectations.

Every other existing assertion is unchanged. The old 68 drive checks are still green, alongside 68 new ones (136/136).
**Why:** The ruling also says to append Mirror to the end of BOTH lists. The worker assertion pins the old list exactly, so it cannot stay green once the ruled tab exists.
**Revisit if:** The owner meant the worker assertion to stay frozen. That would contradict the "append to both" ruling.

## Q: The store drive pins "a WPF store: no strip and no hours read". Does a WPF store get the strip's Mirror line?
**Decision taken:**
- A WPF store that is NOT on mirror still has no strip and makes no hours read, so the existing assertion holds.
- A WPF store that IS on mirror draws the strip with the Mirror line alone. There is no "Master and counter" line, because WPF writes no hourly health. This is drive check 12b.
**Why:** ADR 0073 and the contract say "A WPF store still has its mirror lane", and the existing WPF assertion stays green.
**Revisit if:** The owner wants WPF stores to have no strip at all.

## Q: The strip used to have one unlabelled line. How are the two lines told apart?
**Decision taken:** Each line has a small label at its start: "Master and counter" (the existing line, unchanged in its cells) and "Mirror". There is one legend, shared by both.
**Why:** Without labels, two rows of the same colours cannot be read.
**Revisit if:** A human eye on the strip wants different line names.

## Q: What does the strip's Mirror line show for a store not on mirror?
**Decision taken:** It shows a muted "Not on mirror" bar in place of the cells.
**Why:** 24 grey "no data" cells would read as a mirror that stopped.
**Revisit if:** The owner prefers the grey cells.

## Q: How is the error "expandable"?
**Decision taken:**
- In the row, the error is truncated with CSS in a `<bdi>`.
- A "Show the whole error" button opens the app Modal (the PassDetailModal idiom), which shows the whole error in a `<bdi>` with pre-wrap.
- The button is drawn for every row that has an error, because the cell cannot know whether it is visually truncated.
**Why:** Expanding the row inside AG Grid (autoHeight with a toggle) would be fragile. The modal is an idiom the console already uses.
**Revisit if:** The owner wants the error to expand inline in the row, or the button only on long errors.

## Q: How are acknowledged rows "muted"?
**Decision taken:** With `rowClassRules` `{ 'opacity-60': acknowledgedAt != null }`. This is the settlement grids' `opacity-60` precedent. A rule rather than `getRowClass`, so that a kept row un-mutes if its data changes. Who, when and why are three plain columns: Acknowledged, Acknowledged by, Why.
**Why:** `text-muted-foreground` on the row is overridden by the grid theme's cell colour (measured: identical rgb).
**Revisit if:** A human eye wants a badge instead.

## Q: Should the mirror block show on a WPF store's page, and where?
**Decision taken:** Yes. It sits under the health (or the WPF note) on every store. "Not on mirror" is a short muted note with no states and no figures. The WPF note was reworded to "…shown for the master and counter rails" so that it no longer claims only counters and passes are shown.
**Why:** The rails are independent (ADR 0073), and the existing WPF assertions (`/still synced by WPF/`, no `[data-store-health]`) stay green.
**Revisit if:** The owner wants the WPF page unchanged when the store is off mirror.

## Q: The stage and reason helpers go through `codeBadge`, which needs a severity. What severity do they get?
**Decision taken:** Every stage and reason is `mute`. They are rendered as plain words, never as coloured badges: every row is a dead letter already. An unknown value shows its raw code.
**Why:** The wave rules forbid a new lookup idiom.
**Revisit if:** The owner wants reasons coloured.

## Q: CONTEXT.md lists "poison row" under _Avoid_ for a mirror dead letter. Is the reason label "Poison" allowed?
**Decision taken:** Kept "Poison" as the label of the contract's reason code `poison`.
**Why:** The _Avoid_ entry is about calling a dead letter a "poison row". Spec 2563 story 20 itself lists the reasons as "error cap, orphaned deferral, unmapped, poison".
**Revisit if:** The glossary owner wants a different word for the reason.

## Q: `includeAcknowledged`: should it be sent when it is off?
**Decision taken:** It is always sent (`false` by default), so the door is never left to guess its default.
**Why:** It is explicit, and it is what the drive pins.
**Revisit if:** The door rejects `false`. It should not, since the parameter is a bool.

## Contract gap
None found. Store/Mirror's `lane` is not drawn on the tab, because the header's lane is already on the page. Nothing that is drawn is renamed or invented.
