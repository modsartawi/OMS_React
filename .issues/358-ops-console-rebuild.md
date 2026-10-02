---
type: wayfinder-map
status: open
---

# 358 — The Ops Console rebuild

## Destination

One `status: ready` spec, consumable by `/to-tickets`: **the Ops Console foundation** (colours,
type, density, AG Grid look, rail shell, Ctrl+K command palette, keyboard shortcuts) applied to the
**whole app**, plus full redesigns of **four screens**: Deliveries list, Delivery details, Simulation
and the Call center console. *Amended by [The Simulation price waterfall](372-the-simulation-price-waterfall.md):
Simulation is a **retheme only**, so its spec 110 arrangement stays whole and three screens are
redesigned.*

Reached when that spec is `ready` and no decision blocks the build.

## Notes

**Domain:** oms-react back-office (see `CONTEXT.md`).

**The reference is the "Far — Ops Console" prototype:** [prototype file](assets/358-ops-console-prototype.html),
also published privately at https://claude.ai/artifact/SDwMbJ2aSY8WHwacZY8yYW. Pick **Far** in
the direction switch. The **Adoption notes** drawer gives the effort for each screen. All data in
it is fictional, and its markup is something to react to, not production code. The Near and Mid
directions in the same file were rejected.

**Owner rulings already taken (charting session, 2026-10-02).** These are premises, not open
questions:

- **The direction is Far — Ops Console:** a navy `#002554` rail and the gold `#FDC801` signal
  (al-dawaa brand), with a dense, keyboard-first console. It supersedes the theme map 354, which
  was cancelled (`wontfix`). That map lives only on branch `prototype/theme-directions-355`.
  Numbers 354–357 are taken there, so this map starts at 358.
- **Scope:** the foundation is for every screen, but only the four screens above are reworked.
  Every other screen inherits the foundation and nothing more.
- **Carried forward from cancelled 355:**
  - All **14 delivery filters stay reachable**, and **applied filters stay visible**.
  - **Native cell text selection and Ctrl+C** work in grids (`enableCellTextSelection` +
    `ensureDomOrder`).
  - **AG Grid Community only**; no Enterprise features.
- **Simulation and Call center are ticketed now**, not left in the fog (owner, at charting).

**Prior art to read, not to repeat:**

- The shipped POS design system: [082](082-pos-design-system-spec.md), from map
  [068](068-pos-palette-and-document-detail-rework.md). It sets today's tokens.
- The Document Details rework: spec [083](083-document-details-rework-spec.md).
- The Simulation rework: map [097](097-simulation-screen-rework.md).
- The web call center: map 126.
- BackOffice 464, the "Inter everywhere" type ruling.

Code to start from:

- `src/app/global.css` and `src/core/theme/ag-grid-theme.ts`
- `src/layout/AppShell.tsx` and `src/layout/menu-model.ts`
- `src/features/callcenter/console/CommandPalette.tsx`
- `src/features/oms/deliveries/ViewManager.tsx`

**Skills:**

- `/grilling` + `/domain-modeling` for grilling tickets.
- `/prototype` for prototype tickets, done in the live app (`npm run dev`) where possible, in both
  light and dark.
- `/research` for research tickets.
- `ui-ux-pro-max` for visual judgement.

**Standing rules** (`.claude/rules/`): zero-literal i18n, logical Tailwind (the shell must mirror in
RTL), and feature boundaries. Anything shared, such as a command registry, graduates to `@/core`,
and features never import features.

**Plan, don't do.** Tickets produce decisions. No production code lands from this map.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [Which type family the Ops Console uses](359-which-type-family-the-ops-console-uses.md) — all IBM
  Plex, which overturns 464 ([ADR 0003](../docs/adr/0003-the-ops-console-sets-type-in-ibm-plex.md)):
  Plex Sans for UI and grids, Plex Mono **for IDs and codes only** (money stays sans), and Plex Sans
  Arabic replacing Readex Pro. 12px legibility is checked in the colours ticket.
