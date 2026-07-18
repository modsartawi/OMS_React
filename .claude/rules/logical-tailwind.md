# Rule: logical Tailwind utilities only — no physical left/right

Style with **writing-mode-relative** utilities so the same markup mirrors correctly when the app
is served RTL (Arabic is a planned locale). A physical `ml-2` stays on the visual left in RTL and
breaks the layout; its logical twin `ms-2` follows the text direction.

## Use the logical form

| Instead of | Use |
|---|---|
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `left-*` / `right-*` | `start-*` / `end-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |
| `border-l-*` / `border-r-*` | `border-s-*` / `border-e-*` |

`mt/mb`, `pt/pb`, `top/bottom`, `w/h`, and symmetric `mx/px` are direction-neutral — use them freely.

## Exceptions

- A genuinely direction-independent visual (an icon that must always point one way, a chart axis)
  may use a physical utility — comment why.
- Third-party widget internals we don't control (AG Grid's own DOM) are out of scope; theme them
  through their token API, not by overriding physical classes.

## The tell

`grep` a diff for `\b(ml|mr|pl|pr|left|right|text-left|text-right)-` in `className` strings.
Any hit that isn't a commented exception is a violation.
