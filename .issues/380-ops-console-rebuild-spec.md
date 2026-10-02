---
type: spec
status: ready
map: 358
---

# 380 — The Ops Console: one foundation for every screen, and three screens redesigned

Synthesized from wayfinder map [358](358-ops-console-rebuild.md), whose 21 tickets (359–379) are all
resolved. Every decision below names the ticket that ruled it. Read that ticket's `## Answer` for the
measurements, the captures and the rejected variants. This file states the rulings, not their
reasons. The reference design is the **Far — Ops Console** prototype
([file](assets/358-ops-console-prototype.html)). Its markup is something to react to, not code to
lift.

**Steps.** The work ships in six steps on `main`, in this order, with no flag (361):

| Step | What ships | Blocked by |
|---|---|---|
| **S1 Foundation** | Tokens (palette B), IBM Plex, density, the AG Grid look, the rail shell, overlays, print scope, the RTL/bidi fixes, and the breakage sweep, in one merge | — |
| **S2 Keyboard layer** | The command registry, the app-wide Ctrl+K palette (without live search), shortcuts and the help sheet | S1 |
| **S3 Deliveries list** | Three panes: views rail, query bar, grid and the Delivery inspector | S2 |
| **S4 Delivery details** | The record page: header, command bar, spine and facts | S3 |
| **S5 Simulation** | Foundation retheme plus its registered Process command and palette rows | S4 |
| **S6 Call center** | The console joins the shell; the sentence header; the caller bar | S5 |

The screens ship one at a time in 361's order (list → details → Simulation → call center), so each
step waits for the one before it.

Two later items depend on BackOffice and are **not** part of S1–S6. They are listed under Further
Notes: **Retry job** (370) and **palette live search** (374/376).

Decision ids **F** (foundation), **K** (keyboard), **L** (list), **D** (details), **M** (Simulation),
**C** (call center) and **R** (rollout) are this file's own.

## Problem Statement

The back office looks and behaves like a set of separate screens.

- **The chrome wastes the width the work needs.** A top bar with menus and a footer row costs height
  on every screen. The acting store is hidden in an account popup, so an operator with no store
  resolved finds out only when a screen refuses them.
- **Nothing is reachable from the keyboard.** There is no shortcut layer. The call center has a
  Ctrl+K palette of its own, which probably fails on an Arabic keyboard layout. Simulation has an
  unguarded Ctrl+Enter. An operator who works a queue of deliveries all day reaches for the mouse
  for every row.
- **The Deliveries list hides what an operator is looking for.** There is no way to see at a glance
  which loaded rows need attention, which have a cancellation request, or which are Dawaa Now. Saved
  views remember only the column layout, not the search. Seeing a delivery's state means opening
  its record, which is a heavy read.
- **Delivery details splits one story across tabs.** The timeline, the Log and the outbox jobs live
  in different places. A failed outside call is easy to miss. A dark identity band sits awkwardly
  under any brand rail.
- **The call center agent reads the order back from a row of chips** and repeats the caller's
  details from a fixed 260px rail that duplicates what the header already says.
- **The look is dated and inconsistent.** Pills, a 1.47:1 field edge that fails WCAG 1.4.11, toasts
  in the browser's system font with their own colours, three different scrims and shadows, and grids
  that do not mirror under RTL (5 of 22 never opted in). Times like `18:00–21:00` reverse under
  Arabic.

## Solution

The whole app moves to the **Ops Console** direction: a navy brand rail, gold as a signal only, IBM
Plex type, dense 26px grids and a keyboard-first layer that every screen shares.

- **One foundation, every screen.** Palette B (navy-led) replaces today's steel. Every screen takes
  the new tokens, Plex, density, grid look, overlay recipe and RTL rules without being redesigned.
  A breakage sweep fixes only what the foundation breaks.
- **An expanding navy rail** replaces the top-bar menu. It is collapsed to 56px group icons by
  default and pins open to a 240px labelled tree. A 44px top bar carries the crumb, the palette
  field, the **store chip** and the bell. The user menu sits at the rail foot.
- **Ctrl+K works everywhere** (except print routes). The palette holds the screen's own commands,
  the last five records opened, every screen the operator may open, and a jump to any delivery or
  document number. Each row follows the grant of the screen it leads to.
- **Single-key shortcuts** on the Deliveries list and Delivery details (J/K, Enter, R/C/N, `/`, `?`,
  `I`), behind a per-user switch. Keys only ever **open**. They never write.
- **The Deliveries list becomes one screen of three panes:** a views rail with built-in **lenses**
  and per-user **saved views** that store the search, a query bar of tokens, the grid with a derived
  Status column, and a **Delivery inspector** that shows the selected row without a server read.
- **Delivery details becomes a record page:** a light header with the now-step and due/paid tag,
  083's command bar unchanged, and a **spine** that tells the delivery's story newest first. The
  timeline, the Log, the jobs and a note composer sit in one list.
- **Simulation is rethemed only.** Its arrangement stays as spec 110 shipped it.
- **The call center joins the shell.** The order header becomes a **sentence** the agent can read
  aloud, over a ledger of bookkeeping. The customer rail collapses into a **caller bar** at the top
  of the centre column, which grows from 644 to 904px at 1280.

## User Stories

### Everyone: the foundation

1. As a back-office user, I want every screen in the same navy-led palette, so that the app reads as
   one product.
2. As a back-office user, I want text set in IBM Plex at 12px that I can read at 1× in light and in
   dark, so that dense grids don't strain my eyes.
3. As a back-office user, I want delivery, document and order numbers and store codes in a monospace
   face with a dotted zero, so that I can read `80001238` without miscounting zeros.
4. As a back-office user, I want money and quantities in the same face as the rest of the text, so
   that monospace keeps meaning "this is a key".
5. As a back-office user, I want 26px grid rows, so that more of a result fits on screen.
6. As a back-office user, I want form fields whose edge I can see (at least 3:1), so that I can find
   the box to type in.
7. As a keyboard user, I want a visible focus ring (navy in light, gold in dark), so that I always
   know where I am.
8. As a back-office user, I want the selected grid row marked by a bar on its leading edge that
   stays visible even over a pinned column, so that I never lose my place.
9. As a back-office user, I want buttons as 6px controls rather than pills, so that the console looks
   like a work tool.
10. As a back-office user who prints a screen, I want it printed in light colours whatever mode I'm
    in, so that I don't get pale ink on white paper.
11. As a back-office user who prints, I want the rail and top bar left off the paper, so that only
    the content prints.
12. As a finance user, I want the collection receipt and ACR to print exactly as they do today, so
    that the paper matches what the branch already files.

### Everyone: the rail shell

13. As a back-office user, I want a collapsed navy rail of group icons, so that the screen keeps its
    width for the work.
14. As an occasional user, I want one click to pin the rail open as a labelled tree, and I want it to
    stay that way next time, so that I can find screens by name.
15. As a back-office user, I want clicking a group icon to open a navy flyout of its screens, and I
    want hovering another group to switch to it, so that I can browse the menu like a menu bar.
16. As a keyboard user, I want Esc to close the flyout and return focus, so that the flyout never
    traps me.
17. As a back-office user, I want a gold marker on the group and screen I'm in, so that I know where
    I am at a glance.
18. As a back-office user, I want only the groups and screens I'm granted to appear in the rail, so
    that I'm never offered a door that refuses me.
19. As a back-office user, I want a breadcrumb in the top bar (group / screen / record number), so
    that I know where I am inside a screen.
20. As a back-office user, I want my acting store shown as a chip in the top bar, so that I can see
    and change it from any screen.
21. As a back-office user with no store set, I want the store chip to show in the attention tone, so
    that I find out before a screen refuses me.
22. As a back-office user, I want my name, theme toggle, shortcuts, sign out and the build stamp in a
    menu at the rail foot, so that the top bar stays clear.
23. As a back-office user on a 1100px screen, I want the rail to stay collapsed and the tree to
    overlay the page rather than push it, so that my grid doesn't reflow.
24. As a back-office user on a phone, I want a hamburger that opens the full labelled tree in a
    drawer, so that I can still navigate.

### Everyone: overlays, toasts and the bell

