---
type: wayfinder-ticket
wayfinder: grilling
map: 580
status: done
blocked-by: 583, 584
---

# 588 — How the screens move onto the shared controls

## Question

Token values restyle colours everywhere, but shape and size live in each screen's own class
strings (583's inventory). **How do the 95 screens pick up the new controls?**

Options to weigh against 583's buckets:

- **Extract first.** Add the missing `core/ui` primitives (Input, Select, Textarea, Field with
  label and hint, IconButton, Chip), restyle them once, then migrate screens onto them. Slower to
  start; the next theme change is one file.
- **Restyle in place.** Rewrite each screen's class strings to the new look. Faster per screen;
  leaves the same sprawl for next time.
- **Mixed.** Extract only the buckets above some size; restyle the long tail in place.

Also settle: slicing (by screen, by area, by control kind), whether the sweep runs as AFK batches
(`/afk-loop`), what proof each slice carries (drive + screenshot pair, RTL, dark), and what happens
to the 37 drives that assert colours.

## Answer

Resolved 2026-10-26. The owner took the two pivotal calls, both on recommendation; the rest is
settled as recommendations and can be overruled. Evidence:
[583's inventory](assets/583-control-inventory/inventory.md).

**Pivotal (owner):**

1. **Mixed.** Extract the big buckets into `core/ui` and restyle them once:
   - `Input`, `Select`, `Textarea` and a `Field` wrapper (label, hint, error) for the 466 text-like
     fields on 144 class strings. The 302 fields that already use a named constant (`INPUT` copies
     in 20 features, core's `RULE_INPUT`) move first, since they are a one-line change each.
   - `IconButton` (59), `Chip` / toggle, tabs included (72).
   - The 41 outlined look-alikes and the 88 buttons that already carry a Button variant's colours
     move onto `core/ui/Button`. Button itself takes the pill shape.
   - **Restyled in place:** the long tail of 42 one-offs, 31 row or tile pickers, 25 grid-cell
     actions, 56 text-style buttons (they become underlined links per 585 where they navigate) and
     5 menu items, which already sit on the overlay recipe.
2. **Colours first, shapes follow.** The first release carries tokens (585 light, 586 dark), the
   shell (587), the Button and AG Grid themes and the new primitives, and the whole app turns DMSCO
   in one go. Field shapes stay old until their area is swept, an interim look the owner accepted.
   There is no dual-theme toggle, because one token table carries one palette.

**Settled as recommendations:**

- **Slicing by area, heaviest first, after a primitives slice.** Slice 0 is tokens, shell,
  primitives and the Button and grid themes. Then one ticket per area: campaigns, collection,
  call center, admin, OMS, loyalty, nphies, reports, and the rest. Inside an area, the screen with
  the most controls goes first (`campaigns/workspace` 92, `collection/inquiry` 74,
  `callcenter/console` 70, `admin/sync-console` 48).
- **Prototype folders (`__prototype__`, 78 controls) are not swept.** They are throwaway by rule.
- **AFK.** Slice 0 and the first area are driven by hand. Once the pattern holds, the remaining
  areas run as an `/afk-loop` batch.
- **Proof per slice:** `typecheck` plus the four lint gates, then light and dark screenshots of
  the area's heaviest screen, plus one RTL screenshot. A sweep slice changes no behaviour, so its
  existing drives must stay green unchanged except for colour assertions.
- **The drives that assert colours** (38 match a colour probe today). An assertion that pins a
  literal hex retires in favour of the contrast gate, which already owns token values. An
  assertion that checks a role (danger ink, gold cursor) is rewritten to read the token
  (`getComputedStyle(...).getPropertyValue('--danger')`) rather than a hex. Slice 0 carries this.
- **Empty, loading and error states** keep today's patterns and line icons, and they take the
  tokens. No Figma call is spent on the empty Team Dashboard frame.
- **Illustrations are out of scope** (map 580's Out of scope).
