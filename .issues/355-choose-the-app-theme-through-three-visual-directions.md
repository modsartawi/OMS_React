---
type: wayfinder-ticket
wayfinder: prototype
labels: [wayfinder:prototype]
map: 354
status: wontfix
blocked-by:
---

# Choose the app theme through three visual directions

## Question

Which visual direction, or combination of directions, makes the OMS inquiry screen coherent and easy to scan while retaining the working density of the current app?

Use the prototype skill to compare three variants of Delivery Documents Inquiry in its existing shell: an improved current steel-blue direction and two distinct alternatives. Present the same realistic delivery data and real AG Grid in each. Vary useful page hierarchy, filter/toolbar composition, and surface treatment as well as palette; do not produce three recolors of an identical page.

Include light/dark switching, named color swatches, shared buttons, fields, badges, grid selection and focus, and enough columns to expose horizontal scrolling and pinned identity behavior. Start with the shipped compact row density. Keep brand and domain meanings clear. The alternatives' palettes and compositions are proposals to react to, not decisions recorded in advance.

The owner should be able to select a direction or specific parts of each and identify what still needs refinement. Link the runnable prototype and review captures here. Leave this ticket claimed until that live feedback supplies the answer.

## Context

[Current theme baseline](assets/354-theme-baseline.md) records the existing tokens and concrete mismatches. The prototype is the first frontier ticket; additional skill installation is not a prerequisite.

## Comments

### 2026-10-02 — Prototype ready for owner review

Claimed for this session. Built the three visual directions on the existing inquiry route, inside the real shell, with real AG Grid and repeatable fictional data.

- [Runnable prototype, capture gallery, comparison notes and verification](assets/355-theme-review/README.md).
- Capture branch: `prototype/theme-directions-355`.
- Start: `npm run prototype:theme`; [open the comparison](http://127.0.0.1:5198/oms/deliveries?variant=A).
- Steel: grouped filter card. Cobalt: filter rail. Graphite: compact command strip and open surfaces. Each has light/dark and RTL controls.
- Agent recommendation, awaiting the owner's reaction: Graphite's compact composition with Steel's palette.

**No resolution yet.** The owner has been asked which direction or combination to retain. This ticket remains claimed, and its dependent tickets remain blocked. No production design decision or map resolution is implied by this prototype.

### 2026-10-02 — Owner feedback: copying and the complete filter set

The owner dislikes being unable to select/copy cell text and requires every production filter to remain available. The initial simplified filter set did not represent the real inquiry well enough for a decision.

Prototype refined on the same branch:

- Enabled AG Grid Community native cell text selection and DOM ordering. Browser verification includes selecting a delivery number and copying it with Ctrl+C. This is ordinary selected-text copying, not an Enterprise cell-range clipboard feature.
- Restored all 14 production criteria, retaining `DeliveryFilterCriteria` and `buildDeliveryQuery` semantics, including paired dates, description-valued selects, default limit, and tri-state Dawaa Now. Fixture matching is local and illustrative, not a new server matching contract.
- Proposed five first-row fields (From Date, To Date, Store Code, Delivery No, Customer Phone), plus a grouped expandable section for Document No, Order No, Document Type, Document Source, Delivery Document Type, Reason, Delivery Type, Dawaa Now, and Limit.
- Applied criteria remain visible as removable chips; draft changes are identified until Search; Clear all clears search criteria and grid column filters. The result limit remains visible when collapsed.
- Asked whether all 14 must be visible by default or available through expansion. No answer or theme selection inferred. Grouping and default expansion remain proposals for review.

[Updated captures and guidance sources](assets/355-theme-review/README.md). This is further work on the same visual decision, not resolution of its dependent state-consistency ticket.

## Answer

Resolved with the owner on 2026-10-02. After reviewing the three directions, raising the missing-filter and text-copy concerns, and asking for a recommendation, the owner accepted the recommendation: “yes let's go with that”.

1. **Steel's palette with Graphite's compact composition wins.** Use A's steel-blue light/dark palette with C's compact controls and full-width results area. Do not use B's permanent filter sidebar for this wide inquiry grid.
2. **Retain every production filter.** Keep From Date, To Date, Store Code, Delivery No and Customer Phone visible. Put the other nine under **All filters**, grouped by document identity, classification, fulfilment and results. The initial prominent five are the accepted starting point, subject to later evidence of operator search frequency; this does not block the theme route.
3. **Expansion is under operator control.** The remaining fields are behind All filters initially. Once opened, the panel stays open through Search and Clear all until the operator collapses it. The prototype stores this only in memory; cross-session persistence is not a requirement of this decision.
4. **Make criteria visible and deliberate.** Apply edits with Search, identify unapplied changes, retain removable applied-filter chips when collapsed, and provide Clear all. Keep the result limit visible. Search criteria choose records to load; grid column filters narrow loaded results.
5. **Allow native text selection and Ctrl+C in inquiry grids.** Preserve row selection and normal grid keyboard navigation. The Community-compatible prototype uses `enableCellTextSelection` and `ensureDomOrder`; Excel-style cell-range copying is not required. Carry this behavior into the later specification and rollout scope.
6. **Retain 28px compact rows.** Richer content and shared control geometry remain the remit of the next visual decision; this does not force every component or stacked-content row to 28px.
7. **Preserve domain meanings and the existing token foundation.** Cancellation, cancellation request, prescription and provenance retain distinct meanings. The chosen palette continues to feed both application components and AG Grid from semantic tokens.

**Primary source:** [selected runnable combination and captures](assets/355-theme-review/README.md), on `prototype/theme-directions-355`; [open the selected prototype](http://127.0.0.1:5198/oms/deliveries?variant=selected). The original three directions remain available as comparison evidence on this throwaway branch.

This resolves the visual direction, not the whole map. [Make grid and component states feel like one system](356-make-grid-and-component-states-feel-like-one-system.md) is now unblocked. Production rollout remains outside this map's destination.

## Cancelled

Cancelled 2026-10-02 by the owner: the whole theme map is dropped in favour of the Ops Console direction (new map on main). Nothing here is a production baseline.