25. As a back-office user, I want every popover, menu and dialog to share one look (card, strong
    edge, one shadow, one scrim), so that overlays read as one family.
26. As a back-office user, I want the flyout and the user menu to stay navy because they open from
    the rail, so that I can tell where they came from.
27. As a back-office user, I want toasts in the app's own status colours and type, so that a success,
    a warning and an error look like the rest of the app.
28. As a back-office user, I want toasts at the bottom inline-end corner, so that they never cover
    the store chip, the bell or the open bell panel.
29. As a back-office user, I want a failure in a dialog shown inside that dialog, so that I can read
    it and act on it rather than having it hidden under the dialog's backdrop.
30. As a back-office user, I want the bell panel to show each notification on two lines with its
    type on its own line, so that titles are not truncated.
31. As a back-office user, I want a broadcast tagged in the primary colour rather than amber, so that
    I don't mistake an announcement for a warning.
32. As a back-office user, I want the unread count on the bell in gold with navy ink, so that it
    stands out in both modes.
33. As a back-office user, I want checkboxes in the app's primary colour, so that they don't paint
    in the browser's default purple.

### Arabic and RTL users

34. As an Arabic-reading user, I want every grid to mirror, so that columns read from the right.
35. As an Arabic-reading user, I want a pinned identifier column pinned at the reading start, so
    that the Delivery no. stays where I begin reading.
36. As an Arabic-reading user, I want time windows, phone numbers, negative amounts, counts and
    `code · name` pairs to read the right way round, so that `18:00–21:00` never reads as
    `21:00–18:00`.
37. As an Arabic-reading user, I want Arabic text set at a size that matches the Latin beside it, so
    that mixed lines look even.
38. As an Arabic-reading user, I want toast and confirm text from the server shown with its own
    direction, so that an English message's punctuation doesn't jump to the wrong end.
39. As an Arabic-reading user, I want key hints like `Ctrl K` to read in that order, so that the
    shortcut I'm shown is the one I press.

### Everyone: the command palette

40. As a back-office user, I want Ctrl+K to open one command palette on any screen, so that I can
    reach anything without the mouse.
41. As a back-office user, I want the palette to list what the current screen can do, so that I can
    act without finding the button.
42. As a back-office user, I want the palette to list every screen I may open, so that I can go
    anywhere by typing its name.
43. As a back-office user, I want to type a delivery or document number and jump straight to its
    record, so that I don't have to search for one I already know.
44. As a back-office user, I want my last five opened deliveries and documents listed first, so that
    I can return to what I was just working on.
45. As a back-office user whose access was removed, I want my recent list filtered by my current
    grants, so that the palette never offers me a record I can no longer open.
46. As a back-office user, I want an action the screen would refuse right now shown disabled with
    its reason, so that I learn why rather than wondering where it went.
47. As a call center agent, I want Place order and Abandon call never to be one stray Enter away in
    the palette, so that I can't end a call by accident.
48. As a back-office user on a print route, I want Ctrl+K left to the browser, so that printing is
    not interrupted.
49. As a back-office user with an Arabic keyboard layout, I want Ctrl+K to work, so that the palette
    is not reserved for English layouts.

### Everyone: keyboard shortcuts

50. As an operator, I want shortcut hints on palette rows and button tooltips, so that I learn keys
    as I go.
51. As an operator, I want `?` to show a sheet of every key available on this screen, so that I can
    look one up.
52. As an operator, I want a switch to turn off single-letter shortcuts, so that a stray keystroke
    never acts when I'd rather use the mouse.
53. As an operator typing in a field, I want letters to type rather than trigger shortcuts, so that
    I can enter text normally.
54. As an operator, I want Esc to close the topmost thing first (dialog, then popover, then clearing
    a box), so that one press never undoes two layers.
55. As an operator, I want a refused shortcut to tell me why in a toast, so that a key is never
    silently dead.
56. As an operator, I want shortcuts never to post anything, so that every write stays a deliberate
    click or Enter inside a dialog.

### Delivery operators: the Deliveries list

57. As a delivery operator, I want built-in lenses (All, Needs attention, Cancellation requested,
    Dawaa Now, Rescheduled) over the rows I've loaded, so that I can narrow the result instantly
    without another search.
58. As a delivery operator, I want each lens to show how many loaded rows it matches, so that I see
    where the work is before I click.
59. As a delivery operator, I want counts to read "200+" when my search hit its limit, so that I'm
    never told a lower bound is the total.
60. As a delivery operator, I want a line telling me the result stopped at the limit, so that I know
    to narrow the search or raise the limit.
61. As a delivery operator, I want Needs attention's count in the danger colour while it is above
    zero, so that failed jobs stand out.
62. As a delivery operator, I want to save my search, lens, columns and grid filters as a named
    view, so that I can return to my usual work in one click.
63. As a delivery operator, I want a saved view's dates stored as relative ranges ("today", "last 3
    days"), so that tomorrow it still means today.
64. As a delivery operator, I want to star one view as my default and have it run when I open the
    list, so that my working set is ready when I arrive.
65. As a delivery operator, I want a dot beside my view's name once I've changed something from what
    I saved, so that I know to update it.
66. As a delivery operator, I want to update, save as new, rename, set as default and delete my
    views, with undo for delete, so that I can manage them without a confirm dialog.
67. As a delivery operator on a shared counter PC, I want my saved views kept under my user, so that
    the next operator doesn't see mine.
68. As a delivery operator, I want my existing column layouts brought over once as layout-only
    views, so that I don't lose them.
69. As a delivery operator, I want my search criteria shown as tokens I can click to edit, so that I
    can see and change the whole search in one line.
70. As a delivery operator, I want + Filter to list all 14 criteria grouped, so that every filter
    stays reachable.
71. As a delivery operator, I want the date as one relative range with presets, so that I pick
    "last 3 days" rather than two dates.
72. As a delivery operator, I want the row limit always shown, so that I know how many rows a search
    can return.
73. As a delivery operator, I want edits I haven't searched yet flagged (dashed tokens, struck
    ghosts, "N changes not searched · Discard"), so that I never read a grid that doesn't match the
    criteria on screen.
74. As a delivery operator, I want a derived Status column (Created, Ready, Out for delivery,
    Delivered, Cancellation requested, Cancelled), so that I can read each row's state without
    opening it.
75. As a delivery operator, I want "12 of 40 shown" and Clear grid filters when column filters
    narrow the grid, so that I know rows are hidden.
76. As a delivery operator, I want to drag over cell text and copy it with Ctrl+C, so that I can
    paste a number elsewhere.
77. As a delivery operator, I want J/K and the arrow keys to move one current row and the inspector
    to follow it, so that I can step through deliveries without the mouse.
78. As a delivery operator, I want the inspector to show the selected row's state, customer,
    fulfilment, money and note without a server read, so that stepping is instant.
79. As a delivery operator, I want a "N jobs failed" banner in the inspector, so that I know to open
    the full record.