- [How the Ops Console reaches main](361-how-the-ops-console-reaches-main.md) — stepwise on `main`,
  with no flag. The steps are: foundation (tokens + Plex + grid look + **rail shell** in one merge,
  plus a breakage sweep of the other screens) → keyboard layer (registry, Ctrl+K, shortcuts) →
  Deliveries list → Delivery details → Simulation → Call center. The owner signs off every step;
  an operator lead also accepts any behaviour change.
- [What the delivery reads give us](360-what-the-delivery-reads-give-us.md) — **no total count**: the
  list is a bare `TOP @Limit`, and `rows.length === Limit` means only "may be more" (rows do carry
  `failedJobsCount`). The **details header is heavy**, so the inspector can't fetch it on every J/K
  step. **Retry exists only as the API-key `SdOutbox/Run`**, which is not idempotent and records no
  operator. ([research](assets/360-delivery-reads.RESEARCH.md))
- [How a delivery's state maps to timeline steps](369-how-a-deliverys-state-maps-to-timeline-steps.md)
  — the backend's lifecycle, **Created → Ready → Out for delivery → Delivered** (pick-in-store skips
  Out). Payment is a header **due/paid tag**, not a step. A cancellation **replaces the next step**:
  requested (final; **indigo**, amended from amber by [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md))
  or cancelled (red), with later steps dropped. A rewind shows the current
  position plus a marker, and the full path lives in the feed. Times come from the latest matching
  Log row on Details and from row fields on the inspector, never from `statusHistory`. **BackOffice
  ask:** expose `SdDocumentHeaderAction` milestone times. A failed job is a banner, never a step.
  ([evidence](assets/369-delivery-state-sources.md))
- [What the Ctrl+K palette holds and how features add to it](364-what-the-command-palette-holds.md)
  — **one app-wide palette**, hosted at `ProtectedLayout`, with print routes opted out.
  - **Five groups:** This screen, Recent (the last 5 numbers per user), Go to (the same
    `useVisibleMenu`), Jump to number (straight to the route, no read), and **live search** on
    delivery, document or order number and mobile, never name.
  - **Every row follows its screen's grant.** Jump needs `canOpenDetail`, search needs both OMS
    grants, and pending probes fail closed.
  - **Mechanism:** `@/core/commands` holds the palette and registry, pages call `useCommands`, and
    `layout/` composes the app-wide groups.
  - **Refused acts** are disabled rows carrying their reason.
  - **The call center joins**, keeping its safety rule as a generic `terminal` flag.
  - The search's read: [What read backs the palette's live delivery search](374-what-read-backs-the-palettes-live-delivery-search.md).
- [What the inspector shows for a selected delivery](367-what-the-inspector-shows-for-a-selected-delivery.md)
  — **row fields only, no fetch**, so J/K is free. Items, Log, Jobs and Retry stay on Details, and
  the failed-jobs banner is just the count. Never `customerOtp`.
  - **Read-only:** Reschedule, Request cancellation and Add note (and R/C/N) **deep-link** to
    Delivery details through one-shot router state, which opens the dialog through Details' own
    gate.
  - **Width:** collapsible and **drag-resizable**: 360 px default, 320–560, at most 40% of the
    viewport. The keyboard separator sits on the inline-start edge, and width + open/closed are
    remembered. The grid takes the width back.
  - What the inspector and Details share is the **pure timeline derivation** in `@/core`, not a
    component.
- [Retry job: drop it or ask BackOffice](370-retry-job-drop-it-or-ask-backoffice.md) — **ask
  BackOffice** for a safe web-door twin of `SdOutbox/Run`: its own grant, `F` only, a conditional
  `F→P` re-queue that the worker runs, **one shot**, and an `SdDocumentLog` row naming the operator.
  It acts on one job per click, behind a confirm with an optional note. **Details ships with the
  failed-job banner and no button**; Retry is a later spec ticket, blocked on BackOffice and visible
  only to grant holders. The ask is filed at `/to-spec`.
