---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: —
---

# 364 — What the Ctrl+K palette holds and how features add to it

## Question

Today's `CommandPalette` lives inside `features/callcenter/console`. Graduating it to `@/core`
means deciding:

- **What it holds:** go to any screen (from `menu-model.ts`), jump to a delivery or document number,
  recent records, and actions for the current screen.
- **How a feature adds its own commands** without features importing features. Options: a core
  registry that a page registers into on mount, or composition in `layout/`.
- **Permission gating.**
- **The call center:** does it keep its own palette, or share the one palette with its own
  commands?

## Answer

Grilled with the owner on 2026-10-02. One app-wide palette, five groups, every row gated by the
screen it leads to, and the call center joins it.

**Facts the code settled before grilling:**

- `AppShell` already draws a gated menu via `useVisibleMenu(MENU)`.
- `/oms/delivery/:deliveryNo` and `/oms/document/:documentNo` are real routes, each with its own gate
  and not-found handling.
- `/callcenter` is mounted `chromeless`, outside `AppShell`.
- Nothing in the app records "recent" records today.

### 1. What it holds — five groups

With an empty box, the order is **This screen → Recent → Go to**. Typing adds **Jump to number** and
**live search** rows. Owner's pick: all four proposed groups, Recent included, which goes past the
recommendation to defer it.

- **This screen.** Commands the mounted page registers, such as Export view, Reschedule the
  selected delivery or Run simulation.
- **Recent.** The last 5 deliveries and documents opened through Delivery details, newest first.
  - Kept per browser in `localStorage`, keyed by user id.
  - Stores **the number only**: never the customer, and never the mobile that found it. Contrast
    [239](239-the-lookup-remembers-the-last-five-members-you-found.md)'s `sessionStorage` ruling,
    which was for a loyalty key, a PII value. A delivery number is an identifier.
  - The store is parsed defensively: a malformed store reads as an empty list.
- **Go to.** Every screen the operator can open, read from the **same** `useVisibleMenu` result the
  rail draws, so the palette and the nav can never disagree.
- **Jump to number.** A typed number yields *Open delivery N* and *Open document N* rows that
  navigate straight to the existing routes. The destination page answers not-found or denied. There
  is no read.
- **Live search** (owner chose it over numbers-only). A debounced server search that lists matching
  deliveries with their status, as in the prototype.
  - **It matches on:** delivery, document and order number, exact or by prefix, and **customer
    mobile**, exact or by suffix.
  - **Never by customer name.** That is the heaviest read and the fuzziest PII match.
  - **Which read backs it is open:** [What read backs the palette's live delivery search](374-what-read-backs-the-palettes-live-delivery-search.md).

No **app-level actions** (toggle theme, switch store, sign out) in v1. They were offered and not
picked.

### 2. Permission gating — a row follows the grant of the screen it leads to

The owner asked to make sure search reaches only people with access. The rule as locked:

| Group | Shown when |
|---|---|
| This screen | The page is mounted, so the page's own gate already passed |
| Recent | Re-filtered by the **current** grants on every open, so a revoked grant hides the history too |
| Go to | `useVisibleMenu`, the same probes the rail uses |
| Jump to number | `canOpenDetail`, because it lands on Delivery details |
| Live search | `canOpenList` **and** `canOpenDetail`: it is a list read, and every hit opens a detail |

- Pending or errored probes **fail closed**: the group is hidden until the probe confirms.
- The palette only hides. The server's grant filters (`OmsListGrantEndpointFilter`,
  `OmsDetailGrantEndpointFilter`) stay the real boundary.

### 3. How a feature adds commands — a core registry plus layout groups

- **`@/core/commands`** owns the palette UI (graduated from `features/callcenter/console/CommandPalette.tsx`
  plus `highlight.ts`) and a **registry**.
- A Page calls **`useCommands([...])`** while mounted, and it unregisters on unmount. That is the
  whole "This screen" group, and it lets commands see page state such as the selected row.
- **`layout/` composes the app-wide groups** (Go to, Jump, Search, Recent). It is the composition
  root and may import a feature's API, as `menu-model.ts` already does.
- Features never import each other.

### 4. Refused acts — a disabled row with its reason

A registered action that the page would refuse right now shows **greyed out, carrying the same
reason as its button's tooltip**. `Enter` on it does nothing. This makes the call center's ruling
192 app-wide: the palette answers a question the operator asked, and an absent row teaches nothing.
A command's enablement is the page's handler being present, never a second predicate in the palette.

### 5. The call center joins the one palette

- The console registers its offers, order verbs and two terminal acts as its "This screen" rows
  through `useCommands`. Its `palette-model.ts` becomes that registration, not a second palette.
- The core palette gains a generic **`terminal` flag**: such a row sorts last and is never
  auto-highlighted. Ruling 192's safety rule (*Place order* and *Abandon call* are never one
  mistyped `Enter` away) survives as a property any screen can use.
- The palette is **hosted at `ProtectedLayout`**, so chromeless routes such as `/callcenter` have it.
  The **print routes opt out**.
- Go to, Jump, Search and Recent therefore work from the console too.
- Carried over unchanged:
  - Each open starts with an empty box.
  - The chosen act runs after the dialog has gone.
  - Focus goes back where it came from.
  - `Ctrl+K` is prevented and inert while any `<dialog>` is open.
  - The foot hints are the cheat sheet. Key placement is [365](365-keyboard-shortcuts-that-work-for-everyone.md)'s.
