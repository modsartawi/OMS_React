# HITL — 490 (each track has its own Did not go to plan row)

## Q: How are the two rows laid out and captioned?
**Decision taken:** one "Did not go to plan" section (the band's slot and heading unchanged) holding two rows, Delivery then Pick-up, each captioned with the existing `lane.delivery` / `lane.pickUp` key ("Delivery" / "Pick-up", "توصيل" / "استلام") as an `h3`; each row is a `role="group"` named by the band heading + the track, so a screen reader never confuses it with the lane of the same name. No new locale keys.
**Why:** the ticket's Boundaries say the row captions reuse 489's "Delivery" / "Pick-up"; the till captions its rows "DID NOT GO TO PLAN · DELIVERY" — the section heading + row caption reads the same.
**Revisit if:** the owner wants two separate bands each with the full till caption.

## Q: Does the Pick-up row's Close requested line up under the Delivery row's Close requested?
**Decision taken:** No — the Pick-up row's shown tiles pack from the reading start on the same 5-column grid (so at zero its two tiles sit in columns 1-2, not 4-5).
**Why:** same call 489 made for the lanes; the till's Row widget packs too, and a gap of three empty columns reads as missing data.
**Revisit if:** the owner wants same-miss columns aligned across the rows for comparison (a `col-start` per miss).

## Q: Does a negative pick-up Returned back / Rejected / Rescheduled show?
**Decision taken:** Yes — "hidden when 0 or absent, shown when not zero" is read literally (`hasFigure && !== 0`).
**Why:** bad data stays visible; a negative count is worse data still.
**Revisit if:** never expected from the server; harmless.

## Q: The store-wide Avg hand-over — any change needed so it does not read as Delivered + Picked up?
**Decision taken:** no UI change: 489 already made it its own tile after the Delivered | Picked up pair, caption "Avg hand-over", no note; the "Delivered + picked up" note sits only inside the Handed over tile. The drive now asserts that. The model's two doc comments on `avgHandOverMinutes` were updated to the 2659 meaning (pick-up timed to Made ready).
**Why:** the brief says "same field, no code change", keep the caption.
**Revisit if:** the owner finds "hand-over" itself misleading now that a pick-up stops at Made ready (a caption change en + ar, and the table header `table.avgHandOver`).

## Review notes (not acted on, by ruling)
- /code-review flagged that a 2658/older server now shows only dashes in the misses band although store-wide `misses` was sent — by design (the ticket: "the old single store-wide misses band goes"; store-wide misses live in 491's All view).
- /code-review flagged hiding an absent pick-up Rejected as hiding "no data" — by design (brief: "Hide them too when the server did not send them").