80. As a delivery operator, I want R, C and N (or the inspector's buttons) to take me to the
    delivery's record with that dialog opened, so that every act runs through one implementation.
81. As a delivery operator, I want Enter (or double-click) to open the full record, so that going
    deeper is one key.
82. As a delivery operator, I want `/` to focus the query bar, so that I can start a new search from
    the keyboard.
83. As a delivery operator, I want to collapse the inspector with `I` and resize it by dragging (or
    by arrow keys on its handle), and I want it remembered, so that I can give the grid the width I
    need.
84. As a delivery operator, I want lenses and saved views available in the palette, so that I can
    switch view from the keyboard.
85. As a delivery operator returning from a record, I want my search, layout and current row
    restored, so that I pick up where I left off.
86. As a delivery operator, I want the handover OTP never shown in the inspector, so that a secret
    isn't displayed for every row I step through.

### Delivery operators: Delivery details

87. As a delivery operator, I want a light header with the delivery number, a now-step badge and a
    due/paid tag, so that I see where the delivery is and what is owed at a glance.
88. As a delivery operator, I want All statuses still one disclosure away, so that the thirteen raw
    statuses remain reachable.
89. As a delivery operator, I want the command bar exactly as today, with nothing hidden in a More
    menu, so that my muscle memory still works.
90. As a delivery operator, I want the timeline, Log, jobs and notes in one newest-first list, so
    that I read the delivery's story in one place.
91. As a delivery operator, I want the next step to show the slot window as an expectation, so that
    I know when it should happen.
92. As a delivery operator, I want an earlier pass that was rewound struck through, and the rewind
    marked in amber, so that I can see the delivery went backwards and why.
93. As a delivery operator, I want a cancellation request drawn in indigo and a cancellation in red,
    with later steps dropped, so that a cancelled delivery never looks like it is still heading for
    Delivered.
94. As a delivery operator, I want one banner per failed job naming the outside system, attempts,
    time and last error, so that I can tell ops exactly what failed.
95. As a delivery operator, I want a job that is still retrying shown as "retrying automatically",
    so that I don't escalate something the worker is still handling.
96. As a delivery operator, I want to post a note from a composer at the Now line, with N to focus
    it and Ctrl+Enter to post, so that adding a note doesn't need a dialog.
97. As a delivery operator, I want Esc to take me back to the list, but not while my note is unsent,
    so that I never lose a note I'm writing.
98. As a delivery operator, I want the facts (customer, prescription, fulfilment, driver, payment),
    the items and the folded pricing conditions beside the spine, so that I don't switch tabs.
99. As a delivery operator arriving from the list with R or C, I want the dialog opened only if the
    command is allowed, and otherwise the button ringed with its reason, so that I'm never shown a
    dialog that will be refused.
100. As a delivery operator, I want a reload or Back never to re-open that dialog, so that a write
     dialog doesn't pop up by surprise.

### Pricing users: Simulation

101. As a pricing user, I want Simulation in the new palette and type with its layout unchanged, so
     that I keep the arrangement I know.
102. As a pricing user, I want Ctrl+Enter to run the simulation, to do nothing while a dialog is
     open, and to tell me why when it can't run, so that the chord never fails silently.

### Call center agents

103. As a call center agent, I want the console inside the same rail shell as every other screen
     (rail collapsed), so that I can reach other screens and the palette from a call.
104. As a call center agent, I want the order header written as one sentence ("Deliver to ‹address›
     for ‹caller› from ‹store› at ‹window›, ‹payment›."), so that I can read it back to the caller.
105. As a call center agent, I want the sentence to change shape when I switch to collection, so that
     words that don't apply are gone rather than greyed.
106. As a call center agent, I want source, reference, coupon and note labelled in a ledger under the
     sentence, so that bookkeeping doesn't clutter what I say.
107. As a call center agent, I want each word in the sentence to open the same section it opens
     today, by click or by Tab and Enter, so that I edit the order the way I already know.
108. As a call center agent, I want a word the server blocks drawn in the attention tone, so that I
     know what stops the order being placed.
109. As a call center agent, I want an Arabic caller's name shown whole inside the sentence, so that
     I read it correctly.
110. As a call center agent, I want the phone lookup in a caller bar at the top of the centre column,
     with the caret there when the call opens, so that the first thing I type is the number.
111. As a call center agent, I want the found member shown in the bar with Attach, so that attaching
     is still a deliberate step.
112. As a call center agent, I want the attached caller's name, tier, points, mobile and member id on
     one line, so that I see who is on the line without a side column.
113. As a call center agent, I want the caller bar to take the same space before and after I attach,
     so that the screen doesn't jump mid-call.
114. As a call center agent, I want sign-up to open in the flow under the bar, so that I sign a caller
     up without a modal.
115. As a call center agent, I want open requests as a chip I can open, and a linked request as a chip
     that opens its detail (reason, store, note, link, Unlink), so that I can convert a request
     without a side panel.
116. As a call center agent, I want the address word in the sentence to open the address book, so
     that I change the address where I read it.
117. As a call center agent, I want a 904px centre column at 1280, so that the basket and search have
     room.

### Leads and owners

118. As the product owner, I want to sign off each step live in light, dark and RTL against the Far
     prototype, so that nothing reaches users that I haven't seen.
119. As an operator lead, I want to accept every behaviour change on my team's screen before it
     ships, so that my team isn't surprised mid-shift.

## Implementation Decisions

### Rollout (R)

- **R1 — Stepwise on `main`, no flag, never two token sets** (361). Every step leaves `main`
  shippable. The six steps above ship in order.
- **R2 — Sign-off.** The owner signs off every step live in light, dark and RTL. Where a step changes
  behaviour, an **operator lead from that screen's team also accepts it** before it ships. The known
  behaviour changes:
  - S3: the starred default view **runs on open** (366).
  - S6: the console joins the shell, and the 260px customer rail becomes the caller bar (363, 379).
  - Later: Retry (370).
- **R3 — Screens that are not reworked** take the foundation and the keyboard layer, plus a breakage
  sweep inside S1 that fixes **only what the foundation breaks** (clipped heights, contrast failures,
  hard-coded sizes that Plex disturbs). Shared page-header, toolbar and empty-state pieces move into
  `@/core` only as the reworked screens need them.

### S1 — Foundation (F)

**Type (359, ADR 0003).**

- **F1** — All IBM Plex, self-hosted woff2:
  - **Plex Sans** (variable, Latin) for UI and grids, replacing Inter;
  - **Plex Mono** 400/600 as `--font-mono`, for **IDs and codes only**: delivery, document and order
    numbers, SAP, material and store codes, device ids;
  - **Plex Sans Arabic** 400/500/600/700, gated by `unicode-range`, replacing Readex Pro, with
    **`size-adjust: 115%` on the four Arabic faces only** (378).

  Money and quantities stay in Plex Sans. The `tabular-nums` rule becomes a no-op. `[data-numeric]`
  stays as a marker.

**Palette B, "Navy-led" (362).**

- **F2** — The neutrals take the navy's temperature, and the accent is the navy lifted (`#0F4C9C`
  light / `#79A7EC` dark). Token **names stay 082's**, so call sites don't change. Values are 362 §1's
  table.
- **F3** — **082's status families carry over byte for byte**: danger for cancellation, indigo
  (`--fam-cancel-request`) for a cancellation request, teal for prescription, violet for POST, green
  for fulfilment. **Amber stays reserved for attention.**
- **F4** — The field edge (`--input`) rises to **3:1** in both modes.
- **F5 — Brand and gold.**
  - The rail is navy `#002554` in both modes.
  - The new tokens: `--rail-muted`, `--gold` / `--gold-foreground`, `--cursor`, `--grid-head` /
    `--grid-head-foreground`, `--shadow-pop` and `--backdrop`.
  - **`--sidebar*` is renamed `--rail*`** (`--rail`, `--rail-foreground`, `--rail-accent`,
    `--rail-active`, `--rail-muted`).
  - **Gold is a signal, never text on a light surface.** It is allowed on navy, as a fill carrying
    navy ink, and on dark surfaces.
  - The two consumers that use the rail token as link ink move to `primary` first.
- **F6 — Focus and selection.**
  - Focus is a 2px `--ring` with a 2px offset: navy in light, gold in dark.
  - The selected row is the `--primary-050` ground plus a 3px `--cursor` bar on the inline-start edge
    (navy in light, gold in dark), stacked above pinned cells.
  - Hover is `--accent` for controls and `--card-2` for grid rows.
- **F7 — Radius and density.**
  - `--radius` is 0.5rem: 6px controls, 8px cards, menus and the grid wrapper, 10px dialogs and the
    palette.
  - **Buttons drop the pill** and keep a 28px height.
  - Global `accent-color: var(--primary)`.
- **F8 — The AG Grid look** (still one params block):
  - rows 26px, headers 28px;
  - 12px cells, 11.5px/600 headers, in `var(--font-sans)`;
  - the header ground on the `--grid-head` pair;
  - an 8px wrapper radius;
  - `pinnedColumnBorder` on `--border-strong`;
  - no zebra.
- **F9 — Native copy in every grid.** `enableCellTextSelection` + `ensureDomOrder`. AG Grid
  Community only.

**The rail shell (363).**

- **F10** — **Shell D, expanding and collapsed by default.**
  - **Collapsed (56px):** a navy rail of one icon per **visible group**, from the same
    `useVisibleMenu` the menu uses today, so gating is unchanged. Clicking a group opens a 240px navy
    **flyout**: `role="dialog"`, menu-bar hover switching, Esc / outside click / navigation closes
    it, and focus moves to its first link. The Settlement sub-group draws as a header plus indented
    leaves.
  - **Expanded (240px):** the labelled accordion tree on navy.
  - **Remembered** per user in a small zustand store beside the theme preference, persisted to
    `localStorage`.
  - **The active marker** is a 3px gold `::before` on the inline-start edge.
- **F11 — The top bar (44px, `--card`).**
  - The crumb (group / sub-group / screen / record number in mono, derived from the menu, with a
    **slash** separator);
  - from S2 only, the centred palette field;
  - the **store chip** (opening today's store switcher, attention tone when no store is set);
  - the bell.
- **F12 — The user menu at the rail foot.** It holds name + user id, the theme toggle, the shortcuts
  sheet and single-key switch (from S2), sign out and the **build stamp**. **The footer row goes.**
  Broadcast stays an Administration screen.
- **F13 — Narrow widths.** At 640–1279px the rail is always collapsed and the tree **overlays** with
  a scrim. Under 640px there is no rail: a hamburger opens a navy drawer with the full tree, and body
  scroll locks. Today's 992px breakpoint goes.
- **F14 — Print routes keep their own chromeless layout.** The call center is **not** moved into the
  shell in S1. That is S6.

**Overlays, toasts, bell (377).**

- **F15 — Overlays are styled by origin.** What opens from the rail (the flyout and the user menu) is
  navy with a gold focus ring. **Everything else uses one card recipe:** `--card` ground,
  `--border-strong` edge, `--shadow-pop`, `--backdrop` scrim, 8px popovers and menus, 10px dialogs
  and the palette, 28px menu items. This replaces today's mix of shadows, radii and `bg-black/*`
  scrims.
- **F16 — Toasts.**
  - Keep sonner's `richColors`, but point its variables at 082's tiers: success, attention and
    danger use their `-050` ground, `-border` edge and `-800` ink, and **info uses the primary
    tiers**. Neutral toasts use the card recipe.
  - Plex, `--radius`, 340px wide.
  - The styling lives beside the tokens, not at call sites, and adds no new tokens.
  - **Position: bottom-end, offset 16px, mapped by direction** (`bottom-left` under RTL), re-read
    when the direction changes.
- **F17 — The bell panel** becomes a dense 360px dropdown (max 440px tall):
  - an "N new" chip and a Mark all as read text control;
  - two-line clamped bodies, with the type tag on its own line;
  - **BROADCAST in the primary tier, not amber**;
  - a 6px primary unread dot;
  - the badge in gold with navy ink in both modes.
- **F18 — A dialog's own failure renders inside the dialog** (`ErrorBanner`), and the dialog stays
  open. A success that closes the dialog may toast. The Toaster stays at the root. The breakage sweep
  fixes the two known offenders (the UA set-password dialog and the settlement post-entry dialog)
  and audits the other `Modal` users that toast.

**Print (375).**

- **F19 — Dark is screen-only.** The dark token block and the `dark` variant move under
  `@media screen`, and print gets `color-scheme: light`, so paper always resolves to light B from one
  copy of the values. The contrast gate's dark-block match accepts indentation.
- **F20** — The rail and the top bar take `print:hidden`.
- **F21 — The printed documents (voucher and ACR) are untouched.** They use literal ink and Tahoma
  under the palette-gate exemption.

**Arabic/RTL (378). Lands in S1, all in one change.**

- **F22 — Direction is a boot fact.**
  - `dir` is set from the locale before first paint, like the theme.
  - `@/core/theme` calls `provideGlobalGridOptions({ enableRtl })` once. The global hook carries
    **scalars only**.
  - The per-grid direction opt-in and all its spreads are removed.
  - A language switch reloads the page.
- **F23 — `pinStart`.** A core value replaces literal `pinned: 'left'`. It reads `'right'` under
  RTL. Three call sites use literal sides today.
- **F24 — Bidi isolation by kind, never by shape, and the whole value, never its parts.** This
  replaces 095's shape rule in the `Ltr` component's documentation, and a new rule file under
  `.claude/rules/` states it.
  - **Machine values** (numbers, money, codes, dates, times, ranges, phones, counts, key chords)
    take `Ltr`.
  - **Free text in either script** (names, addresses, notes, server messages) takes `<bdi>` (auto).
  - **A range, a `code · name` pair or `n / m` is formatted to one string and isolated once.**
    Isolating each end reverses it.
- **F25 — One core base `defaultColDef`** that every grid's `defaultColDef` spreads. Its cell
  renderer is a React `<bdi>` showing `valueFormatted ?? value`. A column with its own renderer
  isolates its own values. The base replaces `Ltr` used as a cell renderer, which silently dropped
  `valueFormatter`.
- **F26 — A core FSI…PDI string helper** for string-only sinks: `title`, `placeholder`, native
  `<option>`, toast strings, `document.title` and AG header names. It is **never** used in grid
  values or exports, because its invisible characters would reach Ctrl+C and CSV. Server-supplied
  toast and confirm text renders with `dir="auto"`.
- **F27 — The range sweep:**
  - the shipped call center slot chip;
  - the Details slot;
  - collection's `daySpan`;
  - bonus-buy inquiry's range line;
  - the two `a / b` counters;
  - every place `formatDateTime` is shown.

  Ranges written with words only isolate each value.
- **F28** — Numbers stay at the cell's end under RTL (AG Grid's convention, owner). The crumb keeps
  the slash.

**Breakage sweep (361, 377).**

- **F29** — Inside S1:
  - clipped heights under 26px/28px;
  - contrast failures;
  - hard-coded sizes Plex disturbs;
  - the `NoteField` textarea back to 6px;
  - the dialog-failure audit (F18);
  - the two rail-token link-ink consumers (F5).

### S2 — Keyboard layer (K)

**The registry (364, 365).**

- **K1 — `@/core/commands`** owns the palette UI (graduated from the call center's palette and its
  highlight helper) and a **command registry**.
  - A page calls **`useCommands([...])`** while mounted, and its commands unregister on unmount.
    That is the whole "This screen" group, and it lets commands see page state such as the selected
    row.
  - `layout/` composes the app-wide groups. Features never import each other.
- **K2 — A command** has:
  - an id and a label key;
  - a group;
  - an optional handler (**enablement is the handler being present**, never a second predicate);
  - an optional disabled reason (the same words as its button's tooltip);
  - an optional **`keys`**;
  - an optional **`terminal`** flag;
  - an optional **hidden** flag, for J/K.
- **K3 — The registry refuses**, as a dev-time error:
  - two mounted commands claiming one key;
  - any Alt chord;
  - any Ctrl chord other than Ctrl+K (core) and a screen's Ctrl+Enter;
  - AG Grid's own keys (arrows, Tab, Space, Enter in the grid, PageUp/PageDown, Home/End, Ctrl+A,
    Ctrl+C);
  - **`keys` on a `terminal` command**.
- **K4 — Three firing tiers, enforced in core:**

  | Tier | Fires when |
  |---|---|
  | **Chords** (Ctrl+K, a screen's Ctrl+Enter) | From anywhere, including text boxes and grid cells. **Inert while any `dialog[open]` exists.** Ctrl+K always calls `preventDefault`. |
  | **Esc** | It goes to the topmost layer: native dialog → popover/menu → in-box clear → the screen's Esc command. The screen command runs only if `!defaultPrevented`. |
  | **Single keys** (letters, `/`, `?`) | Focus is not in an input, textarea, select, contenteditable, `role=textbox/combobox/searchbox` or an AG Grid cell editor; there is no `dialog[open]`; no Ctrl, Alt or Meta is held (Shift only for `?`); the switch is on; and `!event.isComposing`. |

  - **Matching:** letters, `/` and `?` use **`event.code`**. Enter and Escape use `event.key`.
    Meta counts as Ctrl.
  - **A key a control has already handled stays that control's:** the layer skips
    `event.defaultPrevented` (368).
  - J/K repeat while held, but acts never repeat.
- **K5 — Keys only open.** An act key presses its button and nothing more. **No key writes on any
  screen.** A refused key toasts its reason, and the toast is coalesced.
- **K6 — The single-key switch** is per user, defaults to on, and is stored like the dark-mode
  preference. It sits in the user menu and in the help sheet. When it is off, letters do nothing,
  while chords, the palette and the mouse still work (WCAG 2.1.4).

**The palette (364, 376).**

- **K7 — One app-wide palette, hosted at `ProtectedLayout`.** That puts it on chromeless routes such
  as the call center. **Print routes opt out through an explicit route flag** (375), never through
  `chromeless`.
  - Each open starts with an empty box.
  - The chosen act runs after the palette closes.
  - Focus returns to where it came from.
  - Ctrl+K is inert under a dialog.
- **K8 — Groups.** With an empty box the order is **This screen → Recent → Go to**. Typing adds
  **Jump to number**. **Live search is not in S2** (376). No app-level actions in v1.
- **K9 — Recent** holds the last 5 deliveries and documents opened through Delivery details, newest
  first.
  - It stores **the number only**, in `localStorage` keyed by user id, parsed defensively (a
    malformed store reads as empty).
  - It is **re-filtered by current grants on every open**.
- **K10 — Go to** reads the **same `useVisibleMenu` result** as the rail.
- **K11 — Jump to number** yields *Open delivery N* and *Open document N* rows that navigate
  straight to the existing routes, with no read. It is gated on `canOpenDetail`.
- **K12 — Gating:**
  - This screen: the page is mounted.
  - Recent: current grants.
  - Go to: menu probes.
  - Jump: `canOpenDetail`.

  **Pending or errored probes fail closed.** The palette only hides. The server's grant filters stay
  the boundary.
- **K13 — Disabled rows.** A command the page would refuse right now is a **greyed row carrying its
  reason**, and Enter on it does nothing (ruling 192, made app-wide).
- **K14 — `terminal` rows** sort last and are never auto-highlighted.

**Discovery and i18n (365).**

- **K15 — Hints.** Palette rows show their key in a right-aligned `kbd`. Button tooltips read
  "Reschedule (R)" and the buttons carry `aria-keyshortcuts`. Letter hints hide when the switch is
  off.
- **K16 — The help sheet** is a native dialog **generated from the registry**: app-wide keys plus the
  mounted screen's commands. It is reached by `?` (on the single-key screens), by a palette row
  (everywhere), and from the user menu. There is no tour.
- **K17 — Legends.**
  - Letters and symbols show their **Latin legend** derived from the code (`KeyR` → `R`). This is
    data, not a translatable string.
  - Named keys go through `t()`: `common:keys.ctrl`, `keys.enter`, `keys.esc`, `keys.shift`.
  - A chord hint is isolated **as one unit**.
  - One key set serves both languages, and the hint always says Ctrl.

**Screen hooks in S2.**

- **K18** — Every screen gets navigation through Go to.
- **K19** — The call center's own Ctrl+K listener and palette model become a `useCommands`
  registration. That brings the `event.code` fix and keeps 153's table whole: no single keys, no
  slash commands, no place-order chord.

### S3 — The Deliveries list (L)

**Views (366).**

- **L1 — A lens** is built in and is a predicate over the **loaded rows**. It never calls the server.

  | Lens | Matches |
  |---|---|
  | All | every row |
  | Needs attention | `failedJobsCount > 0` |
  | Cancellation requested | `closeStatus === 'R'` |
  | Dawaa Now | `isExpressDelivery` |
  | Rescheduled | `rescheduled` |

- **L2 — Counts.**
  - A count is the loaded rows the lens matches, over the **whole loaded result**, ignoring column
    filters.
  - Before any search, it reads **"—"**.
  - When `rows.length === Limit`, **every** count reads as a lower bound (**"200+"**), and the grid
    bar says the page stopped at the limit.
  - There is no server count.
- **L3 — A saved view** captures four things:
  - the 14 `DeliveryFilterCriteria`, with the date range **relative**;
  - the lens;
  - the column state (order, width, visibility, pinning, sort);
  - the AG Grid column filters.

  **Applying one runs its search.** Names are unique per user.
- **L4 — Storage.**
  - Saved views are per user, in `localStorage` **keyed by user id**, with no shared views.
  - The existing shared layout-only views are **imported once** into the signed-in user's store as
    **layout-only** views: no criteria, lens All. Applying one sets the layout and runs no search.
    Re-saving one makes it a full view.
  - The old key is never written or removed.
- **L5 — Lifecycle.**
  - **One starred default** applies and runs on page open when there is no in-memory search. With no
    default, the list opens empty as today. Returning from Details restores the in-memory search,
    never the default.
  - A **modified dot** shows drift in criteria, lens, columns or grid filters.
  - The actions are Update (only once the view has drifted), Save as new, Rename, Make/Remove
    default, and Delete with **undo from the toast** and no confirm dialog.

**Layout (368): A, three panes.**

- **L6** — From inline-start to inline-end: the rail · a **220px views rail** · the centre · the
  **inspector**. At 1280 with the rail collapsed and the inspector open, the grid keeps about 644px.
- **L7 — The views rail** (`--card-2`):
  - **Lenses:** icon, label and a mono count. Needs attention turns danger while it is above 0.
  - **My views:** a star for the default, a `layout` tag for imported views, the modified dot on the
    active view, and a ⋯ menu on hover or focus.
  - **+ Save current view** at the foot.
  - The active row takes the `--primary-050` + `--cursor` pair.
- **L8 — The query bar.**
  - **Tokens** read `Field: value`. A click opens that field's own control in a popover: **Enter
    searches**, Done closes without searching, and × drops the token.
  - **+ Filter** lists **all 14 criteria** in four groups (When · Find one · Narrow · Rows), and marks
    the ones already in the search. From/To is **one Date entry** with relative presets (Today,
    Yesterday, Last 3 days, Last 7 days, Custom).
  - The **Limit token is always shown**, editable and never removable.
  - **Unapplied edits are flagged:** an edited token goes dashed amber, a removed token stays as a
    struck ghost with restore, the note reads "N changes not searched · Discard", and Search carries
    an amber dot until it runs.
- **L9 — The grid bar** shows:
  - the active view name and its modified dot;
  - the row pill ("5 deliveries", or "12 of 40 shown" + Clear grid filters);
  - the cut-off line when rows = Limit;
  - Columns (today's chooser), Export and the Inspector toggle.
- **L10 — The grid.**
  - Today's columns, plus a **derived Status column** in second place: a dot and a word from the
    shared timeline derivation (D1). Cancellation requested is indigo, Cancelled is red.
  - **Delivery no.** is pinned with `pinStart`, in mono 600, and the other IDs are mono.
  - **Failed jobs** is a danger count pill, or a muted "—" at 0.
  - The floating filters stay.
  - **Selection follows focus**, so there is one current row.
  - **The grid stays mounted under its empty states**, which overlay it: no search yet, no matches,
    no rows in this lens.
- **L11 — The status bar** shows "N deliveries · 1 selected", the key hints and "Drag over text,
  Ctrl C copies".
- **L12** — The hand-rolled Save-view dialog moves onto core `Modal` (377).

**The Delivery inspector (367).**

- **L13 — It reads the row only. No request, ever.**
  - **Header:** delivery no. (mono 18px), order and document nos, the status, and the tags (document
    type, delivery type, **Dawaa Now as a gold fill with navy ink**, the due/paid tag).
  - **Timeline:** the inspector variant of D1. Created ← `entryTime`, Out for delivery ←
    `outForDeliveryTime`, Delivered ← `actualDeliveryTime`. The rewind marker comes from
    `rescheduled` / `rescheduledTime`. The next step shows the slot window as an expectation.
  - **The failed-jobs banner** comes from `failedJobsCount` only ("N jobs failed").
  - **Customer:** name, mobile and address.
  - **Fulfilment:** store, slot, rescheduled, source, courier and driver.
  - **Money · SAR:** with a ruled Amount due.
  - **Note.**
  - **`customerOtp` is never shown.**
- **L14 — Commands.** Reschedule (R), Request cancellation (C) and Add note (N) are deep-links to
  Delivery details carrying **one-shot router state** `{ open: 'reschedule' | 'request-close' |
  'add-note' }`. Then **Open full record ↵**. The inspector posts nothing. A letter is bound only if
  the list offers that act.
- **L15 — Width.**
  - Default 360px, min 320, max 560, and never more than 40% of the viewport.
  - The handle sits on the **inline-start edge**. It is a focusable `role="separator"` with
    `aria-valuenow/min/max`: arrows step 16px, Home/End jump to min/max, and a double-click resets
    to 360.
  - **Collapse** by its chevron, by the grid bar toggle, or by **`I`**. The grid takes the width
    back.
  - Width and open/closed are remembered in `localStorage`, parsed defensively. It opens by default.

**Keys and palette (365, 368).**

- **L16 — Keys:**
  - J/K for next/previous (hidden commands);
  - ↓/↑ kept;
  - **Enter on the grid's `onCellKeyDown`** (AG Grid prevents Enter on a cell), ignored on a button
    or link, and the deliberate search inside the query bar;
  - R/C/N;
  - `/` focuses the query bar (with `preventDefault`);
  - `?`;
  - `I`.

  Space, Ctrl+A and Ctrl+C stay AG Grid's.
- **L17 — Palette.** "Show: ‹lens›" for each lens and "Apply view: ‹name›" for each saved view join
  This screen as rows, with no keys.
- **L18 — RTL.** The inspector's slot and courier values are isolated per F24 and re-driven under
  RTL.

### S4 — Delivery details (D)

**The timeline derivation (369). Shared with the list.**

- **D1 — A pure timeline derivation moves into `@/core`.** Both surfaces feed it: the list row
  (`DeliveryDocumentModel`) and the details header (`SdDocumentHeaderModel`) map to one input. The
  inspector and Details share **the derivation, not a component**. It must exist by S3 (the list's
  Status column), so it lands with S3 and S4 extends its input with Log rows.
  - **Steps:** Created → Ready → Out for delivery → Delivered. Pick-in-store (`deliveryType 'P'`)
    skips Out.
  - **Reached:** Created always; Ready when `readyStatus` is R or C; Out when `deliveryStatus` is O;
    Delivered when `deliveryStatus` is D.
  - **Cancellation replaces the next step.** Steps already reached stay done. The stopping step
    becomes **Cancellation requested** (`closeStatus` R, final, **indigo**) or **Cancelled**
    (`closeStatus` C, N or X, red). Later steps are **dropped, not greyed**.
  - **Rewinds** (`DRBK`, `DRSC`, `DCHC`) show the current position plus a marker on the step it fell
    back to.
  - **Payment is not a step.** The **due/paid tag** reads `Due n` while `amountDue > 0` and `Paid`
    at 0.
  - **Times on Details** come from the `entryTime` of the **latest Log row** whose `actionType`
    reached the step:

    | Step | Log action types |
    |---|---|
    | Created | `DCRT` |
    | Ready | `DRDY` / `DTXC` |
    | Out for delivery | `DOFD` |
    | Delivered | `DDLR` |
    | Cancellation requested | `DRCL` |
    | Cancelled | `DCLS` / `DFCL` / `DCNI` / `DCAD` |

    A step reached with no matching row shows **no time**.
  - **Never a time source:** `statusHistory`, `DeliveryDateTime`, `EstimateDeliveryTime` or
    `changedOn`.
  - **The next step's expectation reuses `deliveryWindow()`**, never the raw schedule fields (a live
    capture has from = to).
  - **A failed job is a banner, never a step.**

**The page (371): variant D, C's spine with B's command bar.**

- **D2 — The header** is a light `--card` card, **never a dark slab**.
  - **Line one:** Back chevron (Esc), the Delivery no. in mono 600, the **now-step badge**, the
    **due/paid tag**, the tags (Dawaa Now in gold with navy ink, e-Rx, the Overall code), and
    **All statuses** at the end (083 D-3's disclosure kept).
  - **Then the sub-ids:** order no., type, delivery doc, placed, store and document no.
  - The 083 identity band's customer block is dropped.
- **D3 — The command bar is 083 D-10 unchanged:**
  - three labelled clusters (Fulfilment · Cancellation request · Notes & docs);
  - the terminal pair (Force cancel · Cancel order) pinned to the end;
  - **nothing hidden, no More menu**;
  - evidence-only gating with the disabled reason on hover and focus;
  - R, C and N shown on the buttons.

  A cancelled delivery keeps evidence-only gating (default, overturnable).
- **D4 — Two columns.**
  - **The spine** (about 340–420px, start side) is the timeline and activity feed as **one list,
    newest first**: the failed-job banners; the unreached steps, furthest first, with the next one
    carrying its window as an expectation; the **Now line with the note composer**; then the past,
    newest first.
  - **The facts column** (end side) holds Customer · Prescription · Fulfilment · Driver & tracking ·
    Payment, as dense label/value blocks (083 D-5/D-6's emptiness rules kept). Under them sits
    **Items**, the grid sized to its rows, with deleted lines struck and a pinned totals footer. Under
    that, **Pricing conditions** is folded into a disclosure with its count.
  - **The 083 tabs and the 340px summary rail are gone.**
- **D5 — How the past draws.**
  - A Log row that reached a step is a **milestone node** (the latest matching row).
  - An earlier pass superseded by a rewind is **struck through** and reads "earlier pass". Only
    lifecycle steps can be superseded.
  - A rewind row is an **amber node**.
  - Jobs and notes are small event rows.
  - Cancellation requested is indigo, and Cancelled is red.
  - **No "now" tag on a milestone.** The header badge and the Now line carry "now".
- **D6 — Feed ordering.** Log `entryTime` and outbox `entryTime` merge on one key. On a tie, the Log
  row comes first. No server change.
- **D7 — Jobs.** **One banner per `F` job**:
  - line one: the handler, "failed", the attempts and the time;
  - line two: the last error.

  **No Retry button.** The banner's end keeps room for one. A failing **`P`** row reads "failing,
  retrying automatically · attempt n · next hh:mm" plus its error, and never gets a button.
- **D8 — Notes.** **Add note posts from the composer** at the Now line, which amends 083 D-11 **for
  Add note only**.
  - Cancel order, Force cancel and Request cancellation keep their notes inside their own dialogs.
  - An empty composer cannot post.
  - The command bar's Add note… focuses the composer.
- **D9 — The one-shot `open` intent.**
  - It is consumed **once, after the header loads, through the command bar's own gate**.
    `reschedule` and `request-close` open their real dialogs. `add-note` focuses the composer.
  - **A refused intent** opens nothing. The disabled button gets an attention ring and shows its
    reason as a tooltip, and a warn toast repeats it.
  - The router state is **replaced away on consumption**, so a reload or Back never re-fires it.
- **D10 — Keys.**
  - **Esc goes back to the list**, restoring its query and current row: history-back when we came
    from the list, otherwise the list route. Esc inside a text box only blurs it. **Esc is refused
    while the composer holds unsent text**, with a toast.
  - R/C open Reschedule and Request cancellation.
  - N focuses the composer, and Ctrl+Enter in the composer posts.
  - `?` opens the help sheet.
  - **No J/K next/previous delivery.**
- **D11 — Recent.** Opening a delivery or document here records its number into K9's Recent store.
- **D12 — RTL.** The spine's who · when meta and the expectation window are isolated per F24.

### S5 — Simulation (M)

- **M1 — Retheme only** (372). Spec 110's arrangement stays whole: the chip strip, Items, the 66/34
  split, expand in place and the rail. 116's line expansion (money foot, rule cards, trace) is
  restyled by the foundation only.
- **M2 — Ctrl+Enter = Process** becomes a registered `Process` command with `keys` (a read, so K5's
  no-write rule doesn't apply). It is **inert under a dialog**, and it **toasts its refusal**,
  coalesced ("Add an item first", "A run is already in progress"). This replaces today's silent
  no-op. The `▶ Process ⌃⏎` hint stays. Simulation has no single keys.

### S6 — The call center (C)

- **C1 — The console joins the shell** (363). It stops using `chromeless`, takes the rail
  (collapsed) and the top bar, and its palette is the core one (K19).
- **C2 — Layout** (379): the rail · centre (`minmax(0,1fr)`) · the receipt (320px). **135's 260px
  start column goes.** The centre grows 644 → 904px at 1280.
- **C3 — The sentence** (373) **replaces `ChipRow`/`Chip`.** The header-chips model stays the one
  pure model of slot state (from the server's `submitBlockers`, plus the derived and lapsed flags),
  and it gains the mode word, the address and the caller's name.
  - **One sentence shape per mode:**
    - Delivery: `‹Deliver› to ‹address› for ‹caller› from ‹store› at ‹window›, ‹payment›.`
    - Collection: `‹Collect› from ‹store› for ‹caller›, ‹payment›.`
  - A mode flip rewrites the sentence (absent, not disabled).
  - **The ledger** under it: Source · Ref · Coupon · Note as labelled fields. When empty, Coupon and
    Note read "+ coupon" and "+ note".
- **C4 — Slot looks:**
  - **settled:** a bordered word;
  - **blocked by the server:** a dashed attention fill;
  - **optional and empty:** a ghost word;
  - **readout:** a plain word, not a control.

  The two readouts are the caller's name and the store on a delivery order (dotted underline plus a
  "follows the address" title). The address word opens the address book once a caller is attached.
  The gate reason, the lapsed-slot warning and the retained-address trace (176) are notes under the
  sentence.
- **C5 — Editing.**
  - Every word opens **today's in-flow section**. No popovers.
  - Words are native buttons in reading order: Tab moves, Enter or Space opens and moves focus into
    the section, and Esc closes and returns focus.
  - The palette's verb rows open the same sections.
  - A refused option stays focusable with `aria-disabled`.
- **C6 — i18n.** **Each sentence shape is one key with named self-closing slot tags**, rendered by
  `<Trans components>`, so the translation owns the word order and DOM order follows it. An Arabic
  template never glues a clitic to a slot. Values are isolated per F24: `<bdi>` for the name,
  address, store name and note, and `Ltr` for codes, the reference, coupons and **every window**.
  Template punctuation sits outside the isolates. Until `slot.date` exists, the sentence words the
  window only.
- **C7 — The caller bar** (379), at the top of the centre column.
  - **Lookup:** the phone box keeps the `cc-phone` id. The caret lands there on open (keyed on the
    order) and returns there on remove. The found member appears inline with **Attach**.
  - **Attached:** name · tier · points · mobile · member id · the requests chip · ✕, on one line at
    1280. The fields stay `railFields`'s, with 135's six-field cap and order.
  - **The bar takes the same pixels before and after attach.**
  - **Bidi:** the name in `<bdi>`, the mobile and member id in `Ltr` and mono.
- **C8 — Where the rail's other jobs go.**
  - **Sign-up** opens `SignupPanel` in the flow under the bar.
  - **Open requests** become an attention chip, "N open requests · View" (a new plural key), that
    opens 194's picker.
  - **A linked request** is a *Converting request ‹no› ↗* chip that opens an **in-flow detail
    section**: reason, raised at store, the pharmacist's note, ↗, and **Unlink** (195's confirm
    unchanged). This section was not prototyped and is drawn at build.
  - **The address book's only door** is the sentence's address word.
  - The store word replaces "Collecting from", and `STORE_NOT_CHOSEN` is said once.
- **C9 — Copy.** The opening-steps hints for the caller step and the store step are reworded: there
  are no chips, no slash commands, and no left panel.
- **C10 — Amends** 135, 165, 159, 194, 166 and 176, as 379 lists them.

### i18n

- **`common`** gains:
  - `topbar.*`: collapse/expand menu, flyout close, store chip (set and unset), the crumb;
  - `keys.*`: ctrl, enter, esc, shift;
  - the palette's group names and the Jump rows;
  - the help sheet and the single-key switch;
  - the user menu, including the build stamp label;
  - the refused-key toast.
- **`deliveries`** gains the lens names, the count wording ("—", "N+"), the cut-off line, the view
  actions and their toasts, the query bar (+ Filter groups, Date presets, "N changes not searched ·
  Discard"), the grid bar, the empty states, the status bar, the Status column words and the
  inspector's sections.
- **`document`** gains the now-step badge, the due/paid tag, the spine (earlier pass, the rewind
  labels, Now, the expectation), the job banners and "retrying automatically", and the composer.
- **The call center namespace** gains one key per sentence shape (with slot tags), the ledger labels,
  the caller bar, "N open requests · View" (plural) and the linked-request detail.
- **No new namespace.** Every key is added in the same change that uses it.

## Testing Decisions

- **A good test checks behaviour through the module's public interface**: given rows, events or
  stored strings, what comes out. It never asserts on internal state, class names or the DOM
  structure of a component. A test should survive a refactor that keeps the behaviour.
- **No new runner tier.** This spec does **not** bootstrap React Testing Library. Spec 083's ruling
  stands: the logic lives in pure modules, the components are thin renderers, and the UI is verified
  by driving the app.

**Tier 1: vitest, pure and in-memory** (the existing `src/**/*.test.ts` runner). Each item is a pure
module the step extracts so it can be tested here.

| Module | What the tests pin |
|---|---|
| Command registry (`@/core/commands`) | Refuses collisions, reserved keys (Alt, other Ctrl chords, AG Grid keys) and `keys` on a `terminal` command. Legends derive from `event.code`. `terminal` rows sort last and are never auto-highlighted. Disabled rows carry their reason. |
| Fire-tier decision | One pure function of (key event facts, focus kind, dialog open, switch, composing) → fire or not. It covers the three tiers, `defaultPrevented` skip, Meta = Ctrl, Shift only for `?`, and the Arabic layout case (`event.code` matches when `event.key` is Arabic). |
| Palette composition | Group order. Each group's gate. **Fail closed on pending or errored probes.** Jump rows from a typed number. Print-route opt-out. |
| Recent store | Newest first, capped at 5, numbers only. A malformed store reads as empty. Re-filtered by grants. |
| Timeline derivation (`@/core`) | Each reached rule. Pick-in-store skips Out. Cancellation replaces the next step and drops the later ones (R, C, N, X). Rewind markers. Log-time selection (the latest matching row, none → no time). Inspector-variant times from row fields. `deliveryWindow()` for the expectation. The due/paid tag. |
| Feed ordering | The newest-first merge of Log and jobs, Log first on a tie. Struck earlier passes. Only lifecycle steps can be superseded. |
| Lenses and counts | Each lens predicate. Counts ignore column filters. "—" before a search, "N+" when cut. |
| Saved-view store | Per-user keying. Defensive parse. The one-time layout-only import, which never writes the old key. Relative date resolution. Drift detection (criteria, lens, columns, filters). Unique names. The default. |
| Inspector width | The clamp (320–560, 40% of the viewport). Arrow and Home/End steps. Reset. Defensive parse. |
| Call center sentence model | The shape per mode. The slot look per state (settled, blocked from `submitBlockers`, ghost, readout). The mode flip drops the address and window. The store readout on delivery. |
| Bidi formatting | Ranges, pairs and `n / m` formatted to one string. The FSI helper wraps whole values. The helper is never applied to export values. |

**Tier 2: node lint gates** (`npm run lint`).

- `check-contrast` gets 362 §7's pair changes, plus the **negative assertion that gold on `--card`
  stays below 3:1 in light**. Its dark-block match accepts indentation (F19).
- **A new grid gate** refuses any file that mounts `<AgGridReact` without the core base
  `defaultColDef` (F25). It sits beside the import-boundary gate.
- `check-palette` keeps exempting the printed documents.

**Tier 3: Playwright drives** (`tools/*-drive.mjs`, envelopes stubbed at `api.ts` to the shapes the
reads return today). One drive per step, each run in **light, dark and RTL**:

| Step | Drive checks |
|---|---|
| S1 | Rail collapsed and expanded, the flyout, the marker flush on the inline-start edge, narrow overlay, the phone drawer, the store chip unset tone, toasts at bottom-end in both directions, a dialog failure inside the dialog, every grid mirrored under RTL with the pinned ID at the reading start, isolated values, a dark-mode print of a print route reading light (joins `collection-print-drive.mjs`). |
| S2 | Ctrl+K from a text box and from a grid cell, inert under a dialog, absent on print routes. Esc layering. Letters ignored in fields. The switch off. A refused key toasting. The help sheet listing the mounted commands. The console's palette from an Arabic layout. |
| S3 | Lenses and counts, the cut line, a saved view running its search, the default running on open, the modified dot, delete + undo, + Filter's 14 criteria, unapplied-edit flags, J/K moving the inspector without a request, Enter opening, R/C/N deep-links, `I`, the separator keys, the empty states over a mounted grid, Ctrl+C on cell text, and Enter in a token popover **not** bubbling into Enter-opens. |
| S4 | The spine order, the struck earlier pass, indigo vs red, one banner per `F` job, the `P` line, the composer post, Esc refused with unsent text, and the `open` intent consumed once, refused with a ring, and not re-fired on reload or Back. |
| S5 | Ctrl+Enter inert under a dialog and toasting its refusal. |
| S6 | The caret on `cc-phone` at open and after remove, Tab order through the sentence, Enter/Esc on a word, an Arabic name whole in LTR and RTL, the centre width unchanged across attach, and sign-up and the linked-request detail in the flow. |

- **Prior art:**
  - **Pure tests:** `palette-model.test.ts`, `header-chips.test.ts`, `rail-view.test.ts` and
    `slot-view.test.ts` in the call center; the collection inquiry's criteria/columns tests.
  - **Drives:** `command-palette-drive.mjs`, `palette-drive.mjs`, `document-detail-drive.mjs`,
    `document-rtl-drive.mjs`, `grid-theme-drive.mjs`, `callcenter-drive.mjs`, `sim-rtl-drive.mjs`,
    `collection-print-drive.mjs` and `tools/screen1-smoke.mjs`.
  - **The prototype drives** on the map's branches (`proto-362-contrast`, `proto-363-shots`,
    `proto-373-shots`, `proto-377-shots`, `proto-378-shots`, `proto-378-glob`) hold the measurements
    to reuse.
- **Every step also passes** `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.

## Out of Scope

- **The login page layout.** The Editorial Split stays and only inherits the foundation colours.
- **Reworking any screen other than** the Deliveries list, Delivery details and the call center.
  Simulation is rethemed only. Every other screen inherits the foundation, the keyboard layer and
  the breakage sweep.
- **Adopting shared page-header, toolbar and empty-state pieces on the other screens.** These are a
  later effort.
- **Far's Simulation redesign:** the price waterfall, the permanent inputs pane, the single-select
  results list and the three-pane layout.
- **Server-stored or shared saved views.** These need a new BackOffice entity, table and endpoints.
- **App-level actions in the palette** (toggle theme, switch store, sign out).
- **J/K next/previous delivery on Delivery details.**
- **Bulk or "retry all" on jobs.** Retry is always one job per click.
- **Any total count from the server** for the list or the lenses.
- **A live language switch.** Changing language reloads.
- **Reviewed Arabic copy.** The prototypes' Arabic shows the mechanism only.
- **The printed documents' look**, including 312's A4 red-box check, which stays spec 308's.

## Further Notes

### Later spec tickets, blocked on BackOffice (not S1–S6)

1. **Retry job** (370). This is a grant-gated Retry per `F` job on Delivery details, behind a confirm
   naming the outside system, job, attempts and last error, with an optional note. It re-reads Jobs
   and the Log after a "queued" response, and handles the `NOT_FAILED` business refusal with
   `apiErrorCode`. The OMS access probe gains the retry-grant field, and the button **fails closed**
   on it. The operator lead accepts it (R2).
2. **Palette live search** (374, 376). It is a `quickFind` in a core OMS API, with a 250ms debounce,
   `signal` cancellation, and gating on **both** OMS grants (fail closed).
   - **Matching:** delivery, document and order number are exact or prefix (≥4 chars). The mobile is
     **exact across its stored formats** (`05…`, `9665…`, `+9665…`). No suffix, never by name.
   - **A hit row:** delivery no. (mono), the status pill from D1 over the hit's row fields, the
     store, the entry date and a matched-on tag. **No name, no phone, never the OTP.**
   - Opening a hit goes through Details' own gate.
   - **There is no flagged stub.** The group doesn't exist until the route exists.

### BackOffice asks

The owner chose to list these here. They are **not yet filed** in BackOffice's tracker.

| Ask | Shape | Blocks |
|---|---|---|
| **BO-1 Web-door retry** (370) | A twin of `SdOutbox/Run` with its own `BackOfficeScreen[<controller>,03]` grant (the first per-command grant on the OMS door). A conditional `UPDATE … SET Status='P', NextAttemptTime=now WHERE OutboxId=@id AND Status='F'`, so the worker runs it. **One shot** (attempt count and deadline unchanged). One `SdDocumentLog` row in the same transaction (a new 4-letter action type, `entryUser` = the operator, `actionData` = outbox id + handler, `note`). A `NOT_FAILED` business refusal. **Confirm first** whether `SdOutboxProcessor` checks the deadline and attempts before the run or only on failure. | Retry |
| **BO-2 `DeliveryQuickFind`** (374, 376) | Gated by both OMS grants. Static `TOP 8` branches by the term's shape: delivery-number prefix on the PK, document-number prefix on 028, order-number prefix on a new `IX_DeliveryHeader_OrderNo`, and `CustomerPhone IN (@local, @intl, @plusIntl)` on a new `IX_SdDocumentCustomer_CustomerPhone`. The payload is `deliveryNo · documentNo · orderNo · storeCode · entryTime · matchedOn` plus the status fields, with **no name and no phone**. Two DBA-run `ONLINE` indexes, about 1.5 dev-days. **Pre-build checks:** is 028 applied in prod, does an unscripted phone or OrderNo index already exist, and what is the histogram of phone formats at rest. | Live search |
| **BO-3 `slot.date`** (373) | The slot's day on the call center session header. | Nothing. The sentence words the window only until it lands. |
| **BO-4 Milestone times** (369) | Expose `SdDocumentHeaderAction`'s milestone times (Ready, OutForDelivery, Delivered, CloseRequested, Closed, ReturnedBack, Rescheduled) on `SdDocumentHeaderModel` and `DeliveryDocumentModel`. | Nothing. When they land they replace the Log derivation on both surfaces (D1). |

### Prototype branches (they never merge)

The branches hold the measured prototypes. Read them, never merge them:

- `prototype/377-overlays` (`9e5bf95`), which also keeps 362's `da08890` and 363's `acd5564`
  reachable;
- `prototype/378-rtl` (`18dd9cd`, `4f3bc5b`);
- `prototype/379-cc-rail` (`36d6be9`), which also keeps 373's `bdc24e7` reachable;
- `prototype/theme-directions-355`, the cancelled theme map.

⚠ **Three prototypes have no branch.** Their branches were deleted and their commits are
**unreachable**, so `git gc` will eventually remove them:

- 368's list: `9b7f32c`;
- 371's details: `fb1416b`, plus variant D, the owner's pick, at `bf0754d`;
- 372's waterfall: `d2ed834`.

Re-create refs on them before building S3 and S4 if their code is wanted.

### Owed before or at sign-off

- **The operator lead's acceptance:**
  - S3: the starred default runs on open.
  - S6: the console joins the shell and the caller bar replaces the rail.
  - Later: Retry.
- **A check on `main`:** the 362/363 prototype base logged React "Maximum update depth exceeded" on
  Deliveries (378). Confirm it is not on `main` before S1.
- **The Arabic copy** in every new key needs a reviewer before Arabic ships. Each S-step re-drives
  RTL on its own values.

### Domain vocabulary

`CONTEXT.md` already holds **Delivery timeline**, **Reached**, **Rewind**, **Milestone time**,
**Delivery inspector**, **Lens** and **Saved view**. No new terms are needed. **Delivery inspector**
is kept apart from the IDoc Inspector screen.