- [Keyboard shortcuts that work for everyone](365-keyboard-shortcuts-that-work-for-everyone.md) —
  **a key is a field on a `useCommands` command**: one registration binds the key, labels the
  palette row and feeds the help sheet.
  - **Registry:** collisions and reserved keys (Alt, other Ctrl chords, AG Grid's keys) are refused.
  - **Single keys** exist on the Deliveries list and Delivery details only, behind a per-user
    switch that defaults to on.
  - **Three tiers:**
    - chords work from anywhere but not under a dialog
    - Esc goes to the topmost layer
    - single keys only fire when nothing is being typed or edited
  - **Matching:** `event.code`.
  - **Acts only open,** and a refused key toasts its reason. No key writes.
  - **Call center:** 153 stands whole. `terminal` commands can't carry keys.
  - **Discovery:** palette hints, tooltips, and a generated sheet.
- [Deliveries views and their counts](366-deliveries-views-and-their-counts.md) — a view is two
  things.
  - A **lens** is built in and narrows the **loaded rows**: All, Needs attention, Cancellation
    requested, Dawaa Now, Rescheduled.
  - A **saved view** holds the criteria (dates relative), a lens, the columns and the grid filters.
    Applying one runs its search.
  - **Counts** are the loaded rows each lens matches, and they ignore column filters. Every count
    reads "7+" when the page hit its limit and "—" before a search. There is no BackOffice count.
  - Saved views are **per user** in localStorage keyed by user id, with no shared views. Old
    Angular-key views are imported once as layout-only.
  - **Lifecycle:** one starred default applies and runs on open, which the operator lead accepts.
    A modified dot shows drift. The actions are Update, Save as new, Rename, Default, and Delete
    (undo from the toast).
  - Both terms are in `CONTEXT.md`.
- [Ops Console colours, density and grid look](362-ops-console-colours-density-and-grid-look.md) —
  **palette B, "Navy-led"**, picked live over today's steel and Far as drawn.
  - **Neutrals and accent:** neutrals take the navy's temperature, and the accent is the navy
    lifted (`#0F4C9C` / `#79A7EC`), not a cobalt. 082's status families carry over unchanged.
  - **Brand:** a navy `#002554` rail. Gold is a signal only: on navy, as a fill with navy ink, or in
    dark. It is 1.56:1 on white.
  - **Selection and focus:** the cursor bar is navy in light and gold in dark, and so is focus. The
    field edge rises to 3:1 (today it is 1.47:1).
  - **Density:** 26px rows, Plex at 12px (legible at 1× in both modes), 6px controls (no more
    pills), 8px cards.
  - **The lint-gate pair changes** are listed in the ticket.
  - **Handed on:** a `--sidebar`→`--rail` rename and the CustomerRail/link-ink consumers go to the
    rail ticket, and the dark identity band that clashes with the rail goes to Details.
- [Printed output under the Ops Console tokens](375-printed-output-under-the-ops-console-tokens.md)
  — **The two printed documents (voucher and ACR) are already immune to B.** They use literal ink
  and Tahoma, under the `check-palette` exemption, and need no print scope or sign-off.
  - **Dark becomes screen-only.** The `.dark` block and the variant move under `@media screen`, so
    paper always gets light B from one copy of the values. That fixes today's pale-ink print of the
    print-route states in dark mode.
  - **The rail and top bar take `print:hidden`**, which goes to the rail ticket and foundation
    step 1.
  - **Print routes opt out of Ctrl+K** through an explicit route flag, not through `chromeless`.
  - **Visible-change sign-off list:** the chrome only. ([research](assets/375-print-surfaces.RESEARCH.md))
- [What read backs the palette's live delivery search](374-what-read-backs-the-palettes-live-delivery-search.md)
  — **not the list read**: it matches exactly only, and its catch-all `TOP … ORDER BY DeliveryNo DESC`
  walks all of `DeliveryHeader` on every keystroke.
  - **The ask:** BackOffice builds `DeliveryQuickFind`, gated by **both** OMS grants. It runs
    static `TOP 8` branches by the shape of the term:
    - delivery-number prefix on the PK
    - document-number prefix on 028
    - order-number prefix on a new index
    - the **exact mobile across its formats** on a new index
  - **The cost:** about 1.5 dev-days plus two DBA-run indexes.
  - **The suffix is out:** a suffix match needs a `REVERSE()` column on 20.9M rows and pulls in
    strangers, so the research recommends dropping it. That is the owner's call in
    [What the palette's live search matches on and shows](376-what-the-palettes-live-search-matches-and-shows.md).
  - **A hit** carries the row's status through 369's derivation, with no detail read. Until the
    read ships, Jump to number covers exact numbers.
    ([research](assets/374-palette-search-read.RESEARCH.md))
- [The Simulation price waterfall](372-the-simulation-price-waterfall.md) — **no waterfall, and
  Simulation is a retheme only.** The owner turned down all three placements on the live app
  (inside the expansion, above the cards, Far's pane).
  - **The line expansion stays as 116 shipped it** (money foot, rule cards, trace), restyled by the
    foundation only.
  - **Spec 110's arrangement stays whole:** chip strip, Items, the 66/34 split, expand in place and
    the rail. Far's inputs pane and selected-line pane are not adopted, so 361's Simulation step is
    the foundation plus 365's Ctrl+Enter guard and the palette.
  - **Kept for later:** the facts the prototype measured. Conditions alone foot on all 17 priced
    lines. SAP's "Gross Value" subtotal is really net. A basket axis fails. RTL needs isolated
    amounts. ([prototype branch + shots](assets/372-shots/))

- [The rail shell](363-the-rail-shell.md) — **D, an expanding navy rail, collapsed by default**:
  56px group icons with navy flyouts (Far's look), one click pins a 240px labelled tree, remembered
  per user. The owner picked it live over A (icon rail), B (labelled rail) and C (docked panel).
  - **Gating:** groups come from `useVisibleMenu`, so gating is unchanged.
  - **Marker:** a gold `::before` on the inline-start edge.
  - **Top bar (44px):** crumb, then the Ctrl+K field from the keyboard step, then a **store chip**
    (out of the account popup, attention tone when unset) and the bell.
  - **User menu** at the rail foot, holding theme, shortcuts, sign out and the build stamp. **The
    footer row goes.**
  - **Broadcast** stays an Admin leaf.
  - **The call center joins the shell** (rail collapsed) in its own step.
  - **Narrow:** always collapsed, overlaying under 1280px. A drawer under 640px.
  - **Tokens:** `--sidebar*`→`--rail*`. CustomerRail → `card-2`, link ink → `primary`, and the rail
    and top bar take `print:hidden`.
  - **Found:** the grid did not mirror under RTL.
    ([prototype branch + shots](assets/363-shots/))

- [The Call center order header as a sentence](373-the-call-center-order-header-as-a-sentence.md) —
  **D, a sentence over a ledger**, picked live from four variants in the real console.
  - **The sentence** holds what the agent says to the caller: `‹Deliver› to ‹address› for ‹caller›
    from ‹store› at ‹window›, ‹payment›.` (collection: `‹Collect› from ‹store› for ‹caller›, …`).
  - **The ledger** under it labels the bookkeeping: Source · Ref · Coupon · Note.
  - **It replaces `ChipRow`**, and `header-chips.ts` stays the model.
  - **Editing:** every slot opens today's in-flow section (no popovers). Tab, Enter and Esc were
    measured, the palette verbs open the same section, and 365 holds.
  - **Bidi:** each value is isolated: `<bdi>` for names and `Ltr` for codes and time windows.
  - **RTL:** one key per sentence shape, using `<Trans>` named slots (verified), with no clitic
    glued to a slot.
  - **Found:** `Ltr`'s rule misses ranges. The shipped slot chip reads `21:00–18:00` in RTL, which
    goes to [The foundation in Arabic/RTL](378-the-foundation-in-arabic-rtl.md).
  - **BackOffice ask:** `slot.date` on the session header, filed at `/to-spec`.
  - **The rail** is now its own ticket:
    [Does the Call center customer rail collapse into a caller header?](379-does-the-call-center-customer-rail-collapse-into-a-caller-header.md)
    ([prototype branch + shots](assets/373-shots/))

- [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md) — **A, three panes**,
  picked live over B (grid first) and C (labelled criteria panel).
  - **Layout:** rail · 220px views rail · centre · 367's inspector. At 1280 the grid keeps ≈644px.
  - **Views rail:** the lenses with counts, then my views (star, `layout` tag, modified dot, ⋯
    actions).
  - **Centre:** a query bar, then a grid bar, the grid and a key-hint status bar.
    - The query bar holds the tokens and **+ Filter** with all 14 criteria (Date is one relative
      range), the **Limit token, always shown**, the unapplied edits flagged amber with
      "N changes not searched · Discard", and Search.
    - The grid bar holds "N of M shown" and the cut line.
  - **Grid:** a new derived **Status** column, selection follows focus, and the grid stays mounted
    under its empty states.
  - **Palette:** lenses and saved views join This screen as rows, with no keys.
  - **Amends 369:** *Cancellation requested* is **indigo**, and amber stays for attention.
  - **Amends 365:** **`I`** toggles the inspector.
  - **Found:**
    - A key a control has handled stays owned (`defaultPrevented`).
    - Enter-opens belongs on the grid's `onCellKeyDown`.
    - The inspector's slot and courier values need bidi isolation, handed to 378.
    ([prototype branch + shots](assets/368-shots/))
- [The Delivery details record page](371-the-delivery-details-record-page.md) — **C's spine with B's
  command bar** (variant D), picked live by the owner.
  - **Header:** a light card, no dark slab. It carries the now-step badge, the due/paid tag and
    All statuses. **083 D-10's command bar is unchanged** beneath it: nothing hidden, no More menu.
  - **Spine:** the timeline and Log + Jobs are **one newest-first list**: future steps, then the
    **Now line with the note composer**, then the past. Milestones, struck-through earlier passes,
    amber rewinds, and Cancellation requested in **indigo** (per 368).
  - **Beside the spine:** facts, items, and folded conditions. The tabs and the summary rail are
    gone.
  - **Jobs:** one banner per failed job with no Retry button (room is left for one). A `P` row
    reads "retrying automatically".
  - **Notes:** the composer amends 083 D-11 **for Add note only**.
  - **The `open` intent** goes through `commandBar`'s gate. A refused one shows a ring plus its
    reason.
  - **Found:** the step expectation must reuse `deliveryWindow()`, because a live capture has
    from = to.
  - **Default:** a cancelled delivery keeps evidence-only gating.
    ([prototype branch + shots](assets/371-shots/))

## Not yet specified

<!-- the notifications/toasts/dialogs and Arabic/RTL patches graduated into 377 and 378 -->

## Out of scope

- **The login page layout.** The Editorial Split stays, and the page only inherits the foundation
  colours. The owner didn't add it at charting.
- **Reworking any screen other than the four.**
- **Adopting shared page-header, toolbar and empty-state pieces on the other screens.** The other
  screens get the foundation plus a breakage sweep, nothing more. The pieces move up into `@/core`
  only as the four screens need them, and adopting them elsewhere is a later effort
  ([How the Ops Console reaches main](361-how-the-ops-console-reaches-main.md)).
- **Building.** Production code belongs to the spec's tickets.
- **Server-stored and shared saved views.** SIS.Api has no preference store, so this needs a new
  BackOffice entity, table and cookie endpoints. The destination keeps saved views per user in the
  browser, and syncing or sharing them is a later effort
  ([Deliveries views and their counts](366-deliveries-views-and-their-counts.md)).
- **Far's Simulation redesign:** the price waterfall, the permanent inputs pane, the single-select
  results list and the three-pane layout. The owner kept spec 110's shipped arrangement, so
  Simulation inherits the foundation like any other screen
  ([The Simulation price waterfall](372-the-simulation-price-waterfall.md)).
