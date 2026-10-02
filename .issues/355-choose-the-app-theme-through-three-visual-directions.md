---
type: wayfinder-ticket
wayfinder: prototype
labels: [wayfinder:prototype]
map: 354
status: claimed
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
