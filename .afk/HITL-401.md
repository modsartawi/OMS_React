# HITL — ticket 401 (AFK, 2026-10-03)

The first run of 401 built the whole slice, then died when it killed its vite server by matching the
command line, which killed itself. The owner saved its working tree as `.afk/partial-401.patch` and
`.afk/untracked-401/`. This run re-applied that patch unchanged, re-proved it, re-ran both reviews,
and committed.

## Q: When is the router state replaced away — on arrival, or once the intent is consumed?
**Decision taken:** It is replaced on arrival. The intent is held in page state until the header
loads, then resolved once through the command bar's own gate.
**Why:** "A reload or Back never re-fires it" must hold even when the header fails or the user
leaves before it loads. Replacing on arrival is the only way that holds.
**Revisit if:** The owner wants a failed header load followed by Refresh to still open the dialog.

## Q: Does "the hints hide when the switch is off" include ↵ open?
**Decision taken:** No. With the switch off, the letter hints (J K, R C N, /, ?, I) hide and
"↵ open" stays.
**Why:** 365 §3 puts only letters, `/` and `?` behind the switch. Enter opens the row either way,
so its hint is still true.
**Revisit if:** The owner reads 368 §1 as hiding every key hint.

## Q: How does the refused button behave beyond "ring + tooltip + warn toast"?
**Decision taken:** It takes focus, wears the attention ring and keeps its reason showing until
focus leaves it.
**Why:** A tooltip shown only on hover is not visible to a keyboard or screen-reader user arriving
on the page, and the reason is already the button's `aria-describedby`.
**Revisit if:** The owner wants the ring to fade on a timer instead.

## Q: Saved views store physical pins, so do they fight the new default pinStart on Delivery no.?
**Decision taken:** Not changed in 401. A saved view replays its pins as stored. A view saved with
Delivery no. unpinned unpins it, and an LTR 'left' applied under RTL pins it at the reading end.
**Why:** It is 400's saved-view store, and REVIEW-400 already lists it as finding #4 (MINOR,
logical pins). The column chooser also lets a user unpin Delivery no. on purpose, and a view must
keep that choice.
**Revisit if:** The owner rules on REVIEW-400 #4. The fix is to store logical sides and map them
through `pinStartFor` / `pinEndFor` when applying, in `saved-views.ts`.

## Q: Which icons and colours do the inspector's act rows carry?
**Decision taken:** Each row uses the same icon as its button on Delivery details: CalendarClock,
Flag and Plus. The icon takes that command family's ink: fulfilment, cancel-request (indigo) and
muted.
**Why:** The 368 capture draws coloured act icons, and the indigo reversal rules cancellation.
**Revisit if:** The owner wants the per-act icon and tone moved into `@/core/oms/open-intent`, so the
two features cannot drift apart.

## Note: pre-existing drive failures (not this slice)
- `foundation-drive` passes 1294/1302. The 8 failures are the top bar and bell checks, the same 8 as
  the baseline before 401 (`drive-399-foundation.log`).
- `document-rtl-drive` passes 52/53. The one failure ("every isolate is an inert inline box",
  font-mono 8000000121 / P001) also fails at HEAD with 401's files set aside
  (`drive-401-document-rtl-base.log`).
