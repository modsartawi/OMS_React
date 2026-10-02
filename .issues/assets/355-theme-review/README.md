# Three visual directions for Delivery Documents Inquiry

Throwaway prototype for [Choose the app theme through three visual directions](../../355-choose-the-app-theme-through-three-visual-directions.md), captured on 2026-10-02. **Awaiting owner feedback; no visual direction is approved.**

## Run and review

On branch `prototype/theme-directions-355`, run `npm run prototype:theme` and open:

- [A · Steel](http://127.0.0.1:5198/oms/deliveries?variant=A): grouped filter card, familiar steel palette, separate results toolbar.
- [B · Cobalt](http://127.0.0.1:5198/oms/deliveries?variant=B): persistent filter rail, cooler palette, stronger separation of controls and results.
- [C · Graphite](http://127.0.0.1:5198/oms/deliveries?variant=C): compact query strip, larger scope counts, warm neutral surfaces and restrained green-grey accents.

The floating bar changes the variant, light/dark mode, and RTL. These are URL parameters (`variant`, `mode`, `dir`), so links survive reload. Arrow keys cycle variants outside interactive controls and the grid. The real shell's theme button also updates the prototype URL without storing a theme preference.

All variants use the real AppShell, shared Button and StatusBadge, AG Grid Community, 28px rows, and the same 48 fictional deliveries. Grid sorting, floating filters, horizontal scrolling, pinned identity, row selection, the column chooser, sample search, scope filters, and a local detail preview are interactive. The palette strip shows the active token values. Command-family specimens are disabled; prescription and provenance retain distinct meanings.

The dedicated Vite configuration intercepts every `/api/` request, including writes; it never forwards these requests to SIS.Api. The regular server's authentication remains unchanged. Only development builds can load the variant renderer. No production rollout is part of this ticket.

## Captures

| Direction | Light | Dark | Narrow viewport |
| --- | --- | --- | --- |
| Steel | [View](A-light.png) | [View](A-dark.png) | [View](A-mobile.png) |
| Cobalt | [View](B-light.png) | [View](B-dark.png) | [View](B-mobile.png) |
| Graphite | [View](C-light.png) | [View](C-dark.png) | [View](C-mobile.png) |

[Steel, dark, RTL](A-dark-rtl.png) verifies the mirrored shell and identity at the grid's inline start. The page remains English; time-slot content is isolated LTR so its range does not reverse.

## What this comparison can settle

Choose a palette and a composition independently, or choose one direction whole. The agent's recommendation is **C's compact composition with A's steel palette**: it preserves the familiar palette and gives the data more vertical space. This is a recommendation, not the owner's answer.

B reserves 210px for filters, making repeated searches easier to reach but reducing horizontal grid space. At a narrow viewport its filters move above the grid. C removes the filter card and lets status colours stand out against quieter neutral surfaces. A changes the least from the current application.

The columns and combined status are illustrative fixtures, not a proposed replacement for the production list's 41-column contract or its multiple domain status fields. The fuller shared-state and component review belongs to the dependent visual ticket. This study does not establish loading/error/empty-state styling across the app or settle rich-row density.

## Verification

- `npm run build` (includes TypeScript): passed; the existing large-chunk warning remains.
- `npm run lint`: passed, including the existing 129-pair contrast gate.
- `node tools/theme-prototype-drive.mjs`: 38 browser checks passed; [results](verification.json).
- Browser checks cover all six desktop variants, 28px rows, horizontal overflow within the grid, row selection, four key text/action contrast pairs per view, sample filters, column visibility, keyboard ownership, detail preview, switcher/reload, RTL pinning, shell mode synchronization, no persisted theme setting, and all three layouts at 390px.
- Captures were visually inspected. No browser errors. React Router's hydration-fallback warning and the shell's duplicate-query warning are recorded in the results; neither is introduced as a design decision.
- The driver follows the repo's existing Playwright arrangement in `C:/Playground/frontend` and uses installed Edge. It is a manual review tool, not a new test-suite dependency.

## Pending feedback

Which layout and palette should continue, and which pieces need refinement? Keep the decision ticket claimed until the owner supplies that answer. Do not infer approval from the existence of these captures.
