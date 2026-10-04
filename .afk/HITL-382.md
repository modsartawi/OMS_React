# HITL-382 — unattended decisions, ticket 382 (the grid look)

## Q: Where does native copy (F9) live — per-grid props or the shared options?
**Decision taken:** One `provideGlobalGridOptions({ enableCellTextSelection: true, ensureDomOrder: true })` call in `@/core/theme/ag-grid-theme.ts`, at module load. No grid carries per-grid props.
**Why:** Spec F22 already puts the global hook in core theme (scalars only); every one of the 21 grids imports that module, and a global option cannot be forgotten by one grid. The call REPLACES the global object (verified in ag-grid-community 36), so the comment names it the app's ONE call and 383's `enableRtl` must join the same object.
**Revisit if:** 383 wants copy inside its base `defaultColDef` instead. These two options are grid options, not column options, so they cannot live in a `defaultColDef` at all.

## Q: Which columns count as "IDs" for Plex Mono?
**Decision taken:** Exactly the ticket's list — delivery, document and order numbers and store codes — on every grid that shows one. That means Deliveries (Delivery no. at 600, document no., order no., store code), the central-invoice list (store) and result (delivery no.), both Change Store grids (store, temp store, insurance store), Assignment, Attempts, Collections and Ready (store), Retail invoice (store), Loy Sales (store) and Loy Actions (`branchId`, a bare store code). Other numbers keep what they already had.
**Why:** It is the ticket's list. 359's wider "IDs and codes" is already mono wherever the earlier tickets chose it.
**Revisit if:** the owner wants every code column (payer and provider codes, BBY number, condition reference) set in mono too.

## Q: Is the Delivery no. at 600 everywhere, or only on Deliveries?
**Decision taken:** Only on the Deliveries grid. There it is the row's own key, and 362 §6 measured it there. On the central-invoice grids the delivery no. is mono at 400.
**Why:** It is the narrowest reading of "The Delivery no. is mono 600".
**Revisit if:** S3's list redraw or the owner wants the 600 weight wherever a delivery no. appears.

## Q: New ID cells use `font-mono`, while older ones read `font-mono text-[12px]` — unify them, or add a shared constant?
**Decision taken:** New cells take bare `font-mono`, as the ticket spells it. The 31 existing `font-mono text-[12px]` sites are left as they are. No shared constant.
**Why:** The grid's `fontSize` is 12, so both spellings render the same. The column modules are vitest-tested in a node environment, and `ag-grid-theme.ts` touches `document` at load, so a constant there cannot be imported by them. Sweeping 31 shipped sites is outside this slice.
**Revisit if:** a later ticket (383's base `defaultColDef`, say) gives ID columns a core home. That would be the place for one constant.

## Q: Open Settlements keeps 44px lane rows — an exception to "every grid at 26px"?
**Decision taken:** Kept at 44px. Its header follows the new 28px constant.
**Why:** Those rows are two lines of speech by design (`LANE_ROW_HEIGHT` in `OpenSettlements.tsx`). Cutting them to 26px would clip the second line. Every grid that uses the standard row height is at 26.
**Revisit if:** the owner wants the settlement lanes redrawn as single-line rows.

## Q: How does the drive pin a column "the user pinned"?
**Decision taken:** It calls `applyColumnState` on the grid's own api, taken from the app's AG Grid module instance through `getGridApi`. Visibility is proved by reading a screen pixel. A control run drops the bar to z-index 1 and must lose the pixel.
**Why:** AG Grid Community's column menu has no pin item, and that api call is the one that column drags and saved views make.
**Revisit if:** S3 adds a pin command to the UI. The drive should then drive that command.
