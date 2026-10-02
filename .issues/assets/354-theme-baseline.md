# Current theme baseline

Read-only code inspection on 2026-10-02 for [A coherent app theme and AG Grid](../354-a-coherent-app-theme-and-ag-grid.md). These are implementation observations, not a rendered visual audit or approved redesign.

## Existing foundation

- [global.css](../../src/app/global.css) defines semantic light/dark colors and the Tailwind bridge. Steel blue is primary, with distinct success, attention, danger, command-family, prescription, and provenance roles.
- [ag-grid-theme.ts](../../src/core/theme/ag-grid-theme.ts) maps Quartz directly to the same CSS variables. It already avoids mirrored light/dark color tables. The baseline rows are 28px and headers 30px.
- [theme.ts](../../src/layout/theme.ts) switches the app class and AG Grid mode together. Existing palette/contrast checks run through `npm run lint`.
- [The POS design system](../082-pos-design-system-spec.md) and its [completed map](../068-pos-palette-and-document-detail-rework.md) explain the shipped choices; their historical problem statements should not be mistaken for current defects.

## Concrete comparison points

| Area | Current implementation | Prototype question |
| --- | --- | --- |
| Buttons | [Shared Button](../../src/core/ui/Button.tsx) is 28px, pill-shaped, 12px text. [Delivery filters](../../src/features/oms/deliveries/FilterPanel.tsx) use a 32px rectangular Search control; [Collections toolbar](../../src/features/collection/inquiry/CollectionsToolbar.tsx) uses a 36px pill. | Which sizes and shapes are intentional variants? |
| Fields | Delivery fields use `border-input`, page background and a ring; Collections fields use a translucent weaker border and a focus-border change; grid inputs use card background and `--input`. | What common border, surface, and focus language should fields share? |
| Geometry/type | Grid wrapper radius is a literal 10px and its font stack repeats the global stack. | Which non-color tokens should be shared with the grid adapter? |
| Hover | Grid `--card-2` darkens its card in dark mode; ordinary component `--accent` lightens it. | Should these interaction treatments converge or stay deliberately distinct? |
| Surfaces | Delivery filter panel is an opaque card; Collections uses a translucent card and different radius/border strength. | Is the hierarchy meaningful or accidental? |
| Grid direction | Several older OMS grids omit the shared `omsGridDirection` spread; newer grids use it. | Include RTL in the later consistency/validation contract. |
| Density | Most grids use compact shared heights; settlement lanes deliberately use 44px rows for richer content. | Preserve content-driven density differences unless the owner selects a different rule. |
| Error signals | Deliveries uses translucent destructive colors, while shared ErrorBanner uses dedicated danger surface/border/ink tokens. | Which component idiom is canonical? |

Delivery Documents Inquiry is the first prototype host because its wide, dense grid exposes styling problems that a small specimen table hides. A component specimen strip and selected Collections/Document Details samples test whether the direction transfers.

## Design skills checked

- [Anthropic frontend-design source](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md): intentional visual direction, typography, palette, layout, and critique. Its [directory listing](https://skills.sh/anthropics/skills/frontend-design) showed approximately 945K installs and 179K repository stars when checked.
- [Vercel web-design-guidelines source](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md): reviews interface code against its current interaction/accessibility guidelines. Its [directory listing](https://skills.sh/vercel-labs/agent-skills/web-design-guidelines) showed approximately 690K installs and 32K repository stars when checked.

Both source repositories were checked. Counts are a dated discovery signal, not proof of suitability. Neither skill was installed. If installation is requested, the published commands are `npx skills add https://github.com/anthropics/skills --skill frontend-design` and `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines`; repo-local versus global placement must follow the requested scope.
