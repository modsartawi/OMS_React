# HITL-381 — unattended decisions, ticket 381 (palette B + IBM Plex)

## Q: Does 381 turn `--sidebar*` navy/gold, or leave that to 385's rename?
**Decision taken:** 381 sets the 362 §2 values (navy rail, gold active, `--sidebar-muted`), under the `--sidebar*` names. Because that makes today's light-sidebar shell navy, 381 also moves the consumers it would break: the two group-label inks in `AppShell` → `text-sidebar-muted`, a gold focus ring inside the sidebar (`[--ring:var(--gold)]`), `text-sidebar-active` link ink in `LoginPage` and `ua-admin/cards.ts` → `text-primary`, and `CustomerRail` → `bg-card-2`.
**Why:** 381 says "every value is in 362 §1 and §2", and its gate must pass 362 §7's pairs (gold on `--sidebar` at 4.5, `--foreground` on the rail dropped). That is only possible with a navy `--sidebar`. 362's approved captures show exactly this navy sidebar on today's shell. Leaving the consumers would ship gold link ink at 1.56:1 and a navy call-center rail with dark ink.
**Revisit if:** the owner wanted the navy rail to appear only with 385's new shell. In that case, revert the six `--sidebar*` values and move the gold/rail pairs to 385. The consumer moves are still correct, because 385 lists them as "before the token turns gold".

## Q: The grid's `fontFamily` param is 382's (F8), but 381 removes Inter. Who changes it?
**Decision taken:** 381 changes only `fontFamily` to `'var(--font-sans)'`. Every other F8 param (26/28 heights, 11.5 header, `--grid-head`, radius 8, pinned border) and the cursor bar stay 382's.
**Why:** The param was a hard-coded `'Inter', 'Readex Pro'` literal. With those files removed, the grid would fall back to system-ui. 381's drive must also show that a painted cell resolves to Plex.
**Revisit if:** 382 wanted to own that line. It is a one-line overlap, and 382 finds it already done.

## Q: Does the `tabular-nums` rule go now that it is a no-op?
**Decision taken:** Kept the rule, with its comment rewritten. Plex figures are tabular by default, so it is a no-op under Plex. It still keeps a fallback face aligned while Plex loads. `[data-numeric]` stays as a marker.
**Why:** It is the conservative reading of "becomes a no-op", and it has zero visual effect under Plex.
**Revisit if:** a reviewer wants dead CSS removed. Deleting the rule is safe.

## Q: Hand-rolled pill buttons outside `core/ui/Button` (the GridToolbar on Deliveries, BroadcastCompose, the login buttons)?
**Decision taken:** Left as they are. Only `core/ui/Button` drops `rounded-full`, as the ticket's spine names. The drive's "not pills" check runs on Details' command bar, which is all `core/ui/Button`.
**Why:** Scope. S3 redraws the Deliveries list. The login page is out of 362's scope. The 391 sweep owns the other screens.
**Revisit if:** the owner reads "buttons drop the pill" as app-wide in S1. In that case it is a sweep item for 391.

## Q: `--shadow-pop` / `--backdrop` (listed in spec F5's new tokens)?
**Decision taken:** Not added in 381. The ticket's own token list omits them, and 388 (the overlay recipe) consumes them.
**Why:** Ticket text over spec summary. No consumer exists in 381.
**Revisit if:** 388 expected them to exist already. Adding them is a two-line token add plus bridge lines.

## Q: Dialogs drop from 10px to 8px under the new `--radius` (Modal uses `rounded-lg`) — fix here?
**Decision taken:** Left as it is. F7's 10px dialogs belong to 388's overlay recipe ("a `Modal` computes … the 10px radius"). Until 388 lands, dialogs are 8px. The `--radius` comment says so.
**Why:** The ticket names the radius token and Button. The dialog recipe is 388's.
**Revisit if:** S1 is ever merged without 388.

## Q: Review findings left as judgement calls (standards-review, code-review)
**Decision taken:**
- The gold and navy hexes stay literal in each token, not aliased (`--cursor: var(--sidebar)` and the like). This mirrors 362's table one row per token, and an alias would couple the cursor to a token 385 renames.
- `[--ring:var(--gold)]` stays on the sidebar `<aside>`; 385 replaces that element.
- "rail" stays as the spec's (F5) word for the navigation band.
- The new `--cursor` / `--grid-head*` / `--gold-foreground` tokens are declared and gated now, as the ticket lists them, and 382 consumes them.
- CustomerRail on `--card-2` follows 362's ruling.
- IdentityBand's dark slab beside the navy rail is handed to 402 (362's finding).
**Why:** Each one is either ruled by a governing ticket or owned by a later slice.
**Revisit if:** the owner wants the brand hexes aliased, or a rail glossary entry before 385.
