---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: open
blocked-by: 374
---

# 376 — What the palette's live search matches on and shows

## Question

[What read backs the palette's live delivery search](374-what-read-backs-the-palettes-live-delivery-search.md)
found that no existing read serves [364](364-what-the-command-palette-holds.md)'s live search
cheaply. It priced a new BackOffice read, `DeliveryQuickFind`
([research](assets/374-palette-search-read.RESEARCH.md)). Three owner calls follow from it:

- **Drop the mobile suffix?** The research recommends **exact mobile across its stored formats**
  (`05…` / `9665…` / `+9665…`), which is one plain index. Suffix matching would need a `REVERSE()`
  column on 20.9M rows, and a 4-digit suffix matches about 2,000 strangers. This amends 364's
  "exact or by suffix".
- **Does a hit show the customer's name?** The prototype labels each hit `deliveryNo · name`, and
  364 ruled only that search never *matches* on name. The default in the research is no name, and
  no phone echoed.
- **Does live search ship with the keyboard-layer step, or after it?** It is blocked on a
  BackOffice route and two DBA-run indexes. Jump to number covers exact numbers with no read in the
  meantime.
