---
type: wayfinder-map
status: open
labels: [wayfinder:map]
---

# A coherent app theme and AG Grid

## Destination

A user-selected visual prototype and a ready theme specification for the whole app: light/dark palettes, shared component styling, and matching AG Grid appearance and interaction states. Reached when the specification can be handed to implementation without unresolved design decisions; app-wide rollout is a separate effort.

## Notes

- Owner confirmed on 2026-10-02: follow the recommendation of prototype + agreed theme specification first, comparing an improved current theme with two distinct alternatives.
- Start the visual exploration with Delivery Documents Inquiry in its existing shell, using real AG Grid. Compare controls, badges, a visible palette, and light/dark states together. Keep the existing dense 28px rows as the initial comparison baseline; any density change is a visible proposal, not an assumed requirement.
- This is an evolution of an existing central theme, not a new parallel palette. Read [The POS design system](082-pos-design-system-spec.md), [POS palette as the app standard + Document Details rework](068-pos-palette-and-document-detail-rework.md), and the [current theme baseline](assets/354-theme-baseline.md). Historical decisions remain the production baseline until explicitly superseded by the new specification.
- Skills: use `prototype` (including UI.md) for visual tickets, and `grilling` plus `domain-modeling` for decisions. Read `CLAUDE.md`, the relevant `.claude/rules/`, and `CONTEXT.md`. The glossary holds business language, not theme implementation details.
- Additional design support checked: [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) for visual exploration, and [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) for interaction/accessibility review. These are recommendations, not installed skills; consult the current sources if used. Repo requirements and the owner's choices take precedence.
- Use the existing React/Tailwind/CSS-token system and AG Grid Community. Prototype variants should differ in useful hierarchy and composition as well as palette. Preserve domain meanings, particularly cancellation, cancellation request, prescription, and provenance.
- Prototypes are throwaway, read-only visual experiments with an obvious switcher and no real mutations. Prefer the existing inquiry route under a development-only variant switch, following the prototype skill. Fixture data can make review repeatable without a backend. Capture reviewed artifacts on a throwaway branch and link them from their ticket; do not promote unreviewed prototype code to production.
- Local tracker conventions in [issue-tracker.md](../docs/agents/issue-tracker.md) define claims, dependencies, and resolution. Close a visual ticket only after the owner has reacted to the artifact; generating a prototype is not a verdict.

## Decisions so far

<!-- One title-as-link and short gist per resolved child. Charting premises are above. -->

- [Choose the app theme through three visual directions](355-choose-the-app-theme-through-three-visual-directions.md#answer): Steel palette with the compact Graphite layout, all 14 filters through an expandable panel, visible applied criteria, native text copying, and 28px inquiry rows.

## Not yet specified

Cross-screen exceptions may emerge when the chosen design meets long labels, financial figures, stacked cell content, detail command bars, or smaller viewports. Capture the specific exceptions revealed by the prototype rather than pre-designing every screen here.

## Out of scope

- Production rollout, bulk component migrations, and fixing all existing styling inconsistencies: follow the selected design and specification in a separate implementation effort.
- Backend behavior, business rules, new workflows, replacing AG Grid, or changing its licence tier.
- A full Arabic translation or localization rollout. Existing logical layout and RTL compatibility remain requirements for the proposed theme.
