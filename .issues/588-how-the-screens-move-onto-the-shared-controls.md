---
type: wayfinder-ticket
wayfinder: grilling
map: 580
status: open
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
